import { Hono } from 'hono'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import { snapshotService } from '@portfolio/snapshot-service'

const portfolioRoutes = new Hono()

/**
 * GET /api/portfolio
 * Returns the current portfolio state or 503 if not yet available.
 */
portfolioRoutes.get('/', (c) => {
  const portfolio = portfolioTracker.getPortfolio()

  if (!portfolio) {
    return c.json({ error: 'Portfolio not yet available' }, 503)
  }

  return c.json(portfolio)
})

/**
 * GET /api/portfolio/history?from=&to=
 * Returns snapshots within the given Unix epoch seconds range.
 * Defaults: from = 24h ago, to = now
 */
portfolioRoutes.get('/history', async (c) => {
  const nowSecs = Math.floor(Date.now() / 1_000)
  const fromParam = c.req.query('from')
  const toParam = c.req.query('to')

  const from = fromParam ? parseInt(fromParam, 10) : nowSecs - 86_400
  const to = toParam ? parseInt(toParam, 10) : nowSecs

  if (isNaN(from) || isNaN(to)) {
    return c.json({ error: 'Invalid from/to parameters — expected Unix epoch seconds' }, 400)
  }

  try {
    const snapshots = await snapshotService.getSnapshots(from, to)
    return c.json(snapshots)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { portfolioRoutes }
