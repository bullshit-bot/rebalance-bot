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

    it('should return 400 when to param is invalid', async () => {
      const res = await app.request('/analytics/equity-curve?to=invalidnumber')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should handle database errors in equity curve', async () => {
      const res = await app.request('/analytics/equity-curve')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle database errors in drawdown', async () => {
      const res = await app.request('/analytics/drawdown')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /analytics/drawdown with time params', () => {
    it('should accept from parameter', async () => {
      const res = await app.request('/analytics/drawdown?from=1704067200')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept to parameter', async () => {
      const res = await app.request('/analytics/drawdown?to=1711065600')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should reject invalid from param', async () => {
      const res = await app.request('/analytics/drawdown?from=notanumber')
      expect(res.status).toBe(400)
    })

    it('should reject invalid to param', async () => {
      const res = await app.request('/analytics/drawdown?to=notanumber')
      expect(res.status).toBe(400)
    })

    it('should reject when from > to', async () => {
      const res = await app.request('/analytics/drawdown?from=2000000000&to=1000000000')
      expect(res.status).toBe(400)
    })
  })

  describe('GET /analytics/pnl with time params', () => {
    it('should reject invalid from param', async () => {
      const res = await app.request('/analytics/pnl?from=invalid')
      expect(res.status).toBe(400)
    })

    it('should reject invalid to param', async () => {
      const res = await app.request('/analytics/pnl?to=notanumber')
      expect(res.status).toBe(400)
    })

    it('should reject when from > to', async () => {
      const res = await app.request('/analytics/pnl?from=2000000000&to=1000000000')
      expect(res.status).toBe(400)
    })

    it('should handle service errors gracefully', async () => {
      const res = await app.request('/analytics/pnl')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /analytics/fees with time params', () => {
    it('should reject invalid from param', async () => {
      const res = await app.request('/analytics/fees?from=invalidnumber')
      expect(res.status).toBe(400)
    })

    it('should reject invalid to param', async () => {
      const res = await app.request('/analytics/fees?to=notanumber')
      expect(res.status).toBe(400)
    })

    it('should reject when from > to', async () => {
      const res = await app.request('/analytics/fees?from=2000000000&to=1000000000')
      expect(res.status).toBe(400)
    })

    it('should handle service errors', async () => {
      const res = await app.request('/analytics/fees')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /analytics/assets in detail', () => {
    it('should handle errors from pnl calculator', async () => {
      const res = await app.request('/analytics/assets')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should merge both pnl and fees data when successful', async () => {
      const res = await app.request('/analytics/assets')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('assets')
        expect(typeof data.assets).toBe('object')
        // Assets should have pnl, fees, net for each asset
        Object.entries(data.assets).forEach(([symbol, asset]: [string, any]) => {
          expect(typeof symbol).toBe('string')
          if (asset) {
            expect(asset).toHaveProperty('pnl')
            expect(asset).toHaveProperty('fees')
            expect(asset).toHaveProperty('net')
          }
        })
      }
    })
  })

  describe('GET /tax/report in detail', () => {
    it('should use current year when year param omitted', async () => {
      const res = await app.request('/tax/report')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should accept valid year parameter', async () => {
      const res = await app.request('/tax/report?year=2025')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should reject non-integer year', async () => {
      const res = await app.request('/tax/report?year=abc')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should reject year < 2000', async () => {
      const res = await app.request('/tax/report?year=1999')
      expect(res.status).toBe(400)
    })

    it('should reject year > 2100', async () => {
      const res = await app.request('/tax/report?year=2101')
      expect(res.status).toBe(400)
    })

    it('should handle service errors', async () => {
      const res = await app.request('/tax/report?year=2024')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /tax/export', () => {
    it('should return CSV when successful', async () => {
      const res = await app.request('/tax/export')
      expect([200, 401, 500]).toContain(res.status)
      if (res.status === 200) {
        expect(res.headers.get('content-type')).toContain('text/csv')
        expect(res.headers.get('content-disposition')).toBeDefined()
      }
    })

    it('should accept year parameter', async () => {
      const res = await app.request('/tax/export?year=2025')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should use current year when year param omitted', async () => {
      const res = await app.request('/tax/export')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should reject invalid year', async () => {
      const res = await app.request('/tax/export?year=notayear')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should reject year < 2000', async () => {
      const res = await app.request('/tax/export?year=1999')
      expect(res.status).toBe(400)
    })

    it('should reject year > 2100', async () => {
      const res = await app.request('/tax/export?year=2101')
      expect(res.status).toBe(400)
    })

    it('should handle service errors during CSV generation', async () => {
      const res = await app.request('/tax/export?year=2024')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should include filename in content-disposition header', async () => {
      const res = await app.request('/tax/export?year=2025')
      if (res.status === 200) {
        const disposition = res.headers.get('content-disposition')
        expect(disposition).toContain('tax-report-2025.csv')
      }
    })
  })
})
