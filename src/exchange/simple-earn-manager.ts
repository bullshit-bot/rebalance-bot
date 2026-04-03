import { eventBus } from "@events/event-bus";
import { exchangeManager } from "@exchange/exchange-manager";
import type * as ccxt from "ccxt";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EarnProduct {
  productId: string;
  asset: string;
  latestAnnualPercentageRate?: number;
}

export interface EarnPosition {
  asset: string;
  amount: number;
  productId: string;
  latestAnnualPercentageRate?: number;
}

// CCXT implicit methods require casting through this interface
interface BinanceExchange extends ccxt.Exchange {
  sapiPostSimpleEarnFlexibleSubscribe(params: Record<string, string>): Promise<Record<string, unknown>>;
  sapiPostSimpleEarnFlexibleRedeem(params: Record<string, string>): Promise<Record<string, unknown>>;
  sapiGetSimpleEarnFlexibleList(params: Record<string, unknown>): Promise<{
    data?: { rows?: EarnProduct[] };
    rows?: EarnProduct[];
  }>;
  sapiGetSimpleEarnFlexiblePosition(params: Record<string, unknown>): Promise<{
    data?: { rows?: EarnPosition[] };
    rows?: EarnPosition[];
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum amount to subscribe — avoids dust errors from Binance */
const MIN_SUBSCRIBE_AMOUNT = 0.00001;

/** Product list cache TTL — 1 hour */
const PRODUCT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Position cache TTL — 30 seconds */
const POSITION_CACHE_TTL_MS = 30_000;

// ─── SimpleEarnManager ────────────────────────────────────────────────────────

/**
 * Wraps Binance Simple Earn Flexible API via CCXT implicit methods.
 * All methods are non-throwing — errors are logged and empty/null returned.
 * Earn operations must never block DCA or rebalance flows.
 */
class SimpleEarnManager {
  /** Cached product list: productId → EarnProduct */
  private productCache: Map<string, EarnProduct> = new Map();
  /** Timestamp of last product cache fill */
  private productCacheAt = 0;

  /** Cached flexible positions */
  private positionCache: EarnPosition[] = [];
  /** Timestamp of last position cache fill */
  private positionCacheAt = 0;

  // ─── Exchange access ────────────────────────────────────────────────────────

  /**
   * Returns the first connected Binance exchange as a BinanceExchange.
   * Returns null if no Binance exchange is connected.
   */
  private getBinanceExchange(): BinanceExchange | null {
    const exchange = exchangeManager.getExchange("binance");
    if (!exchange) {
      console.warn("[SimpleEarnManager] No Binance exchange connected");
      return null;
    }
    return exchange as BinanceExchange;
  }

  // ─── Products ───────────────────────────────────────────────────────────────

  /**
   * Fetch all available Flexible Earn products.
   * Results are cached for 1h to avoid hammering the API.
   */
  async getFlexibleProducts(): Promise<EarnProduct[]> {
    const now = Date.now();
    if (this.productCache.size > 0 && now - this.productCacheAt < PRODUCT_CACHE_TTL_MS) {
      return Array.from(this.productCache.values());
    }

    const exchange = this.getBinanceExchange();
    if (!exchange) return [];

    try {
      const resp = await exchange.sapiGetSimpleEarnFlexibleList({ current: 1, size: 100 });
      // Response shape may vary; handle both nested and flat
      const rows: EarnProduct[] = resp?.data?.rows ?? resp?.rows ?? [];

      this.productCache.clear();
      for (const p of rows) {
        if (p.productId && p.asset) {
          this.productCache.set(p.asset, p);
        }
      }
      this.productCacheAt = now;
      return rows;
    } catch (err) {
      console.error("[SimpleEarnManager] getFlexibleProducts failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Look up the productId for a given asset symbol.
   * Returns null if asset has no Flexible Earn product.
   */
  async getProductId(asset: string): Promise<string | null> {
    // Ensure cache is warm
    await this.getFlexibleProducts();
    return this.productCache.get(asset)?.productId ?? null;
  }

  /**
   * Returns a map of asset → APY% from cached product list.
   * Keys are "ASSET/USDT" format for backtest compatibility.
   */
  async getApyMap(): Promise<Record<string, number>> {
    await this.getFlexibleProducts();
    const map: Record<string, number> = {};
    for (const [asset, product] of this.productCache) {
      if (product.latestAnnualPercentageRate != null) {
        map[`${asset}/USDT`] = product.latestAnnualPercentageRate * 100;
      }
    }
    return map;
  }

  // ─── Positions ──────────────────────────────────────────────────────────────

  /**
   * Fetch current Flexible Earn positions for the account.
   * Results are cached for 30s.
   */
  async getFlexiblePositions(): Promise<EarnPosition[]> {
    const now = Date.now();
    if (this.positionCache.length > 0 && now - this.positionCacheAt < POSITION_CACHE_TTL_MS) {
      return this.positionCache;
    }

    const exchange = this.getBinanceExchange();
    if (!exchange) return [];

    try {
      const resp = await exchange.sapiGetSimpleEarnFlexiblePosition({ current: 1, size: 100 });
      const rawRows = resp?.data?.rows ?? resp?.rows ?? [];
      // Binance returns totalAmount as string, normalize to number amount
      const rows: EarnPosition[] = rawRows.map((r: any) => ({
        asset: r.asset,
        amount: Number(r.totalAmount ?? r.amount ?? 0),
        productId: r.productId ?? "",
        latestAnnualPercentageRate: r.latestAnnualPercentageRate != null ? Number(r.latestAnnualPercentageRate) : undefined,
      }));
      this.positionCache = rows;
      this.positionCacheAt = now;
      return rows;
    } catch (err) {
      console.error("[SimpleEarnManager] getFlexiblePositions failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Returns a Map<asset, earnedAmount> from current Flexible positions.
   * Invalidates position cache before fetching to get fresh data.
   */
  async getEarnBalanceMap(): Promise<Map<string, number>> {
    // Force fresh fetch
    this.positionCacheAt = 0;
    const positions = await this.getFlexiblePositions();
    const map = new Map<string, number>();
    for (const p of positions) {
      if (p.asset && p.amount > 0) {
        map.set(p.asset, (map.get(p.asset) ?? 0) + p.amount);
      }
    }
    return map;
  }

  // ─── Subscribe ──────────────────────────────────────────────────────────────

  /**
   * Subscribe `amount` of `asset` to Flexible Earn.
   * Returns true on success, false on failure.
   */
  async subscribe(asset: string, amount: number): Promise<boolean> {
    if (amount < MIN_SUBSCRIBE_AMOUNT) return false;

    const productId = await this.getProductId(asset);
    if (!productId) {
      console.warn(`[SimpleEarnManager] No Flexible Earn product for ${asset}`);
      return false;
    }

    const exchange = this.getBinanceExchange();
    if (!exchange) return false;

    try {
      await exchange.sapiPostSimpleEarnFlexibleSubscribe({
        productId,
        amount: amount.toString(),
      });
      // Invalidate position cache
      this.positionCacheAt = 0;
      eventBus.emit("earn:subscribed", { asset, amount });
      console.log(`[SimpleEarnManager] Subscribed ${amount.toFixed(6)} ${asset} to Flexible Earn`);
      return true;
    } catch (err) {
      console.error(`[SimpleEarnManager] subscribe ${asset} failed:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Redeem `amount` of `asset` from Flexible Earn back to Spot.
   * Returns true on success, false on failure.
   */
  async redeem(asset: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false;

    const productId = await this.getProductId(asset);
    if (!productId) {
      console.warn(`[SimpleEarnManager] No Flexible Earn product for ${asset} — cannot redeem`);
      return false;
    }

    const exchange = this.getBinanceExchange();
    if (!exchange) return false;

    try {
      await exchange.sapiPostSimpleEarnFlexibleRedeem({
        productId,
        amount: amount.toString(),
        destAccount: "SPOT",
      });
      // Invalidate position cache
      this.positionCacheAt = 0;
      eventBus.emit("earn:redeemed", { asset, amount });
      console.log(`[SimpleEarnManager] Redeemed ${amount.toFixed(6)} ${asset} from Earn → Spot`);
      return true;
    } catch (err) {
      console.error(`[SimpleEarnManager] redeem ${asset} failed:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  // ─── Bulk operations ────────────────────────────────────────────────────────

  /**
   * Subscribe idle spot balances for a list of assets.
   * Fetches current spot balance via exchange, then subscribes anything > MIN_SUBSCRIBE_AMOUNT.
   * Non-throwing — logs errors per asset.
   */
  async subscribeAll(assets: string[]): Promise<void> {
    const exchange = this.getBinanceExchange();
    if (!exchange || !exchange.fetchBalance) return;

    let spotBalance: Record<string, unknown>;
    try {
      spotBalance = await exchange.fetchBalance();
    } catch (err) {
      console.error("[SimpleEarnManager] subscribeAll: fetchBalance failed:", err instanceof Error ? err.message : err);
      return;
    }

    for (const asset of assets) {
      try {
        const balanceEntry = spotBalance[asset];
        if (typeof balanceEntry !== "object" || balanceEntry === null) continue;
        const free = (balanceEntry as { free?: number }).free ?? 0;
        if (free >= MIN_SUBSCRIBE_AMOUNT) {
          await this.subscribe(asset, free);
        }
      } catch (err) {
        console.error(`[SimpleEarnManager] subscribeAll: ${asset} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  /**
   * Redeem assets needed for sell orders from Earn back to Spot.
   * Only redeems what's needed (avoids unnecessary full redemption).
   */
  async redeemForRebalance(sellOrders: Array<{ pair: string; amount: number }>): Promise<void> {
    const earnBalances = await this.getEarnBalanceMap();

    for (const order of sellOrders) {
      const asset = order.pair.split("/")[0];
      if (!asset) continue;

      const earnBalance = earnBalances.get(asset) ?? 0;
      if (earnBalance <= 0) continue;

      // Redeem exactly what's needed, or full earn balance if less
      const redeemAmount = Math.min(order.amount, earnBalance);
      if (redeemAmount > MIN_SUBSCRIBE_AMOUNT) {
        await this.redeem(asset, redeemAmount);
      }
    }
  }

  /**
   * Poll spot balance until `expected` amounts are available, or timeout.
   * Used after redemption to confirm funds arrived in Spot before trading.
   */
  async waitForSettlement(
    expected: Map<string, number>,
    timeoutMs = 30_000
  ): Promise<void> {
    const exchange = this.getBinanceExchange();
    if (!exchange || !exchange.fetchBalance || expected.size === 0) return;

    const deadline = Date.now() + timeoutMs;
    const POLL_INTERVAL = 2_000;

    while (Date.now() < deadline) {
      try {
        const spotBalance = await exchange.fetchBalance();
        let allSettled = true;

        for (const [asset, needed] of expected) {
          const balEntry = spotBalance[asset];
          const free =
            typeof balEntry === "object" && balEntry !== null
              ? ((balEntry as { free?: number }).free ?? 0)
              : 0;
          if (free < needed * 0.95) {
            // 5% tolerance for rounding
            allSettled = false;
            break;
          }
        }

        if (allSettled) {
          console.log("[SimpleEarnManager] Settlement confirmed — funds available in Spot");
          return;
        }
      } catch (err) {
        console.warn("[SimpleEarnManager] waitForSettlement poll error:", err instanceof Error ? err.message : err);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    console.warn("[SimpleEarnManager] waitForSettlement timed out — proceeding with available Spot balance");
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const simpleEarnManager = new SimpleEarnManager();
export { SimpleEarnManager };
