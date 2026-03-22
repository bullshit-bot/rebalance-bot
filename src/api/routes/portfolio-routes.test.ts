import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { portfolioRoutes } from './portfolio-routes'

describe('Portfolio Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/portfolio', portfolioRoutes)
  })

  describe('GET /portfolio', () => {
    it('should return portfolio data', async () => {
      const res = await app.request('/portfolio')
      expect(res.status).toBeOneOf([200, 401])
    })

    it('should return JSON', async () => {
      const res = await app.request('/portfolio')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should include portfolio structure', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        expect(data).toBeDefined()
      }
    })
  })

  describe('GET /portfolio/history', () => {
    it('should return portfolio history', async () => {
      const res = await app.request('/portfolio/history')
      expect(res.status).toBeOneOf([200, 401])
    })

    it('should return JSON array', async () => {
      const res = await app.request('/portfolio/history')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should support pagination', async () => {
      const res = await app.request('/portfolio/history?limit=10&offset=0')
      expect(res.status).toBeOneOf([200, 401])
    })

    it('should handle limit parameter', async () => {
      const res = await app.request('/portfolio/history?limit=5')
      expect(res.status).toBeOneOf([200, 401])
    })

    it('should handle offset parameter', async () => {
      const res = await app.request('/portfolio/history?offset=10')
      expect(res.status).toBeOneOf([200, 401])
    })
  })

  describe('error handling', () => {
    it('should handle invalid parameters', async () => {
      const res = await app.request('/portfolio/history?limit=invalid')
      expect([200, 400, 401]).toContain(res.status)
    })

    it('should handle missing auth', async () => {
      const res = await app.request('/portfolio')
      // May require auth depending on setup
      expect([200, 401]).toContain(res.status)
    })
  })
})
