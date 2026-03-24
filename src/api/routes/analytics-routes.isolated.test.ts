import { describe, it, expect, mock } from 'bun:test'

mock.module('@/analytics/equity-curve-builder', () => ({
  equityCurveBuilder: { build: async () => [{ timestamp: 1000, value: 1000 }] },
}))

mock.module('@/analytics/pnl-calculator', () => ({
  pnlCalculator: {
    getRealizedPnL: async () => ({ total: 100, byAsset: { BTC: 50, ETH: 50 } }),
  },
}))

mock.module('@/analytics/fee-tracker', () => ({
  feeTracker: { getFees: async () => ({ total: 10, byAsset: { BTC: 5, ETH: 5 } }) },
}))

mock.module('@/analytics/drawdown-analyzer', () => ({
  drawdownAnalyzer: {
    analyze: async () => ({ maxDrawdown: 0.1, currentDrawdown: 0.05 }),
  },
}))

mock.module('@/analytics/tax-reporter', () => ({
  taxReporter: {
    generateReport: async () => ({ year: 2026, transactions: [] }),
    exportCSV: async () => 'ticker,date\nBTC,2026-01-01',
  },
}))

import { Hono } from 'hono'
import { analyticsRoutes } from './analytics-routes'

describe('analytics-routes', () => {
  const app = new Hono()
  app.route('/', analyticsRoutes)

  it('GET /analytics/equity-curve returns curve data', async () => {
    const res = await app.request('http://localhost/analytics/equity-curve')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toBeDefined()
  })

  it('GET /analytics/equity-curve with invalid from param', async () => {
    const res = await app.request('http://localhost/analytics/equity-curve?from=invalid')
    expect(res.status).toBe(400)
  })

  it('GET /analytics/pnl returns pnl data', async () => {
    const res = await app.request('http://localhost/analytics/pnl')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(100)
  })

  it('GET /analytics/drawdown returns drawdown analysis', async () => {
    const res = await app.request('http://localhost/analytics/drawdown')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.maxDrawdown).toBe(0.1)
  })

  it('GET /analytics/fees returns fee summary', async () => {
    const res = await app.request('http://localhost/analytics/fees')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(10)
  })

  it('GET /analytics/assets returns per-asset performance', async () => {
    const res = await app.request('http://localhost/analytics/assets')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.assets).toBeDefined()
  })

  it('GET /tax/report returns tax report', async () => {
    const res = await app.request('http://localhost/tax/report?year=2026')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.year).toBe(2026)
  })

  it('GET /tax/report with invalid year', async () => {
    const res = await app.request('http://localhost/tax/report?year=1999')
    expect(res.status).toBe(400)
  })

  it('GET /tax/export returns CSV', async () => {
    const res = await app.request('http://localhost/tax/export?year=2026')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('GET /tax/export with default year', async () => {
    const res = await app.request('http://localhost/tax/export')
    expect(res.status).toBe(200)
  })

  it('GET /analytics/pnl with custom time range', async () => {
    const res = await app.request('http://localhost/analytics/pnl?from=1000&to=2000')
    expect(res.status).toBe(200)
  })

  it('GET /analytics/equity-curve with from > to', async () => {
    const res = await app.request('http://localhost/analytics/equity-curve?from=2000&to=1000')
    expect(res.status).toBe(400)
  })
})
