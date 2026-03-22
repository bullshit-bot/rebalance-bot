import { env } from '@config/app-config'
import type { Allocation, ExchangeName, Portfolio, TradeOrder } from '@/types/index'

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
 * All pairs use the canonical "ASSET/USDT" format.
 * USDT itself is the rebalancing currency and is never traded.
 */
export function calculateTrades(portfolio: Portfolio, targets: Allocation[]): TradeOrder[] {
  const totalUsd = portfolio.totalValueUsd
  if (totalUsd <= 0) return []

  // Build a target lookup: asset → targetPct
  const targetMap = new Map<string, Allocation>()
  for (const alloc of targets) {
    targetMap.set(alloc.asset, alloc)
  }

  // Collect the primary exchange for each held asset (fallback to 'binance')
  const exchangeMap = new Map<string, ExchangeName>()
  for (const held of portfolio.assets) {
    exchangeMap.set(held.asset, held.exchange)
  }

  // ─── Build delta list ───────────────────────────────────────────────────────

  type AssetDelta = {
    asset: string
    exchange: ExchangeName
    deltaUsd: number   // positive = need to buy, negative = need to sell
    absDeltaUsd: number
  }

  const deltas: AssetDelta[] = []

  // Assets that are currently held
  for (const held of portfolio.assets) {
    if (held.asset === 'USDT' || held.asset === 'USDC' || held.asset === 'BUSD') continue

    const alloc = targetMap.get(held.asset)
    const targetPct = alloc?.targetPct ?? 0
    const targetUsd = (targetPct / 100) * totalUsd
    const currentUsd = held.valueUsd
    const deltaUsd = targetUsd - currentUsd

    // Use allocation-level min if provided, else fall back to env
    const minTrade = alloc?.minTradeUsd ?? env.MIN_TRADE_USD

    if (Math.abs(deltaUsd) < minTrade) continue

    const exchange = alloc?.exchange ?? held.exchange
    deltas.push({ asset: held.asset, exchange, deltaUsd, absDeltaUsd: Math.abs(deltaUsd) })
  }

  // Assets in targets that are NOT yet held (pure buys)
  for (const alloc of targets) {
    if (alloc.asset === 'USDT' || alloc.asset === 'USDC' || alloc.asset === 'BUSD') continue
    if (exchangeMap.has(alloc.asset)) continue // already processed above

    const targetUsd = (alloc.targetPct / 100) * totalUsd
    const minTrade = alloc.minTradeUsd ?? env.MIN_TRADE_USD

    if (targetUsd < minTrade) continue

    const exchange = alloc.exchange ?? 'binance'
    deltas.push({ asset: alloc.asset, exchange, deltaUsd: targetUsd, absDeltaUsd: targetUsd })
  }

  // Sort largest absolute drift first
  deltas.sort((a, b) => b.absDeltaUsd - a.absDeltaUsd)

  // ─── Convert to TradeOrders ─────────────────────────────────────────────────

  return deltas.map((d): TradeOrder => ({
    exchange: d.exchange,
    pair: `${d.asset}/USDT`,
    side: d.deltaUsd > 0 ? 'buy' : 'sell',
    type: 'market',
    amount: d.absDeltaUsd,   // denominated in USD; executor converts to base qty
  }))
}
