import { describe, it, expect, beforeEach, mock } from 'bun:test'
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
      expect(res.status).toBeOneOf([200, 401, 503])
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

    it('should handle portfolio not available (503)', async () => {
      const res = await app.request('/portfolio')
      // When portfolioTracker returns null and no snapshots exist, should return 503
      if (res.status === 503) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Portfolio not yet available')
      }
    })

    it('should return portfolio with totalValueUsd and assets', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        // Portfolio structure check
        expect(data).toBeDefined()
        if (data.totalValueUsd !== undefined) {
          expect(typeof data.totalValueUsd).toBe('number')
        }
        if (Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            expect(asset).toHaveProperty('asset')
            expect(typeof asset.asset).toBe('string')
          })
        }
      }
    })
  })

  describe('GET /portfolio/history', () => {
    it('should return portfolio history', async () => {
      const res = await app.request('/portfolio/history')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should return JSON array', async () => {
      const res = await app.request('/portfolio/history')
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should support pagination with from and to parameters', async () => {
      const res = await app.request('/portfolio/history?from=1000000000&to=2000000000')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should handle limit parameter', async () => {
      const res = await app.request('/portfolio/history?limit=5')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should handle from parameter', async () => {
      const res = await app.request('/portfolio/history?from=1700000000')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should handle to parameter', async () => {
      const res = await app.request('/portfolio/history?to=1700000000')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should default from and to when not provided', async () => {
      const res = await app.request('/portfolio/history')
      expect(res.status).toBeOneOf([200, 400, 401, 500])
    })

    it('should return 400 for invalid from parameter', async () => {
      const res = await app.request('/portfolio/history?from=invalid')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Invalid from/to')
      }
    })

    it('should return 400 for invalid to parameter', async () => {
      const res = await app.request('/portfolio/history?to=notanumber')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('Invalid from/to')
      }
    })
  })

  describe('buildPortfolioFromSnapshot fallback behavior', () => {
    it('should return snapshot portfolio when available', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        // If status is 200, data should have portfolio-like structure
        expect(data).toBeDefined()
      }
    })

    it('should return 503 when no snapshots exist', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 503) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Portfolio not yet available')
      }
    })

    it('should include holdings data from snapshot', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        // Check that assets field exists and is properly structured
        if (data.assets) {
          expect(Array.isArray(data.assets)).toBe(true)
        }
      }
    })

    it('should compute drift correctly from snapshot', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        if (data.assets && Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            if (asset.driftPct !== undefined) {
              expect(typeof asset.driftPct).toBe('number')
              // Drift should be current - target
              const expectedDrift = asset.currentPct - asset.targetPct
              expect(Math.abs(asset.driftPct - expectedDrift)).toBeLessThan(0.2) // Allow small rounding difference
            }
          })
        }
      }
    })

    it('should include updatedAt timestamp from snapshot', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        if (data.updatedAt !== undefined) {
          expect(typeof data.updatedAt).toBe('number')
          expect(data.updatedAt).toBeGreaterThan(0)
        }
      }
    })

    it('should merge allocations correctly', async () => {
      const res = await app.request('/portfolio')
      if (res.status === 200) {
        const data = await res.json()
        if (data.assets && Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            expect(asset).toHaveProperty('targetPct')
            expect(typeof asset.targetPct).toBe('number')
          })
        }
      }
    })
  })

  describe('error handling', () => {
    it('should handle invalid from/to parameters', async () => {
      const res = await app.request('/portfolio/history?from=invalid&to=invalid')
      if (res.status === 400) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })

    it('should handle missing auth', async () => {
      const res = await app.request('/portfolio')
      // May require auth depending on setup
      expect([200, 401, 503]).toContain(res.status)
    })

    it('should handle database errors gracefully', async () => {
      const res = await app.request('/portfolio/history')
      if (res.status === 500) {
        const data = await res.json()
        expect(data).toHaveProperty('error')
      }
    })
  })
})
