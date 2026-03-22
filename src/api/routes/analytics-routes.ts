import { Hono } from 'hono'
import { equityCurveBuilder } from '@/analytics/equity-curve-builder'
import { pnlCalculator } from '@/analytics/pnl-calculator'
import { feeTracker } from '@/analytics/fee-tracker'
import { drawdownAnalyzer } from '@/analytics/drawdown-analyzer'
import { taxReporter } from '@/analytics/tax-reporter'

const analyticsRoutes = new Hono()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parsed time range; each bound is present only when the caller supplied it. */
interface TimeRange {
  from: number | undefined
  to: number | undefined
}

/**
 * Parse optional from/to Unix-second query params.
 * Returns a TimeRange where either field may be undefined.
 * Returns an error string when a provided param is not a valid integer.
 */
function parseTimeRange(
  fromParam: string | undefined,
  toParam: string | undefined,
): TimeRange | string {
  let from: number | undefined
  let to: number | undefined

  if (fromParam !== undefined) {
    from = parseInt(fromParam, 10)
    if (isNaN(from)) return 'from must be a Unix epoch seconds integer'
  }
  if (toParam !== undefined) {
    to = parseInt(toParam, 10)
    if (isNaN(to)) return 'to must be a Unix epoch seconds integer'
  }
  if (from !== undefined && to !== undefined && from > to) {
    return 'from must not be greater than to'
  }

  return { from, to }
}

/** Default time range: last 30 days, returned as Unix epoch seconds. */
function defaultRange(): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1_000)
  return { from: to - 30 * 86_400, to }
}

// ─── Equity curve ─────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/equity-curve?from=&to=
 * Returns the portfolio equity curve data points for the given time window.
 * Defaults to the last 30 days when params are omitted.
 */
analyticsRoutes.get('/analytics/equity-curve', async (c) => {
  const parsed = parseTimeRange(c.req.query('from'), c.req.query('to'))
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)

  const { from, to } = parsed
  const defaults = defaultRange()
  const resolvedFrom = from ?? defaults.from
  const resolvedTo = to ?? defaults.to

  try {
    const curve = await equityCurveBuilder.build(resolvedFrom, resolvedTo)
    return c.json({ from: resolvedFrom, to: resolvedTo, data: curve })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

// ─── PnL ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/pnl?from=&to=
 * Returns realized PnL breakdown (total, by-asset, by-period) for the window.
 */
analyticsRoutes.get('/analytics/pnl', async (c) => {
  const parsed = parseTimeRange(c.req.query('from'), c.req.query('to'))
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)

  try {
    const summary = await pnlCalculator.getRealizedPnL(parsed.from, parsed.to)
    return c.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

// ─── Drawdown ─────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/drawdown?from=&to=
 * Returns drawdown analysis (max drawdown, current drawdown, drawdown series).
 * Defaults to the last 30 days when params are omitted.
 */
analyticsRoutes.get('/analytics/drawdown', async (c) => {
  const parsed = parseTimeRange(c.req.query('from'), c.req.query('to'))
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)

  const defaults = defaultRange()
  const resolvedFrom = parsed.from ?? defaults.from
  const resolvedTo = parsed.to ?? defaults.to

  try {
    const result = await drawdownAnalyzer.analyze(resolvedFrom, resolvedTo)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

// ─── Fees ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/fees?from=&to=
 * Returns a fee summary (total, by-exchange, by-asset, by-period).
 */
analyticsRoutes.get('/analytics/fees', async (c) => {
  const parsed = parseTimeRange(c.req.query('from'), c.req.query('to'))
  if (typeof parsed === 'string') return c.json({ error: parsed }, 400)

  try {
    const summary = await feeTracker.getFees(parsed.from, parsed.to)
    return c.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

// ─── Per-asset performance ────────────────────────────────────────────────────

/**
 * GET /api/analytics/assets
 * Returns per-asset realized PnL combined with fee cost, for all time.
 * Response shape: { assets: Record<string, { pnl: number; fees: number; net: number }> }
 */
analyticsRoutes.get('/analytics/assets', async (c) => {
  try {
    const [pnlSummary, feeSummary] = await Promise.all([
      pnlCalculator.getRealizedPnL(),
      feeTracker.getFees(),
    ])

    // Merge PnL and fees keyed by asset symbol
    const assetSet = new Set([
      ...Object.keys(pnlSummary.byAsset),
      ...Object.keys(feeSummary.byAsset),
    ])

    const assets: Record<string, { pnl: number; fees: number; net: number }> = {}

    for (const asset of assetSet) {
      const pnl = pnlSummary.byAsset[asset] ?? 0
      const fees = feeSummary.byAsset[asset] ?? 0
      assets[asset] = { pnl, fees, net: pnl - fees }
    }

    return c.json({ assets })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

// ─── Tax report ───────────────────────────────────────────────────────────────

/**
 * GET /api/tax/report?year=2026
 * Returns a structured FIFO-based tax report for the given calendar year.
 */
analyticsRoutes.get('/tax/report', async (c) => {
  const yearParam = c.req.query('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  if (isNaN(year) || year < 2000 || year > 2100) {
    return c.json({ error: 'year must be a valid calendar year integer (e.g. 2026)' }, 400)
  }

  try {
    const report = await taxReporter.generateReport(year)
    return c.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/tax/export?year=2026
 * Streams a Koinly-compatible CSV download for the given calendar year.
 */
analyticsRoutes.get('/tax/export', async (c) => {
  const yearParam = c.req.query('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  if (isNaN(year) || year < 2000 || year > 2100) {
    return c.json({ error: 'year must be a valid calendar year integer (e.g. 2026)' }, 400)
  }

  try {
    const csv = await taxReporter.exportCSV(year)
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-report-${year}.csv"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: message }, 500)
  }
})

export { analyticsRoutes }
