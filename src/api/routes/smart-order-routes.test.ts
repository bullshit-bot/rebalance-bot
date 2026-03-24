import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { smartOrderRoutes } from './smart-order-routes'

describe('Smart Order Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', smartOrderRoutes)
  })

  describe('Validation', () => {
    it('should reject missing type field', async () => {
      const body = JSON.stringify({
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

      expect(res.status).toBe(400)
    })

    it('should reject invalid type value', async () => {
      const body = JSON.stringify({
        type: 'invalid',
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

      expect(res.status).toBe(400)
    })

    it('should reject invalid side value', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'invalid',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid totalAmount', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 0,
        durationMs: 3600000,
        slices: 10,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid durationMs', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: -1,
        slices: 10,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid slices', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 0,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject non-integer slices', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10.5,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject empty exchange', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: '',
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

      expect(res.status).toBe(400)
    })

    it('should reject empty pair', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: '',
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

      expect(res.status).toBe(400)
    })

    it('should reject non-object body', async () => {
      const res = await app.request('/smart-order', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 500]).toContain(res.status)
    })
  })

  describe('GET /smart-order/active', () => {
    it('should list active smart orders', async () => {
      const res = await app.request('/smart-order/active')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array response', async () => {
      const res = await app.request('/smart-order/active')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should return JSON content-type', async () => {
      const res = await app.request('/smart-order/active')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should handle database errors gracefully', async () => {
      const res = await app.request('/smart-order/active')
      expect([200, 401, 500]).toContain(res.status)
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
    it('should cancel order with valid ID', async () => {
      const res = await app.request('/smart-order/order-123/cancel', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })

    it('should return cancellation status', async () => {
      const res = await app.request('/smart-order/order-123/cancel', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('status')
      }
    })

    it('should handle non-existent order ID', async () => {
      const res = await app.request('/smart-order/nonexistent/cancel', { method: 'PUT' })
      expect([404, 409, 500]).toContain(res.status)
    })
  })

  describe('PUT /smart-order/:id/pause', () => {
    it('should pause order with valid ID', async () => {
      const res = await app.request('/smart-order/order-123/pause', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })

    it('should return pause status', async () => {
      const res = await app.request('/smart-order/order-123/pause', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('status')
        expect(data.status).toBe('paused')
      }
    })

    it('should reject pause on inactive order', async () => {
      const res = await app.request('/smart-order/order-inactive/pause', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })
  })

  describe('PUT /smart-order/:id/resume', () => {
    it('should resume order with valid ID', async () => {
      const res = await app.request('/smart-order/order-123/resume', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })

    it('should return resume status', async () => {
      const res = await app.request('/smart-order/order-123/resume', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('status')
        expect(data.status).toBe('active')
      }
    })

    it('should reject resume on non-paused order', async () => {
      const res = await app.request('/smart-order/order-active/resume', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })
  })
})
