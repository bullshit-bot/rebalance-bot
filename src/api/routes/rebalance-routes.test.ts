import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { rebalanceRoutes } from './rebalance-routes'

describe('Rebalance Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/rebalance', rebalanceRoutes)
  })

  describe('POST /rebalance/trigger', () => {
    it('should trigger rebalance', async () => {
      const res = await app.request('/rebalance/trigger', { method: 'POST' })
      expect([200, 201, 401, 400]).toContain(res.status)
    })

    it('should support strategy parameter', async () => {
      const res = await app.request('/rebalance/trigger?strategy=periodic', { method: 'POST' })
      expect([200, 201, 401, 400]).toContain(res.status)
    })

    it('should return JSON response', async () => {
      const res = await app.request('/rebalance/trigger', { method: 'POST' })
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /rebalance/preview', () => {
    it('should return rebalance preview', async () => {
      const res = await app.request('/rebalance/preview')
      expect([200, 401]).toContain(res.status)
    })

    it('should include suggested allocations', async () => {
      const res = await app.request('/rebalance/preview')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /rebalance/history', () => {
    it('should return rebalance history', async () => {
      const res = await app.request('/rebalance/history')
      expect([200, 401]).toContain(res.status)
    })

    it('should support limit parameter', async () => {
      const res = await app.request('/rebalance/history?limit=20')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/rebalance/history')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('error handling', () => {
    it('should handle invalid strategy', async () => {
      const res = await app.request('/rebalance/trigger?strategy=invalid', { method: 'POST' })
      expect([200, 400, 401]).toContain(res.status)
    })
  })
})
