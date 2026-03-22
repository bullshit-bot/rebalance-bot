import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@db/database'
import { allocations } from '@db/schema'
import type { ExchangeName } from '@/types/index'

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_EXCHANGES: ExchangeName[] = ['binance', 'okx', 'bybit']

interface AllocationInput {
  asset: string
  targetPct: number
  exchange?: ExchangeName
  minTradeUsd?: number
}

function isValidExchange(value: unknown): value is ExchangeName {
  return typeof value === 'string' && (VALID_EXCHANGES as string[]).includes(value)
}

function validateAllocations(body: unknown): { valid: true; data: AllocationInput[] } | { valid: false; error: string } {
  if (!Array.isArray(body)) {
    return { valid: false, error: 'Body must be an array of allocation objects' }
  }

  for (const item of body) {
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: 'Each item must be an object' }
    }

    const { asset, targetPct, exchange, minTradeUsd } = item as Record<string, unknown>

    if (typeof asset !== 'string' || asset.trim() === '') {
      return { valid: false, error: 'asset must be a non-empty string' }
    }

    if (typeof targetPct !== 'number' || targetPct < 0 || targetPct > 100) {
      return { valid: false, error: `targetPct must be a number between 0 and 100 (got ${String(targetPct)})` }
    }

    if (exchange !== undefined && !isValidExchange(exchange)) {
      return { valid: false, error: `exchange must be one of: ${VALID_EXCHANGES.join(', ')}` }
    }

    if (minTradeUsd !== undefined && (typeof minTradeUsd !== 'number' || minTradeUsd < 0)) {
      return { valid: false, error: 'minTradeUsd must be a non-negative number' }
    }
  }

  return { valid: true, data: body as AllocationInput[] }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const configRoutes = new Hono()

/**
 * GET /api/config/allocations
 * Returns all configured target allocations.
 */
configRoutes.get('/allocations', async (c) => {
  try {
    const rows = await db.select().from(allocations)
    return c.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/config/allocations
 * Replaces allocation config. Body: array of { asset, targetPct, exchange?, minTradeUsd? }.
 * Upserts each item by asset+exchange key; removes rows not present in the new set.
 */
configRoutes.put('/allocations', async (c) => {
  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = validateAllocations(body)
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400)
  }

  const inputs = validation.data

  // Validate total target percentage does not exceed 100
  const totalPct = inputs.reduce((sum, a) => sum + a.targetPct, 0)
  if (totalPct > 100.01) {
    return c.json({ error: `Total targetPct (${totalPct.toFixed(2)}%) exceeds 100%` }, 400)
  }

  try {
    // Delete all existing rows then re-insert for a clean replace
    await db.delete(allocations)

    if (inputs.length > 0) {
      await db.insert(allocations).values(
        inputs.map((a) => ({
          asset: a.asset.toUpperCase(),
          targetPct: a.targetPct,
          ...(a.exchange ? { exchange: a.exchange } : {}),
          ...(a.minTradeUsd !== undefined ? { minTradeUsd: a.minTradeUsd } : {}),
        })),
      )
    }

    const updated = await db.select().from(allocations)
    return c.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * DELETE /api/config/allocations/:asset
 * Removes the allocation row for a specific asset (across all exchanges).
 */
configRoutes.delete('/allocations/:asset', async (c) => {
  const asset = c.req.param('asset').toUpperCase()

  try {
    await db.delete(allocations).where(eq(allocations.asset, asset))
    return c.json({ deleted: asset })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { configRoutes }
