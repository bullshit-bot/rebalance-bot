import type { Allocation, Portfolio, TradeOrder } from "@/types/index";
import { env } from "@config/app-config";
import { calcProportionalDCA, calcSingleTargetDCA } from "@dca/dca-allocation-calculator";
import { getExecutor } from "@executor/index";
import { simpleEarnManager } from "@exchange/simple-earn-manager";
import { portfolioTracker } from "@portfolio/portfolio-tracker";
import { strategyManager } from "@rebalancer/strategy-manager";
import { STABLECOINS } from "@rebalancer/trade-calculator";
import { trendFilter } from "@rebalancer/trend-filter";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fallback DCA amount when no strategy config is active. */
const FALLBACK_DCA_AMOUNT = 20;

// ─── DCAService ───────────────────────────────────────────────────────────────

/**
 * DCA (Dollar-Cost Averaging) service.
 * Scheduled daily via cron to buy crypto according to target allocations.
 *
 * When dcaRebalanceEnabled is true: concentrates on most underweight asset.
 * When dcaRebalanceEnabled is false: spreads proportionally.
 */
class DCAService {
  /** Whether the service is actively listening */
  private running = false;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Start DCA service (scheduled DCA only, no deposit detection). */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log("[DCAService] Started");
  }

  /** Stop DCA service. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
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
   * Called by cron scheduler daily.
   */
  async executeScheduledDCA(amountUsd?: number): Promise<TradeOrder[]> {
    const portfolio = portfolioTracker.getPortfolio();
    if (!portfolio) {
      console.log("[DCAService] Scheduled DCA skipped — portfolio not ready");
      return [];
    }

    const targets = await portfolioTracker.getTargetAllocations();
    const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined;
    const configAmount = gs?.dcaAmountUsd as number | undefined;
    const amount = amountUsd ?? configAmount ?? FALLBACK_DCA_AMOUNT;

    // If Earn enabled, redeem USDT from Flexible Earn to fund DCA
    if (gs?.simpleEarnEnabled) {
      const usdtSpot = portfolio.assets.find((a) => a.asset === "USDT")?.amount ?? 0;
      if (usdtSpot < amount) {
        const deficit = amount - usdtSpot + 1; // +$1 buffer for fees
        try {
          await simpleEarnManager.redeem("USDT", deficit);
          console.log(`[DCAService] Redeemed $${deficit.toFixed(2)} USDT from Earn for DCA`);
          // Wait for settlement
          await simpleEarnManager.waitForSettlement(new Map([["USDT", amount]]), 15_000);
        } catch (err) {
          console.warn("[DCAService] USDT redeem failed (will try DCA with available balance):", err instanceof Error ? err.message : err);
        }
      }
    }

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

      // After successful DCA execution, subscribe idle balances to Earn (crypto + USDT)
      if (gs?.simpleEarnEnabled) {
        try {
          const allTargetAssets = [...targets.map((t) => t.asset), "USDT"];
          await simpleEarnManager.subscribeAll(allTargetAssets);
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

}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const dcaService = new DCAService();

export { DCAService };
