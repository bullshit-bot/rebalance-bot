import type { Allocation, Portfolio, TradeOrder } from "@/types/index";
import { env } from "@config/app-config";
import { calcProportionalDCA, calcSingleTargetDCA } from "@dca/dca-allocation-calculator";
import { eventBus } from "@events/event-bus";
import { getExecutor } from "@executor/index";
import { simpleEarnManager } from "@exchange/simple-earn-manager";
import { portfolioTracker } from "@portfolio/portfolio-tracker";
import { strategyManager } from "@rebalancer/strategy-manager";
import { STABLECOINS } from "@rebalancer/trade-calculator";
import { trendFilter } from "@rebalancer/trend-filter";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Min % change in portfolio value to be considered a deposit (not price noise). */
const DEPOSIT_THRESHOLD_PCT = 1;

/** Cooldown between consecutive deposit detections (ms). */
const DEPOSIT_COOLDOWN_MS = 60_000;

/** Fallback DCA amount when no strategy config is active. */
const FALLBACK_DCA_AMOUNT = 20;

// ─── DCAService ───────────────────────────────────────────────────────────────

/**
 * Smart DCA (Dollar-Cost Averaging) service.
 * Monitors portfolio:update events to detect new deposits and suggests
 * optimal buy orders that prioritise the most underweight assets first.
 *
 * When dcaRebalanceEnabled is true in the active strategy config, the full
 * deposit is concentrated on the single most underweight asset instead of
 * being spread proportionally.
 */
class DCAService {
  /** Total portfolio USD value from the previous portfolio:update snapshot */
  private previousTotalValue = 0;

  /** Timestamp of the last detected deposit — used for cooldown gating */
  private lastDepositAt = 0;

  /** Whether the service is actively listening for portfolio updates */
  private running = false;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Start monitoring portfolio:update events for deposit detection. */
  start(): void {
    if (this.running) return;
    this.running = true;
    eventBus.on("portfolio:update", this.onPortfolioUpdate);
    console.log("[DCAService] Started — monitoring portfolio for deposits");
  }

  /** Stop monitoring and reset internal state. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    eventBus.off("portfolio:update", this.onPortfolioUpdate);
    this.previousTotalValue = 0;
    console.log("[DCAService] Stopped");
  }

  /**
   * Calculate optimal DCA allocation orders for a new deposit.
   *
   * Routing logic:
   *  - dcaRebalanceEnabled=true → full deposit goes to most underweight asset
   *  - dcaRebalanceEnabled=false (default) → proportional split across underweights
   *
   * Returns buy TradeOrder[] — caller decides whether to execute.
   */
  calculateDCAAllocation(
    depositAmount: number,
    portfolio: Portfolio,
    targets: Allocation[]
  ): TradeOrder[] {
    const minTradeUsd = env.MIN_TRADE_USD;

    // Bear mode guard: when trend filter is enabled and market is bearish,
    // do not route DCA into crypto — hold deposit as cash
    const gs = strategyManager.getActiveConfig()?.globalSettings as
      | Record<string, unknown>
      | undefined;
    if (gs?.trendFilterEnabled) {
      const maPeriod = typeof gs.trendFilterMA === "number" ? gs.trendFilterMA : 100;
      const buffer = typeof gs.trendFilterBuffer === "number" ? gs.trendFilterBuffer : 2;
      if (!trendFilter.isBullish(maPeriod, buffer)) {
        console.log("[DCAService] Bear market detected — DCA deposit held as cash, no crypto buys");
        return [];
      }
    }

    // DCA rebalance routing
    if (gs?.dcaRebalanceEnabled) {
      // When crypto holdings are small, distribute proportionally to build initial positions
      const cryptoValue = portfolio.assets
        .filter((a) => !STABLECOINS.has(a.asset))
        .reduce((sum, a) => sum + a.valueUsd, 0);

      const configDcaAmount =
        typeof gs.dcaAmountUsd === "number" ? gs.dcaAmountUsd : FALLBACK_DCA_AMOUNT;
      if (cryptoValue < configDcaAmount) {
        // Not enough crypto to compare ratios — spread proportionally
        console.log(
          `[DCAService] Crypto $${cryptoValue.toFixed(0)} < configured DCA $${configDcaAmount} — proportional mode`
        );
        const orders = calcProportionalDCA(depositAmount, portfolio, targets, minTradeUsd);
        if (orders.length > 0) return orders;
      }

      // Enough crypto to compare — concentrate on most underweight asset
      const dcaTarget = strategyManager.getDCATarget(portfolio, targets);
      if (dcaTarget !== null) {
        return calcSingleTargetDCA(dcaTarget, depositAmount, portfolio, targets, minTradeUsd);
      }

      console.log("[DCAService] Rebalance mode: portfolio crypto is balanced — no DCA needed");
      return [];
    }

    // Default (proportional mode): spread across all underweight assets
    const orders = calcProportionalDCA(depositAmount, portfolio, targets, minTradeUsd);
    if (orders.length === 0) {
      console.log("[DCAService] Portfolio is balanced — no DCA orders needed");
    }
    return orders;
  }

