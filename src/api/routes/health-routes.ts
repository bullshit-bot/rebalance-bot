import { Hono } from 'hono'
import { exchangeManager } from '@exchange/exchange-manager'
import { trendFilter } from '@rebalancer/trend-filter'
import { strategyManager } from '@rebalancer/strategy-manager'

/** Bot process start time — captured once at module load */
const START_TIME = Date.now()

const healthRoutes = new Hono()

/**
 * GET /api/health
 * Public endpoint (no auth required).
 * Returns service liveness, uptime in seconds, exchange connection status,
 * and trend filter state when enabled.
 */
healthRoutes.get('/', (c) => {
  const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined
  const trendEnabled = gs?.trendFilterEnabled === true
  const maPeriod = typeof gs?.trendFilterMA === 'number' ? gs.trendFilterMA : 100
  const buffer = typeof gs?.trendFilterBuffer === 'number' ? gs.trendFilterBuffer : 2

  return c.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1_000),
    exchanges: exchangeManager.getStatus(),
    trendStatus: {
      enabled: trendEnabled,
      bullish: trendFilter.isBullish(maPeriod, buffer),
      ma: trendFilter.getMA(maPeriod),
      price: trendFilter.getCurrentPrice(),
      dataPoints: trendFilter.getDataPoints(),
    },
  })
})

export { healthRoutes }
