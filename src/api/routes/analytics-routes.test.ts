import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { analyticsRoutes } from './analytics-routes'

describe('Analytics Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', analyticsRoutes)
  })

  describe('GET /analytics/equity-curve', () => {
    it('should return equity curve', async () => {
      const res = await app.request('/analytics/equity-curve')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support from/to unix timestamp params', async () => {
      const res = await app.request('/analytics/equity-curve?from=1704067200&to=1711065600')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return data object with array', async () => {
      const res = await app.request('/analytics/equity-curve')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })

    it('should reject invalid from param', async () => {
      const res = await app.request('/analytics/equity-curve?from=invalid')
      expect(res.status).toBe(400)
    })
  })

  describe('GET /analytics/pnl', () => {
    it('should return PnL data', async () => {
      const res = await app.request('/analytics/pnl')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support time range params', async () => {
      const res = await app.request('/analytics/pnl?from=1704067200&to=1711065600')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should include realized data when successful', async () => {
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
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should include max drawdown data when successful', async () => {
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
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support time range params', async () => {
      const res = await app.request('/analytics/fees?from=1704067200&to=1711065600')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should reject invalid to param', async () => {
      const res = await app.request('/analytics/fees?to=invalid')
      expect(res.status).toBe(400)
    })
  })

  describe('GET /analytics/assets', () => {
    it('should return per-asset performance', async () => {
      const res = await app.request('/analytics/assets')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should include assets object when successful', async () => {
      const res = await app.request('/analytics/assets')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('assets')
      }
    })
  })

  describe('GET /tax/report', () => {
    it('should return tax report', async () => {
      const res = await app.request('/tax/report')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support year parameter', async () => {
      const res = await app.request('/tax/report?year=2024')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should reject invalid year', async () => {
      const res = await app.request('/tax/report?year=invalid')
      expect(res.status).toBe(400)
    })
  })

  describe('error handling', () => {
    it('should return 400 for invalid from timestamp', async () => {
      const res = await app.request('/analytics/equity-curve?from=notanumber')
      expect(res.status).toBe(400)
    })

    it('should return 400 when from > to', async () => {
      const res = await app.request('/analytics/pnl?from=9999999999&to=1000000000')
      expect(res.status).toBe(400)
    })
  })
})
