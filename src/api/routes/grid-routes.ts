import { Hono } from 'hono'
import { gridBotManager } from '@grid/grid-bot-manager'
import { gridPnLTracker } from '@grid/grid-pnl-tracker'
import type { CreateGridBotParams } from '@grid/grid-bot-manager'
import type { ExchangeName } from '@/types/index'

const gridRoutes = new Hono()

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates the POST /grid request body.
 * Returns an error string or null if valid.
 */
function validateCreateBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object'

  const b = body as Record<string, unknown>

  if (typeof b['exchange'] !== 'string' || b['exchange'].length === 0) {
    return 'exchange must be a non-empty string'
  }
  if (typeof b['pair'] !== 'string' || b['pair'].length === 0) {
    return 'pair must be a non-empty string'
  }
  if (typeof b['priceLower'] !== 'number' || b['priceLower'] <= 0) {
    return 'priceLower must be a positive number'
  }
  if (typeof b['priceUpper'] !== 'number' || b['priceUpper'] <= 0) {
    return 'priceUpper must be a positive number'
  }
  if ((b['priceLower'] as number) >= (b['priceUpper'] as number)) {
    return 'priceLower must be less than priceUpper'
  }
  if (
    typeof b['gridLevels'] !== 'number' ||
    b['gridLevels'] < 2 ||
    !Number.isInteger(b['gridLevels'])
  ) {
    return 'gridLevels must be an integer >= 2'
  }
  if (typeof b['investment'] !== 'number' || b['investment'] <= 0) {
    return 'investment must be a positive number (USD)'
  }
  if (b['gridType'] !== 'normal' && b['gridType'] !== 'reverse') {
    return "gridType must be 'normal' or 'reverse'"
  }

  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/grid/list
 * List all grid bots (active and stopped).
 * IMPORTANT: must be declared before /:id to avoid route shadowing.
 */
gridRoutes.get('/grid/list', async (c) => {
  try {
    const bots = await gridBotManager.listBots()

    // Merge in-memory PnL (more up-to-date for active bots) with DB row
    const result = bots.map((bot) => {
      const pnl = gridPnLTracker.getPnL(bot.id)
      return {
        id: bot.id,
        exchange: bot.exchange,
        pair: bot.pair,
        gridType: bot.gridType,
        priceLower: bot.priceLower,
        priceUpper: bot.priceUpper,
        gridLevels: bot.gridLevels,
        investment: bot.investment,
        status: bot.status,
        totalProfit: pnl.realized > 0 ? pnl.realized : (bot.totalProfit ?? 0),
        totalTrades: pnl.tradeCount > 0 ? pnl.tradeCount : (bot.totalTrades ?? 0),
        createdAt: bot.createdAt,
        stoppedAt: bot.stoppedAt,
      }
    })

    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/grid
 * Create a new grid bot, calculate levels, place initial orders and start monitoring.
 * Returns the new botId.
 */
gridRoutes.post('/grid', async (c) => {
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

  const b = body as CreateGridBotParams & { exchange: ExchangeName }

  try {
    const botId = await gridBotManager.create({
      exchange: b.exchange,
      pair: b.pair,
      priceLower: b.priceLower,
      priceUpper: b.priceUpper,
      gridLevels: b.gridLevels,
      investment: b.investment,
      gridType: b.gridType,
    })

    return c.json({ botId, status: 'active' }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Surface domain errors (no price cached, out-of-range price) as 422
    return c.json({ error: message }, 422)
  }
})

/**
 * GET /api/grid/:id
 * Get status and PnL for a specific grid bot.
 */
gridRoutes.get('/grid/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const bot = await gridBotManager.getBot(id)

    if (!bot) {
      return c.json({ error: `Grid bot not found: ${id}` }, 404)
    }

    // Load PnL from DB into tracker memory then read it for the most current snapshot
    await gridPnLTracker.loadFromDb(id)
    const pnl = gridPnLTracker.getPnL(id)

    return c.json({
      id: bot.id,
      exchange: bot.exchange,
      pair: bot.pair,
      gridType: bot.gridType,
      priceLower: bot.priceLower,
      priceUpper: bot.priceUpper,
      gridLevels: bot.gridLevels,
      investment: bot.investment,
      status: bot.status,
      pnl: {
        realized: pnl.realized,
        unrealized: pnl.unrealized,
        total: pnl.total,
        tradeCount: pnl.tradeCount,
      },
      createdAt: bot.createdAt,
      stoppedAt: bot.stoppedAt,
      config: bot.config ? JSON.parse(bot.config) : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * PUT /api/grid/:id/stop
 * Stop a running grid bot: cancels all open orders and returns final PnL.
 */
gridRoutes.put('/grid/:id/stop', async (c) => {
  const id = c.req.param('id')

  try {
    const result = await gridBotManager.stop(id)

    return c.json({
      id,
      status: 'stopped',
      totalProfit: result.totalProfit,
      totalTrades: result.totalTrades,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Domain errors (not found, already stopped) surface as 409/404
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    if (message.includes('already stopped')) {
      return c.json({ error: message }, 409)
    }
    return c.json({ error: message }, 500)
  }
})

export { gridRoutes }
