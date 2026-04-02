import type { Allocation, ExchangeName, Portfolio, TradeOrder } from "@/types/index";
import { env } from "@config/app-config";
import { priceCache } from "@price/price-cache";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stablecoin symbols treated as cash reserve (not traded as crypto positions). */
export const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"]);

/** Returns true if the asset symbol is a recognized stablecoin / cash asset. */
const isStablecoin = (asset: string): boolean => STABLECOINS.has(asset);

// ─── calculateTrades ──────────────────────────────────────────────────────────

/**
 * Derives the minimal set of TradeOrders needed to bring a portfolio back to
 * its target allocations.
 *
 * Algorithm:
 *  1. Compute USD delta for every asset (currentValue - targetValue).
 *  2. Filter deltas smaller than MIN_TRADE_USD (noise reduction).
 *  3. Sort by absolute delta descending (largest drift first).
 *  4. Emit one TradeOrder per asset — buy if under-allocated, sell if over.
 *
 * Cash reserve (cashReservePct > 0):
 *  - crypto targets are computed against cryptoPoolUsd = totalUsd * (1 - cashReservePct/100)
 *  - if stablecoin balance < targetCashUsd: sell overweight crypto to replenish
 *  - cashReservePct=0 (default) = identical to previous behaviour
 *
 * All pairs use the canonical "ASSET/USDT" format.
 * USDT itself is the rebalancing currency and is never traded directly.
 */
export function calculateTrades(
  portfolio: Portfolio,
  targets: Allocation[],
  priceOverrides?: Record<string, number>,
  cashReservePct?: number
): TradeOrder[] {
  const totalUsd = portfolio.totalValueUsd;
  if (totalUsd <= 0) return [];

  // ─── Cash reserve setup ─────────────────────────────────────────────────────

  const reservePct = cashReservePct ?? 0;
  const targetCashUsd = totalUsd * (reservePct / 100);
  // USD value of all stablecoins currently held
  const cashValueUsd = portfolio.assets
    .filter((a) => isStablecoin(a.asset))
    .reduce((sum, a) => sum + a.valueUsd, 0);

  // When cashReservePct is explicitly set (bear/bull triggers), use full portfolio
  // as crypto pool — this allows selling crypto to cash (bear) or buying from cash (bull).
  // When cashReservePct is 0/undefined (normal rebalance), only redistribute existing
  // crypto — never touch stablecoins (that's DCA's job).
  const cryptoPoolUsd = reservePct > 0
    ? totalUsd - targetCashUsd
    : Math.max(0, totalUsd - cashValueUsd);

  // ─── Target / exchange lookups ──────────────────────────────────────────────

  const targetMap = new Map<string, Allocation>();
  for (const alloc of targets) {
    targetMap.set(alloc.asset, alloc);
  }

  const exchangeMap = new Map<string, ExchangeName>();
  for (const held of portfolio.assets) {
    exchangeMap.set(held.asset, held.exchange);
  }

  // ─── Build delta list ───────────────────────────────────────────────────────

  type AssetDelta = {
    asset: string;
    exchange: ExchangeName;
    deltaUsd: number; // positive = need to buy, negative = need to sell
    absDeltaUsd: number;
  };

  const deltas: AssetDelta[] = [];

  // Assets that are currently held (non-stablecoin)
  for (const held of portfolio.assets) {
    if (isStablecoin(held.asset)) continue;

    const alloc = targetMap.get(held.asset);
    const targetPct = alloc?.targetPct ?? 0;
    // Targets are percentage of cryptoPoolUsd, not totalUsd
    const targetUsd = (targetPct / 100) * cryptoPoolUsd;
    const currentUsd = held.valueUsd;
    const deltaUsd = targetUsd - currentUsd;

    const minTrade = alloc?.minTradeUsd ?? env.MIN_TRADE_USD;

    if (Math.abs(deltaUsd) < minTrade) continue;

    const exchange = alloc?.exchange ?? held.exchange;
    deltas.push({ asset: held.asset, exchange, deltaUsd, absDeltaUsd: Math.abs(deltaUsd) });
  }

  // Assets in targets not yet held (pure buys)
  for (const alloc of targets) {
    if (isStablecoin(alloc.asset)) continue;
    if (exchangeMap.has(alloc.asset)) continue; // already processed above

    const targetUsd = (alloc.targetPct / 100) * cryptoPoolUsd;
    const minTrade = alloc.minTradeUsd ?? env.MIN_TRADE_USD;

    if (targetUsd < minTrade) continue;

    const exchange = alloc.exchange ?? "binance";
    deltas.push({ asset: alloc.asset, exchange, deltaUsd: targetUsd, absDeltaUsd: targetUsd });
  }

  // ─── Cash deficit: sell overweight crypto to replenish reserve ──────────────

  if (reservePct > 0 && cashValueUsd < targetCashUsd) {
    const cashDeficit = targetCashUsd - cashValueUsd;
    // Find assets with positive deltaUsd (overweight) and reduce them to fund cash
    let remaining = cashDeficit;
    for (const d of deltas) {
      if (remaining <= 0) break;
      if (d.deltaUsd > 0) continue; // underweight — skip (it's already a buy)
      // d.deltaUsd < 0 means overweight; increase sell amount by cashDeficit share
      const extra = Math.min(remaining, d.absDeltaUsd);
      d.deltaUsd -= extra;
      d.absDeltaUsd += extra;
      remaining -= extra;
    }
    // If cash deficit still unmet, add sells on any overweight (positive deltaUsd) assets
    if (remaining > 0) {
      for (const d of deltas) {
        if (remaining <= 0) break;
        if (d.deltaUsd <= 0) continue; // already a sell
        const sellExtra = Math.min(remaining, d.deltaUsd);
        d.deltaUsd -= sellExtra;
        d.absDeltaUsd = Math.abs(d.deltaUsd);
        remaining -= sellExtra;
      }
    }
  }

  // Sort largest absolute drift first
  deltas.sort((a, b) => b.absDeltaUsd - a.absDeltaUsd);

  // ─── Convert to TradeOrders ─────────────────────────────────────────────────

  const orders: TradeOrder[] = [];

  for (const d of deltas) {
    // Skip if delta collapsed to zero after cash deficit adjustment
    if (d.absDeltaUsd < env.MIN_TRADE_USD / 2) continue;

    const pair = `${d.asset}/USDT`;

    const price =
      priceOverrides?.[pair] ??
      priceCache.getBestPrice(pair) ??
      priceCache.getBestPrice(`${d.asset}/USD`) ??
      priceCache.getBestPrice(`${d.asset}/USDC`);

    if (!price || price <= 0) {
      console.warn(`[TradeCalculator] No price for ${pair}, skipping trade`);
      continue;
    }

    const baseQty = d.absDeltaUsd / price;

    orders.push({
      exchange: d.exchange,
      pair,
      side: d.deltaUsd > 0 ? "buy" : "sell",
      type: "market",
      amount: baseQty,
    });
  }

  return orders;
}
