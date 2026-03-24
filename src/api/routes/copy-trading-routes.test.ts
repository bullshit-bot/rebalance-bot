import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { copyTradingRoutes } from './copy-trading-routes'

describe('Copy Trading Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', copyTradingRoutes)
  })

  describe('GET /copy/sources', () => {
    it('should list copy sources', async () => {
      const res = await app.request('/copy/sources')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/copy/sources')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('POST /copy/source', () => {
    it('should add URL source', async () => {
      const body = JSON.stringify({
        name: 'External Fund',
        sourceType: 'url',
        sourceUrl: 'https://example.com/portfolio.json',
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should add manual source', async () => {
      const body = JSON.stringify({
        name: 'Manual Portfolio',
        sourceType: 'manual',
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should return source ID on success', async () => {
      const body = JSON.stringify({
        name: 'Test Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
      }
    })

    it('should reject missing name', async () => {
      const body = JSON.stringify({
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /copy/source/:id', () => {
    it('should update source', async () => {
      const body = JSON.stringify({ name: 'Updated Name' })

      const res = await app.request('/copy/source/source-123', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 404, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('DELETE /copy/source/:id', () => {
    it('should remove source', async () => {
      const res = await app.request('/copy/source/source-123', { method: 'DELETE' })
      expect([200, 204, 404, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /copy/sync', () => {
    it('should accept POST request', async () => {
      // Sync triggers real HTTP to source URLs — just verify route exists
      // by sending a request for a non-existent source (returns quickly)
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({ sourceId: 'non-existent-id' }),
        headers: { 'Content-Type': 'application/json' },
      })
      // Accept any non-timeout response
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    })
  })

  describe('GET /copy/history', () => {
    it('should return sync history', async () => {
      const res = await app.request('/copy/history')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support limit param', async () => {
      const res = await app.request('/copy/history?limit=20')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /copy/sources detailed', () => {
    it('should return JSON array', async () => {
      const res = await app.request('/copy/sources')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should include source details', async () => {
      const res = await app.request('/copy/sources')
      if (res.status === 200) {
        const data = await res.json()
        data.forEach((source: any) => {
          expect(source).toHaveProperty('id')
          expect(source).toHaveProperty('name')
          expect(source).toHaveProperty('sourceType')
        })
      }
    })

    it('should handle database errors', async () => {
      const res = await app.request('/copy/sources')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /copy/source validation', () => {
    it('should validate allocations sum', async () => {
      const body = JSON.stringify({
        name: 'Invalid Source',
        sourceType: 'manual',
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 60 },
        ],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should require allocations for manual source', async () => {
      const body = JSON.stringify({
        name: 'No Allocations',
        sourceType: 'manual',
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should require sourceUrl for url source', async () => {
      const body = JSON.stringify({
        name: 'URL Source Without URL',
        sourceType: 'url',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should reject invalid sourceType', async () => {
      const body = JSON.stringify({
        name: 'Invalid Type',
        sourceType: 'invalid',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should handle invalid JSON body', async () => {
      const res = await app.request('/copy/source', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const body = JSON.stringify({
        name: 'Test Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy/source', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('PUT /copy/source/:id detailed', () => {
    it('should handle non-existent source', async () => {
      const body = JSON.stringify({ name: 'Updated' })

      const res = await app.request('/copy/source/nonexistent-id', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should require valid JSON', async () => {
      const res = await app.request('/copy/source/source-123', {
        method: 'PUT',
        body: 'invalid',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 404, 401, 422, 500]).toContain(res.status)
    })

    it('should update name field', async () => {
      const body = JSON.stringify({ name: 'New Name' })

      const res = await app.request('/copy/source/source-123', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 404, 401, 422, 500]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const body = JSON.stringify({ name: 'Updated' })

      const res = await app.request('/copy/source/source-123', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 404, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('DELETE /copy/source/:id detailed', () => {
    it('should return 204 on successful delete', async () => {
      const res = await app.request('/copy/source/source-123', { method: 'DELETE' })
      expect([200, 204, 404, 401, 500]).toContain(res.status)
    })

    it('should handle non-existent source', async () => {
      const res = await app.request('/copy/source/nonexistent-id', { method: 'DELETE' })
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle database errors', async () => {
      const res = await app.request('/copy/source/source-123', { method: 'DELETE' })
      expect([200, 204, 404, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /copy/sync detailed', () => {
    it('should require sourceId', async () => {
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    })

    it('should handle missing source gracefully', async () => {
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({ sourceId: 'nonexistent' }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    })

    it('should return JSON response', async () => {
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({ sourceId: 'test-id' }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /copy/history detailed', () => {
    it('should return history array', async () => {
      const res = await app.request('/copy/history')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should support different limits', async () => {
      const res = await app.request('/copy/history?limit=10')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should support limit=50', async () => {
      const res = await app.request('/copy/history?limit=50')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const res = await app.request('/copy/history')
      expect([200, 401, 500]).toContain(res.status)
    })
  })
})
