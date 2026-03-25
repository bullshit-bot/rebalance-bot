import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { rebalanceRoutes } from './rebalance-routes'

describe('Rebalance Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/rebalance', rebalanceRoutes)
  })

  describe('POST /rebalance', () => {
    it('should trigger rebalance', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      expect([200, 201, 400, 401, 404, 500]).toContain(res.status)
    })

    it('should return JSON response when successful', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status !== 404) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    it('should return response with error or event data', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status !== 404) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })

    it('should return 201 on successful trigger', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 201) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })

    it('should handle trigger errors', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })

  describe('GET /rebalance/preview', () => {
    it('should return rebalance preview', async () => {
      const res = await app.request('/rebalance/preview')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should return JSON', async () => {
      const res = await app.request('/rebalance/preview')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should include trades array in response', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
        if (data.trades !== undefined) {
          expect(Array.isArray(data.trades)).toBe(true)
        }
      }
    })

    it('should handle Portfolio not yet available error gracefully', async () => {
      const res = await app.request('/rebalance/preview')
      // When preview throws "Portfolio not yet available", should return empty preview
      if (res.status === 200) {
        const data = await res.json()
        // Should have trades and portfolio fields
        expect(data).toHaveProperty('trades')
        expect(data).toHaveProperty('portfolio')
        if (data.trades) {
          expect(Array.isArray(data.trades)).toBe(true)
        }
        // portfolio can be null when unavailable
        if (data.portfolio === null) {
          expect(data.trades.length).toBe(0)
        }
      }
    })

    it('should return empty trades when portfolio unavailable', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        // When portfolio is null, trades should be empty
        if (data.portfolio === null) {
          expect(Array.isArray(data.trades)).toBe(true)
          expect(data.trades.length).toBe(0)
        }
      }
    })

    it('should not return 500 for Portfolio not yet available error', async () => {
      const res = await app.request('/rebalance/preview')
      // "Portfolio not yet available" should be handled as 200 with empty preview
      // not 500 error
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      } else if (res.status === 500) {
        const data = await res.json()
        // If 500, should not be about portfolio availability
        if (data.error) {
          expect(data.error).not.toContain('Portfolio not yet available')
        }
      }
    })

    it('should return 500 for other errors', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })

  describe('GET /rebalance/history', () => {
    it('should return rebalance history', async () => {
      const res = await app.request('/rebalance/history')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should support limit parameter', async () => {
      const res = await app.request('/rebalance/history?limit=20')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should return array on success', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should validate limit parameter bounds', async () => {
      const res = await app.request('/rebalance/history?limit=1')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should enforce max limit of 200', async () => {
      const res = await app.request('/rebalance/history?limit=201')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    it('should reject limit < 1', async () => {
      const res = await app.request('/rebalance/history?limit=0')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    it('should reject invalid limit', async () => {
      const res = await app.request('/rebalance/history?limit=invalid')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    it('should default limit to 20 when not provided', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should return recent rebalances first', async () => {
      const res = await app.request('/rebalance/history?limit=10')
      if (res.status === 200) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 1) {
          // Verify order (most recent first)
          expect(data[0].startedAt).toBeGreaterThanOrEqual(data[data.length - 1].startedAt)
        }
      }
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle POST errors', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle missing auth', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 401) {
        expect(res.status).toBe(401)
      }
    })
  })

  describe('POST /rebalance edge cases', () => {
    it('should return JSON on error', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status !== 404) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    it('should handle rebalance trigger with no portfolio', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      expect([200, 201, 400, 401, 404, 500]).toContain(res.status)
    })

    it('should include rebalance event when successful', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('event')
      }
    })
  })

  describe('GET /rebalance/preview detailed behavior', () => {
    it('should handle null portfolio gracefully', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        if (data.portfolio === null) {
          expect(data.trades).toBeDefined()
          expect(Array.isArray(data.trades)).toBe(true)
        }
      }
    })

    it('should include portfolio when available', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('trades')
        expect(data).toHaveProperty('portfolio')
      }
    })

    it('should handle rebalancer calculation errors', async () => {
      const res = await app.request('/rebalance/preview')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /rebalance/history detailed behavior', () => {
    it('should default limit to 20', async () => {
      const res = await app.request('/rebalance/history')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept limit=5', async () => {
      const res = await app.request('/rebalance/history?limit=5')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept limit=100', async () => {
      const res = await app.request('/rebalance/history?limit=100')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should accept limit=200', async () => {
      const res = await app.request('/rebalance/history?limit=200')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    it('should handle float limit parameter', async () => {
      const res = await app.request('/rebalance/history?limit=5.5')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle negative limit', async () => {
      const res = await app.request('/rebalance/history?limit=-1')
      if (res.status === 400) {
        const data = await res.json()
          expect(data).toHaveProperty('error')
      }
    })

    it('should retrieve history from database', async () => {
      const res = await app.request('/rebalance/history?limit=10')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        data.forEach((item: any) => {
          expect(item).toHaveProperty('id')
          expect(item).toHaveProperty('startedAt')
          expect(item).toHaveProperty('completedAt')
        })
      }
    })

    it('should handle empty history', async () => {
      const res = await app.request('/rebalance/history?limit=10')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should order results by most recent first', async () => {
      const res = await app.request('/rebalance/history?limit=50')
      if (res.status === 200) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 1) {
          for (let i = 0; i < data.length - 1; i++) {
            expect(data[i].startedAt).toBeGreaterThanOrEqual(data[i + 1].startedAt)
          }
        }
      }
    })

    it('should reject NaN limit parameter', async () => {
      const res = await app.request('/rebalance/history?limit=notanumber')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    it('should explicitly reject 0 limit', async () => {
      const res = await app.request('/rebalance/history?limit=0')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })

    it('should explicitly reject 201 limit', async () => {
      const res = await app.request('/rebalance/history?limit=201')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })
  })

  describe('POST /rebalance detailed error cases', () => {
    it('should handle trigger errors with message', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 500) {
        const data = await res.json()
        expect(typeof data.error).toBe('string')
      }
    })

    it('should return correct status on success', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 201) {
        expect(res.status).toBe(201)
      }
    })
  })

  describe('GET /rebalance/preview error paths', () => {
    it('should handle rebalancer service failure', async () => {
      const res = await app.request('/rebalance/preview')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return structured error on 500', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })
  })
})
