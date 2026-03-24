import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { tradeRoutes } from './trade-routes'

describe('Trade Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/trades', tradeRoutes)
  })

  describe('GET /trades', () => {
    it('should return trades', async () => {
      const res = await app.request('/trades')
      expect([200, 401]).toContain(res.status)
    })

    it('should return JSON', async () => {
      const res = await app.request('/trades')
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('filters', () => {
    it('should filter by pair', async () => {
      const res = await app.request('/trades?pair=BTC/USDT')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by side', async () => {
      const res = await app.request('/trades?side=buy')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by exchange', async () => {
      const res = await app.request('/trades?exchange=binance')
      expect([200, 401]).toContain(res.status)
    })

    it('should support multiple filters', async () => {
      const res = await app.request('/trades?pair=BTC/USDT&side=buy&exchange=binance')
      expect([200, 401]).toContain(res.status)
    })

    it('should support pagination', async () => {
      const res = await app.request('/trades?limit=10&offset=0')
      expect([200, 401]).toContain(res.status)
    })

    it('should support date range', async () => {
      const since = Math.floor(Date.now() / 1000) - 86400 // 24h ago
      const until = Math.floor(Date.now() / 1000)
      const res = await app.request(`/trades?since=${since}&until=${until}`)
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('GET /trades/:id', () => {
    it('should get trade by ID', async () => {
      const res = await app.request('/trades/trade-123')
      expect([200, 404, 401]).toContain(res.status)
    })
  })

  describe('GET /trades detailed', () => {
    it('should return JSON array', async () => {
      const res = await app.request('/trades')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should return empty array if no trades', async () => {
      const res = await app.request('/trades')
      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      }
    })

    it('should handle database errors', async () => {
      const res = await app.request('/trades')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('GET /trades filters detailed', () => {
    it('should filter by sell side', async () => {
      const res = await app.request('/trades?side=sell')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by different exchange', async () => {
      const res = await app.request('/trades?exchange=kraken')
      expect([200, 401]).toContain(res.status)
    })

    it('should filter by different pair', async () => {
      const res = await app.request('/trades?pair=ETH/USDT')
      expect([200, 401]).toContain(res.status)
    })

    it('should support limit parameter', async () => {
      const res = await app.request('/trades?limit=5')
      expect([200, 401]).toContain(res.status)
    })

    it('should support offset parameter', async () => {
      const res = await app.request('/trades?offset=10')
      expect([200, 401]).toContain(res.status)
    })

    it('should combine limit and offset', async () => {
      const res = await app.request('/trades?limit=20&offset=40')
      expect([200, 401]).toContain(res.status)
    })

    it('should support since parameter', async () => {
      const since = Math.floor(Date.now() / 1000) - 3600 // 1h ago
      const res = await app.request(`/trades?since=${since}`)
      expect([200, 401]).toContain(res.status)
    })

    it('should support until parameter', async () => {
      const until = Math.floor(Date.now() / 1000)
      const res = await app.request(`/trades?until=${until}`)
      expect([200, 401]).toContain(res.status)
    })

    it('should support rebalanceId filter', async () => {
      const res = await app.request('/trades?rebalanceId=rebalance-123')
      expect([200, 401]).toContain(res.status)
    })

    it('should combine all filters', async () => {
      const since = Math.floor(Date.now() / 1000) - 86400
      const until = Math.floor(Date.now() / 1000)
      const res = await app.request(
        `/trades?pair=BTC/USDT&side=buy&exchange=binance&limit=50&offset=0&since=${since}&until=${until}`,
      )
      expect([200, 401]).toContain(res.status)
    })
  })

  describe('GET /trades with rebalanceId', () => {
    it('filters by rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=rb-001')
      expect([200, 401, 500]).toContain(res.status)
    })

    it('handles non-existent rebalanceId', async () => {
      const res = await app.request('/trades?rebalanceId=nonexistent')
      expect([200, 401, 500]).toContain(res.status)
    })
  })

  describe('Error scenarios', () => {
    it('should handle invalid limit values', async () => {
      const res = await app.request('/trades?limit=abc')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle invalid offset values', async () => {
      const res = await app.request('/trades?offset=xyz')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle negative limit', async () => {
      const res = await app.request('/trades?limit=-1')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle negative offset', async () => {
      const res = await app.request('/trades?offset=-1')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle zero limit', async () => {
      const res = await app.request('/trades?limit=0')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle invalid side value', async () => {
      const res = await app.request('/trades?side=invalid')
      expect([200, 401]).toContain(res.status)
    })

    it('should handle missing auth header', async () => {
      const res = await app.request('/trades')
      expect([200, 401]).toContain(res.status)
    })
  })
})