  /**
   * Scheduled DCA: buy $amount worth of the most underweight asset.
   * Called by cron scheduler daily — does not depend on deposit detection.
   * In paper mode, logs the order but doesn't execute.
   */
  async executeScheduledDCA(amountUsd?: number): Promise<TradeOrder[]> {
    const portfolio = portfolioTracker.getPortfolio();
    if (!portfolio) {
      console.log("[DCAService] Scheduled DCA skipped — portfolio not ready");
      return [];
    }

    const targets = await portfolioTracker.getTargetAllocations();
    const configAmount = (
      strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined
    )?.dcaAmountUsd as number | undefined;
    const amount = amountUsd ?? configAmount ?? FALLBACK_DCA_AMOUNT;
    const orders = this.calculateDCAAllocation(amount, portfolio, targets);

    if (orders.length > 0) {
      console.log(`[DCAService] Scheduled DCA: $${amount} →`);
      for (const order of orders) {
        console.log(`  BUY ${order.amount.toFixed(6)} ${order.pair} on ${order.exchange}`);
      }
      // Execute via paper/live executor
      try {
        const executor = getExecutor();
        const results = await executor.executeBatch(orders);
        console.log(`[DCAService] DCA executed: ${results.length} orders`);
      } catch (err) {
        console.error(
          "[DCAService] DCA execution failed:",
          err instanceof Error ? err.message : err
        );
      }

      // After successful DCA execution, subscribe idle balances to Earn
      const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined;
      if (gs?.simpleEarnEnabled) {
        try {
          const targetAssets = orders.map((o) => o.pair.split("/")[0]!);
          await simpleEarnManager.subscribeAll(targetAssets);
          console.log("[DCAService] Subscribed idle balances to Earn");
        } catch (err) {
          console.error("[DCAService] Earn subscribe failed (non-critical):", err instanceof Error ? err.message : err);
        }
      }
    } else {
      console.log(`[DCAService] Scheduled DCA: $${amount} — no orders (balanced or bear)`);
    }

    return orders;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Handles each portfolio:update event.
   *
   * Heuristic deposit detection:
   *  - Skips the very first update (establishes baseline).
   *  - Only considers increases > MIN_TRADE_USD AND > DEPOSIT_THRESHOLD_PCT of portfolio.
   *  - Applies a cooldown window to avoid duplicate detections.
   *
   * Note: price-driven increases can reach 1% on volatile days, so this is a
   * suggestion-only signal — the caller / operator confirms before executing.
   */
  private readonly onPortfolioUpdate = (portfolio: Portfolio): void => {
    // Skip incomplete portfolio data (e.g. only USDT loaded, crypto prices pending)
    if (portfolio.totalValueUsd < 100) return;

    if (this.previousTotalValue === 0) {
      this.previousTotalValue = portfolio.totalValueUsd;
      console.log(
        `[DCAService] Baseline portfolio value set: $${portfolio.totalValueUsd.toFixed(2)}`
      );
      return;
    }

    const diff = portfolio.totalValueUsd - this.previousTotalValue;

    if (diff <= 0) {
      this.previousTotalValue = portfolio.totalValueUsd;
      return;
    }

    const diffPct = (diff / this.previousTotalValue) * 100;
    const minTradeUsd = env.MIN_TRADE_USD;
    const now = Date.now();
    const cooldownElapsed = now - this.lastDepositAt > DEPOSIT_COOLDOWN_MS;
    const isLikelyDeposit =
      diff > minTradeUsd && diffPct > DEPOSIT_THRESHOLD_PCT && cooldownElapsed;

    if (isLikelyDeposit) {
      this.lastDepositAt = now;
      console.log(
        `[DCAService] Possible deposit detected: +$${diff.toFixed(2)} (+${diffPct.toFixed(2)}%)`
      );

      portfolioTracker
        .getTargetAllocations()
        .then((targets) => {
          const orders = this.calculateDCAAllocation(diff, portfolio, targets);
          if (orders.length === 0) {
            console.log("[DCAService] Portfolio balanced — no DCA suggestions");
          } else {
            console.log(`[DCAService] Suggested DCA orders for $${diff.toFixed(2)} deposit:`);
            for (const order of orders) {
              console.log(
                `  BUY ${order.amount.toFixed(6)} ${order.pair} on ${order.exchange} (market)`
              );
            }
          }
        })
        .catch((err: unknown) => {
          console.error("[DCAService] Failed to fetch target allocations:", err);
        });
    }

    this.previousTotalValue = portfolio.totalValueUsd;
  };
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const dcaService = new DCAService();

export { DCAService };
