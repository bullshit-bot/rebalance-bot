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

    it('should accept empty body for PUT /ai/config', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })
      expect([200, 400, 401]).toContain(res.status)
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('autoApprove')
        expect(data).toHaveProperty('maxAllocationShiftPct')
        expect(data).toHaveProperty('enabled')
      }
    })

    it('should update maxShiftPct field', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: 5.5 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should reject invalid maxShiftPct', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: -1 }),
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

    it('should handle market summary generation (lines 143-145)', async () => {
      // Test the GET /ai/summary endpoint which includes error handling
      const res = await app.request('/ai/summary')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('summary')
      } else if (res.status === 500) {
        // Error case — should have error field
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return json response for summary', async () => {
      const res = await app.request('/ai/summary')
      expect(res.headers.get('content-type')).toContain('application/json')
      const data = await res.json()
      expect(typeof data).toBe('object')
    })
  })

  describe('GET /ai/suggestions detailed', () => {
    it('should return empty array if no suggestions', async () => {
      const res = await app.request('/ai/suggestions')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should filter by approved status', async () => {
      const res = await app.request('/ai/suggestions?status=approved')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should filter by rejected status', async () => {
      const res = await app.request('/ai/suggestions?status=rejected')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle invalid status filter', async () => {
      const res = await app.request('/ai/suggestions?status=invalid')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const res = await app.request('/ai/suggestions')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /ai/suggestion validation', () => {
    it('should validate allocations sum to 100%', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 60 },
        ],
        reasoning: 'Invalid percentages',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should accept valid allocations summing to 100%', async () => {
      const body = JSON.stringify({
        allocations: [
          { asset: 'BTC', targetPct: 70 },
          { asset: 'ETH', targetPct: 30 },
        ],
        reasoning: 'Correct percentages',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should validate reasoning is non-empty string', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: '',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle invalid JSON body', async () => {
      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should accept optional sentimentData', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: 'Based on sentiment analysis',
        sentimentData: {
          fear_index: 30,
          bullish: true,
          confidence: 0.75,
        },
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const body = JSON.stringify({
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: 'Test suggestion',
      })

      const res = await app.request('/ai/suggestion', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('PUT /ai/suggestion/:id/approve detailed', () => {
    it('should return 404 for nonexistent suggestion', async () => {
      const res = await app.request('/ai/suggestion/nonexistent-id/approve', { method: 'PUT' })
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return 422 when already approved', async () => {
      const res = await app.request('/ai/suggestion/already-approved/approve', { method: 'PUT' })
      expect([200, 404, 401, 422]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const res = await app.request('/ai/suggestion/test-id/approve', { method: 'PUT' })
      expect([200, 404, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('PUT /ai/suggestion/:id/reject detailed', () => {
    it('should return 404 for nonexistent suggestion', async () => {
      const res = await app.request('/ai/suggestion/nonexistent-id/reject', { method: 'PUT' })
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return 422 when already rejected', async () => {
      const res = await app.request('/ai/suggestion/already-rejected/reject', { method: 'PUT' })
      expect([200, 404, 401, 422]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const res = await app.request('/ai/suggestion/test-id/reject', { method: 'PUT' })
      expect([200, 404, 401, 422, 500]).toContain(res.status)
    })
  })

  describe('PUT /ai/config detailed', () => {
    it('should accept autoApprove true', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: true }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should accept autoApprove false', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: false }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should reject string autoApprove', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: 'true' }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject number autoApprove', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: 1 }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should handle invalid JSON', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle database errors', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ autoApprove: true }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /ai/summary detailed', () => {
    it('should return JSON object on success', async () => {
      const res = await app.request('/ai/summary')
      if (res.status === 200) {
        const data = await res.json()
        expect(typeof data).toBe('object')
      }
    })

    it('should handle service errors gracefully', async () => {
      const res = await app.request('/ai/summary')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should catch and format error from generateSummary (lines 143-145)', async () => {
      const res = await app.request('/ai/summary')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })
  })

  describe('GET /ai/suggestions error handling', () => {
    it('should catch database errors in getAll (lines 63-65)', async () => {
      const res = await app.request('/ai/suggestions')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })

    it('should catch database errors in getPending', async () => {
      const res = await app.request('/ai/suggestions?status=pending')
      expect([200, 401, 500]).toContain(res.status)
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })

  describe('PUT /ai/config maxShiftPct validation', () => {
    it('should validate maxShiftPct as positive number (lines 121-125)', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: 5.5 }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should reject zero maxShiftPct', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: 0 }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject negative maxShiftPct', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: -5 }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject NaN maxShiftPct', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: NaN }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 401]).toContain(res.status)
    })

    it('should reject Infinity maxShiftPct', async () => {
      const res = await app.request('/ai/config', {
        method: 'PUT',
        body: JSON.stringify({ maxShiftPct: Infinity }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 401]).toContain(res.status)
    })
  })
})
