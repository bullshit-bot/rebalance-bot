import { randomUUID } from "node:crypto";
import { AISuggestionModel, AllocationModel } from "@db/database";
import type { IAISuggestion } from "@db/database";
import { eventBus } from "@/events/event-bus";
import { aiConfig } from "./ai-config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuggestionInput {
  allocations: { asset: string; targetPct: number }[];
  reasoning: string;
  sentimentData?: Record<string, unknown>;
}

// ─── AISuggestionHandler ──────────────────────────────────────────────────────

/**
 * Handles AI-generated portfolio allocation suggestions from GoClaw.
 * Validates allocation safety constraints, persists to DB, and optionally
 * auto-applies or queues for manual approval.
 */
class AISuggestionHandler {
  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Receive a new suggestion from GoClaw (called by the API route).
   * Validates the allocations sum ≈ 100% and each asset shift ≤ maxAllocationShiftPct,
   * then either auto-applies or saves as pending for manual approval.
   */
  async handleSuggestion(data: SuggestionInput): Promise<{ id: string; status: string }> {
    this.validateAllocationsSum(data.allocations);
    await this.validateShiftConstraints(data.allocations);

    const id = randomUUID();
    const status = aiConfig.autoApprove ? "auto-applied" : "pending";

    await AISuggestionModel.create({
      _id: id,
      source: "goclaw",
      suggestedAllocations: data.allocations as unknown as Record<string, unknown>,
      reasoning: data.reasoning,
      sentimentData: (data.sentimentData ?? null) as Record<string, unknown> | null,
      status,
      approvedAt: aiConfig.autoApprove ? new Date() : null,
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

    // suggestedAllocations is already an object (Mongoose Mixed field)
    const parsed = suggestion.suggestedAllocations as unknown as { asset: string; targetPct: number }[];
    await this.applyAllocations(parsed);

    await AISuggestionModel.updateOne(
      { _id: suggestionId },
      { status: "approved", approvedAt: new Date() }
    );

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

    await AISuggestionModel.updateOne({ _id: suggestionId }, { status: "rejected" });

    console.info(`[AISuggestionHandler] Rejected suggestion ${suggestionId}`);
  }

  /** Return all suggestions with status 'pending'. */
  async getPending(): Promise<IAISuggestion[]> {
    return AISuggestionModel.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .lean();
  }

  /** Return suggestions ordered newest-first with optional limit (default 50). */
  async getAll(limit = 50): Promise<IAISuggestion[]> {
    return AISuggestionModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getById(id: string): Promise<IAISuggestion | null> {
    return AISuggestionModel.findById(id).lean();
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
    const current = await AllocationModel.find().lean();
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
   * Replaces the allocations collection with the suggested values and triggers rebalance.
   */
  private async applyAllocations(proposed: { asset: string; targetPct: number }[]): Promise<void> {
    await AllocationModel.deleteMany({});

    if (proposed.length > 0) {
      await AllocationModel.insertMany(
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
