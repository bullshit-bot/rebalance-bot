import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { healthRoutes } from './health-routes'

describe('Health Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/health', healthRoutes)
  })

  describe('GET /health', () => {
    it('should return 200 status', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
    })

    it('should return JSON response', async () => {
      const res = await app.request('/health')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should include ok status', async () => {
      const res = await app.request('/health')
      const data = await res.json()
      expect(data.status).toBe('ok')
    })

    it('should include uptimeSeconds', async () => {
      const res = await app.request('/health')
      const data = await res.json()
      expect(typeof data.uptimeSeconds).toBe('number')
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    })

    it('should have increasing uptime', async () => {
      const res1 = await app.request('/health')
      const data1 = await res1.json()

      // Small delay to accumulate some uptime
      await new Promise((resolve) => setTimeout(resolve, 10))

      const res2 = await app.request('/health')
      const data2 = await res2.json()

      expect(data2.uptimeSeconds).toBeGreaterThanOrEqual(data1.uptimeSeconds)
    })

    it('should include exchange status', async () => {
      const res = await app.request('/health')
      const data = await res.json()
      expect(data.exchanges).toBeDefined()
    })

    it('should return valid response object', async () => {
      const res = await app.request('/health')
      const data = await res.json()
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('uptimeSeconds')
      expect(data).toHaveProperty('exchanges')
    })

    it('should not require authentication', async () => {
      const res = await app.request('/health', {
        headers: { 'X-API-Key': 'invalid' },
      })
      expect(res.status).toBe(200)
    })

    it('should handle multiple requests', async () => {
      const res1 = await app.request('/health')
      const res2 = await app.request('/health')
      const res3 = await app.request('/health')

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res3.status).toBe(200)
    })
  })
})
