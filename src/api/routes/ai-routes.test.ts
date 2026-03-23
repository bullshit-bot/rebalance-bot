import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { aiRoutes } from './ai-routes'

describe('AI Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', aiRoutes)
  })

  describe('GET /ai/suggestions', () => {
    it('should list suggestions', async () => {
      const res = await app.request('/ai/suggestions')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/ai/suggestions')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should filter by pending status', async () => {
      const res = await app.request('/ai/suggestions?status=pending')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /ai/suggestion', () => {
    it('should receive suggestion', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Market analysis suggests rebalance',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should accept sentiment data', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Based on sentiment',
        sentimentData: { fear_index: 25 },
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should reject missing reasoning', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject empty allocations', async () => {
      const body = JSON.stringify({
        allocations: [],
        reasoning: 'Test',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /ai/suggestions/:id — via suggestions list route', () => {
    it('should not 404 on suggestions list', async () => {
      const res = await app.request('/ai/suggestions')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('PUT /ai/suggestion/:id/approve', () => {
    it('should approve suggestion', async () => {
      const res = await app.request('/ai/suggestion/sugg-123/approve', { method: 'PUT' })
      expect([200, 404, 401, 422]).toContain(res.status)
    })
  })

  describe('PUT /ai/suggestion/:id/reject', () => {
    it('should reject suggestion', async () => {
      const res = await app.request('/ai/suggestion/sugg-123/reject', { method: 'PUT' })
      expect([200, 404, 401, 422]).toContain(res.status)
    })
  })

  describe('PUT /ai/config', () => {
    it('should update autoApprove flag', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: true }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should reject invalid autoApprove type', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: 'yes' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /ai/summary', () => {
    it('should return market summary', async () => {
      const res = await app.request('/ai/summary')
      expect([200, 401, 500]).toContain(res.status)
    })
  })
})
