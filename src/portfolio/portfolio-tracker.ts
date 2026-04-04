import type { Allocation, ExchangeName, Portfolio, PortfolioAsset } from "@/types/index";
import { AllocationModel } from "@db/database";
import { eventBus } from "@events/event-bus";
import { simpleEarnManager } from "@exchange/simple-earn-manager";
import { priceCache } from "@price/price-cache";
import { strategyManager } from "@rebalancer/strategy-manager";
import { trendFilter } from "@rebalancer/trend-filter";

// ─── Local interface ───────────────────────────────────────────────────────────

/** Minimal CCXT Pro Exchange interface — avoids importing the broken ccxt.pro namespace. */
interface CcxtProExchange {
  watchBalance?(): Promise<Record<string, unknown>>;
  fetchBalance?(): Promise<Record<string, unknown>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum drift percentage that triggers a drift:warning event */
const REBALANCE_THRESHOLD = Number(process.env.REBALANCE_THRESHOLD ?? "5");

// ─── Dependency injection interfaces ─────────────────────────────────────────

export interface IPriceCacheDepPT {
  getBestPrice(pair: string): number | undefined;
}

export interface IEventBusDepPT {
  emit(event: string, data?: unknown): void;
}

export interface PortfolioTrackerDeps {
  priceCache: IPriceCacheDepPT;
  eventBus: IEventBusDepPT;
}

// ─── PortfolioTracker ─────────────────────────────────────────────────────────

/**
 * Tracks real-time portfolio balances across all connected exchanges.
 * Subscribes to CCXT Pro watchBalance streams, aggregates holdings,
 * prices via PriceCache, and emits portfolio:update / drift:warning events.
 *
 * Accepts optional deps for dependency injection in tests.
 */
class PortfolioTracker {
  private readonly deps: PortfolioTrackerDeps;

  constructor(deps?: Partial<PortfolioTrackerDeps>) {
    this.deps = {
      priceCache: deps?.priceCache ?? priceCache,
      eventBus: deps?.eventBus ?? eventBus,
    };
  }
  /** exchange name → (asset symbol → amount) */
  private readonly balances: Map<ExchangeName, Map<string, number>> = new Map();

  /** Latest computed portfolio state */
  private portfolio: Portfolio | null = null;

  /** AbortController per exchange — cancels the watch loop on stopWatching() */
  private readonly controllers: Map<string, AbortController> = new Map();

  /** Whether any watch loops are active */
  private watching = false;

  /** Timestamp (ms) of the last DB write for this tracker — throttle to once per 60s */
  private lastSnapshotAt = 0;

  /** Cached target allocations to avoid DB round-trip on every balance tick */
  private cachedTargets: import("@/types/index").Allocation[] | null = null;

  /** Timestamp (ms) of last successful portfolio recalculation */
  private lastUpdateTime = 0;

  /** Earn balances: asset → amount in Flexible Earn (merged into portfolio totals) */
  private earnBalanceCache: Map<string, number> = new Map();

  /** Interval handle for polling earn balances */
  private earnPollInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start watching balances on all provided exchanges concurrently.
   * Each exchange gets its own long-running watchBalance loop.
   */
  async startWatching(exchanges: Map<ExchangeName, CcxtProExchange>): Promise<void> {
    if (this.watching) return;
    this.watching = true;

    for (const [name, exchange] of exchanges) {
      const controller = new AbortController();
      this.controllers.set(name, controller);
      // Fire and forget — errors are caught inside watchBalance
      this.watchBalance(exchange, name, controller.signal).catch((err: unknown) => {
        console.error(`[PortfolioTracker] watchBalance loop error on ${name}:`, err);
      });
    }

    // Start earn balance polling when simpleEarnEnabled is active
    this.startEarnPolling();
  }

  /** Stop all watch loops and clean up. */
  async stopWatching(): Promise<void> {
    this.watching = false;
    for (const [name, controller] of this.controllers) {
      controller.abort();
      this.controllers.delete(name);
    }
    // Stop earn polling
    if (this.earnPollInterval !== null) {
      clearInterval(this.earnPollInterval);
      this.earnPollInterval = null;
    }
  }

  /**
   * Start polling Flexible Earn balances every 30s.
   * Only active when simpleEarnEnabled is true in global settings.
   */
  private startEarnPolling(): void {
    const EARN_POLL_INTERVAL = 30_000;

    this.earnPollInterval = setInterval(() => {
      const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined;
      if (!gs?.simpleEarnEnabled) return;

      simpleEarnManager.getEarnBalanceMap()
        .then((map) => {
          this.earnBalanceCache = map;
          // Trigger a portfolio recalculate to include updated earn balances
          this.recalculate();
        })
        .catch((err: unknown) => {
          console.error("[PortfolioTracker] Earn balance poll failed:", err instanceof Error ? err.message : err);
        });
    }, EARN_POLL_INTERVAL);
  }

  /** Returns the most recently calculated portfolio, or null if not yet ready. */
  getPortfolio(): Portfolio | null {
    return this.portfolio;
  }

