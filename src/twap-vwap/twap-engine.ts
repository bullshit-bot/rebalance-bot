import { randomUUID } from 'node:crypto'
import { SmartOrderModel } from '@db/database'
import { executionTracker } from '@/twap-vwap/execution-tracker'
import { sliceScheduler } from '@/twap-vwap/slice-scheduler'
import type { ExchangeName, OrderSide } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwapCreateParams {
  exchange: ExchangeName
  pair: string
  side: OrderSide
  totalAmount: number
  /** Total execution window in milliseconds */
  durationMs: number
  /** Number of equal-sized slices to split the order into */
  slices: number
  rebalanceId?: string
}

// ─── TwapEngine ───────────────────────────────────────────────────────────────

/**
 * Time-Weighted Average Price execution engine.
 *
 * Splits a large order into `slices` equal-sized sub-orders spaced evenly
 * over `durationMs`. Each slice executes at: (durationMs / slices) intervals.
 *
 * This minimises market impact by spreading execution over time rather than
 * hitting the book all at once.
 */
class TwapEngine {
  /**
   * Create and immediately schedule a TWAP order.
   * @returns orderId — use with executionTracker.getProgress() for status.
   */
  async create(params: TwapCreateParams): Promise<string> {
    const { exchange, pair, side, totalAmount, durationMs, slices, rebalanceId } = params

    if (slices < 1) throw new Error('[TwapEngine] slices must be >= 1')
    if (totalAmount <= 0) throw new Error('[TwapEngine] totalAmount must be > 0')
    if (durationMs <= 0) throw new Error('[TwapEngine] durationMs must be > 0')

    const orderId = randomUUID()
    const sliceAmount = totalAmount / slices
    const intervalMs = Math.floor(durationMs / slices)

    // Build uniform slice schedule: each slice fires intervalMs after the previous
    const sliceList = Array.from({ length: slices }, (_, i) => ({
      amount: sliceAmount,
      // First slice fires immediately (0 ms), subsequent slices at regular intervals
      delayMs: i === 0 ? 0 : intervalMs,
    }))

    const config = { slices, intervalMs, sliceAmount }

    // Persist to DB before scheduling
    await SmartOrderModel.create({
      _id: orderId,
      type: 'twap',
      exchange,
      pair,
      side,
      totalAmount,
      filledAmount: 0,
      slicesTotal: slices,
      slicesCompleted: 0,
      durationMs,
      status: 'active',
      config,
      rebalanceId: rebalanceId ?? null,
    })

    // Register with tracker before slices start firing
    executionTracker.register(orderId, 'twap', totalAmount, slices, durationMs)

    // Hand off to scheduler — non-blocking
    await sliceScheduler.scheduleSlices({ orderId, exchange, pair, side, slices: sliceList })

    console.log(
      `[TwapEngine] Created ${orderId}: ${slices} slices × ${sliceAmount.toFixed(6)} ${pair} every ${intervalMs}ms`,
    )

    return orderId
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const twapEngine = new TwapEngine()
export { TwapEngine }
