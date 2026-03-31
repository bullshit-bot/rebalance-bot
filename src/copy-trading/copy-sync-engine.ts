/**
 * Syncs portfolio allocations from copy trading sources.
 * Compares source allocations against current DB targets, applies changes
 * when drift exceeds threshold, logs each sync, and emits rebalance:trigger.
 */

import { AllocationModel, CopySourceModel, CopySyncLogModel } from "@db/database";
import { eventBus } from "@events/event-bus";
import { type SourceAllocation, portfolioSourceFetcher } from "./portfolio-source-fetcher";

/** Minimum per-asset drift (absolute %) required to apply a sync */
const DRIFT_THRESHOLD_PCT = 2;

export interface SyncResult {
  changed: boolean;
  appliedChanges: number;
}

interface WeightedSource {
  allocations: SourceAllocation[];
  weight: number;
}

class CopySyncEngine {
  /**
   * Weighted average merge of multiple source allocation sets.
   * Normalises result to sum exactly 100%.
   */
  mergeAllocations(sources: WeightedSource[]): SourceAllocation[] {
    if (sources.length === 0) return [];

    const totalWeight = sources.reduce((s, src) => s + src.weight, 0);
    if (totalWeight === 0) throw new Error("Total source weight must be > 0");

    const merged = new Map<string, number>();

    for (const { allocations: allocs, weight } of sources) {
      for (const { asset, targetPct } of allocs) {
        merged.set(asset, (merged.get(asset) ?? 0) + targetPct * (weight / totalWeight));
      }
    }

    // Normalise to 100% to absorb floating-point drift
    const rawTotal = Array.from(merged.values()).reduce((s, v) => s + v, 0);
    const factor = rawTotal > 0 ? 100 / rawTotal : 1;

    return Array.from(merged.entries()).map(([asset, pct]) => ({
      asset,
      targetPct: Math.round(pct * factor * 100) / 100,
    }));
  }

  /**
   * Syncs allocations from a single source by ID.
   * For URL sources: fetches live data.
   * For manual sources: uses stored allocations array directly.
   * Only applies changes when any asset drifts > DRIFT_THRESHOLD_PCT.
   */
  async syncSource(sourceId: string): Promise<SyncResult> {
    const source = await CopySourceModel.findById(sourceId).lean();
    if (!source) throw new Error(`Copy source not found: ${sourceId}`);
    if (!source.enabled) return { changed: false, appliedChanges: 0 };

    // Resolve target allocations from source
    let sourceAllocs: SourceAllocation[];
    if (source.sourceType === "url" && source.sourceUrl) {
      sourceAllocs = await portfolioSourceFetcher.fetch(source.sourceUrl);
    } else {
      // allocations is already an array of objects in Mongoose Mixed field
      sourceAllocs = source.allocations as unknown as SourceAllocation[];
    }

    // Load current DB allocations
    const currentRows = await AllocationModel.find().lean();
    const currentMap = new Map(currentRows.map((r) => [r.asset, r.targetPct]));
    const beforeSnapshot = currentRows.map((r) => ({ asset: r.asset, targetPct: r.targetPct }));

    // Detect drift
    const drifted = sourceAllocs.filter(({ asset, targetPct }) => {
      const current = currentMap.get(asset) ?? 0;
      return Math.abs(targetPct - current) > DRIFT_THRESHOLD_PCT;
    });

    if (drifted.length === 0) {
      return { changed: false, appliedChanges: 0 };
    }

    // Apply all source allocations (not just drifted ones — keep them consistent)
    for (const { asset, targetPct } of sourceAllocs) {
      const existing = currentRows.find((r) => r.asset === asset);
      if (existing) {
        await AllocationModel.updateOne({ asset }, { targetPct, updatedAt: new Date() });
      } else {
        await AllocationModel.create({ asset, targetPct });
      }
    }

    const afterSnapshot = sourceAllocs.map((a) => ({ asset: a.asset, targetPct: a.targetPct }));

    // Log the sync
    await CopySyncLogModel.create({
      sourceId,
      beforeAllocations: beforeSnapshot,
      afterAllocations: afterSnapshot,
      changesApplied: drifted.length,
    });

    // Update lastSyncedAt on the source
    await CopySourceModel.updateOne({ _id: sourceId }, { lastSyncedAt: new Date() });

    // Trigger rebalance
    eventBus.emit("rebalance:trigger", { trigger: "manual" });

    return { changed: true, appliedChanges: drifted.length };
  }

  /**
   * Syncs all enabled sources.
   * When multiple sources are enabled, performs a weighted merge before applying.
   */
  async syncAll(): Promise<void> {
    const sources = await CopySourceModel.find({ enabled: true }).lean();
    if (sources.length === 0) return;

    if (sources.length === 1) {
      await this.syncSource(sources[0]!._id);
      return;
    }

    // Resolve allocations for each enabled source
    const resolved: WeightedSource[] = [];
    for (const source of sources) {
      try {
        let allocs: SourceAllocation[];
        if (source.sourceType === "url" && source.sourceUrl) {
          allocs = await portfolioSourceFetcher.fetch(source.sourceUrl);
        } else {
          allocs = source.allocations as unknown as SourceAllocation[];
        }
        resolved.push({ allocations: allocs, weight: source.weight ?? 1 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CopySyncEngine] Skipping source "${source._id}": ${msg}`);
      }
    }

    if (resolved.length === 0) return;

    const merged = this.mergeAllocations(resolved);

    // Check drift against current DB state
    const currentRows = await AllocationModel.find().lean();
    const currentMap = new Map(currentRows.map((r) => [r.asset, r.targetPct]));
    const beforeSnapshot = currentRows.map((r) => ({ asset: r.asset, targetPct: r.targetPct }));

    const drifted = merged.filter(({ asset, targetPct }) => {
      const current = currentMap.get(asset) ?? 0;
      return Math.abs(targetPct - current) > DRIFT_THRESHOLD_PCT;
    });

    if (drifted.length === 0) return;

    for (const { asset, targetPct } of merged) {
      const existing = currentRows.find((r) => r.asset === asset);
      if (existing) {
        await AllocationModel.updateOne({ asset }, { targetPct, updatedAt: new Date() });
      } else {
        await AllocationModel.create({ asset, targetPct });
      }
    }

    const afterSnapshot = merged.map((a) => ({ asset: a.asset, targetPct: a.targetPct }));

    // Log under a synthetic "all-sources" entry (use first source id as reference)
    await CopySyncLogModel.create({
      sourceId: sources[0]!._id,
      beforeAllocations: beforeSnapshot,
      afterAllocations: afterSnapshot,
      changesApplied: drifted.length,
    });

    // Update lastSyncedAt for all synced sources
    const sourceIds = sources.map((s) => s._id);
    await CopySourceModel.updateMany({ _id: { $in: sourceIds } }, { lastSyncedAt: new Date() });

    eventBus.emit("rebalance:trigger", { trigger: "manual" });
  }
}

export const copySyncEngine = new CopySyncEngine();
