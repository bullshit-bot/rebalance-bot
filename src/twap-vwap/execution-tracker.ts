import { SmartOrderModel } from '@db/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartOrderProgress {
  id: string
  type: 'twap' | 'vwap'
  status: string
  filledAmount: number
  totalAmount: number
  /** 0–100 percentage of total amount filled */
  filledPct: number
  avgPrice: number
  slicesCompleted: number
  slicesTotal: number
  /** Estimated unix-ms when order will be fully completed */
  estimatedCompletion: number
}

// ─── ExecutionTracker ─────────────────────────────────────────────────────────

/**
 * Tracks in-memory progress for smart (TWAP/VWAP) orders and persists state
 * to the smart_orders table after each slice fill.
 */
class ExecutionTracker {
  /** In-memory progress store keyed by orderId */
  private readonly store: Map<string, SmartOrderProgress> = new Map()

  /**
   * Register a new order in the tracker.
   * Call this once when a smart order is created.
   */
  register(
    id: string,
    type: 'twap' | 'vwap',
    totalAmount: number,
    slicesTotal: number,
    durationMs: number,
  ): void {
    const now = Date.now()
    this.store.set(id, {
      id,
      type,
      status: 'active',
      filledAmount: 0,
      totalAmount,
      filledPct: 0,
      avgPrice: 0,
      slicesCompleted: 0,
      slicesTotal,
      estimatedCompletion: now + durationMs,
    })
  }

  /**
   * Update progress after a slice is filled.
   * Recalculates running average price and persists to DB.
   */
  updateSlice(orderId: string, filled: number, price: number): void {
    const progress = this.store.get(orderId)
    if (!progress) {
      console.warn(`[ExecutionTracker] Unknown orderId: ${orderId}`)
      return
    }

    // Running weighted average price
    const totalFilled = progress.filledAmount + filled
    const newAvgPrice =
      totalFilled > 0
        ? (progress.avgPrice * progress.filledAmount + price * filled) / totalFilled
        : price

    const updated: SmartOrderProgress = {
      ...progress,
      filledAmount: totalFilled,
      filledPct: totalFilled > 0 ? (totalFilled / progress.totalAmount) * 100 : 0,
      avgPrice: newAvgPrice,
      slicesCompleted: progress.slicesCompleted + 1,
    }

    this.store.set(orderId, updated)
    this._persistProgress(orderId, updated).catch((err) => {
      console.error(`[ExecutionTracker] Failed to persist progress for ${orderId}:`, err)
    })
  }

  /** Retrieve current progress snapshot for an order. */
  getProgress(orderId: string): SmartOrderProgress | undefined {
    return this.store.get(orderId)
  }

  /** Mark order as completed and persist final state. */
  complete(orderId: string): void {
    const progress = this.store.get(orderId)
    if (!progress) return

    const updated: SmartOrderProgress = { ...progress, status: 'completed' }
    this.store.set(orderId, updated)

    SmartOrderModel.updateOne(
      { _id: orderId },
      {
        status: 'completed',
        filledAmount: updated.filledAmount,
        avgPrice: updated.avgPrice,
        slicesCompleted: updated.slicesCompleted,
        completedAt: new Date(),
      }
    ).catch((err) => console.error(`[ExecutionTracker] complete persist failed for ${orderId}:`, err))
  }

  /** Mark order as cancelled and persist state. */
  cancel(orderId: string): void {
    const progress = this.store.get(orderId)
    if (!progress) return

    const updated: SmartOrderProgress = { ...progress, status: 'cancelled' }
    this.store.set(orderId, updated)

    SmartOrderModel.updateOne(
      { _id: orderId },
      { status: 'cancelled', filledAmount: updated.filledAmount, avgPrice: updated.avgPrice }
    ).catch((err) => console.error(`[ExecutionTracker] cancel persist failed for ${orderId}:`, err))
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _persistProgress(orderId: string, progress: SmartOrderProgress): Promise<void> {
    await SmartOrderModel.updateOne(
      { _id: orderId },
      {
        filledAmount: progress.filledAmount,
        avgPrice: progress.avgPrice,
        slicesCompleted: progress.slicesCompleted,
        status: progress.status,
      }
    )
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const executionTracker = new ExecutionTracker()
export { ExecutionTracker }
