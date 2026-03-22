import { randomUUID } from "node:crypto";
import { db } from "@/db/database";
import { aiSuggestions, allocations } from "@/db/schema";
import type { AISuggestion } from "@/db/schema";
import { eventBus } from "@/events/event-bus";
import { desc, eq } from "drizzle-orm";
import { aiConfig } from "./ai-config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuggestionInput {
  allocations: { asset: string; targetPct: number }[];
  reasoning: string;
  sentimentData?: Record<string, unknown>;
}

// ─── AISuggestionHandler ──────────────────────────────────────────────────────

/**
 * Handles AI-generated portfolio allocation suggestions from OpenClaw.
 * Validates allocation safety constraints, persists to DB, and optionally
 * auto-applies or queues for manual approval.
 */
class AISuggestionHandler {
  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Receive a new suggestion from OpenClaw (called by the API route).
   * Validates the allocations sum ≈ 100% and each asset shift ≤ maxAllocationShiftPct,
   * then either auto-applies or saves as pending for manual approval.
   */
  async handleSuggestion(data: SuggestionInput): Promise<{ id: string; status: string }> {
    this.validateAllocationsSum(data.allocations);
    await this.validateShiftConstraints(data.allocations);

    const id = randomUUID();
    const status = aiConfig.autoApprove ? "auto-applied" : "pending";

    await db.insert(aiSuggestions).values({
      id,
      source: "openclaw",
      suggestedAllocations: JSON.stringify(data.allocations),
      reasoning: data.reasoning,
      sentimentData: data.sentimentData ? JSON.stringify(data.sentimentData) : null,
      status,
      approvedAt: aiConfig.autoApprove ? Math.floor(Date.now() / 1000) : null,
    });

    if (aiConfig.autoApprove) {
      await this.applyAllocations(data.allocations);
      console.info(`[AISuggestionHandler] Auto-applied suggestion ${id}`);
    } else {
      // Notify via event bus — TelegramNotifier or other subscribers can alert operator
      eventBus.emit(
        "alert" as never,
        {
          level: "info",
          message: `New AI suggestion (${id}) awaiting approval:\n${data.reasoning}`,
        } as never
      );
      console.info(`[AISuggestionHandler] Suggestion ${id} saved as pending`);
    }

    return { id, status };
  }

  /**
   * Approve a pending suggestion: apply allocations and trigger rebalance.
   */
  async approve(suggestionId: string): Promise<void> {
    const suggestion = await this.getById(suggestionId);
    if (!suggestion) throw new Error(`Suggestion ${suggestionId} not found`);
    if (suggestion.status !== "pending") {
      throw new Error(`Suggestion ${suggestionId} is not pending (status: ${suggestion.status})`);
    }

    const parsed = JSON.parse(suggestion.suggestedAllocations) as {
      asset: string;
      targetPct: number;
    }[];
    await this.applyAllocations(parsed);

    await db
      .update(aiSuggestions)
      .set({ status: "approved", approvedAt: Math.floor(Date.now() / 1000) })
      .where(eq(aiSuggestions.id, suggestionId));

    console.info(`[AISuggestionHandler] Approved and applied suggestion ${suggestionId}`);
  }

  /**
   * Reject a pending suggestion without applying it.
   */
  async reject(suggestionId: string): Promise<void> {
    const suggestion = await this.getById(suggestionId);
    if (!suggestion) throw new Error(`Suggestion ${suggestionId} not found`);
    if (suggestion.status !== "pending") {
      throw new Error(`Suggestion ${suggestionId} is not pending (status: ${suggestion.status})`);
    }

    await db
      .update(aiSuggestions)
      .set({ status: "rejected" })
      .where(eq(aiSuggestions.id, suggestionId));

    console.info(`[AISuggestionHandler] Rejected suggestion ${suggestionId}`);
  }

  /** Return all suggestions with status 'pending'. */
  async getPending(): Promise<AISuggestion[]> {
    return db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.status, "pending"))
      .orderBy(desc(aiSuggestions.createdAt));
  }

  /** Return suggestions ordered newest-first with optional limit (default 50). */
  async getAll(limit = 50): Promise<AISuggestion[]> {
    return db.select().from(aiSuggestions).orderBy(desc(aiSuggestions.createdAt)).limit(limit);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getById(id: string): Promise<AISuggestion | undefined> {
    const rows = await db.select().from(aiSuggestions).where(eq(aiSuggestions.id, id)).limit(1);
    return rows[0];
  }

  /**
   * Validates that proposed allocations sum to approximately 100% (±1%).
   */
  private validateAllocationsSum(proposed: { asset: string; targetPct: number }[]): void {
    const total = proposed.reduce((sum, a) => sum + a.targetPct, 0);
    if (Math.abs(total - 100) > 1) {
      throw new Error(`Suggested allocations sum to ${total.toFixed(2)}% — must be ~100%`);
    }
  }

  /**
   * Validates each asset's proposed shift is within aiConfig.maxAllocationShiftPct.
   * Assets not in the current DB are treated as 0% current allocation.
   */
  private async validateShiftConstraints(
    proposed: { asset: string; targetPct: number }[]
  ): Promise<void> {
    const current = await db.select().from(allocations);
    const currentMap = new Map(current.map((a) => [a.asset.toUpperCase(), a.targetPct]));

    for (const { asset, targetPct } of proposed) {
      const currentPct = currentMap.get(asset.toUpperCase()) ?? 0;
      const shift = Math.abs(targetPct - currentPct);
      if (shift > aiConfig.maxAllocationShiftPct) {
        throw new Error(
          `Asset ${asset}: proposed shift ${shift.toFixed(2)}% exceeds max allowed ${aiConfig.maxAllocationShiftPct}%`
        );
      }
    }
  }

  /**
   * Replaces the allocations table with the suggested values and triggers rebalance.
   */
  private async applyAllocations(proposed: { asset: string; targetPct: number }[]): Promise<void> {
    await db.delete(allocations);

    if (proposed.length > 0) {
      await db.insert(allocations).values(
        proposed.map((a) => ({
          asset: a.asset.toUpperCase(),
          targetPct: a.targetPct,
        }))
      );
    }

    eventBus.emit("rebalance:trigger", { trigger: "manual" });
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const aiSuggestionHandler = new AISuggestionHandler();
