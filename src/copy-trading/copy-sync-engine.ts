/**
 * Syncs portfolio allocations from copy trading sources.
 * Compares source allocations against current DB targets, applies changes
 * when drift exceeds threshold, logs each sync, and emits rebalance:trigger.
 */

import { eq } from 'drizzle-orm'
import { db } from '@db/database'
import { allocations, copySources, copySyncLog } from '@db/schema'
import { eventBus } from '@events/event-bus'
import { portfolioSourceFetcher, type SourceAllocation } from './portfolio-source-fetcher'

/** Minimum per-asset drift (absolute %) required to apply a sync */
const DRIFT_THRESHOLD_PCT = 2

export interface SyncResult {
  changed: boolean
  appliedChanges: number
}

interface WeightedSource {
  allocations: SourceAllocation[]
  weight: number
}

class CopySyncEngine {
  /**
   * Weighted average merge of multiple source allocation sets.
   * Normalises result to sum exactly 100%.
   */
  mergeAllocations(sources: WeightedSource[]): SourceAllocation[] {
    if (sources.length === 0) return []

    const totalWeight = sources.reduce((s, src) => s + src.weight, 0)
    if (totalWeight === 0) throw new Error('Total source weight must be > 0')

    const merged = new Map<string, number>()

    for (const { allocations: allocs, weight } of sources) {
      for (const { asset, targetPct } of allocs) {
        merged.set(asset, (merged.get(asset) ?? 0) + targetPct * (weight / totalWeight))
      }
    }

    // Normalise to 100% to absorb floating-point drift
    const rawTotal = Array.from(merged.values()).reduce((s, v) => s + v, 0)
    const factor = rawTotal > 0 ? 100 / rawTotal : 1

    return Array.from(merged.entries()).map(([asset, pct]) => ({
      asset,
      targetPct: Math.round(pct * factor * 100) / 100,
    }))
  }

  /**
   * Syncs allocations from a single source by ID.
   * For URL sources: fetches live data.
   * For manual sources: uses stored allocations JSON.
   * Only applies changes when any asset drifts > DRIFT_THRESHOLD_PCT.
   */
  async syncSource(sourceId: string): Promise<SyncResult> {
    const source = await db.query.copySources.findFirst({
      where: eq(copySources.id, sourceId),
    })
    if (!source) throw new Error(`Copy source not found: ${sourceId}`)
    if (!source.enabled) return { changed: false, appliedChanges: 0 }

    // Resolve target allocations from source
    let sourceAllocs: SourceAllocation[]
    if (source.sourceType === 'url' && source.sourceUrl) {
      sourceAllocs = await portfolioSourceFetcher.fetch(source.sourceUrl)
    } else {
      try {
        sourceAllocs = JSON.parse(source.allocations) as SourceAllocation[]
      } catch {
        throw new Error(`Invalid allocations JSON for source ${sourceId}`)
      }
    }

    // Load current DB allocations
    const currentRows = await db.select().from(allocations)
    const currentMap = new Map(currentRows.map((r) => [r.asset, r.targetPct]))
    const beforeSnapshot = currentRows.map((r) => ({ asset: r.asset, targetPct: r.targetPct }))

    // Detect drift
    const drifted = sourceAllocs.filter(({ asset, targetPct }) => {
      const current = currentMap.get(asset) ?? 0
      return Math.abs(targetPct - current) > DRIFT_THRESHOLD_PCT
    })

    if (drifted.length === 0) {
      return { changed: false, appliedChanges: 0 }
    }

    // Apply all source allocations (not just drifted ones — keep them consistent)
    const now = Math.floor(Date.now() / 1000)
    for (const { asset, targetPct } of sourceAllocs) {
      const existing = currentRows.find((r) => r.asset === asset)
      if (existing) {
        await db
          .update(allocations)
          .set({ targetPct, updatedAt: now })
          .where(eq(allocations.asset, asset))
      } else {
        await db.insert(allocations).values({ asset, targetPct, updatedAt: now })
      }
    }

    const afterSnapshot = sourceAllocs.map((a) => ({ asset: a.asset, targetPct: a.targetPct }))

    // Log the sync
    await db.insert(copySyncLog).values({
      sourceId,
      beforeAllocations: JSON.stringify(beforeSnapshot),
      afterAllocations: JSON.stringify(afterSnapshot),
      changesApplied: drifted.length,
    })

    // Update lastSyncedAt on the source
    await db
      .update(copySources)
      .set({ lastSyncedAt: now })
      .where(eq(copySources.id, sourceId))

    // Trigger rebalance
    eventBus.emit('rebalance:trigger', { trigger: 'manual' })

    return { changed: true, appliedChanges: drifted.length }
  }

  /**
   * Syncs all enabled sources.
   * When multiple sources are enabled, performs a weighted merge before applying.
   */
  async syncAll(): Promise<void> {
    const sources = await db.select().from(copySources).where(eq(copySources.enabled, 1))
    if (sources.length === 0) return

    if (sources.length === 1) {
      await this.syncSource(sources[0]!.id)
      return
    }

    // Resolve allocations for each enabled source
    const resolved: WeightedSource[] = []
    for (const source of sources) {
      try {
        let allocs: SourceAllocation[]
        if (source.sourceType === 'url' && source.sourceUrl) {
          allocs = await portfolioSourceFetcher.fetch(source.sourceUrl)
        } else {
          allocs = JSON.parse(source.allocations) as SourceAllocation[]
        }
        resolved.push({ allocations: allocs, weight: source.weight ?? 1 })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[CopySyncEngine] Skipping source "${source.id}": ${msg}`)
      }
    }

    if (resolved.length === 0) return

    const merged = this.mergeAllocations(resolved)

    // Check drift against current DB state
    const currentRows = await db.select().from(allocations)
    const currentMap = new Map(currentRows.map((r) => [r.asset, r.targetPct]))
    const beforeSnapshot = currentRows.map((r) => ({ asset: r.asset, targetPct: r.targetPct }))

    const drifted = merged.filter(({ asset, targetPct }) => {
      const current = currentMap.get(asset) ?? 0
      return Math.abs(targetPct - current) > DRIFT_THRESHOLD_PCT
    })

    if (drifted.length === 0) return

    const now = Math.floor(Date.now() / 1000)
    for (const { asset, targetPct } of merged) {
      const existing = currentRows.find((r) => r.asset === asset)
      if (existing) {
        await db
          .update(allocations)
          .set({ targetPct, updatedAt: now })
          .where(eq(allocations.asset, asset))
      } else {
        await db.insert(allocations).values({ asset, targetPct, updatedAt: now })
      }
    }

    const afterSnapshot = merged.map((a) => ({ asset: a.asset, targetPct: a.targetPct }))

    // Log under a synthetic "all-sources" entry (use first source id as reference)
    await db.insert(copySyncLog).values({
      sourceId: sources[0]!.id,
      beforeAllocations: JSON.stringify(beforeSnapshot),
      afterAllocations: JSON.stringify(afterSnapshot),
      changesApplied: drifted.length,
    })

    // Update lastSyncedAt for all synced sources
    for (const source of sources) {
      await db
        .update(copySources)
        .set({ lastSyncedAt: now })
        .where(eq(copySources.id, source.id))
    }

    eventBus.emit('rebalance:trigger', { trigger: 'manual' })
  }
}

export const copySyncEngine = new CopySyncEngine()
