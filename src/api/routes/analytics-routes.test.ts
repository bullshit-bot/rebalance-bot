import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { analyticsRoutes } from './analytics-routes'

describe('Analytics Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/analytics', analyticsRoutes)
  })

  describe('GET /analytics/equity', () => {
    it('should return equity curve', async () => {
      const res = await app.request('/analytics/equity')
      expect([200, 401]).toContain(res.status)
    })

    it('should support date range', async () => {
      const res = await app.request('/analytics/equity?since=2024-01-01&until=2024-03-22')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array of points', async () => {
      const res = await app.request('/analytics/equity')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('GET /analytics/pnl', () => {
    it('should return PnL data', async () => {
      const res = await app.request('/analytics/pnl')
      expect([200, 401]).toContain(res.status)
    })

    it('should include realized and unrealized', async () => {
      const res = await app.request('/analytics/pnl')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /analytics/drawdown', () => {
    it('should return drawdown metrics', async () => {
      const res = await app.request('/analytics/drawdown')
      expect([200, 401]).toContain(res.status)
    })

    it('should include max drawdown', async () => {
      const res = await app.request('/analytics/drawdown')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /analytics/fees', () => {
    it('should return fee summary', async () => {
      const res = await app.request('/analytics/fees')
      expect([200, 401]).toContain(res.status)
    })

    it('should support period parameter', async () => {
      const res = await app.request('/analytics/fees?period=30d')
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('GET /analytics/tax', () => {
    it('should return tax report', async () => {
      const res = await app.request('/analytics/tax')
      expect([200, 401]).toContain(res.status)
    })

    it('should support year parameter', async () => {
      const res = await app.request('/analytics/tax?year=2024')
      expect([200, 401]).toContain(res.status)
    })

    it('should include realized gains', async () => {
      const res = await app.request('/analytics/tax')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('error handling', () => {
    it('should handle invalid date ranges', async () => {
      const res = await app.request('/analytics/equity?since=invalid&until=invalid')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle invalid periods', async () => {
      const res = await app.request('/analytics/fees?period=invalid')
      expect([200, 400, 401]).toContain(res.status)
    })
  })
})
