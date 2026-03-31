/**
 * CRUD manager for copy trading sources and sync history.
 * Provides add/remove/update/query operations for CopySourceModel
 * and exposes sync history from CopySyncLogModel.
 */

import { randomUUID } from "node:crypto";
import { CopySourceModel, CopySyncLogModel } from "@db/database";
import type { ICopySource, ICopySyncLog } from "@db/database";
import { copySyncEngine } from "./copy-sync-engine";
import type { SourceAllocation } from "./portfolio-source-fetcher";

export interface AddSourceParams {
  name: string;
  sourceType: "url" | "manual";
  sourceUrl?: string;
  allocations: SourceAllocation[];
  weight?: number;
  syncInterval?: string;
}

export type UpdateSourceParams = Partial<
  Omit<AddSourceParams, "sourceType"> & {
    enabled: boolean;
  }
>;

export type SyncLogEntry = ICopySyncLog & { _id: string };

class CopyTradingManager {
  /** Add a new copy trading source. Returns the generated source ID. */
  async addSource(params: AddSourceParams): Promise<string> {
    if (params.sourceType === "url" && !params.sourceUrl) {
      throw new Error("sourceUrl is required for URL-type sources");
    }
    if (params.allocations.length === 0) {
      throw new Error("allocations must not be empty");
    }

    const id = randomUUID();
    await CopySourceModel.create({
      _id: id,
      name: params.name,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl ?? null,
      allocations: params.allocations as unknown as Record<string, unknown>[],
      weight: params.weight ?? 1.0,
      syncInterval: params.syncInterval ?? "4h",
      enabled: true,
    });
    return id;
  }

  /** Remove a copy source by ID. No-op if not found. */
  async removeSource(sourceId: string): Promise<void> {
    await CopySourceModel.deleteOne({ _id: sourceId });
  }

  /** Partial update of a copy source. Only provided fields are changed. */
  async updateSource(sourceId: string, updates: UpdateSourceParams): Promise<void> {
    const patch: Record<string, unknown> = {};

    if (updates.name !== undefined) patch["name"] = updates.name;
    if (updates.sourceUrl !== undefined) patch["sourceUrl"] = updates.sourceUrl;
    if (updates.weight !== undefined) patch["weight"] = updates.weight;
    if (updates.syncInterval !== undefined) patch["syncInterval"] = updates.syncInterval;
    if (updates.enabled !== undefined) patch["enabled"] = updates.enabled;
    if (updates.allocations !== undefined) patch["allocations"] = updates.allocations;

    if (Object.keys(patch).length === 0) return;

    await CopySourceModel.updateOne({ _id: sourceId }, patch);
  }

  /** Return all copy sources. */
  async getSources(): Promise<ICopySource[]> {
    return CopySourceModel.find().lean();
  }

  /** Return a single copy source or null if not found. */
  async getSource(sourceId: string): Promise<ICopySource | null> {
    return CopySourceModel.findById(sourceId).lean();
  }

  /**
   * Return sync log entries, optionally filtered by sourceId.
   * Ordered by most recent first. Defaults to last 50 entries.
   */
  async getSyncHistory(sourceId?: string, limit = 50): Promise<SyncLogEntry[]> {
    const filter = sourceId ? { sourceId } : {};
    const rows = await CopySyncLogModel.find(filter).sort({ syncedAt: -1 }).limit(limit).lean();
    return rows as unknown as SyncLogEntry[];
  }

  /**
   * Force an immediate sync.
   * Pass sourceId to sync a single source; omit to sync all enabled sources.
   */
  async forceSync(sourceId?: string): Promise<void> {
    if (sourceId) {
      await copySyncEngine.syncSource(sourceId);
    } else {
      await copySyncEngine.syncAll();
    }
  }
}

export const copyTradingManager = new CopyTradingManager();
