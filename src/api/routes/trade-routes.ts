import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'
import { db } from '@db/database'
import { trades } from '@db/schema'

const tradeRoutes = new Hono()

/**
 * GET /api/trades?limit=50&rebalanceId=
 * Returns trade records, optionally filtered by rebalanceId.
 * Ordered by most recent first.
 */
tradeRoutes.get('/', async (c) => {
  const limitParam = c.req.query('limit')
  const rebalanceId = c.req.query('rebalanceId')

  const limit = limitParam ? parseInt(limitParam, 10) : 50

  if (isNaN(limit) || limit < 1 || limit > 500) {
    return c.json({ error: 'limit must be an integer between 1 and 500' }, 400)
  }

  try {
    const query = db.select().from(trades).orderBy(desc(trades.executedAt)).limit(limit)

    const rows = rebalanceId
      ? await query.where(eq(trades.rebalanceId, rebalanceId))
      : await query

    return c.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { tradeRoutes }
