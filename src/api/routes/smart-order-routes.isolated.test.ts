import { describe, it, expect, mock, beforeEach } from 'bun:test'

let engineState = {
  twapCreateThrows: false,
  vwapCreateThrows: false,
  findByIdThrows: false,
}

let dbCallCount = {
  twapCreate: 0,
  vwapCreate: 0,
  findById: 0,
  findActive: 0,
}

// Mock dependencies before importing
mock.module('@/twap-vwap/twap-engine', () => ({
  twapEngine: {
    create: async () => {
      dbCallCount.twapCreate++
      if (engineState.twapCreateThrows) {
        throw new Error('TWAP creation failed')
      }
      return 'order-twap-' + dbCallCount.twapCreate
    },
  },
}))

mock.module('@/twap-vwap/vwap-engine', () => ({
  vwapEngine: {
    create: async () => {
      dbCallCount.vwapCreate++
      if (engineState.vwapCreateThrows) {
        throw new Error('VWAP creation failed')
      }
      return 'order-vwap-' + dbCallCount.vwapCreate
    },
  },
}))

mock.module('@/twap-vwap/execution-tracker', () => ({
  executionTracker: {
    getProgress: (id: string) => {
      if (!id) return null
      return {
        status: 'active',
        filledAmount: 50,
        filledPct: 50,
        avgPrice: 100,
        slicesCompleted: 5,
        slicesTotal: 10,
        estimatedCompletion: Date.now() + 3600000,
      }
    },
  },
}))

mock.module('@/twap-vwap/slice-scheduler', () => ({
  sliceScheduler: {
    pause: () => {},
    resume: () => {},
    cancel: () => {},
  },
}))

mock.module('@db/database', () => {
  const baseOrder = {
    _id: 'order-123',
    type: 'twap',
    exchange: 'binance',
    pair: 'BTC/USDT',
    side: 'buy',
    totalAmount: 1,
    durationMs: 3600000,
    status: 'active',
    filledAmount: 0,
    filledPct: 0,
    avgPrice: null,
    slicesCompleted: 0,
    slicesTotal: 10,
    rebalanceId: null,
    createdAt: Date.now(),
    completedAt: null,
    config: null,
  }

  const pausedOrder = { ...baseOrder, status: 'paused' }
  const completedOrder = { ...baseOrder, status: 'completed' }
  const cancelledOrder = { ...baseOrder, status: 'cancelled' }

  let dbState: Record<string, any> = {
    'order-123': baseOrder,
    'paused-order': pausedOrder,
    'completed-order': completedOrder,
    'cancelled-order': cancelledOrder,
  }

  return {
    SmartOrderModel: {
      find: (query?: any) => ({
        lean: async () => {
          dbCallCount.findActive++
          if (query?.status === 'active') {
            return [baseOrder]
          }
          return []
        },
      }),
      findById: (id: string) => ({
        lean: async () => {
          dbCallCount.findById++
          if (engineState.findByIdThrows) {
            throw new Error('Database error')
          }
          return dbState[id] || null
        },
      }),
    },
  }
})

import { Hono } from 'hono'
import { smartOrderRoutes } from './smart-order-routes'

