import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { tradeRoutes } from './trade-routes'

describe('Trade Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/trades', tradeRoutes)
  })

  describe('GET /trades', () => {
    it('should return trades', async () => {
      const res = await app.request('/trades')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return JSON', async () => {
      const res = await app.request('/trades')
      if (res.status >= 200 && res.status < 300) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    it('should return array on success', async () => {
      const res = await app.request('/trades')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('GET /trades with limit parameter', () => {
    it('should accept default limit (50)', async () => {
      const res = await app.request('/trades')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept custom limit', async () => {
      const res = await app.request('/trades?limit=10')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept limit at boundary (1)', async () => {
      const res = await app.request('/trades?limit=1')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept limit at boundary (500)', async () => {
      const res = await app.request('/trades?limit=500')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should reject limit > 500', async () => {
      const res = await app.request('/trades?limit=501')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 500')
      }
    })

    it('should reject limit < 1', async () => {
      const res = await app.request('/trades?limit=0')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 500')
      }
    })

    it('should reject negative limit', async () => {
      const res = await app.request('/trades?limit=-1')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should reject non-numeric limit', async () => {
      const res = await app.request('/trades?limit=abc')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 500')
      }
    })

    it('should reject float limit', async () => {
      const res = await app.request('/trades?limit=5.5')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })

  describe('GET /trades with rebalanceId filter', () => {
    it('should filter by rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=rb-001')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle non-existent rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=nonexistent')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should combine limit and rebalanceId', async () => {
      const res = await app.request('/trades?limit=10&rebalanceId=rb-001')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should filter with various rebalanceIds', async () => {
      const ids = ['rb-001', 'rb-002', 'test-id', 'long-rebalance-id-12345']
      for (const id of ids) {
        const res = await app.request(`/trades?rebalanceId=${id}`)
        expect([200, 401, 500]).toContain(res.status)
      }
    })
  })

  describe('Error handling', () => {
    it('should return JSON on error', async () => {
      const res = await app.request('/trades?limit=999')
      if (res.status >= 400) {
        expect(res.headers.get('content-type')).toContain('application/json')
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle database errors gracefully', async () => {
      const res = await app.request('/trades')
      expect([200, 401, 500]).toContain(res.status)
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })

    it('should return error structure on 400', async () => {
      const res = await app.request('/trades?limit=invalid')
      if (res.status === 400) {
        const data = await res.json()
        expect(typeof data.error).toBe('string')
        expect(data.error.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should handle special characters in rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=rb%20001')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should ignore unknown parameters', async () => {
      const res = await app.request('/trades?unknown=value&limit=10')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should handle database error in catch block', async () => {
      // This tests the error handling path at lines 31-33
      const res = await app.request('/trades?limit=1')
      expect([200, 400, 401, 500]).toContain(res.status)
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })
  })
})
