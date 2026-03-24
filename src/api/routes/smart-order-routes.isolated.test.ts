import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test'

// Mock dependencies before importing
mock.module('@/twap-vwap/twap-engine', () => ({
  twapEngine: {
    create: async () => 'order-123',
  },
}))

mock.module('@/twap-vwap/vwap-engine', () => ({
  vwapEngine: {
    create: async () => 'order-456',
  },
}))

mock.module('@/twap-vwap/execution-tracker', () => ({
  executionTracker: {
    getProgress: () => ({
      status: 'active',
      filledAmount: 50,
      filledPct: 50,
      avgPrice: 100,
      slicesCompleted: 5,
      slicesTotal: 10,
      estimatedCompletion: Date.now() + 3600000,
    }),
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
  const activeOrder = {
    id: 'order-1',
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
  const pausedOrder = { ...activeOrder, status: 'paused' }
  // Track call count: first call returns active, second returns paused (for resume test)
  let whereCallCount = 0
  return {
    db: {
      select: () => ({
        from: () => ({
          // For GET /smart-order/active — awaited directly (no .limit())
          where: () => {
            whereCallCount++
            // 4th call is the resume route, which requires status === 'paused'
            const order = whereCallCount === 4 ? pausedOrder : activeOrder
            // Return a thenable so it resolves to [order], and also has .limit()
            const result = [order]
            return Object.assign(Promise.resolve(result), {
              limit: () => Promise.resolve(result),
            })
          },
        }),
      }),
    },
  }
})

import { Hono } from 'hono'
import { smartOrderRoutes } from './smart-order-routes'

describe('smart-order-routes', () => {
  let app: Hono

  beforeAll(() => {
    app = new Hono()
    app.route('/', smartOrderRoutes)
  })

  it('POST /smart-order creates twap order', async () => {
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
    expect(data.orderId).toBe('order-123')
    expect(data.status).toBe('active')
  })

  it('POST /smart-order creates vwap order', async () => {
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
    expect(data.orderId).toBe('order-456')
    expect(data.status).toBe('active')
  })

  it('POST /smart-order rejects invalid type', async () => {
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
  })

  it('POST /smart-order rejects non-positive totalAmount', async () => {
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
  })

  it('POST /smart-order rejects invalid slices', async () => {
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
        slices: 0.5,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /smart-order rejects invalid JSON', async () => {
    const res = await app.request('http://localhost/smart-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('GET /smart-order/active returns active orders', async () => {
    const res = await app.request('http://localhost/smart-order/active', {
      method: 'GET',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /smart-order/:id returns order details', async () => {
    const res = await app.request('http://localhost/smart-order/order-1', {
      method: 'GET',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('order-1')
  })

  it('PUT /smart-order/:id/pause pauses order', async () => {
    const res = await app.request('http://localhost/smart-order/order-1/pause', {
      method: 'PUT',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('paused')
  })

  it('PUT /smart-order/:id/resume resumes order', async () => {
    const res = await app.request('http://localhost/smart-order/order-1/resume', {
      method: 'PUT',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('active')
  })

  it('PUT /smart-order/:id/cancel cancels order', async () => {
    const res = await app.request('http://localhost/smart-order/order-1/cancel', {
      method: 'PUT',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('cancelled')
  })

  it('POST /smart-order with rebalanceId', async () => {
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
        rebalanceId: 'rebal-123',
      }),
    })
    expect(res.status).toBe(201)
  })

  it('POST /smart-order rejects invalid side', async () => {
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
  })
})
