import type { Portfolio } from "@/types/index";
import { SnapshotModel } from "@db/database";
import type { ISnapshot } from "@db/database";

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
    const holdingsMap: Record<string, { amount: number; valueUsd: number; exchange: string }> = {};
    const allocationsMap: Record<
      string,
      { currentPct: number; targetPct: number; driftPct: number }
    > = {};

    for (const asset of portfolio.assets) {
      holdingsMap[asset.asset] = {
        amount: asset.amount,
        valueUsd: asset.valueUsd,
        exchange: asset.exchange,
      };
      allocationsMap[asset.asset] = {
        currentPct: asset.currentPct,
        targetPct: asset.targetPct,
        driftPct: asset.driftPct,
      };
    }

    await SnapshotModel.create({
      totalValueUsd: portfolio.totalValueUsd,
      holdings: holdingsMap,
      allocations: allocationsMap,
    });
  }

  /**
   * Returns all snapshots whose createdAt falls within [from, to].
   * from/to are Unix epoch seconds.
   *
   * @param from - Start of range, Unix epoch seconds (inclusive)
   * @param to   - End of range, Unix epoch seconds (inclusive)
   */
  async getSnapshots(from: number, to: number): Promise<ISnapshot[]> {
    return SnapshotModel.find({
      createdAt: {
        $gte: new Date(from * 1_000),
        $lte: new Date(to * 1_000),
      },
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Fetches the most recently inserted snapshot row, or null if none exist.
   */
  async getLatest(): Promise<ISnapshot | null> {
    return SnapshotModel.findOne().sort({ createdAt: -1 }).lean();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const snapshotService = new SnapshotService();

export { SnapshotService };
