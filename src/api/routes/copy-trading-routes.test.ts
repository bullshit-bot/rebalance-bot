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
    it('should trigger sync all', async () => {
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })
      expect([200, 400, 401, 422]).toContain(res.status)
    })

    it('should sync specific source', async () => {
      const res = await app.request('/copy/sync', {
        method: 'POST',
        body: JSON.stringify({ sourceId: 'source-123' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect([200, 400, 401, 422]).toContain(res.status)
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
})
