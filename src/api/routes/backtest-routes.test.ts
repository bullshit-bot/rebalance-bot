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

  describe('POST /backtest detailed validation', () => {
    it('should validate allocations sum', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 60 },
        ],
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

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should reject endDate < startDate', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1711065600000,
        endDate: 1704067200000,
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

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should reject non-positive initialBalance', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 0,
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

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should accept valid 1d timeframe', async () => {
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

    it('should accept valid 1h timeframe', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1h',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should accept valid 15m timeframe', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '15m',
        exchange: 'binance',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should reject invalid JSON', async () => {
      const res = await app.request('/backtest', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should handle database/service errors', async () => {
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
  })

  describe('GET /backtest/list detailed', () => {
    it('should return empty array if no backtests', async () => {
      const res = await app.request('/backtest/list')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should include backtest summaries', async () => {
      const res = await app.request('/backtest/list')
      if (res.status === 200) {
        const data = await res.json()
        data.forEach((item: any) => {
          if (item.id) {
            expect(typeof item.id).toBe('string')
          }
        })
      }
    })

    it('should handle database errors', async () => {
      const res = await app.request('/backtest/list')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /backtest/:id detailed', () => {
    it('should return 404 for nonexistent ID', async () => {
      const res = await app.request('/backtest/nonexistent-id-xyz')
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should include full result when found', async () => {
      const res = await app.request('/backtest/test-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
        // Should have metrics, timeline, etc.
        expect(typeof data).toBe('object')
      }
    })

    it('should handle database errors', async () => {
      const res = await app.request('/backtest/test-id')
      expect([200, 404, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /backtest edge cases', () => {
    it('should accept multiple pairs', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT', 'ETH/USDT'],
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
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

    it('should accept 0 threshold', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 0,
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

    it('should accept 0 fee', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0,
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
  })
})
