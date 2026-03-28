import { Hono } from 'hono'
import { BacktestResultModel } from '@db/database'
import { backtestSimulator } from '@/backtesting/backtest-simulator'
import type { BacktestConfig } from '@/backtesting/backtest-simulator'
import { StrategyParamsSchema } from '@rebalancer/strategies/strategy-config-types'
import { strategyOptimizer } from '@/backtesting/strategy-optimizer'
import type { OptimizationRequest } from '@/backtesting/strategy-optimizer'

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

  // Optional strategy fields
  if (b['strategyType'] !== undefined) {
    if (typeof b['strategyType'] !== 'string') {
      return 'strategyType must be a string'
    }
    if (b['strategyParams'] === undefined) {
      return 'strategyParams is required when strategyType is provided'
    }
    const parsed = StrategyParamsSchema.safeParse(b['strategyParams'])
    if (!parsed.success) {
      return `strategyParams invalid: ${parsed.error.issues.map((i) => i.message).join(', ')}`
    }
    // Ensure strategyParams.type matches strategyType
    const parsedType = (parsed.data as { type: string }).type
    if (parsedType !== b['strategyType']) {
      return `strategyParams.type ('${parsedType}') must match strategyType ('${b['strategyType']}')`
    }
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
    // Merge Zod-coerced strategyParams (with defaults applied) into the config
    const rawConfig = body as Record<string, unknown>
    let config = rawConfig as unknown as BacktestConfig
    if (rawConfig['strategyType'] && rawConfig['strategyParams']) {
      const parsed = StrategyParamsSchema.safeParse(rawConfig['strategyParams'])
      if (parsed.success) {
        config = { ...config, strategyParams: parsed.data }
      }
    }
    const result = await backtestSimulator.run(config)
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

/**
 * POST /api/backtest/optimize
 * Runs a grid-search optimization across all strategy parameter combinations.
 * WARNING: This can take several minutes for the full grid (~98 combos).
 * Accepts: OptimizationRequest (pairs, allocations, dates, balance, fee + optional strategyTypes/topN)
 */
backtestRoutes.post('/backtest/optimize', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Request body must be a JSON object' }, 400)
  }

  const b = body as Record<string, unknown>

  // Validate required base config fields
  if (!Array.isArray(b['pairs']) || b['pairs'].length === 0) {
    return c.json({ error: 'pairs must be a non-empty array' }, 400)
  }
  if (!Array.isArray(b['allocations']) || b['allocations'].length === 0) {
    return c.json({ error: 'allocations must be a non-empty array' }, 400)
  }
  if (typeof b['startDate'] !== 'number' || b['startDate'] <= 0) {
    return c.json({ error: 'startDate must be a positive Unix millisecond timestamp' }, 400)
  }
  if (typeof b['endDate'] !== 'number' || b['endDate'] <= 0) {
    return c.json({ error: 'endDate must be a positive Unix millisecond timestamp' }, 400)
  }
  if ((b['startDate'] as number) >= (b['endDate'] as number)) {
    return c.json({ error: 'startDate must be earlier than endDate' }, 400)
  }
  if (typeof b['initialBalance'] !== 'number' || b['initialBalance'] <= 0) {
    return c.json({ error: 'initialBalance must be a positive number' }, 400)
  }
  if (typeof b['feePct'] !== 'number' || b['feePct'] < 0) {
    return c.json({ error: 'feePct must be a non-negative number' }, 400)
  }
  if (typeof b['exchange'] !== 'string' || b['exchange'].length === 0) {
    return c.json({ error: 'exchange must be a non-empty string' }, 400)
  }

  try {
    const request = body as OptimizationRequest
    // Default timeframe to '1d' if not provided
    if (!request.timeframe) (request as Record<string, unknown>)['timeframe'] = '1d'

    const result = await strategyOptimizer.optimize(request)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { backtestRoutes }