  /** Returns the timestamp (ms) of the last successful portfolio recalculation. */
  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  /** Clears cached allocations — used for test isolation. */
  clearCache(): void {
    this.cachedTargets = null;
    this.lastSnapshotAt = 0;
  }

  /** Clear Earn balance cache — call after Earn redeem/subscribe to force fresh data. */
  clearEarnCache(): void {
    this.earnBalanceCache.clear();
  }

  /**
   * Loads target allocation config from the database.
   * Results are cached; a fresh DB query is issued at most once every 60 seconds
   * to avoid a DB round-trip on every balance tick.
   * Maps DB rows to the application-level Allocation type.
   */
  async getTargetAllocations(): Promise<Allocation[]> {
    const now = Date.now();
    const CACHE_TTL_MS = 60_000;

    if (this.cachedTargets !== null && now - this.lastSnapshotAt < CACHE_TTL_MS) {
      return this.cachedTargets;
    }

    const rows = await AllocationModel.find().lean();
    const result = rows.map((row): Allocation => {
      const base = {
        asset: row.asset,
        targetPct: row.targetPct,
        minTradeUsd: row.minTradeUsd ?? 10,
      };
      // exchange is optional on Allocation — only include if present in DB
      return row.exchange ? { ...base, exchange: row.exchange as ExchangeName } : base;
    });

    this.cachedTargets = result;
    this.lastSnapshotAt = now;
    return result;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Long-running loop that calls exchange.watchBalance() repeatedly.
   * On each balance delta: updates internal state and triggers recalculate().
   * Loop exits when the AbortSignal fires or the exchange throws a permanent error.
   */
  private async watchBalance(
    exchange: CcxtProExchange,
    name: ExchangeName,
    signal: AbortSignal
  ): Promise<void> {
    // Bun runtime doesn't support ws 'upgrade' event needed by CCXT Pro watchBalance.
    // Use REST fetchBalance polling at 10s interval — reliable on both testnet and mainnet.
    // Price feeds still use WebSocket (public streams work fine in Bun).
    const POLL_INTERVAL = 5_000;

    if (!exchange.fetchBalance) {
      console.error(`[PortfolioTracker] Exchange ${name} has no fetchBalance — skipping`);
      return;
    }

    console.info(`[PortfolioTracker] Polling balance on ${name} every ${POLL_INTERVAL / 1000}s`);

    while (!signal.aborted) {
      try {
        const balanceResponse = await exchange.fetchBalance();
        this.processBalanceResponse(balanceResponse, name);
      } catch (err: unknown) {
        if (signal.aborted) break;
        console.error(
          `[PortfolioTracker] fetchBalance error on ${name}:`,
          err instanceof Error ? err.message : err
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  /** Extract free balances from CCXT response and trigger recalculate. */
  private processBalanceResponse(
    balanceResponse: Record<string, unknown>,
    name: ExchangeName
  ): void {
    const snapshot = new Map<string, number>();
    for (const [rawAsset, data] of Object.entries(balanceResponse)) {
      if (typeof data === "object" && data !== null && "free" in data) {
        const free = Number((data as { free: unknown }).free);
        if (!isNaN(free) && free > 0) {
          // Skip LD-prefixed assets (Binance Earn/Flexible Deposit)
          // Earn balances are handled separately by SimpleEarnManager
          if (rawAsset.startsWith("LD")) continue;
          const existing = snapshot.get(rawAsset);
          snapshot.set(rawAsset, (existing ?? 0) + free);
        }
      }
    }

    console.debug(`[PortfolioTracker] processBalance: ${snapshot.size} assets from ${name}: ${JSON.stringify(Object.fromEntries(snapshot))}`);
    this.balances.set(name, snapshot);
    const rawBalances: Record<string, number> = Object.fromEntries(snapshot);
    this.deps.eventBus.emit("balance:update", { exchange: name, balances: rawBalances });
    this.recalculate();
  }

  /**
   * Recalculates the full Portfolio from current balances and cached prices.
   * Loads target allocations from DB, computes drift, and emits events.
   * Runs synchronously after each balance update; DB query is fire-and-forget
   * to avoid blocking the event loop.
   */
  private recalculate(): void {
    // Aggregate all balances across exchanges into asset totals
    const assetTotals = new Map<string, { amount: number; exchange: ExchangeName }>();

    for (const [exchangeName, exchangeBalances] of this.balances) {
      for (const [asset, amount] of exchangeBalances) {
        const existing = assetTotals.get(asset);
        if (existing) {
          // Accumulate amounts; keep the exchange of whichever has more value
          existing.amount += amount;
        } else {
          assetTotals.set(asset, { amount, exchange: exchangeName });
        }
      }
    }

    // Merge Flexible Earn balances into totals when simpleEarnEnabled
    const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined;
    if (gs?.simpleEarnEnabled && this.earnBalanceCache.size > 0) {
      for (const [asset, earnAmount] of this.earnBalanceCache) {
        const existing = assetTotals.get(asset);
        if (existing) {
          existing.amount += earnAmount;
        } else {
          // Earn-only holding — attribute to binance as default exchange
          assetTotals.set(asset, { amount: earnAmount, exchange: "binance" });
        }
      }
    }

    if (assetTotals.size === 0) {
      console.debug("[PortfolioTracker] recalculate: no asset totals, skipping");
      return;
    }

    // Resolve USD value for each asset using PriceCache
    const assetValues = new Map<
      string,
      { amount: number; valueUsd: number; exchange: ExchangeName }
    >();
    let totalValueUsd = 0;

    for (const [asset, { amount, exchange }] of assetTotals) {
      let valueUsd: number;

      // Stablecoins and USD-denominated assets are priced at 1:1
      if (["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"].includes(asset)) {
        valueUsd = amount;
      } else {
        const price =
          this.deps.priceCache.getBestPrice(`${asset}/USDT`) ??
          this.deps.priceCache.getBestPrice(`${asset}/USD`) ??
          this.deps.priceCache.getBestPrice(`${asset}/USDC`);

        if (price === undefined || price === 0) continue; // skip assets with no price data
        valueUsd = amount * price;

        // Feed BTC price into trend filter for MA calculation
        if (asset === "BTC" && price > 0) trendFilter.recordPrice(price);
      }

      assetValues.set(asset, { amount, valueUsd, exchange });
      totalValueUsd += valueUsd;
    }

    if (totalValueUsd === 0) {
      console.debug("[PortfolioTracker] recalculate: totalValueUsd=0, skipping");
      return;
    }
    console.debug(`[PortfolioTracker] recalculate: $${totalValueUsd.toFixed(2)}, ${assetValues.size} assets`);

    // Load target allocations async — use cached targets if available
    this.loadAndBuildPortfolio(assetValues, totalValueUsd);
  }

  /**
   * Fetches target allocations from DB, builds PortfolioAsset list,
   * and emits portfolio:update + drift:warning events.
   */
  private loadAndBuildPortfolio(
    assetValues: Map<string, { amount: number; valueUsd: number; exchange: ExchangeName }>,
    _totalValueUsd: number
  ): void {
    // Run async DB fetch without blocking; result is handled in the callback
    this.getTargetAllocations()
      .then((targets) => {
        const targetMap = new Map<string, number>();
        for (const alloc of targets) {
          targetMap.set(alloc.asset, alloc.targetPct);
        }

        // Include assets with a target allocation OR quote stablecoins (USDT/USDC)
        // that represent cash holdings. Exclude non-target, non-quote assets
        // (e.g. DAI stuck on testnet) that inflate totalValueUsd and distort drift %
        const quoteAssets = new Set(["USDT", "USDC"]);
        const targetAssetValues = new Map<
          string,
          { amount: number; valueUsd: number; exchange: ExchangeName }
        >();
        let targetTotalUsd = 0;
        for (const [asset, data] of assetValues) {
          if (targetMap.has(asset) || quoteAssets.has(asset)) {
            targetAssetValues.set(asset, data);
            targetTotalUsd += data.valueUsd;
          }
        }

        if (targetTotalUsd === 0) return;

        // Compute crypto-only total for percentage calculation (exclude stablecoins)
        let cryptoOnlyUsd = 0;
        for (const [asset, data] of targetAssetValues) {
          if (!quoteAssets.has(asset)) cryptoOnlyUsd += data.valueUsd;
        }
        const pctDenominator = cryptoOnlyUsd > 0 ? cryptoOnlyUsd : targetTotalUsd;

        const assets: PortfolioAsset[] = [];

        for (const [asset, { amount, valueUsd, exchange }] of targetAssetValues) {
          // Crypto assets: % relative to crypto-only total
          // Stablecoins: % relative to full total (shows cash proportion)
          const currentPct = quoteAssets.has(asset)
            ? (valueUsd / targetTotalUsd) * 100
            : (valueUsd / pctDenominator) * 100;
          const targetPct = targetMap.get(asset) ?? 0;
          const driftPct = currentPct - targetPct;

          assets.push({ asset, amount, valueUsd, currentPct, targetPct, driftPct, exchange });
        }

        const portfolio: Portfolio = {
          totalValueUsd: targetTotalUsd,
          assets,
          updatedAt: Date.now(),
        };

        this.portfolio = portfolio;
        this.lastUpdateTime = Date.now();
        this.deps.eventBus.emit("portfolio:update", portfolio);

        // Emit drift warnings for any asset exceeding threshold
        for (const asset of assets) {
          if (Math.abs(asset.driftPct) >= REBALANCE_THRESHOLD) {
            this.deps.eventBus.emit("drift:warning", {
              asset: asset.asset,
              currentPct: asset.currentPct,
              targetPct: asset.targetPct,
              driftPct: asset.driftPct,
            });
          }
        }
      })
      .catch((err: unknown) => {
        console.error("[PortfolioTracker] Failed to load target allocations:", err);
      });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const portfolioTracker = new PortfolioTracker();

export { PortfolioTracker };
