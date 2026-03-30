import { Hono } from 'hono'
import { AllocationModel } from '@db/database'
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
    const rows = await AllocationModel.find().lean()
    return c.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/config/allocations
 * Replaces allocation config. Body: array of { asset, targetPct, exchange?, minTradeUsd? }.
 * Deletes all existing rows then re-inserts for a clean replace.
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
    // Atomic replace: upsert each allocation by asset, then remove unlisted assets
    const assetNames = inputs.map((a) => a.asset.toUpperCase())
    const ops = inputs.map((a) => ({
      updateOne: {
        filter: { asset: a.asset.toUpperCase() },
        update: {
          asset: a.asset.toUpperCase(),
          targetPct: a.targetPct,
          ...(a.exchange ? { exchange: a.exchange } : {}),
          ...(a.minTradeUsd !== undefined ? { minTradeUsd: a.minTradeUsd } : {}),
          updatedAt: new Date(),
        },
        upsert: true,
      },
    }))
    if (ops.length > 0) await AllocationModel.bulkWrite(ops)
    // Remove assets not in the new list
    if (assetNames.length > 0) {
      await AllocationModel.deleteMany({ asset: { $nin: assetNames } })
    } else {
      await AllocationModel.deleteMany({})
    }

    const updated = await AllocationModel.find().lean()
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
    await AllocationModel.deleteMany({ asset })
    return c.json({ deleted: asset })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { configRoutes }
