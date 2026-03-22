import { and, gte, lte } from 'drizzle-orm'
import { db } from '@db/database'
import { snapshots } from '@db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single point on the equity curve.
 * timestamp is Unix epoch seconds.
 */
export interface EquityPoint {
  timestamp: number
  valueUsd: number
}

// ─── EquityCurveBuilder ───────────────────────────────────────────────────────

/**
 * Builds an equity curve from portfolio snapshots stored in the database.
 * Each point maps a snapshot's createdAt timestamp to its total USD value.
 */
class EquityCurveBuilder {
  /**
   * Returns equity curve data points for the given Unix-second date range.
   * Results are ordered chronologically ascending.
   *
   * @param from - Start timestamp, Unix epoch seconds (inclusive)
   * @param to   - End timestamp, Unix epoch seconds (inclusive)
   */
  async build(from: number, to: number): Promise<EquityPoint[]> {
    const rows = await db
      .select({
        createdAt: snapshots.createdAt,
        totalValueUsd: snapshots.totalValueUsd,
      })
      .from(snapshots)
      .where(and(gte(snapshots.createdAt, from), lte(snapshots.createdAt, to)))
      .orderBy(snapshots.createdAt)

    return rows.map((row) => ({
      timestamp: row.createdAt ?? 0,
      valueUsd: row.totalValueUsd,
    }))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const equityCurveBuilder = new EquityCurveBuilder()

export { EquityCurveBuilder }
