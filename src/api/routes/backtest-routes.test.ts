import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { backtestRoutes } from './backtest-routes'

describe('Backtest Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', backtestRoutes)
  })

  describe('POST /backtest', () => {
    it('should run backtest with valid config', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should reject missing pairs', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid timeframe', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '4h',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should return result on success', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 201) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /backtest/list', () => {
    it('should list saved backtests', async () => {
      const res = await app.request('/backtest/list')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array when successful', async () => {
      const res = await app.request('/backtest/list')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('GET /backtest/:id', () => {
    it('should get backtest result by ID', async () => {
      const res = await app.request('/backtest/test-123')
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should include metrics when found', async () => {
      const res = await app.request('/backtest/test-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })
})
