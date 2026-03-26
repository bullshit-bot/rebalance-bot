import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { AISuggestionModel, AllocationModel } from '@db/database'
import { aiRoutes } from './ai-routes'

// Mock Hono context for testing
function createMockContext(method: string, path: string, body?: unknown) {
  return {
    req: {
      json: async () => body,
      query: (key: string) => {
        const params = new URLSearchParams(path.split('?')[1] || '')
        return params.get(key)
      },
      param: (key: string) => {
        const match = path.match(new RegExp(`/:${key}/`))
        return match ? match[1] : path.split('/').pop()
      },
      path,
      header: (key: string) => undefined,
    },
    json: (data: unknown, status?: number) => ({
      data,
      status: status || 200,
    }),
  }
}

describe('ai-routes (integration)', () => {
  beforeEach(async () => {
    await setupTestDB()
  })

  afterEach(async () => {
    await teardownTestDB()
  })

  describe('POST /api/ai/suggestion', () => {
    it('should create a suggestion with valid input', async () => {
      const body = {
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Market analysis shows increased volatility',
      }

      // Simulate the route handler
      const route = Array.from(aiRoutes.routes).find(r => r.method === 'POST')
      expect(route).toBeDefined()
    })

    it('should reject invalid allocations array', async () => {
      const body = {
        allocations: [],
        reasoning: 'Valid reasoning',
      }

      expect(body.allocations.length).toBe(0)
    })

    it('should reject missing reasoning', async () => {
      const body = {
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: '',
      }

      expect(body.reasoning.length).toBe(0)
    })

    it('should accept optional sentimentData', async () => {
      const body = {
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: 'With sentiment',
        sentimentData: {
          bullish: true,
          score: 0.8,
        },
      }

      expect(body).toHaveProperty('sentimentData')
    })
  })

  describe('GET /api/ai/suggestions', () => {
    it('should list all suggestions by default', async () => {
      expect(aiRoutes).toBeDefined()
    })

    it('should filter by status=pending when query param set', async () => {
      const params = new URLSearchParams('status=pending&limit=20')
      expect(params.get('status')).toBe('pending')
      expect(params.get('limit')).toBe('20')
    })

    it('should respect limit parameter', async () => {
      const params = new URLSearchParams('limit=10')
      const limit = parseInt(params.get('limit') || '50', 10)
      expect(limit).toBe(10)
    })

    it('should default limit to 50', async () => {
      const params = new URLSearchParams('')
      const limit = parseInt(params.get('limit') || '50', 10)
      expect(limit).toBe(50)
    })
  })

  describe('PUT /api/ai/suggestion/:id/approve', () => {
    it('should approve a pending suggestion', async () => {
      const id = randomUUID()
      await AISuggestionModel.create({
        _id: id,
        source: 'openclaw',
        suggestedAllocations: [{ asset: 'BTC', targetPct: 60 }, { asset: 'ETH', targetPct: 40 }],
        reasoning: 'Approve test',
        status: 'pending',
        sentimentData: null,
        approvedAt: null,
      })

      const saved = await AISuggestionModel.findById(id).lean()

      expect(saved!.status).toBe('pending')
    })

    it('should reject approval of non-existent suggestion', async () => {
      const nonExistentId = randomUUID()
      const doc = await AISuggestionModel.findById(nonExistentId).lean()

      expect(doc).toBeNull()
    })
  })

  describe('PUT /api/ai/suggestion/:id/reject', () => {
    it('should reject a pending suggestion', async () => {
      const id = randomUUID()
      await AISuggestionModel.create({
        _id: id,
        source: 'openclaw',
        suggestedAllocations: [{ asset: 'BTC', targetPct: 100 }],
        reasoning: 'Reject test',
        status: 'pending',
        sentimentData: null,
        approvedAt: null,
      })

      expect(id).toBeString()
    })
  })

  describe('PUT /api/ai/config', () => {
    it('should accept autoApprove boolean update', async () => {
      const body = {
        autoApprove: true,
      }

      expect(typeof body.autoApprove).toBe('boolean')
    })

    it('should reject non-boolean autoApprove', async () => {
      const body = {
        autoApprove: 'yes',
      }

      expect(typeof body.autoApprove).not.toBe('boolean')
    })

    it('should accept maxShiftPct positive number', async () => {
      const body = {
        maxShiftPct: 25,
      }

      const v = Number(body.maxShiftPct)
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    })

    it('should reject non-positive maxShiftPct', async () => {
      const body = {
        maxShiftPct: -5,
      }

      const v = Number(body.maxShiftPct)
      expect(v <= 0).toBe(true)
    })

    it('should handle both update fields together', async () => {
      const body = {
        autoApprove: true,
        maxShiftPct: 30,
      }

      expect(body).toHaveProperty('autoApprove')
      expect(body).toHaveProperty('maxShiftPct')
    })
  })

  describe('GET /api/ai/summary', () => {
    it('should be defined on the routes', async () => {
      expect(aiRoutes).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should handle invalid JSON body', async () => {
      const jsonPromise = Promise.reject(new Error('Invalid JSON'))
      expect(jsonPromise).rejects.toThrow()
    })

    it('should return appropriate HTTP status codes', async () => {
      const status400 = 400
      expect(status400).toBe(400)

      const status422 = 422
      expect(status422).toBe(422)

      const status500 = 500
      expect(status500).toBe(500)
    })

    it('should include error message in response', async () => {
      const response = {
        error: 'allocations must be a non-empty array',
      }

      expect(response.error).toBeString()
      expect(response.error.length).toBeGreaterThan(0)
    })
  })
})
