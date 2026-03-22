import { and, desc, gte, lte } from 'drizzle-orm'
import { db } from '@db/database'
import { snapshots } from '@db/schema'
import type { Snapshot } from '@db/schema'
import type { Portfolio } from '@/types/index'

// ─── SnapshotService ──────────────────────────────────────────────────────────

/**
 * Persists point-in-time portfolio snapshots to the database.
 * Used for historical charting, before/after rebalance audits,
 * and periodic health checks.
 */
class SnapshotService {
  /**
   * Serialize the current portfolio state and insert a row into snapshots.
   * holdings stores per-asset breakdown; allocations stores current % per asset.
   */
  async saveSnapshot(portfolio: Portfolio): Promise<void> {
    // Build compact holdings map: asset -> { amount, valueUsd }
    const holdingsMap: Record<string, { amount: number; valueUsd: number; exchange: string }> = {}
    const allocationsMap: Record<string, { currentPct: number; targetPct: number; driftPct: number }> = {}

    for (const asset of portfolio.assets) {
      holdingsMap[asset.asset] = {
        amount: asset.amount,
        valueUsd: asset.valueUsd,
        exchange: asset.exchange,
      }
      allocationsMap[asset.asset] = {
        currentPct: asset.currentPct,
        targetPct: asset.targetPct,
        driftPct: asset.driftPct,
      }
    }

    await db.insert(snapshots).values({
      totalValueUsd: portfolio.totalValueUsd,
      holdings: JSON.stringify(holdingsMap),
      allocations: JSON.stringify(allocationsMap),
    })
  }

  /**
   * Returns all snapshots whose createdAt falls within [from, to].
   * Timestamps are Unix epoch seconds (matching the DB default `unixepoch()`).
   *
   * @param from - Start of range, Unix epoch seconds (inclusive)
   * @param to   - End of range, Unix epoch seconds (inclusive)
   */
  async getSnapshots(from: number, to: number): Promise<Snapshot[]> {
    return db
      .select()
      .from(snapshots)
      .where(and(gte(snapshots.createdAt, from), lte(snapshots.createdAt, to)))
      .orderBy(snapshots.createdAt)
  }

  /**
   * Fetches the most recently inserted snapshot row, or null if none exist.
   */
  async getLatest(): Promise<Snapshot | null> {
    const rows = await db
      .select()
      .from(snapshots)
      .orderBy(desc(snapshots.createdAt))
      .limit(1)

    return rows[0] ?? null
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const snapshotService = new SnapshotService()

export { SnapshotService }
