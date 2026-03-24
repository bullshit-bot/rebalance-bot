import { describe, it, expect, mock } from 'bun:test'

mock.module('@rebalancer/rebalance-engine', () => ({
  rebalanceEngine: {
    execute: async () => ({
      id: 'rebal-1',
      trigger: 'manual',
      trades: [],
      totalFeesUsd: 10,
      startedAt: new Date(),
      completedAt: new Date(),
    }),
    preview: async () => ({ trades: [], portfolio: null }),
  },
}))

mock.module('@db/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => [
            {
              id: 'rebal-1',
              trigger: 'manual',
              trades: '[]',
              totalFeesUsd: 10,
              startedAt: Date.now(),
            },
          ],
        }),
      }),
    }),
  },
}))

import { Hono } from 'hono'
import { rebalanceRoutes } from './rebalance-routes'

describe('rebalance-routes', () => {
  const app = new Hono()
  app.route('/', rebalanceRoutes)

  it('POST / triggers manual rebalance', async () => {
    const res = await app.request('http://localhost/', {
      method: 'POST',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('rebal-1')
  })

  it('GET /preview returns rebalance preview', async () => {
    const res = await app.request('http://localhost/preview')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.trades).toBeDefined()
  })

  it('GET /history returns rebalance history', async () => {
    const res = await app.request('http://localhost/history')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /history with limit parameter', async () => {
    const res = await app.request('http://localhost/history?limit=10')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /history rejects invalid limit', async () => {
    const res = await app.request('http://localhost/history?limit=invalid')
    expect(res.status).toBe(400)
  })

  it('GET /history rejects limit > 200', async () => {
    const res = await app.request('http://localhost/history?limit=300')
    expect(res.status).toBe(400)
  })

  it('GET /history rejects limit < 1', async () => {
    const res = await app.request('http://localhost/history?limit=0')
    expect(res.status).toBe(400)
  })
})
