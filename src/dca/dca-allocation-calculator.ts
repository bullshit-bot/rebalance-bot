import type { Allocation, ExchangeName, Portfolio, TradeOrder } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

type DeficitEntry = {
  asset: string
  deficitPct: number
  exchange: ExchangeName
}

// ─── Proportional DCA allocation ─────────────────────────────────────────────

/**
 * Proportionally allocates a deposit across underweight assets.
 * Each asset's share is proportional to its deficit (targetPct - currentPct).
 * Assets below minTradeUsd are skipped.
 */
export function calcProportionalDCA(
  depositAmount: number,
  portfolio: Portfolio,
  targets: Allocation[],
  minTradeUsd: number,
): TradeOrder[] {
  const targetMap = new Map<string, { targetPct: number; exchange?: ExchangeName }>()
  for (const t of targets) {
    const entry: { targetPct: number; exchange?: ExchangeName } = { targetPct: t.targetPct }
    if (t.exchange !== undefined) entry.exchange = t.exchange
    targetMap.set(t.asset, entry)
  }

  const underweight: DeficitEntry[] = []
  for (const portfolioAsset of portfolio.assets) {
    const target = targetMap.get(portfolioAsset.asset)
    if (!target) continue
    const deficit = target.targetPct - portfolioAsset.currentPct
    if (deficit > 0) {
      underweight.push({
        asset: portfolioAsset.asset,
        deficitPct: deficit,
        exchange: target.exchange ?? portfolioAsset.exchange,
      })
    }
  }

  if (underweight.length === 0) return []

  underweight.sort((a, b) => b.deficitPct - a.deficitPct)
  const totalDeficit = underweight.reduce((sum, e) => sum + e.deficitPct, 0)
  const orders: TradeOrder[] = []

  for (const entry of underweight) {
    const allocationUsd = (entry.deficitPct / totalDeficit) * depositAmount
    if (allocationUsd < minTradeUsd) continue

    const portfolioAsset = portfolio.assets.find((a) => a.asset === entry.asset)
    if (!portfolioAsset || portfolioAsset.amount === 0 || portfolioAsset.valueUsd === 0) continue

    const priceUsd = portfolioAsset.valueUsd / portfolioAsset.amount
    orders.push({
      exchange: entry.exchange,
      pair: `${entry.asset}/USDT`,
      side: 'buy',
      type: 'market',
      amount: allocationUsd / priceUsd,
    })
  }

  return orders
}

// ─── Single-target DCA (rebalance routing mode) ───────────────────────────────

/**
 * Concentrates the full deposit into one target asset.
 * Returns [] if deposit < minTradeUsd or asset has no price in portfolio.
 */
export function calcSingleTargetDCA(
  asset: string,
  depositAmount: number,
  portfolio: Portfolio,
  targets: Allocation[],
  minTradeUsd: number,
): TradeOrder[] {
  if (depositAmount < minTradeUsd) {
    console.log(`[DCAAlloc] Target=${asset} deposit $${depositAmount.toFixed(2)} < min $${minTradeUsd}`)
    return []
  }

  const alloc = targets.find((t) => t.asset === asset)
  const portfolioAsset = portfolio.assets.find((a) => a.asset === asset)

  if (!portfolioAsset || portfolioAsset.amount === 0 || portfolioAsset.valueUsd === 0) {
    console.log(`[DCAAlloc] Target=${asset} has no price in portfolio snapshot, skipping`)
    return []
  }

  const exchange: ExchangeName = alloc?.exchange ?? portfolioAsset.exchange ?? 'binance'
  const priceUsd = portfolioAsset.valueUsd / portfolioAsset.amount
  console.log(`[DCAAlloc] DCA routing: full $${depositAmount.toFixed(2)} → ${asset} (most underweight)`)

  return [{
    exchange,
    pair: `${asset}/USDT`,
    side: 'buy',
    type: 'market',
    amount: depositAmount / priceUsd,
  }]
}
