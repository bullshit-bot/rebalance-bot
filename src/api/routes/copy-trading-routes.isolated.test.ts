import { describe, it, expect, mock } from 'bun:test'

mock.module('@/copy-trading/copy-trading-manager', () => ({
  copyTradingManager: {
    addSource: async () => 'src-123',
    getSources: async () => [{ id: 'src-1', name: 'Source 1' }],
    updateSource: async () => {},
    removeSource: async () => {},
    forceSync: async () => {},
    getSyncHistory: async () => [],
  },
}))

import { Hono } from 'hono'
import { copyTradingRoutes } from './copy-trading-routes'

describe('copy-trading-routes', () => {
  const app = new Hono()
  app.route('/', copyTradingRoutes)

  it('POST /copy/source adds source', async () => {
    const res = await app.request('http://localhost/copy/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      }),
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('src-123')
  })

  it('POST /copy/source rejects invalid sourceType', async () => {
    const res = await app.request('http://localhost/copy/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Source',
        sourceType: 'invalid',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /copy/sources lists sources', async () => {
    const res = await app.request('http://localhost/copy/sources')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('PUT /copy/source/:id updates source', async () => {
    const res = await app.request('http://localhost/copy/source/src-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(res.status).toBe(200)
  })

  it('DELETE /copy/source/:id removes source', async () => {
    const res = await app.request('http://localhost/copy/source/src-1', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
  })

  it('POST /copy/sync syncs all sources', async () => {
    const res = await app.request('http://localhost/copy/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
  })

  it('GET /copy/history returns sync history', async () => {
    const res = await app.request('http://localhost/copy/history?limit=10')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})
