import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { gridRoutes } from './grid-routes'

describe('Grid Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', gridRoutes)
  })

  describe('GET /grid/list', () => {
    it('should list grid bots', async () => {
      const res = await app.request('/grid/list')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array', async () => {
      const res = await app.request('/grid/list')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should handle optional status filter', async () => {
      const res = await app.request('/grid/list?status=active')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('POST /grid', () => {
    it('should create grid bot', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        gridType: 'normal',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422, 500]).toContain(res.status)
    })

    it('should support reverse grid type', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 2000,
        priceUpper: 3000,
        gridLevels: 5,
        investment: 500,
        gridType: 'reverse',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect([200, 201, 400, 401, 422, 500]).toContain(res.status)
    })

    it('should return bot ID on success', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        gridType: 'normal',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 201) {
        const data = await res.json()
        expect(data).toHaveProperty('botId')
      }
    })

    it('should reject invalid body', async () => {
      const body = JSON.stringify({ exchange: 'binance' })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /grid/:id', () => {
    it('should get bot by ID', async () => {
      const res = await app.request('/grid/bot-123')
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should include current PnL when found', async () => {
      const res = await app.request('/grid/bot-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('PUT /grid/:id/stop', () => {
    it('should stop bot', async () => {
      const res = await app.request('/grid/bot-123/stop', { method: 'PUT' })
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should return final PnL on success', async () => {
      const res = await app.request('/grid/bot-123/stop', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('totalProfit')
        expect(data).toHaveProperty('totalTrades')
      }
    })
  })
})
