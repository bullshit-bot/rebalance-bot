/**
 * CRUD manager for copy trading sources and sync history.
 * Provides add/remove/update/query operations for copy_sources table
 * and exposes sync history from copy_sync_log.
 */

import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@db/database'
import { copySources, copySyncLog, type CopySource, type CopySyncLog } from '@db/schema'
import { copySyncEngine } from './copy-sync-engine'
import type { SourceAllocation } from './portfolio-source-fetcher'

export interface AddSourceParams {
  name: string
  sourceType: 'url' | 'manual'
  sourceUrl?: string
  allocations: SourceAllocation[]
  weight?: number
  syncInterval?: string
}

export type UpdateSourceParams = Partial<Omit<AddSourceParams, 'sourceType'> & {
  enabled: boolean
}>

export type SyncLogEntry = CopySyncLog

class CopyTradingManager {
  /** Add a new copy trading source. Returns the generated source ID. */
  async addSource(params: AddSourceParams): Promise<string> {
    if (params.sourceType === 'url' && !params.sourceUrl) {
      throw new Error('sourceUrl is required for URL-type sources')
    }
    if (params.allocations.length === 0) {
      throw new Error('allocations must not be empty')
    }

    const id = randomUUID()
    await db.insert(copySources).values({
      id,
      name: params.name,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl ?? null,
      allocations: JSON.stringify(params.allocations),
      weight: params.weight ?? 1.0,
      syncInterval: params.syncInterval ?? '4h',
      enabled: 1,
    })
    return id
  }

  /** Remove a copy source by ID. No-op if not found. */
  async removeSource(sourceId: string): Promise<void> {
    await db.delete(copySources).where(eq(copySources.id, sourceId))
  }

  /** Partial update of a copy source. Only provided fields are changed. */
  async updateSource(sourceId: string, updates: UpdateSourceParams): Promise<void> {
    const patch: Record<string, unknown> = {}

    if (updates.name !== undefined) patch['name'] = updates.name
    if (updates.sourceUrl !== undefined) patch['sourceUrl'] = updates.sourceUrl
    if (updates.weight !== undefined) patch['weight'] = updates.weight
    if (updates.syncInterval !== undefined) patch['syncInterval'] = updates.syncInterval
    if (updates.enabled !== undefined) patch['enabled'] = updates.enabled ? 1 : 0
    if (updates.allocations !== undefined) {
      patch['allocations'] = JSON.stringify(updates.allocations)
    }

    if (Object.keys(patch).length === 0) return

    await db.update(copySources).set(patch).where(eq(copySources.id, sourceId))
  }

  /** Return all copy sources. */
  async getSources(): Promise<CopySource[]> {
    return db.select().from(copySources)
  }

  /** Return a single copy source or null if not found. */
  async getSource(sourceId: string): Promise<CopySource | null> {
    const row = await db.query.copySources.findFirst({
      where: eq(copySources.id, sourceId),
    })
    return row ?? null
  }

  /**
   * Return sync log entries, optionally filtered by sourceId.
   * Ordered by most recent first. Defaults to last 50 entries.
   */
  async getSyncHistory(sourceId?: string, limit = 50): Promise<SyncLogEntry[]> {
    const query = db
      .select()
      .from(copySyncLog)
      .orderBy(desc(copySyncLog.syncedAt))
      .limit(limit)

    if (sourceId) {
      return db
        .select()
        .from(copySyncLog)
        .where(eq(copySyncLog.sourceId, sourceId))
        .orderBy(desc(copySyncLog.syncedAt))
        .limit(limit)
    }

    return query
  }

  /**
   * Force an immediate sync.
   * Pass sourceId to sync a single source; omit to sync all enabled sources.
   */
  async forceSync(sourceId?: string): Promise<void> {
    if (sourceId) {
      await copySyncEngine.syncSource(sourceId)
    } else {
      await copySyncEngine.syncAll()
    }
  }
}

export const copyTradingManager = new CopyTradingManager()
