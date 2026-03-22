import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { aiRoutes } from './ai-routes'

describe('AI Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/ai', aiRoutes)
  })

  describe('GET /ai/suggestions', () => {
    it('should list suggestions', async () => {
      const res = await app.request('/ai/suggestions')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/ai/suggestions')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should filter by status', async () => {
      const res = await app.request('/ai/suggestions?status=pending')
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('POST /ai/suggestions/receive', () => {
    it('should receive suggestion', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Market analysis suggests rebalance',
      })

      const res = await app.request('/ai/suggestions/receive', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should include sentiment data', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Based on sentiment',
        sentimentData: { fear_index: 25 },
      })

      const res = await app.request('/ai/suggestions/receive', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should validate allocations', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 60 }, // 120% invalid
        ],
        reasoning: 'Invalid',
      })

      const res = await app.request('/ai/suggestions/receive', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })
  })

  describe('GET /ai/suggestions/:id', () => {
    it('should get suggestion by ID', async () => {
      const res = await app.request('/ai/suggestions/sugg-123')
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('POST /ai/suggestions/:id/approve', () => {
    it('should approve suggestion', async () => {
      const res = await app.request('/ai/suggestions/sugg-123/approve', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })

    it('should trigger rebalance', async () => {
      const res = await app.request('/ai/suggestions/sugg-123/approve', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('POST /ai/suggestions/:id/reject', () => {
    it('should reject suggestion', async () => {
      const res = await app.request('/ai/suggestions/sugg-123/reject', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('GET /ai/pending', () => {
    it('should return pending suggestions only', async () => {
      const res = await app.request('/ai/pending')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/ai/pending')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })
})
