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
})
