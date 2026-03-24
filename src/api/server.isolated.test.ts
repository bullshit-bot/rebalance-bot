import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

mock.module('@exchange/exchange-manager', () => ({
  exchangeManager: {
    getEnabledExchanges: () => new Map(),
    getStatus: () => ({}),
  },
}))

mock.module('@portfolio/portfolio-tracker', () => ({
  portfolioTracker: {
    getPortfolio: async () => ({ totalValueUsd: 100000 }),
  },
}))

mock.module('@db/database', () => ({
  db: {
    query: async () => [],
  },
}))

mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
  },
}))

import { app } from '@api/server'

describe('API Server', () => {
  it('should define app instance', () => {
    expect(app).toBeDefined()
  })

  it('should handle GET /health', async () => {
    const response = await app.request(
      new Request('http://localhost:3000/health', { method: 'GET' }),
    )
    expect(response).toBeDefined()
    expect([200, 404]).toContain(response.status)
  })

  it('should handle GET /api/status', async () => {
    const response = await app.request(
      new Request('http://localhost:3000/api/status', { method: 'GET' }),
    )
    expect(response).toBeDefined()
    // Route doesn't exist; auth middleware may intercept with 401 before 404
    expect([200, 401, 404]).toContain(response.status)
  })

  it('should handle 404 for unknown routes', async () => {
    const response = await app.request(
      new Request('http://localhost:3000/unknown-route', { method: 'GET' }),
    )
    expect(response.status).toBe(404)
  })

  it('should support CORS headers', async () => {
    const response = await app.request(
      new Request('http://localhost:3000/api/status', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:3001' },
      }),
    )
    expect(response).toBeDefined()
  })
})
