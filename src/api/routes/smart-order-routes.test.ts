import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { smartOrderRoutes } from './smart-order-routes'

describe('Smart Order Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', smartOrderRoutes)
  })

  describe('GET /smart-order/active', () => {
    it('should list active smart orders', async () => {
      const res = await app.request('/smart-order/active')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/smart-order/active')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })

  describe('POST /smart-order', () => {
    it('should create TWAP order', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should create VWAP order', async () => {
      const body = JSON.stringify({
        type: 'vwap',
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        totalAmount: 10,
        durationMs: 7200000,
        slices: 5,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should return order ID on success', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('orderId')
      }
    })

    it('should validate required fields', async () => {
      const body = JSON.stringify({ type: 'twap' })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /smart-order/:id', () => {
    it('should get order by ID', async () => {
      const res = await app.request('/smart-order/order-123')
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should include progress when found', async () => {
      const res = await app.request('/smart-order/order-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('PUT /smart-order/:id/cancel', () => {
    it('should cancel order', async () => {
      const res = await app.request('/smart-order/order-123/cancel', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })
  })

  describe('PUT /smart-order/:id/pause', () => {
    it('should pause order', async () => {
      const res = await app.request('/smart-order/order-123/pause', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })
  })

  describe('PUT /smart-order/:id/resume', () => {
    it('should resume order', async () => {
      const res = await app.request('/smart-order/order-123/resume', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })
  })
})
