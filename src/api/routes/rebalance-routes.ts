import { Hono } from 'hono'
import { desc } from 'drizzle-orm'
import { db } from '@db/database'
import { rebalances } from '@db/schema'
import { rebalanceEngine } from '@rebalancer/rebalance-engine'

const rebalanceRoutes = new Hono()

/**
 * POST /api/rebalance
 * Triggers a manual rebalance cycle.
 */
rebalanceRoutes.post('/', async (c) => {
  try {
    const event = await rebalanceEngine.execute('manual')
    return c.json(event, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/rebalance/preview
 * Dry-run: returns trades that would be generated without executing them.
 */
rebalanceRoutes.get('/preview', async (c) => {
  try {
    const result = await rebalanceEngine.preview()
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/rebalance/history?limit=20
 * Returns past rebalance records ordered by most recent first.
 */
rebalanceRoutes.get('/history', async (c) => {
  const limitParam = c.req.query('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 20

  if (isNaN(limit) || limit < 1 || limit > 200) {
    return c.json({ error: 'limit must be an integer between 1 and 200' }, 400)
  }

  try {
    const rows = await db
      .select()
      .from(rebalances)
      .orderBy(desc(rebalances.startedAt))
      .limit(limit)

    return c.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { rebalanceRoutes }
