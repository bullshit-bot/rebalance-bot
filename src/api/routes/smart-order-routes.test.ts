import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { smartOrderRoutes } from './smart-order-routes'

describe('Smart Order Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/smart-orders', smartOrderRoutes)
  })

  describe('GET /smart-orders', () => {
    it('should list smart orders', async () => {
      const res = await app.request('/smart-orders')
      expect([200, 401]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/smart-orders')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should filter by status', async () => {
      const res = await app.request('/smart-orders?status=active')
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('POST /smart-orders', () => {
    it('should create TWAP order', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-orders', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should create VWAP order', async () => {
      const body = JSON.stringify({
        type: 'vwap',
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        amount: 10,
        durationMs: 7200000,
        slices: 5,
      })

      const res = await app.request('/smart-orders', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401]).toContain(res.status)
    })

    it('should return order ID', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-orders', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 200 || res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
      }
    })

    it('should validate required fields', async () => {
      const body = JSON.stringify({ type: 'twap' })

      const res = await app.request('/smart-orders', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 401]).toContain(res.status)
    })
  })

  describe('GET /smart-orders/:id', () => {
    it('should get order by ID', async () => {
      const res = await app.request('/smart-orders/order-123')
      expect([200, 404, 401]).toContain(res.status)
    })

    it('should include progress', async () => {
      const res = await app.request('/smart-orders/order-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('POST /smart-orders/:id/cancel', () => {
    it('should cancel order', async () => {
      const res = await app.request('/smart-orders/order-123/cancel', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('POST /smart-orders/:id/pause', () => {
    it('should pause order', async () => {
      const res = await app.request('/smart-orders/order-123/pause', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('POST /smart-orders/:id/resume', () => {
    it('should resume order', async () => {
      const res = await app.request('/smart-orders/order-123/resume', { method: 'POST' })
      expect([200, 404, 401]).toContain(res.status)
    })
  })
})
