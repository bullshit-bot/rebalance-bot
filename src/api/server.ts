import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from '@config/app-config'
import { authMiddleware } from '@api/middleware/auth-middleware'
import { portfolioRoutes } from '@api/routes/portfolio-routes'
import { rebalanceRoutes } from '@api/routes/rebalance-routes'
import { tradeRoutes } from '@api/routes/trade-routes'
import { configRoutes } from '@api/routes/config-routes'
import { healthRoutes } from '@api/routes/health-routes'
import { backtestRoutes } from '@api/routes/backtest-routes'
import { analyticsRoutes } from '@api/routes/analytics-routes'
import { smartOrderRoutes } from '@api/routes/smart-order-routes'
import { gridRoutes } from '@api/routes/grid-routes'
import { aiRoutes } from '@api/routes/ai-routes'
import { copyTradingRoutes } from '@api/routes/copy-trading-routes'
import { strategyConfigRoutes } from '@api/routes/strategy-config-routes'
import { initWebSocket, handleOpen, handleClose } from '@api/ws/ws-handler'
import { dcaService } from '@dca/dca-service'

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MINUTE = 600
const RATE_LIMIT_WINDOW_MS = 60_000

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Evict expired entries every 60s to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip)
  }
}, 60_000).unref()

/**
 * Simple in-memory rate limiter: max 100 requests per IP per minute.
 * Returns true if the request is allowed, false if rate-limited.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_PER_MINUTE) {
    return false
  }

  entry.count++
  return true
}

// ─── Hono app ─────────────────────────────────────────────────────────────────

const app = new Hono()

// CORS — permissive by default; restrict origins via reverse proxy in production
app.use('*', cors())

// Rate limiting — applied before auth to limit unauthenticated probing
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Too many requests' }, 429)
  }
  return next()
})

// Auth middleware applied to all /api/* routes except /api/health
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') {
    await next()
    return
  }
  return authMiddleware(c, next)
})

// ─── Route groups ─────────────────────────────────────────────────────────────

app.route('/api/health', healthRoutes)
app.route('/api/portfolio', portfolioRoutes)
app.route('/api/rebalance', rebalanceRoutes)
app.route('/api/trades', tradeRoutes)
app.route('/api/config', configRoutes)
app.route('/api', backtestRoutes)
app.route('/api', analyticsRoutes)
app.route('/api', smartOrderRoutes)
app.route('/api', gridRoutes)
app.route('/api', aiRoutes)
app.route('/api', copyTradingRoutes)
app.route('/api/strategy-config', strategyConfigRoutes)

// ─── Manual DCA trigger ──────────────────────────────────────────────────────

app.post('/api/dca/trigger', async (c) => {
  const orders = await dcaService.executeScheduledDCA()
  return c.json({ triggered: true, orders: orders.length, details: orders })
})

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404))

// ─── Server startup ───────────────────────────────────────────────────────────

/**
 * Starts the HTTP + WebSocket server using Bun.serve().
 *
 * WebSocket upgrade requests to /ws are handled natively by Bun;
 * all other requests are dispatched through Hono.
 * Returns the server instance so callers can call server.stop() on shutdown.
 */
export function startServer(): ReturnType<typeof Bun.serve> {
  // Wire eventBus → WebSocket broadcast bridges before accepting connections
  initWebSocket()

  const server = Bun.serve({
    port: env.API_PORT,

    fetch(req, server) {
      const url = new URL(req.url)

      // Upgrade /ws path to a native Bun WebSocket connection
      if (url.pathname === '/ws') {
        // Require API key as query param: /ws?apiKey=<key>
        const apiKey = url.searchParams.get('apiKey')
        if (apiKey !== env.API_KEY) {
          return new Response('Unauthorized', { status: 401 })
        }

        const upgraded = server.upgrade(req, { data: {} })
        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 })
        }
        // Returning undefined signals Bun to proceed with the upgrade
        return undefined
      }

      return app.fetch(req)
    },

    websocket: {
      open: handleOpen,
      close: handleClose,
      // Server-to-client push only — inbound messages are silently ignored
      message(_ws, _message) {},
    },
  })

  return server
}

export { app }
