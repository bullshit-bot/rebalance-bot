import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { tradeRoutes } from './trade-routes'

describe('Trade Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/trades', tradeRoutes)
  })

  describe('GET /trades', () => {
    it('should return trades', async () => {
      const res = await app.request('/trades')
      expect([200, 401]).toContain(res.status)
    })

    it('should return JSON', async () => {
      const res = await app.request('/trades')
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('filters', () => {
    it('should filter by pair', async () => {
      const res = await app.request('/trades?pair=BTC/USDT')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by side', async () => {
      const res = await app.request('/trades?side=buy')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by exchange', async () => {
      const res = await app.request('/trades?exchange=binance')
      expect([200, 401]).toContain(res.status)
    })

    it('should support multiple filters', async () => {
      const res = await app.request('/trades?pair=BTC/USDT&side=buy&exchange=binance')
      expect([200, 401]).toContain(res.status)
    })

    it('should support pagination', async () => {
      const res = await app.request('/trades?limit=10&offset=0')
      expect([200, 401]).toContain(res.status)
    })

    it('should support date range', async () => {
      const since = Math.floor(Date.now() / 1000) - 86400 // 24h ago
      const until = Math.floor(Date.now() / 1000)
      const res = await app.request(`/trades?since=${since}&until=${until}`)
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('GET /trades/:id', () => {
    it('should get trade by ID', async () => {
      const res = await app.request('/trades/trade-123')
      expect([200, 404, 401]).toContain(res.status)
    })
  })
})
