import { Hono } from 'hono'
import { BacktestResultModel } from '@db/database'
import { backtestSimulator } from '@/backtesting/backtest-simulator'
import type { BacktestConfig } from '@/backtesting/backtest-simulator'

const backtestRoutes = new Hono()

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates a BacktestConfig body and returns an error string or null.
 * Does not perform deep type-checking but catches obviously missing/invalid fields.
 */
function validateConfig(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object'

  const b = body as Record<string, unknown>

  if (!Array.isArray(b['pairs']) || b['pairs'].length === 0) {
    return 'pairs must be a non-empty array of trading pair strings'
  }
  if (!Array.isArray(b['allocations']) || b['allocations'].length === 0) {
    return 'allocations must be a non-empty array'
  }
  if (typeof b['startDate'] !== 'number' || b['startDate'] <= 0) {
    return 'startDate must be a positive Unix millisecond timestamp'
  }
  if (typeof b['endDate'] !== 'number' || b['endDate'] <= 0) {
    return 'endDate must be a positive Unix millisecond timestamp'
  }
  if ((b['startDate'] as number) >= (b['endDate'] as number)) {
    return 'startDate must be earlier than endDate'
  }
  if (typeof b['initialBalance'] !== 'number' || b['initialBalance'] <= 0) {
    return 'initialBalance must be a positive number (USD)'
  }
  if (typeof b['threshold'] !== 'number' || b['threshold'] <= 0 || b['threshold'] > 100) {
    return 'threshold must be a number between 0 and 100 (percent)'
  }
  if (typeof b['feePct'] !== 'number' || b['feePct'] < 0) {
    return 'feePct must be a non-negative number (e.g. 0.001 for 0.1%)'
  }
  if (b['timeframe'] !== '1h' && b['timeframe'] !== '1d') {
    return "timeframe must be '1h' or '1d'"
  }
  if (typeof b['exchange'] !== 'string' || b['exchange'].length === 0) {
    return 'exchange must be a non-empty string'
  }

  return null
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/backtest
 * Runs a backtest simulation with the supplied BacktestConfig.
 * Returns a full BacktestResult including metrics, trades, equity curve, and benchmark.
 */
backtestRoutes.post('/backtest', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validationError = validateConfig(body)
  if (validationError) {
    return c.json({ error: validationError }, 400)
  }

  try {
    const result = await backtestSimulator.run(body as BacktestConfig)
    return c.json(result, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/backtest/list
 * Lists all saved backtest results with a condensed summary (id, config summary, metrics).
 * IMPORTANT: must be declared before /:id to avoid route shadowing.
 */
backtestRoutes.get('/backtest/list', async (c) => {
  try {
    const rows = await BacktestResultModel.find(
      {},
      { _id: 1, config: 1, metrics: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .lean()

    // config and metrics are already objects in Mongoose — no JSON.parse needed
    const summaries = rows.map((row) => {
      const config = row.config as unknown as BacktestConfig
      const metrics = row.metrics as Record<string, unknown>

      return {
        id: row._id,
        createdAt: row.createdAt,
        configSummary: {
          exchange: config.exchange,
          pairs: config.pairs,
          timeframe: config.timeframe,
          startDate: config.startDate,
          endDate: config.endDate,
          initialBalance: config.initialBalance,
          threshold: config.threshold,
          feePct: config.feePct,
        },
        metrics,
      }
    })

    return c.json(summaries)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/backtest/:id
 * Returns the full saved backtest result (metrics, trades, equity curve, benchmark) by ID.
 */
backtestRoutes.get('/backtest/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const row = await BacktestResultModel.findById(id).lean()

    if (!row) {
      return c.json({ error: `Backtest result not found: ${id}` }, 404)
    }

    // Fields are already objects in Mongoose — no JSON.parse needed
    const parsed = {
      id: row._id,
      createdAt: row.createdAt,
      config: row.config,
      metrics: row.metrics,
      trades: row.trades,
      benchmark: row.benchmark,
    }

    return c.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { backtestRoutes }
