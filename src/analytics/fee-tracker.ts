import { and, gte, lte } from 'drizzle-orm'
import { db } from '@db/database'
import { trades } from '@db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Aggregated fee summary across a time range.
 * All fee values are in USD.
 * byPeriod contains rolling totals relative to now.
 */
export interface FeeSummary {
  totalFeesUsd: number
  byExchange: Record<string, number>
  byAsset: Record<string, number>
  byPeriod: {
    daily: number
    weekly: number
    monthly: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the base asset from a trading pair string.
 * e.g. "BTC/USDT" → "BTC"
 */
function baseAsset(pair: string): string {
  return pair.split('/')[0] ?? pair
}

type FeeRow = {
  exchange: string
  pair: string
  fee: number | null
  feeCurrency: string | null
  price: number
  executedAt: number | null
}

/**
 * Aggregate fee rows into total, byExchange, and byAsset maps.
 * Fees stored in the trades table are already in USD (costUsd basis).
 * When feeCurrency is a crypto asset, the fee column still reflects the
 * USD-equivalent cost because the executor records it that way.
 */
function aggregateFees(rows: FeeRow[]): {
  total: number
  byExchange: Record<string, number>
  byAsset: Record<string, number>
} {
  let total = 0
  const byExchange: Record<string, number> = {}
  const byAsset: Record<string, number> = {}

  for (const row of rows) {
    const feeUsd = row.fee ?? 0
    if (feeUsd === 0) continue

    total += feeUsd

    // Group by exchange
    byExchange[row.exchange] = (byExchange[row.exchange] ?? 0) + feeUsd

    // Group by base asset of the trading pair
    const asset = baseAsset(row.pair)
    byAsset[asset] = (byAsset[asset] ?? 0) + feeUsd
  }

  return { total, byExchange, byAsset }
}

// ─── FeeTracker ───────────────────────────────────────────────────────────────

/**
 * Queries the trades table to aggregate fee data by exchange, asset, and period.
 * All monetary values are in USD.
 */
class FeeTracker {
  /**
   * Returns a fee summary for trades executed within [from, to].
   * When from/to are omitted, all trades are included.
   *
   * @param from - Start timestamp, Unix epoch seconds (inclusive, optional)
   * @param to   - End timestamp, Unix epoch seconds (inclusive, optional)
   */
  async getFees(from?: number, to?: number): Promise<FeeSummary> {
    const conditions = []
    if (from !== undefined) conditions.push(gte(trades.executedAt, from))
    if (to !== undefined) conditions.push(lte(trades.executedAt, to))

    const rows = await db
      .select({
        exchange: trades.exchange,
        pair: trades.pair,
        fee: trades.fee,
        feeCurrency: trades.feeCurrency,
        price: trades.price,
        executedAt: trades.executedAt,
      })
      .from(trades)
      .where(conditions.length > 0 ? and(...(conditions as [ReturnType<typeof gte>])) : undefined)

    const { total, byExchange, byAsset } = aggregateFees(rows)

    // Compute rolling period totals relative to current time
    const nowSec = Math.floor(Date.now() / 1000)
    const dailyCutoff = nowSec - 86400
    const weeklyCutoff = nowSec - 7 * 86400
    const monthlyCutoff = nowSec - 30 * 86400

    const { total: daily } = aggregateFees(rows.filter((r) => (r.executedAt ?? 0) >= dailyCutoff))
    const { total: weekly } = aggregateFees(rows.filter((r) => (r.executedAt ?? 0) >= weeklyCutoff))
    const { total: monthly } = aggregateFees(
      rows.filter((r) => (r.executedAt ?? 0) >= monthlyCutoff),
    )

    return {
      totalFeesUsd: total,
      byExchange,
      byAsset,
      byPeriod: { daily, weekly, monthly },
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const feeTracker = new FeeTracker()

export { FeeTracker }