describe('smart-order-routes (isolated)', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', smartOrderRoutes)
    engineState = {
      twapCreateThrows: false,
      vwapCreateThrows: false,
      findByIdThrows: false,
    }
    dbCallCount = {
      twapCreate: 0,
      vwapCreate: 0,
      findById: 0,
      findActive: 0,
    }
  })

  describe('POST /smart-order - Create Order', () => {
    it('should create TWAP order successfully', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data).toHaveProperty('orderId')
      expect(data.type).toBe('twap')
      expect(data.status).toBe('active')
    })

    it('should create VWAP order successfully', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vwap',
          exchange: 'binance',
          pair: 'ETH/USDT',
          side: 'sell',
          totalAmount: 10,
          durationMs: 1800000,
          slices: 6,
        }),
      })
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data).toHaveProperty('orderId')
      expect(data.type).toBe('vwap')
      expect(data.status).toBe('active')
    })

    it('should return 201 on successful creation', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'kraken',
          pair: 'ETH/USD',
          side: 'buy',
          totalAmount: 5,
          durationMs: 1800000,
          slices: 4,
        }),
      })
      expect(res.status).toBe(201)
    })

    it('should handle engine creation errors with 500', async () => {
      engineState.twapCreateThrows = true
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('TWAP creation failed')
    })

    it('should accept rebalanceId when provided', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
          rebalanceId: 'rebal-abc123',
        }),
      })
      expect(res.status).toBe(201)
    })
  })

  describe('POST /smart-order - Validation', () => {
    it('should reject invalid type', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invalid',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('twap')
    })

    it('should reject empty exchange', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: '',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should reject empty pair', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: '',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should reject invalid side', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'invalid',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('side')
    })

    it('should reject zero totalAmount', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 0,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('totalAmount')
    })

    it('should reject negative totalAmount', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: -5,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should reject zero durationMs', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 0,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('durationMs')
    })

    it('should reject negative durationMs', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: -1000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should reject zero slices', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 0,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('slices')
    })

    it('should reject float slices', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10.5,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should reject invalid JSON body', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('JSON')
    })

    it('should reject null body', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      })
      expect(res.status).toBe(400)
    })

    it('should reject array body', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '[]',
      })
      expect(res.status).toBe(400)
    })

    it('should reject invalid rebalanceId type', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
          rebalanceId: 123,
        }),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('rebalanceId')
    })

    it('should reject missing type', async () => {
      const res = await app.request('http://localhost/smart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 1,
          durationMs: 3600000,
          slices: 10,
        }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /smart-order/active - List Active Orders', () => {
    it('should return array of active orders', async () => {
      const res = await app.request('http://localhost/smart-order/active')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should include merged tracker progress', async () => {
      const res = await app.request('http://localhost/smart-order/active')
      expect(res.status).toBe(200)
      const data = await res.json()
      if (data.length > 0) {
        const order = data[0]
        expect(order).toHaveProperty('filledAmount')
        expect(order).toHaveProperty('filledPct')
        expect(order).toHaveProperty('avgPrice')
        expect(order).toHaveProperty('slicesCompleted')
        expect(order).toHaveProperty('slicesTotal')
      }
    })

    it('should return JSON content-type', async () => {
      const res = await app.request('http://localhost/smart-order/active')
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /smart-order/:id - Get Order Details', () => {
    it('should return order details by ID', async () => {
      const res = await app.request('http://localhost/smart-order/order-123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data._id || data.id).toBeDefined()
      expect(data.type).toBe('twap')
      expect(data.exchange).toBe('binance')
    })

    it('should include all order fields', async () => {
      const res = await app.request('http://localhost/smart-order/order-123')
      expect(res.status).toBe(200)
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
    })

    it('should return 404 for non-existent order', async () => {
      const res = await app.request('http://localhost/smart-order/nonexistent')
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('not found')
    })

    it('should handle database errors with 500', async () => {
      engineState.findByIdThrows = true
      const res = await app.request('http://localhost/smart-order/order-123')
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('PUT /smart-order/:id/pause - Pause Order', () => {
    it('should pause active order', async () => {
      const res = await app.request('http://localhost/smart-order/order-123/pause', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('paused')
    })

    it('should return order ID in response', async () => {
      const res = await app.request('http://localhost/smart-order/order-123/pause', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('id')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await app.request('http://localhost/smart-order/nonexistent/pause', {
        method: 'PUT',
      })
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toContain('not found')
    })

    it('should return 409 for non-active order', async () => {
      const res = await app.request('http://localhost/smart-order/paused-order/pause', {
        method: 'PUT',
      })
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('not active')
    })

    it('should handle database errors with 500', async () => {
      engineState.findByIdThrows = true
      const res = await app.request('http://localhost/smart-order/order-123/pause', {
        method: 'PUT',
      })
      expect(res.status).toBe(500)
    })
  })

  describe('PUT /smart-order/:id/resume - Resume Order', () => {
    it('should resume paused order', async () => {
      const res = await app.request('http://localhost/smart-order/paused-order/resume', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('active')
    })

    it('should return order ID in response', async () => {
      const res = await app.request('http://localhost/smart-order/paused-order/resume', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('id')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await app.request('http://localhost/smart-order/nonexistent/resume', {
        method: 'PUT',
      })
      expect(res.status).toBe(404)
    })

    it('should return 409 for non-paused order', async () => {
      const res = await app.request('http://localhost/smart-order/order-123/resume', {
        method: 'PUT',
      })
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('not paused')
    })

    it('should handle database errors with 500', async () => {
      engineState.findByIdThrows = true
      const res = await app.request('http://localhost/smart-order/paused-order/resume', {
        method: 'PUT',
      })
      expect(res.status).toBe(500)
    })
  })

  describe('PUT /smart-order/:id/cancel - Cancel Order', () => {
    it('should cancel active order', async () => {
      const res = await app.request('http://localhost/smart-order/order-123/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('cancelled')
    })

    it('should cancel paused order', async () => {
      const res = await app.request('http://localhost/smart-order/paused-order/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('cancelled')
    })

    it('should return order ID in response', async () => {
      const res = await app.request('http://localhost/smart-order/order-123/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('id')
    })

    it('should return 404 for non-existent order', async () => {
      const res = await app.request('http://localhost/smart-order/nonexistent/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(404)
    })

    it('should return 409 for completed order', async () => {
      const res = await app.request('http://localhost/smart-order/completed-order/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('completed')
    })

    it('should return 409 for already cancelled order', async () => {
      const res = await app.request('http://localhost/smart-order/cancelled-order/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('cancelled')
    })

    it('should handle database errors with 500', async () => {
      engineState.findByIdThrows = true
      const res = await app.request('http://localhost/smart-order/order-123/cancel', {
        method: 'PUT',
      })
      expect(res.status).toBe(500)
    })
  })
})
