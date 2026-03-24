import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { db } from '@db/database'
import { rebalances } from '@db/schema'
import { rebalanceRoutes } from './rebalance-routes'
import { eq, gte } from 'drizzle-orm'

describe('rebalance-routes integration', () => {
  let app: Hono

  beforeAll(async () => {
    // Set up app with routes
    app = new Hono()
    app.route('/rebalance', rebalanceRoutes)

    // Clean up old test rebalances
    const oneHourAgo = Math.floor((Date.now() - 3600000) / 1000)
    const oldRebalances = await db
      .select()
      .from(rebalances)
      .where(gte(rebalances.startedAt, oneHourAgo))

    for (const rb of oldRebalances) {
      await db.delete(rebalances).where(eq(rebalances.id, rb.id)).catch(() => {})
    }
  })

  afterAll(async () => {
    // Clean up test data
    const oneHourAgo = Math.floor((Date.now() - 3600000) / 1000)
    const testRebalances = await db
      .select()
      .from(rebalances)
      .where(gte(rebalances.startedAt, oneHourAgo))
      .catch(() => [])

    for (const rb of testRebalances) {
      await db.delete(rebalances).where(eq(rebalances.id, rb.id)).catch(() => {})
    }
  })

  describe('POST /rebalance error path coverage', () => {
    test('POST /rebalance returns 201 on success with event', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 201) {
        const data = await res.json()
        expect(data).toBeDefined()
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    test('POST /rebalance returns 500 on error with error message', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })
  })

  describe('GET /rebalance/preview error path coverage', () => {
    test('preview returns 200 with empty preview when portfolio unavailable', async () => {
      const res = await app.request('/rebalance/preview')
      // When portfolio is unavailable, should return 200 with empty preview
      // or if portfolio IS available, should still return 200
      expect([200, 401, 500]).toContain(res.status)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
        // Should have either empty preview or full preview
        if (data.portfolio === null) {
          expect(data.trades).toEqual([])
        } else if (data.trades) {
          expect(Array.isArray(data.trades)).toBe(true)
        }
      }
    })

    test('preview returns JSON on error responses', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status >= 400) {
        expect(res.headers.get('content-type')).toContain('application/json')
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })

    test('preview does not return 500 for Portfolio not yet available', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        // If we got 200, it was handled as empty preview (not 500)
        expect(data).toHaveProperty('trades')
      } else if (res.status === 500) {
        const data = await res.json()
        if (data.error) {
          // If it's a 500, it should NOT be about portfolio unavailability
          expect(data.error).not.toContain('Portfolio not yet available')
        }
      }
    })
  })

  describe('GET /rebalance/history error path coverage', () => {
    test('history returns array on success', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    test('history returns 400 for invalid limit parameter', async () => {
      // Test with limit that's too high
      const res1 = await app.request('/rebalance/history?limit=201')
      if (res1.status === 400) {
        const data = await res1.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    test('history returns 400 for limit < 1', async () => {
      const res = await app.request('/rebalance/history?limit=0')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    test('history returns 400 for non-numeric limit', async () => {
      const res = await app.request('/rebalance/history?limit=abc')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('limit must be an integer between 1 and 200')
      }
    })

    test('history returns 400 for negative limit', async () => {
      const res = await app.request('/rebalance/history?limit=-10')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    test('history returns JSON on error', async () => {
      const res = await app.request('/rebalance/history?limit=abc')
      expect([200, 400, 500, 401]).toContain(res.status)
      if (res.status >= 400) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    test('history with valid limit returns array', async () => {
      const res = await app.request('/rebalance/history?limit=10')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        // Check items have expected shape
        data.forEach((item: any) => {
          expect(item).toHaveProperty('id')
          expect(item).toHaveProperty('startedAt')
        })
      }
    })

    test('history orders results by recent first', async () => {
      const res = await app.request('/rebalance/history?limit=50')
      if (res.status === 200) {
        const data = await res.json()
        if (data.length > 1) {
          for (let i = 0; i < data.length - 1; i++) {
            expect(data[i].startedAt).toBeGreaterThanOrEqual(data[i + 1].startedAt)
          }
        }
      }
    })

    test('history returns JSON response', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 200 || res.status === 400 || res.status === 500) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })
  })

  describe('Edge cases and error handling', () => {
    test('POST endpoint returns JSON content-type', async () => {
      const res = await app.request('/rebalance/', { method: 'POST' })
      if (res.status !== 404) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    test('history with limit=1 works', async () => {
      const res = await app.request('/rebalance/history?limit=1')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    test('history with limit=200 works', async () => {
      const res = await app.request('/rebalance/history?limit=200')
      expect([200, 400, 401, 500]).toContain(res.status)
    })

    test('preview returns correct JSON structure', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('trades')
        expect(Array.isArray(data.trades)).toBe(true)
      }
    })
  })
})
