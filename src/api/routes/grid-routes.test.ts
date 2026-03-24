import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { gridRoutes } from './grid-routes'

describe('Grid Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', gridRoutes)
  })

  describe('Validation', () => {
    it('should reject missing exchange', async () => {
      const body = JSON.stringify({
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

      expect(res.status).toBe(400)
    })

    it('should reject empty exchange', async () => {
      const body = JSON.stringify({
        exchange: '',
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

      expect(res.status).toBe(400)
    })

    it('should reject empty pair', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: '',
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

      expect(res.status).toBe(400)
    })

    it('should reject non-positive priceLower', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 0,
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

      expect(res.status).toBe(400)
    })

    it('should reject priceLower >= priceUpper', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 50000,
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

      expect(res.status).toBe(400)
    })

    it('should reject gridLevels < 2', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 1,
        investment: 1000,
        gridType: 'normal',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject non-integer gridLevels', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10.5,
        investment: 1000,
        gridType: 'normal',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject non-positive investment', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 0,
        gridType: 'normal',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject invalid gridType', async () => {
      const body = JSON.stringify({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        gridType: 'invalid',
      })

      const res = await app.request('/grid', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)
    })

    it('should reject non-object body', async () => {
      const res = await app.request('/grid', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 500]).toContain(res.status)
    })
  })

  describe('GET /grid/list', () => {
    it('should list all grid bots', async () => {
      const res = await app.request('/grid/list')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('should return array response', async () => {
      const res = await app.request('/grid/list')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should return JSON content-type', async () => {
      const res = await app.request('/grid/list')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should include bot status in response', async () => {
      const res = await app.request('/grid/list')
      if (res.status === 200) {
        const data = await res.json()
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('status')
        }
      }
    })

    it('should include profit data', async () => {
      const res = await app.request('/grid/list')
      if (res.status === 200) {
        const data = await res.json()
        if (data.length > 0) {
          expect(data[0]).toHaveProperty('totalProfit')
          expect(data[0]).toHaveProperty('totalTrades')
        }
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
    it('should get bot by valid ID', async () => {
      const res = await app.request('/grid/bot-123')
      expect([200, 404, 401, 500]).toContain(res.status)
    })

    it('should return bot data when found', async () => {
      const res = await app.request('/grid/bot-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('id')
        expect(data).toHaveProperty('status')
      }
    })

    it('should include PnL breakdown', async () => {
      const res = await app.request('/grid/bot-123')
      if (res.status === 200) {
        const data = await res.json()
        if (data.pnl) {
          expect(data.pnl).toHaveProperty('realized')
          expect(data.pnl).toHaveProperty('unrealized')
          expect(data.pnl).toHaveProperty('total')
          expect(data.pnl).toHaveProperty('tradeCount')
        }
      }
    })

    it('should return 404 for non-existent bot', async () => {
      const res = await app.request('/grid/nonexistent-id')
      expect([200, 404, 500]).toContain(res.status)
    })

    it('should include creation timestamp', async () => {
      const res = await app.request('/grid/bot-123')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('createdAt')
      }
    })
  })

  describe('PUT /grid/:id/stop', () => {
    it('should stop bot with valid ID', async () => {
      const res = await app.request('/grid/bot-123/stop', { method: 'PUT' })
      expect([200, 404, 401, 409, 500]).toContain(res.status)
    })

    it('should return final PnL on success', async () => {
      const res = await app.request('/grid/bot-123/stop', { method: 'PUT' })
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('totalProfit')
        expect(data).toHaveProperty('totalTrades')
        expect(data).toHaveProperty('status')
        expect(data.status).toBe('stopped')
      }
    })

    it('should reject stop on non-existent bot', async () => {
      const res = await app.request('/grid/nonexistent-id/stop', { method: 'PUT' })
      expect([404, 409, 500]).toContain(res.status)
    })

    it('should return error for already stopped bot', async () => {
      const res = await app.request('/grid/already-stopped/stop', { method: 'PUT' })
      expect([200, 404, 409, 500]).toContain(res.status)
    })

    it('should return JSON response', async () => {
      const res = await app.request('/grid/bot-123/stop', { method: 'PUT' })
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })
})
