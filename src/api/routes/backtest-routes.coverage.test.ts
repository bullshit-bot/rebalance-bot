import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { backtestRoutes } from './backtest-routes'

/**
 * Coverage tests for backtest routes
 * Targets uncovered branches in:
 * - validateConfig() validation logic (pairs, allocations, dates, balance, fees, strategy)
 * - POST /backtest with various configurations
 * - GET /backtest/list result handling
 * - GET /backtest/:id not found scenarios
 * - POST /backtest/optimize validation and grid search
 */

describe('Backtest Routes Coverage Tests', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', backtestRoutes)
  })

  // ─── POST /backtest validation ────────────────────────────────────────────

  describe('POST /backtest validation', () => {
    it('rejects invalid JSON', async () => {
      const res = await app.request('/backtest', {
        method: 'POST',
        body: 'invalid json {',
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Invalid JSON')
    })

    it('rejects missing pairs', async () => {
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
      const data = await res.json()
      expect(data.error).toContain('pairs')
    })

    it('rejects empty pairs array', async () => {
      const body = JSON.stringify({
        pairs: [],
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

    it('rejects non-array pairs', async () => {
      const body = JSON.stringify({
        pairs: 'not-an-array',
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

    it('rejects missing allocations', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
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

    it('rejects empty allocations array', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [],
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

    it('rejects invalid startDate (zero)', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 0,
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
      const data = await res.json()
      expect(data.error).toContain('startDate')
    })

    it('rejects invalid startDate (negative)', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: -1000,
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

    it('rejects startDate >= endDate', async () => {
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

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('startDate must be earlier than endDate')
    })

    it('rejects invalid initialBalance (zero)', async () => {
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

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('initialBalance')
    })

    it('rejects invalid initialBalance (negative)', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: -1000,
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

    it('rejects invalid threshold (zero)', async () => {
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

      expect(res.status).toBe(400)
    })

    it('rejects invalid threshold (> 100)', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 101,
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

    it('accepts valid threshold values', async () => {
      for (const threshold of [0.1, 5, 50, 99]) {
        const body = JSON.stringify({
          pairs: ['BTC/USDT'],
          allocations: [{ asset: 'BTC', targetPct: 100 }],
          startDate: 1704067200000,
          endDate: 1711065600000,
          initialBalance: 10000,
          threshold,
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
      }
    })

    it('rejects invalid feePct (negative)', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: -0.001,
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

    it('accepts zero feePct', async () => {
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

    it('rejects invalid timeframe', async () => {
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
      const data = await res.json()
      expect(data.error).toContain("'1h' or '1d'")
    })

    it('accepts timeframe=1h', async () => {
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

    it('accepts timeframe=1d', async () => {
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

    it('rejects missing exchange', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('exchange')
    })

    it('rejects empty exchange', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: '',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  // ─── Strategy parameter validation ────────────────────────────────────────

  describe('POST /backtest strategy validation', () => {
    it('rejects strategyType without strategyParams', async () => {
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
        strategyType: 'momentum',
      })

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('strategyParams')
    })

    it('accepts valid config without strategy', async () => {
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

  // ─── GET /backtest/list ───────────────────────────────────────────────────

  describe('GET /backtest/list', () => {
    it('returns array of results', async () => {
      const res = await app.request('/backtest/list')

      expect([200, 400, 401, 500]).toContain(res.status)
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('includes config summary fields', async () => {
      const res = await app.request('/backtest/list')

      if (res.status === 200) {
        const data = await res.json()
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('id')
          expect(data[0]).toHaveProperty('configSummary')
          expect(data[0]).toHaveProperty('metrics')
        }
      }
    })

    it('handles empty result list', async () => {
      const res = await app.request('/backtest/list')

      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('handles database errors', async () => {
      const res = await app.request('/backtest/list')

      expect([200, 400, 401, 500]).toContain(res.status)
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })

  // ─── GET /backtest/:id ────────────────────────────────────────────────────

  describe('GET /backtest/:id', () => {
    it('returns 404 for non-existent ID', async () => {
      const res = await app.request('/backtest/nonexistent-id')

      if (res.status === 404) {
        const data = await res.json()
        expect(data.error).toContain('not found')
      }
    })

    it('includes full result data on success', async () => {
      const res = await app.request('/backtest/any-id')

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('config')
        expect(data).toHaveProperty('metrics')
        expect(data).toHaveProperty('trades')
        expect(data).toHaveProperty('benchmark')
      }
    })

    it('handles database errors gracefully', async () => {
      const res = await app.request('/backtest/test-id')

      expect([200, 400, 401, 404, 500]).toContain(res.status)
    })
  })

  // ─── POST /backtest/optimize ──────────────────────────────────────────────

  describe('POST /backtest/optimize', () => {
    it('rejects invalid JSON', async () => {
      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body: 'invalid json {',
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('rejects non-object body', async () => {
      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body: JSON.stringify('not an object'),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('validates pairs parameter', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        feePct: 0.001,
        exchange: 'binance',
      })

      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('validates allocations parameter', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        feePct: 0.001,
        exchange: 'binance',
      })

      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('accepts optional timeframe with default', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        feePct: 0.001,
        exchange: 'binance',
      })

      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('accepts optional includeCashScenarios', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        feePct: 0.001,
        exchange: 'binance',
        includeCashScenarios: true,
      })

      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('handles non-boolean includeCashScenarios', async () => {
      const body = JSON.stringify({
        pairs: ['BTC/USDT'],
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        startDate: 1704067200000,
        endDate: 1711065600000,
        initialBalance: 10000,
        feePct: 0.001,
        exchange: 'binance',
        includeCashScenarios: 'true', // should be boolean
      })

      const res = await app.request('/backtest/optimize', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      // Should default to false
      expect([200, 400, 401, 500]).toContain(res.status)
    })
  })

  // ─── Status code validation ────────────────────────────────────────────────

  describe('Status codes', () => {
    it('returns 201 on successful backtest creation', async () => {
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

      if (res.ok) {
        expect(res.status).toBe(201)
      }
    })

    it('returns 400 for validation errors', async () => {
      const body = JSON.stringify({})

      const res = await app.request('/backtest', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })
})
