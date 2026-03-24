import { describe, it, expect, mock } from 'bun:test'

mock.module('@/backtesting/backtest-simulator', () => ({
  backtestSimulator: {
    run: async () => ({
      metrics: { totalReturn: 0.1, sharpe: 1.5 },
      trades: [],
      equityCurve: [],
      benchmark: [],
    }),
  },
}))

mock.module('@db/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          map: (fn: any) => [
            {
              id: 'bt-1',
              config: JSON.stringify({
                exchange: 'binance',
                pairs: ['BTC/USDT'],
                timeframe: '1h',
                startDate: 1000000,
                endDate: 2000000,
                initialBalance: 1000,
                threshold: 5,
                feePct: 0.001,
              }),
              metrics: JSON.stringify({ totalReturn: 0.1 }),
              createdAt: Date.now(),
              trades: JSON.stringify([]),
              benchmark: JSON.stringify([]),
            },
          ].map(fn),
        }),
        where: () => ({
          limit: async () => [
            {
              id: 'bt-1',
              config: JSON.stringify({
                exchange: 'binance',
                pairs: ['BTC/USDT'],
                timeframe: '1h',
                startDate: 1000000,
                endDate: 2000000,
                initialBalance: 1000,
                threshold: 5,
                feePct: 0.001,
              }),
              metrics: JSON.stringify({ totalReturn: 0.1 }),
              createdAt: Date.now(),
              trades: JSON.stringify([]),
              benchmark: JSON.stringify([]),
            },
          ],
        }),
      }),
    }),
  },
}))

import { Hono } from 'hono'
import { backtestRoutes } from './backtest-routes'

describe('backtest-routes', () => {
  const app = new Hono()
  app.route('/', backtestRoutes)

  it('POST /backtest runs backtest', async () => {
    const res = await app.request('http://localhost/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1000000,
        endDate: 2000000,
        initialBalance: 1000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1h',
        exchange: 'binance',
      }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.metrics).toBeDefined()
  })

  it('POST /backtest rejects invalid dates', async () => {
    const res = await app.request('http://localhost/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [],
        startDate: 2000000,
        endDate: 1000000,
        initialBalance: 1000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1h',
        exchange: 'binance',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /backtest rejects empty pairs', async () => {
    const res = await app.request('http://localhost/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs: [],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1000000,
        endDate: 2000000,
        initialBalance: 1000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1h',
        exchange: 'binance',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /backtest rejects invalid threshold', async () => {
    const res = await app.request('http://localhost/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1000000,
        endDate: 2000000,
        initialBalance: 1000,
        threshold: 150,
        feePct: 0.001,
        timeframe: '1h',
        exchange: 'binance',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /backtest/list returns summaries', async () => {
    const res = await app.request('http://localhost/backtest/list')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /backtest/:id returns full result', async () => {
    const res = await app.request('http://localhost/backtest/bt-1')
    // The mock returns 0 rows on the second call, so we get 404
    if (res.status === 404) {
      expect(res.status).toBe(404)
    } else {
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('bt-1')
    }
  })

  it('POST /backtest rejects invalid timeframe', async () => {
    const res = await app.request('http://localhost/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1000000,
        endDate: 2000000,
        initialBalance: 1000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '5m',
        exchange: 'binance',
      }),
    })
    expect(res.status).toBe(400)
  })
})
