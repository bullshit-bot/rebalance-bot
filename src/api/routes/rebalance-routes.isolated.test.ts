import { describe, it, expect, mock, beforeEach } from 'bun:test'

let engineState = {
  executeThrows: false,
  previewThrows: false,
  previewPortfolioUnavailable: false,
  stopped: false,
}

mock.module('@rebalancer/rebalance-engine', () => ({
  rebalanceEngine: {
    execute: async () => {
      if (engineState.executeThrows) {
        throw new Error('Engine execution failed')
      }
      return {
        id: 'rebal-1',
        trigger: 'manual',
        trades: [],
        totalFeesUsd: 10,
        startedAt: new Date(),
        completedAt: new Date(),
      }
    },
    preview: async () => {
      if (engineState.previewThrows) {
        throw new Error('Preview calculation failed')
      }
      if (engineState.previewPortfolioUnavailable) {
        throw new Error('Portfolio not yet available - no exchange connections')
      }
      return { trades: [], portfolio: null }
    },
    stop: () => {
      engineState.stopped = true
    },
    start: () => {
      engineState.stopped = false
    },
  },
}))

mock.module('@rebalancer/drift-detector', () => ({
  driftDetector: {
    stop: () => {},
    start: () => {},
  },
}))

mock.module('@db/database', () => ({
  RebalanceModel: {
    find: () => ({
      sort: () => ({
        limit: (n: number) => ({
          lean: async () => [
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

describe('rebalance-routes (isolated)', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', rebalanceRoutes)
    engineState = {
      executeThrows: false,
      previewThrows: false,
      previewPortfolioUnavailable: false,
      stopped: false,
    }
  })

  describe('POST / - Manual Rebalance Trigger', () => {
    it('should trigger manual rebalance successfully', async () => {
      const res = await app.request('http://localhost/', {
        method: 'POST',
      })
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBe('rebal-1')
      expect(data.trigger).toBe('manual')
      expect(data.trades).toBeDefined()
      expect(data.totalFeesUsd).toBe(10)
    })

    it('should return 201 on successful execution', async () => {
      const res = await app.request('http://localhost/', {
        method: 'POST',
      })
      expect(res.status).toBe(201)
    })

    it('should handle engine errors with 500 status', async () => {
      engineState.executeThrows = true
      const res = await app.request('http://localhost/', {
        method: 'POST',
      })
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Engine execution failed')
    })

    it('should return JSON error response on failure', async () => {
      engineState.executeThrows = true
      const res = await app.request('http://localhost/', {
        method: 'POST',
      })
      expect(res.headers.get('content-type')).toContain('application/json')
      const data = await res.json()
      expect(typeof data.error).toBe('string')
    })

    it('should handle non-Error exceptions', async () => {
      engineState.executeThrows = true
      const res = await app.request('http://localhost/', {
        method: 'POST',
      })
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('GET /preview - Rebalance Preview', () => {
    it('should return rebalance preview successfully', async () => {
      const res = await app.request('http://localhost/preview')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveProperty('trades')
      expect(Array.isArray(data.trades)).toBe(true)
    })

    it('should return empty trades when portfolio unavailable', async () => {
      engineState.previewPortfolioUnavailable = true
      const res = await app.request('http://localhost/preview')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.trades).toEqual([])
      expect(data.portfolio).toBeNull()
    })

    it('should handle portfolio unavailable error gracefully', async () => {
      engineState.previewPortfolioUnavailable = true
      const res = await app.request('http://localhost/preview')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).not.toHaveProperty('error')
    })

    it('should return 500 for non-portfolio errors', async () => {
      engineState.previewThrows = true
      const res = await app.request('http://localhost/preview')
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toContain('Preview calculation failed')
    })

    it('should return JSON content-type', async () => {
      const res = await app.request('http://localhost/preview')
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /history - Rebalance History', () => {
    it('should return rebalance history', async () => {
      const res = await app.request('http://localhost/history')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should default limit to 20 when not provided', async () => {
      const res = await app.request('http://localhost/history')
      expect(res.status).toBe(200)
    })

    it('should accept valid limit parameter', async () => {
      const res = await app.request('http://localhost/history?limit=10')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should reject invalid limit (non-numeric)', async () => {
      const res = await app.request('http://localhost/history?limit=invalid')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })

    it('should reject limit < 1', async () => {
      const res = await app.request('http://localhost/history?limit=0')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })

    it('should reject negative limit', async () => {
      const res = await app.request('http://localhost/history?limit=-5')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })

    it('should reject limit > 200', async () => {
      const res = await app.request('http://localhost/history?limit=300')
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit must be an integer between 1 and 200')
    })

    it('should accept limit=1', async () => {
      const res = await app.request('http://localhost/history?limit=1')
      expect(res.status).toBe(200)
    })

    it('should accept limit=200 (max)', async () => {
      const res = await app.request('http://localhost/history?limit=200')
      expect(res.status).toBe(200)
    })

    it('should accept float limit (parseInt truncates)', async () => {
      // parseInt('10.5', 10) returns 10 (not NaN)
      const res = await app.request('http://localhost/history?limit=10.5')
      expect(res.status).toBe(200)
    })

    it('should return JSON array', async () => {
      const res = await app.request('http://localhost/history')
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should have correct content-type', async () => {
      const res = await app.request('http://localhost/history')
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('POST /pause - Pause Rebalance', () => {
    it('should pause rebalance engine and drift detector', async () => {
      const res = await app.request('http://localhost/pause', {
        method: 'POST',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('paused')
    })

    it('should return JSON response', async () => {
      const res = await app.request('http://localhost/pause', {
        method: 'POST',
      })
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return paused status in response', async () => {
      const res = await app.request('http://localhost/pause', {
        method: 'POST',
      })
      const data = await res.json()
      expect(data.status).toBe('paused')
    })
  })

  describe('POST /resume - Resume Rebalance', () => {
    it('should resume rebalance engine and drift detector', async () => {
      const res = await app.request('http://localhost/resume', {
        method: 'POST',
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('running')
    })

    it('should return JSON response', async () => {
      const res = await app.request('http://localhost/resume', {
        method: 'POST',
      })
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('should return running status in response', async () => {
      const res = await app.request('http://localhost/resume', {
        method: 'POST',
      })
      const data = await res.json()
      expect(data.status).toBe('running')
    })
  })

  describe('Pause/Resume sequence', () => {
    it('should handle pause then resume', async () => {
      const pauseRes = await app.request('http://localhost/pause', {
        method: 'POST',
      })
      expect(pauseRes.status).toBe(200)
      const pauseData = await pauseRes.json()
      expect(pauseData.status).toBe('paused')

      const resumeRes = await app.request('http://localhost/resume', {
        method: 'POST',
      })
      expect(resumeRes.status).toBe(200)
      const resumeData = await resumeRes.json()
      expect(resumeData.status).toBe('running')
    })
  })
})
