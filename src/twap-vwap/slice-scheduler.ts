import { executionTracker } from "@/twap-vwap/execution-tracker";
import type { ExchangeName, OrderSide } from "@/types/index";
import { SmartOrderModel } from "@db/database";
import { getExecutor } from "@executor/index";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SliceParams {
  orderId: string;
  exchange: ExchangeName;
  pair: string;
  side: OrderSide;
  slices: { amount: number; delayMs: number }[];
}

interface ScheduledOrder {
  orderId: string;
  timers: ReturnType<typeof setTimeout>[];
  paused: boolean;
  cancelled: boolean;
  /** Remaining slices when paused, for resume support */
  pendingSlices: { amount: number; delayMs: number; absoluteFireAt: number }[];
}

// ─── SliceScheduler ───────────────────────────────────────────────────────────

/**
 * Schedules and executes sub-slices for TWAP/VWAP orders.
 *
 * Each slice fires via setTimeout at its designated delay relative to the
 * previous slice. Supports pause/resume/cancel lifecycle.
 * After each fill, executionTracker is updated and smart_orders row persisted.
 */
class SliceScheduler {
  private readonly active: Map<string, ScheduledOrder> = new Map();

  /**
   * Schedule all slices for a smart order.
   * delayMs is relative to the previous slice (or now for the first slice).
   */
  async scheduleSlices(params: SliceParams): Promise<void> {
    const { orderId, exchange, pair, side, slices } = params;

    const scheduled: ScheduledOrder = {
      orderId,
      timers: [],
      paused: false,
      cancelled: false,
      pendingSlices: [],
    };

    this.active.set(orderId, scheduled);

    let cumulativeDelay = 0;

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      if (!slice) continue;
      cumulativeDelay += slice.delayMs;

      const fireAt = Date.now() + cumulativeDelay;
      scheduled.pendingSlices.push({ ...slice, absoluteFireAt: fireAt });

      const timer = setTimeout(async () => {
        const current = this.active.get(orderId);
        if (!current || current.cancelled || current.paused) return;

        try {
          const executor = getExecutor();
          const result = await executor.execute({
            exchange,
            pair,
            side,
            type: "market",
            amount: slice.amount,
          });
          executionTracker.updateSlice(orderId, result.amount, result.price);

          // Mark complete when last slice fires
          if (i === slices.length - 1) {
            executionTracker.complete(orderId);
            this.active.delete(orderId);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[SliceScheduler] Slice ${i + 1}/${slices.length} failed for ${orderId}: ${msg}`
          );

          // Persist error status but keep order active (partial fill)
          SmartOrderModel.updateOne({ _id: orderId }, { status: "active" }).catch(() => {});
        }
      }, cumulativeDelay);

      scheduled.timers.push(timer);
    }
  }

  /** Pause future slice execution. In-flight slices may still complete. */
  pause(orderId: string): void {
    const order = this.active.get(orderId);
    if (!order) return;

    order.paused = true;
    // Clear all pending timers
    for (const t of order.timers) clearTimeout(t);
    order.timers = [];

    SmartOrderModel.updateOne({ _id: orderId }, { status: "paused" }).catch(() => {});

    console.log(`[SliceScheduler] Paused order ${orderId}`);
  }

  /**
   * Resume a paused order by re-scheduling remaining slices.
   * Slices whose absoluteFireAt is in the past fire immediately (0 ms delay).
   */
  resume(orderId: string): void {
    const order = this.active.get(orderId);
    if (!order || !order.paused) return;

    order.paused = false;
    const now = Date.now();

    for (let i = 0; i < order.pendingSlices.length; i++) {
      const slice = order.pendingSlices[i];
      if (!slice) continue;
      const delay = Math.max(0, slice.absoluteFireAt - now);

      const timer = setTimeout(async () => {
        const current = this.active.get(orderId);
        if (!current || current.cancelled || current.paused) return;

        try {
          // Fetch exchange/pair/side from DB on resume to keep self-contained
          const row = await SmartOrderModel.findById(orderId).lean();
          if (!row) return;

          const executor = getExecutor();
          const result = await executor.execute({
            exchange: row.exchange as ExchangeName,
            pair: row.pair,
            side: row.side as OrderSide,
            type: "market",
            amount: slice.amount,
          });
          executionTracker.updateSlice(orderId, result.amount, result.price);

          if (i === order.pendingSlices.length - 1) {
            executionTracker.complete(orderId);
            this.active.delete(orderId);
          }
        } catch (err) {
          console.error(`[SliceScheduler] Resume slice failed for ${orderId}:`, err);
        }
      }, delay);

      order.timers.push(timer);
    }

    SmartOrderModel.updateOne({ _id: orderId }, { status: "active" }).catch(() => {});

    console.log(`[SliceScheduler] Resumed order ${orderId}`);
  }

  /** Cancel all remaining slices and mark the order cancelled. */
  cancel(orderId: string): void {
    const order = this.active.get(orderId);
    if (!order) return;

    order.cancelled = true;
    for (const t of order.timers) clearTimeout(t);
    order.timers = [];

    executionTracker.cancel(orderId);
    this.active.delete(orderId);

    console.log(`[SliceScheduler] Cancelled order ${orderId}`);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const sliceScheduler = new SliceScheduler();
export { SliceScheduler };
