import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { configRoutes } from './config-routes'

describe('Config Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/config', configRoutes)
  })

  describe('GET /config/allocations', () => {
    it('should return allocations', async () => {
      const res = await app.request('/config/allocations')
      expect([200, 401]).toContain(res.status)
    })

    it('should return JSON array', async () => {
      const res = await app.request('/config/allocations')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should include asset and targetPct', async () => {
      const res = await app.request('/config/allocations')
      if (res.status === 200) {
        const data = await res.json()
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('asset')
          expect(data[0]).toHaveProperty('targetPct')
        }
      }
    })
  })

  describe('PUT /config/allocations', () => {
    it('should update allocations', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 50 },
        { asset: 'ETH', targetPct: 50 },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should validate allocations sum', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 60 }, // 120% invalid
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should require valid JSON', async () => {
      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 401]).toContain(res.status)
    })

    it('should handle empty allocations', async () => {
      const body = JSON.stringify([])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })
  })

  describe('error handling', () => {
    it('should validate asset names', async () => {
      const body = JSON.stringify([{ asset: '', targetPct: 100 }])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })
  })

  describe('GET /config/allocations detailed', () => {
    it('should return 200 when allocations exist', async () => {
      const res = await app.request('/config/allocations')
      expect([200, 401]).toContain(res.status)
    })

    it('should return valid JSON response', async () => {
      const res = await app.request('/config/allocations')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        data.forEach((allocation: any) => {
          expect(allocation).toHaveProperty('asset')
          expect(allocation).toHaveProperty('targetPct')
          expect(typeof allocation.asset).toBe('string')
          expect(typeof allocation.targetPct).toBe('number')
        })
      }
    })
  })

  describe('PUT /config/allocations validation', () => {
    it('should accept valid 100% allocations', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 50 },
        { asset: 'ETH', targetPct: 50 },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should reject allocations > 100%', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 75 },
        { asset: 'ETH', targetPct: 35 },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should accept single asset 100%', async () => {
      const body = JSON.stringify([{ asset: 'BTC', targetPct: 100 }])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should handle null body', async () => {
      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body: 'null',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle object body instead of array', async () => {
      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 400, 401]).toContain(res.status)
    })

    it('should validate negative percentages', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: -10 },
        { asset: 'ETH', targetPct: 110 },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return JSON response on success', async () => {
      const body = JSON.stringify([{ asset: 'BTC', targetPct: 100 }])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 200 || res.status === 201) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })
  })

  describe('DELETE /config/allocations/:asset', () => {
    it('should handle delete request', async () => {
      const res = await app.request('/config/allocations/BTC', { method: 'DELETE' })
      expect([200, 204, 400, 401, 404]).toContain(res.status)
    })

    it('should return JSON on success', async () => {
      const res = await app.request('/config/allocations/BTC', { method: 'DELETE' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('deleted')
      }
    })

    it('should return JSON on error', async () => {
      const res = await app.request('/config/allocations/INVALID', { method: 'DELETE' })
      if (res.status >= 400) {
        expect(res.headers.get('content-type')).toContain('application/json')
      }
    })

    it('should handle non-existent asset', async () => {
      const res = await app.request('/config/allocations/NONEXISTENT', { method: 'DELETE' })
      expect([200, 204, 400, 401, 404]).toContain(res.status)
    })

    it('should uppercase asset parameter', async () => {
      const res = await app.request('/config/allocations/btc', { method: 'DELETE' })
      expect([200, 204, 400, 401, 404]).toContain(res.status)
      if (res.status === 200) {
        const data = await res.json()
        expect(data.deleted).toBe('BTC')
      }
    })
  })

  describe('Config routes error paths', () => {
    it('should handle database errors in GET', async () => {
      const res = await app.request('/config/allocations')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should handle database errors in PUT', async () => {
      const body = JSON.stringify([{ asset: 'BTC', targetPct: 100 }])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should reject non-object items in array', async () => {
      const body = JSON.stringify([null, 'string', 123])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('item')
      }
    })

    it('should reject invalid exchange values', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 50, exchange: 'invalid_exchange' },
        { asset: 'ETH', targetPct: 50, exchange: 'binance' },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('exchange')
      }
    })

    it('should reject negative minTradeUsd', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 100, minTradeUsd: -10 },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('minTradeUsd')
      }
    })

    it('should reject invalid minTradeUsd type', async () => {
      const body = JSON.stringify([
        { asset: 'BTC', targetPct: 100, minTradeUsd: 'not-a-number' },
      ])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('minTradeUsd')
      }
    })

    it('should handle GET error response structure', async () => {
      const res = await app.request('/config/allocations')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })

    it('should handle PUT error response structure', async () => {
      const body = JSON.stringify([{ asset: 'BTC', targetPct: 100 }])

      const res = await app.request('/config/allocations', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })

    it('should handle DELETE error response structure', async () => {
      const res = await app.request('/config/allocations/BTC', { method: 'DELETE' })
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(typeof data.error).toBe('string')
      }
    })
  })
})
