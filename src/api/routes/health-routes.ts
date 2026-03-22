import { Hono } from 'hono'
import { exchangeManager } from '@exchange/exchange-manager'

/** Bot process start time — captured once at module load */
const START_TIME = Date.now()

const healthRoutes = new Hono()

/**
 * GET /api/health
 * Public endpoint (no auth required).
 * Returns service liveness, uptime in seconds, and exchange connection status.
 */
healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1_000),
    exchanges: exchangeManager.getStatus(),
  })
})

export { healthRoutes }
