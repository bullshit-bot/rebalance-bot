import { SnapshotModel } from '@db/database'

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
    const rows = await SnapshotModel.find({
      createdAt: {
        $gte: new Date(from * 1000),
        $lte: new Date(to * 1000),
      },
    })
      .select('createdAt totalValueUsd')
      .sort({ createdAt: 1 })
      .lean()

    return rows.map((row) => ({
      timestamp: Math.floor(new Date(row.createdAt).getTime() / 1000),
      valueUsd: row.totalValueUsd,
    }))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const equityCurveBuilder = new EquityCurveBuilder()

export { EquityCurveBuilder }
