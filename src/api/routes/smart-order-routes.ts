import { Hono } from 'hono'
import { twapEngine } from '@/twap-vwap/twap-engine'
import { vwapEngine } from '@/twap-vwap/vwap-engine'
import { executionTracker } from '@/twap-vwap/execution-tracker'
import { sliceScheduler } from '@/twap-vwap/slice-scheduler'
import { db } from '@db/database'
import { smartOrders } from '@db/schema'
import { eq } from 'drizzle-orm'
import type { ExchangeName, OrderSide } from '@/types/index'

const smartOrderRoutes = new Hono()

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates the POST /smart-order request body.
 * Returns an error string or null if valid.
 */
function validateCreateBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object'

  const b = body as Record<string, unknown>

  if (b['type'] !== 'twap' && b['type'] !== 'vwap') {
    return "type must be 'twap' or 'vwap'"
  }
  if (typeof b['exchange'] !== 'string' || b['exchange'].length === 0) {
    return 'exchange must be a non-empty string'
  }
  if (typeof b['pair'] !== 'string' || b['pair'].length === 0) {
    return 'pair must be a non-empty string'
  }
  if (b['side'] !== 'buy' && b['side'] !== 'sell') {
    return "side must be 'buy' or 'sell'"
  }
  if (typeof b['totalAmount'] !== 'number' || b['totalAmount'] <= 0) {
    return 'totalAmount must be a positive number'
  }
  if (typeof b['durationMs'] !== 'number' || b['durationMs'] <= 0) {
    return 'durationMs must be a positive number (milliseconds)'
  }
  if (typeof b['slices'] !== 'number' || b['slices'] < 1 || !Number.isInteger(b['slices'])) {
    return 'slices must be a positive integer'
  }
  if (b['rebalanceId'] !== undefined && typeof b['rebalanceId'] !== 'string') {
    return 'rebalanceId must be a string if provided'
  }

  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/smart-order
 * Create a TWAP or VWAP smart order and begin execution.
 * Returns the new orderId.
 */
smartOrderRoutes.post('/smart-order', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validationError = validateCreateBody(body)
  if (validationError) {
    return c.json({ error: validationError }, 400)
  }

  const b = body as {
    type: 'twap' | 'vwap'
    exchange: ExchangeName
    pair: string
    side: OrderSide
    totalAmount: number
    durationMs: number
    slices: number
    rebalanceId?: string
  }

  try {
    const params = {
      exchange: b.exchange,
      pair: b.pair,
      side: b.side,
      totalAmount: b.totalAmount,
      durationMs: b.durationMs,
      slices: b.slices,
      ...(b.rebalanceId !== undefined && { rebalanceId: b.rebalanceId }),
    }

    const orderId =
      b.type === 'twap' ? await twapEngine.create(params) : await vwapEngine.create(params)

    return c.json({ orderId, type: b.type, status: 'active' }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/smart-order/active
 * List all smart orders currently active in-memory (not yet completed or cancelled).
 * IMPORTANT: must be declared before /:id to avoid route shadowing.
 */
smartOrderRoutes.get('/smart-order/active', async (c) => {
  try {
    const rows = await db
      .select()
      .from(smartOrders)
      .where(eq(smartOrders.status, 'active'))

    // Merge in-memory progress (more up-to-date) with DB row
    const result = rows.map((row) => {
      const progress = executionTracker.getProgress(row.id)
      return {
        id: row.id,
        type: row.type,
        exchange: row.exchange,
        pair: row.pair,
        side: row.side,
        totalAmount: row.totalAmount,
        durationMs: row.durationMs,
        status: progress?.status ?? row.status,
        filledAmount: progress?.filledAmount ?? row.filledAmount,
        filledPct: progress?.filledPct ?? 0,
        avgPrice: progress?.avgPrice ?? row.avgPrice,
        slicesCompleted: progress?.slicesCompleted ?? row.slicesCompleted,
        slicesTotal: progress?.slicesTotal ?? row.slicesTotal,
        estimatedCompletion: progress?.estimatedCompletion ?? null,
        rebalanceId: row.rebalanceId,
        createdAt: row.createdAt,
      }
    })

    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/smart-order/:id
 * Get execution progress for a specific smart order.
 * Merges in-memory tracker state (live) with DB row (persisted).
 */
smartOrderRoutes.get('/smart-order/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const rows = await db.select().from(smartOrders).where(eq(smartOrders.id, id)).limit(1)

    if (rows.length === 0) {
      return c.json({ error: `Smart order not found: ${id}` }, 404)
    }

    const row = rows[0]!
    const progress = executionTracker.getProgress(id)

    return c.json({
      id: row.id,
      type: row.type,
      exchange: row.exchange,
      pair: row.pair,
      side: row.side,
      totalAmount: row.totalAmount,
      durationMs: row.durationMs,
      status: progress?.status ?? row.status,
      filledAmount: progress?.filledAmount ?? row.filledAmount,
      filledPct: progress?.filledPct ?? 0,
      avgPrice: progress?.avgPrice ?? row.avgPrice,
      slicesCompleted: progress?.slicesCompleted ?? row.slicesCompleted,
      slicesTotal: progress?.slicesTotal ?? row.slicesTotal,
      estimatedCompletion: progress?.estimatedCompletion ?? null,
      rebalanceId: row.rebalanceId,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      config: row.config ? JSON.parse(row.config) : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/smart-order/:id/pause
 * Pause future slice execution for an active smart order.
 * In-flight slices may still complete.
 */
smartOrderRoutes.put('/smart-order/:id/pause', async (c) => {
  const id = c.req.param('id')

  try {
    const rows = await db.select().from(smartOrders).where(eq(smartOrders.id, id)).limit(1)

    if (rows.length === 0) {
      return c.json({ error: `Smart order not found: ${id}` }, 404)
    }

    const row = rows[0]!
    if (row.status !== 'active') {
      return c.json({ error: `Order is not active (current status: ${row.status})` }, 409)
    }

    sliceScheduler.pause(id)

    return c.json({ id, status: 'paused' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/smart-order/:id/resume
 * Resume a paused smart order. Remaining slices are re-scheduled.
 */
smartOrderRoutes.put('/smart-order/:id/resume', async (c) => {
  const id = c.req.param('id')

  try {
    const rows = await db.select().from(smartOrders).where(eq(smartOrders.id, id)).limit(1)

    if (rows.length === 0) {
      return c.json({ error: `Smart order not found: ${id}` }, 404)
    }

    const row = rows[0]!
    if (row.status !== 'paused') {
      return c.json({ error: `Order is not paused (current status: ${row.status})` }, 409)
    }

    sliceScheduler.resume(id)

    return c.json({ id, status: 'active' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/smart-order/:id/cancel
 * Cancel a smart order and clear all pending slices.
 * Partial fills are preserved in the record.
 */
smartOrderRoutes.put('/smart-order/:id/cancel', async (c) => {
  const id = c.req.param('id')

  try {
    const rows = await db.select().from(smartOrders).where(eq(smartOrders.id, id)).limit(1)

    if (rows.length === 0) {
      return c.json({ error: `Smart order not found: ${id}` }, 404)
    }

    const row = rows[0]!
    if (row.status === 'cancelled' || row.status === 'completed') {
      return c.json({ error: `Order already ${row.status}` }, 409)
    }

    sliceScheduler.cancel(id)

    return c.json({ id, status: 'cancelled' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { smartOrderRoutes }
