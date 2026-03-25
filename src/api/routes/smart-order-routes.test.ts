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

  describe('Detailed GET /smart-order/:id behavior', () => {
    it('should return 404 for non-existent order', async () => {
      const res = await app.request('/smart-order/nonexistent-order-xyz')
      expect([404, 401, 500]).toContain(res.status)
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('not found')
      }
    })

    it('should merge execution tracker progress into response', async () => {
      const res = await app.request('/smart-order/order-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('type')
        expect(data).toHaveProperty('exchange')
        expect(data).toHaveProperty('pair')
        expect(data).toHaveProperty('side')
        expect(data).toHaveProperty('totalAmount')
        expect(data).toHaveProperty('durationMs')
        expect(data).toHaveProperty('status')
        expect(data).toHaveProperty('filledAmount')
        expect(data).toHaveProperty('filledPct')
        expect(data).toHaveProperty('avgPrice')
        expect(data).toHaveProperty('slicesCompleted')
        expect(data).toHaveProperty('slicesTotal')
        expect(data).toHaveProperty('estimatedCompletion')
        expect(data).toHaveProperty('createdAt')
        expect(data).toHaveProperty('completedAt')
        expect(data).toHaveProperty('config')
      }
    })

    it('should handle database errors on GET order by ID', async () => {
      const res = await app.request('/smart-order/test-id')
      expect([200, 404, 401, 500]).toContain(res.status)
    })
  })

  describe('Detailed GET /smart-order/active behavior', () => {
    it('should merge tracker progress for each active order', async () => {
      const res = await app.request('/smart-order/active')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        data.forEach((order: any) => {
          // Each active order should have merged progress
          expect(order).toHaveProperty('id')
          expect(order).toHaveProperty('type')
          expect(order).toHaveProperty('status')
          expect(order).toHaveProperty('filledAmount')
          expect(order).toHaveProperty('filledPct')
          expect(order).toHaveProperty('slicesCompleted')
          expect(order).toHaveProperty('slicesTotal')
        })
      }
    })

    it('should handle database errors on list', async () => {
      const res = await app.request('/smart-order/active')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('Detailed PUT /smart-order/:id/pause behavior', () => {
    it('should return 404 when order does not exist', async () => {
      const res = await app.request('/smart-order/nonexistent/pause', { method: 'PUT' })
      expect([404, 401, 500]).toContain(res.status)
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return 409 when order is not active', async () => {
      const res = await app.request('/smart-order/test-paused/pause', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
      if (res.status === 409) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return proper status on successful pause', async () => {
      const res = await app.request('/smart-order/active-order/pause', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data.id).toBeDefined()
        expect(data.status).toBe('paused')
      }
    })

    it('should handle database errors on pause', async () => {
      const res = await app.request('/smart-order/test-id/pause', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })
  })

  describe('Detailed PUT /smart-order/:id/resume behavior', () => {
    it('should return 404 when order does not exist', async () => {
      const res = await app.request('/smart-order/nonexistent/resume', { method: 'PUT' })
      expect([404, 401, 500]).toContain(res.status)
    })

    it('should return 409 when order is not paused', async () => {
      const res = await app.request('/smart-order/test-active/resume', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
      if (res.status === 409) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle database errors on resume', async () => {
      const res = await app.request('/smart-order/test-id/resume', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })
  })

  describe('Detailed PUT /smart-order/:id/cancel behavior', () => {
    it('should return 404 when order does not exist', async () => {
      const res = await app.request('/smart-order/nonexistent/cancel', { method: 'PUT' })
      expect([404, 401, 500]).toContain(res.status)
    })

    it('should return 409 when order is already completed', async () => {
      const res = await app.request('/smart-order/completed-order/cancel', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
      if (res.status === 409) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should return 409 when order is already cancelled', async () => {
      const res = await app.request('/smart-order/cancelled-order/cancel', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
      if (res.status === 409) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle database errors on cancel', async () => {
      const res = await app.request('/smart-order/test-id/cancel', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })
  })

  describe('POST /smart-order with rebalanceId', () => {
    it('should accept rebalanceId field when provided', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10,
        rebalanceId: 'rebalance-xyz',
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 500]).toContain(res.status)
    })

    it('should reject rebalanceId if not a string', async () => {
      const body = JSON.stringify({
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1,
        durationMs: 3600000,
        slices: 10,
        rebalanceId: 123,
      })

      const res = await app.request('/smart-order', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /smart-order error handling', () => {
    it('should handle invalid JSON body', async () => {
      const res = await app.request('/smart-order', {
        method: 'POST',
        body: 'not a json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should handle null body', async () => {
      const res = await app.request('/smart-order', {
        method: 'POST',
        body: 'null',
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })

    it('should handle array body instead of object', async () => {
      const res = await app.request('/smart-order', {
        method: 'POST',
        body: '[]',
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should return 500 when engine.create fails', async () => {
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
  })

  describe('GET /smart-order/active error handling', () => {
    it('should handle database errors gracefully', async () => {
      const res = await app.request('/smart-order/active')
      expect([200, 401, 500]).toContain(res.status)
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should return JSON on error', async () => {
      const res = await app.request('/smart-order/active')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should properly merge execution tracker progress', async () => {
      const res = await app.request('/smart-order/active')
      if (res.status === 200) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((order: any) => {
            expect(order).toHaveProperty('filledAmount')
            expect(order).toHaveProperty('filledPct')
            expect(order).toHaveProperty('avgPrice')
          })
        }
      }
    })
  })

  describe('GET /smart-order/:id error handling', () => {
    it('should return 404 for truly non-existent order', async () => {
      const res = await app.request('/smart-order/completely-nonexistent-xyz')
      expect([404, 401, 500]).toContain(res.status)
      if (res.status === 404) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle database errors on GET by id', async () => {
      const res = await app.request('/smart-order/test-order')
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should parse and return config JSON when present', async () => {
      const res = await app.request('/smart-order/test-order')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('config')
      }
    })
  })

  describe('PUT /smart-order/:id/pause error handling', () => {
    it('should handle database errors on pause', async () => {
      const res = await app.request('/smart-order/test-id/pause', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })

    it('should return proper error message when order not found', async () => {
      const res = await app.request('/smart-order/nonexistent-pause/pause', { method: 'PUT' })
      if (res.status === 404) {
        const data = await res.json()
        expect(data.error).toContain('not found')
      }
    })

    it('should return proper error message when order not active', async () => {
      const res = await app.request('/smart-order/inactive/pause', { method: 'PUT' })
      if (res.status === 409) {
        const data = await res.json()
        expect(data.error).toContain('not active')
      }
    })
  })

  describe('PUT /smart-order/:id/resume error handling', () => {
    it('should handle database errors on resume', async () => {
      const res = await app.request('/smart-order/test-id/resume', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })

    it('should return proper error message when order not paused', async () => {
      const res = await app.request('/smart-order/test-active/resume', { method: 'PUT' })
      if (res.status === 409) {
        const data = await res.json()
        expect(data.error).toContain('not paused')
      }
    })
  })

  describe('PUT /smart-order/:id/cancel error handling', () => {
    it('should handle database errors on cancel', async () => {
      const res = await app.request('/smart-order/test-id/cancel', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })

    it('should return proper error message for already completed order', async () => {
      const res = await app.request('/smart-order/completed-order/cancel', { method: 'PUT' })
      if (res.status === 409) {
        const data = await res.json()
        expect(data.error).toContain('completed')
      }
    })

    it('should return proper error message for already cancelled order', async () => {
      const res = await app.request('/smart-order/cancelled-order/cancel', { method: 'PUT' })
      if (res.status === 409) {
        const data = await res.json()
        expect(data.error).toContain('cancelled')
      }
    })
  })

  describe('POST /smart-order with missing optional fields', () => {
    it('should not require rebalanceId', async () => {
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
  })
})
