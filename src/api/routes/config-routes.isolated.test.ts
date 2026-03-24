import { describe, it, expect, mock } from 'bun:test'

mock.module('@db/database', () => ({
  db: {
    select: () => ({
      from: async () => [
        { asset: 'BTC', targetPct: 50, exchange: 'binance' },
        { asset: 'ETH', targetPct: 50, exchange: 'binance' },
      ],
    }),
    delete: () => ({
      where: async () => {},
    }),
    insert: () => ({
      values: async () => {},
    }),
  },
}))

import { Hono } from 'hono'
import { configRoutes } from './config-routes'

describe('config-routes', () => {
  const app = new Hono()
  app.route('/', configRoutes)

  it('GET /allocations returns allocations', async () => {
    const res = await app.request('http://localhost/allocations')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('PUT /allocations updates allocations', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 40 },
      ]),
    })
    expect(res.status).toBe(200)
  })

  it('PUT /allocations rejects empty array', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
    expect(res.status).toBe(200)
  })

  it('PUT /allocations rejects > 100%', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 50 },
      ]),
    })
    expect(res.status).toBe(400)
  })

  it('PUT /allocations rejects invalid targetPct', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { asset: 'BTC', targetPct: 150 },
      ]),
    })
    expect(res.status).toBe(400)
  })

  it('PUT /allocations rejects invalid exchange', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { asset: 'BTC', targetPct: 100, exchange: 'invalid' },
      ]),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /allocations/:asset removes allocation', async () => {
    const res = await app.request('http://localhost/allocations/BTC', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe('BTC')
  })

  it('PUT /allocations with negative targetPct', async () => {
    const res = await app.request('http://localhost/allocations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { asset: 'BTC', targetPct: -10 },
      ]),
    })
    expect(res.status).toBe(400)
  })
})
