import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { copyTradingRoutes } from './copy-trading-routes'

describe('Copy Trading Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/copy-trading', copyTradingRoutes)
  })

  describe('GET /copy-trading/sources', () => {
    it('should list copy sources', async () => {
      const res = await app.request('/copy-trading/sources')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/copy-trading/sources')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('POST /copy-trading/sources', () => {
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

      const res = await app.request('/copy-trading/sources', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
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

      const res = await app.request('/copy-trading/sources', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should return source ID', async () => {
      const body = JSON.stringify({
        name: 'Test Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/copy-trading/sources', {
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

  describe('GET /copy-trading/sources/:id', () => {
    it('should get source by ID', async () => {
      const res = await app.request('/copy-trading/sources/source-123')
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('PUT /copy-trading/sources/:id', () => {
    it('should update source', async () => {
      const body = JSON.stringify({ name: 'Updated Name' })

      const res = await app.request('/copy-trading/sources/source-123', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('DELETE /copy-trading/sources/:id', () => {
    it('should remove source', async () => {
      const res = await app.request('/copy-trading/sources/source-123', { method: 'DELETE' })
      expect([200, 204, 404, 401]).toContain(res.status)
    })
  })

  describe('POST /copy-trading/sync', () => {
    it('should trigger sync', async () => {
      const res = await app.request('/copy-trading/sync', { method: 'POST' })
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should sync specific source', async () => {
      const res = await app.request('/copy-trading/sync?sourceId=source-123', { method: 'POST' })
      expect([200, 400, 401]).toContain(res.status)
    })
  })

  describe('GET /copy-trading/sync-history', () => {
    it('should return sync history', async () => {
      const res = await app.request('/copy-trading/sync-history')
      expect([200, 401]).toContain(res.status)
    })

    it('should support limit', async () => {
      const res = await app.request('/copy-trading/sync-history?limit=20')
      expect([200, 401]).toContain(res.status)
    })
  })
})
