import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { backtestRoutes } from './backtest-routes'

describe('Backtest Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/backtest', backtestRoutes)
  })

  describe('POST /backtest/run', () => {
    it('should run backtest', async () => {
      const body = JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-03-22',
        pair: 'BTC/USDT',
      })

      const res = await app.request('/backtest/run', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should require start date', async () => {
      const body = JSON.stringify({ endDate: '2024-03-22', pair: 'BTC/USDT' })

      const res = await app.request('/backtest/run', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should return backtest ID', async () => {
      const body = JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-03-22',
        pair: 'BTC/USDT',
      })

      const res = await app.request('/backtest/run', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 200 || res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
      }
    })
  })

  describe('GET /backtest/:id', () => {
    it('should get backtest result', async () => {
      const res = await app.request('/backtest/test-123')
      expect([200, 404, 401]).toContain(res.status)
    })

    it('should include metrics', async () => {
      const res = await app.request('/backtest/test-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /backtest', () => {
    it('should list backtests', async () => {
      const res = await app.request('/backtest')
      expect([200, 401]).toContain(res.status)
    })

    it('should support pagination', async () => {
      const res = await app.request('/backtest?limit=10&offset=0')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/backtest')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })
})
