import { Hono } from 'hono'
import { copyTradingManager } from '@/copy-trading/copy-trading-manager'
import type { AddSourceParams, UpdateSourceParams } from '@/copy-trading/copy-trading-manager'

const copyTradingRoutes = new Hono()

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/copy/source
 * Add a new copy trading source.
 * Body: { name, sourceType, sourceUrl?, allocations, weight?, syncInterval? }
 */
copyTradingRoutes.post('/copy/source', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const b = body as Record<string, unknown>

  if (typeof b['name'] !== 'string' || b['name'].length === 0) {
    return c.json({ error: 'name must be a non-empty string' }, 400)
  }
  if (b['sourceType'] !== 'url' && b['sourceType'] !== 'manual') {
    return c.json({ error: "sourceType must be 'url' or 'manual'" }, 400)
  }
  if (!Array.isArray(b['allocations']) || b['allocations'].length === 0) {
    return c.json({ error: 'allocations must be a non-empty array' }, 400)
  }

  try {
    const id = await copyTradingManager.addSource(b as unknown as AddSourceParams)
    return c.json({ id }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * GET /api/copy/sources
 * List all copy trading sources.
 */
copyTradingRoutes.get('/copy/sources', async (c) => {
  try {
    const sources = await copyTradingManager.getSources()
    return c.json(sources)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/copy/source/:id
 * Partially update a copy trading source.
 */
copyTradingRoutes.put('/copy/source/:id', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  try {
    await copyTradingManager.updateSource(id, body as UpdateSourceParams)
    return c.json({ ok: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * DELETE /api/copy/source/:id
 * Remove a copy trading source.
 */
copyTradingRoutes.delete('/copy/source/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await copyTradingManager.removeSource(id)
    return c.json({ ok: true, id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/copy/sync
 * Force an immediate sync. Body: { sourceId? } — omit sourceId to sync all.
 */
copyTradingRoutes.post('/copy/sync', async (c) => {
  let sourceId: string | undefined
  try {
    const body = await c.req.json() as Record<string, unknown>
    if (typeof body['sourceId'] === 'string') sourceId = body['sourceId']
  } catch {
    // body is optional — proceed without it
  }

  try {
    await copyTradingManager.forceSync(sourceId)
    return c.json({ ok: true, sourceId: sourceId ?? 'all' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 422)
  }
})

/**
 * GET /api/copy/history?sourceId=&limit=20
 * Return sync history, optionally filtered by sourceId.
 */
copyTradingRoutes.get('/copy/history', async (c) => {
  const sourceId = c.req.query('sourceId')
  const limit = parseInt(c.req.query('limit') ?? '20', 10)

  try {
    const history = await copyTradingManager.getSyncHistory(sourceId, limit)
    return c.json(history)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { copyTradingRoutes }
