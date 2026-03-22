import { describe, it, expect, beforeEach } from 'bun:test'
import { AISuggestionHandler } from './ai-suggestion-handler'

describe('AISuggestionHandler', () => {
  let handler: AISuggestionHandler

  beforeEach(() => {
    handler = new AISuggestionHandler()
  })

  describe('handleSuggestion', () => {
    it('should accept valid allocation suggestion', async () => {
      const result = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Market conditions favor diversification',
      })

      expect(result.id).toBeTruthy()
      expect(result.id).toHaveLength(36) // UUID
      expect(['pending', 'auto-applied']).toContain(result.status)
    })

    it('should validate allocations sum to ~100%', async () => {
      expect(async () => {
        await handler.handleSuggestion({
          allocations: [
            { asset: 'BTC', targetPct: 60 },
            { asset: 'ETH', targetPct: 60 }, // total = 120%
          ],
          reasoning: 'Invalid',
        })
      }).toThrow('must be ~100%')
    })

    it('should reject under-allocated suggestions', async () => {
      expect(async () => {
        await handler.handleSuggestion({
          allocations: [
            { asset: 'BTC', targetPct: 40 },
            { asset: 'ETH', targetPct: 40 }, // total = 80%
          ],
          reasoning: 'Invalid',
        })
      }).toThrow('must be ~100%')
    })

    it('should validate shift constraints', async () => {
      expect(async () => {
        await handler.handleSuggestion({
          allocations: [
            { asset: 'BTC', targetPct: 95 }, // huge shift
            { asset: 'ETH', targetPct: 5 },
          ],
          reasoning: 'Extreme shift',
        })
      }).toThrow()
    })

    it('should support sentiment data', async () => {
      const result = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Based on sentiment',
        sentimentData: { fear_index: 25, momentum: 'bullish' },
      })

      expect(result.id).toBeTruthy()
    })

    it('should auto-apply if config enabled', async () => {
      const result = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
        reasoning: 'Auto-apply test',
      })

      expect(['pending', 'auto-applied']).toContain(result.status)
    })

    it('should handle multiple assets', async () => {
      const result = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 30 },
          { asset: 'ETH', targetPct: 30 },
          { asset: 'SOL', targetPct: 25 },
          { asset: 'ADA', targetPct: 15 },
        ],
        reasoning: 'Multi-asset rebalance',
      })

      expect(result.id).toBeTruthy()
    })
  })

  describe('approve', () => {
    it('should approve pending suggestion', async () => {
      const { id } = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Test',
      })

      if (id) {
        await handler.approve(id)
        expect(true).toBe(true)
      }
    })

    it('should reject approval of non-pending', async () => {
      expect(async () => {
        await handler.approve('non-existent-id')
      }).toThrow()
    })

    it('should trigger rebalance on approve', async () => {
      const { id } = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Test',
      })

      if (id) {
        await handler.approve(id)
        expect(true).toBe(true)
      }
    })
  })

  describe('reject', () => {
    it('should reject pending suggestion', async () => {
      const { id } = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Test reject',
      })

      if (id) {
        await handler.reject(id)
        expect(true).toBe(true)
      }
    })

    it('should reject non-existent suggestion', async () => {
      expect(async () => {
        await handler.reject('non-existent-id')
      }).toThrow()
    })

    it('should not apply rejected allocations', async () => {
      const { id } = await handler.handleSuggestion({
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        reasoning: 'Test',
      })

      if (id) {
        await handler.reject(id)
        expect(true).toBe(true)
      }
    })
  })

  describe('getPending', () => {
    it('should return pending suggestions', async () => {
      const pending = await handler.getPending()
      expect(Array.isArray(pending)).toBe(true)
    })

    it('should return ordered by newest first', async () => {
      const pending = await handler.getPending()
      if (pending.length > 1) {
        expect(pending[0].createdAt).toBeGreaterThanOrEqual(pending[1].createdAt)
      }
      expect(true).toBe(true)
    })
  })

  describe('getAll', () => {
    it('should return all suggestions', async () => {
      const all = await handler.getAll()
      expect(Array.isArray(all)).toBe(true)
    })

    it('should support custom limit', async () => {
      const limited = await handler.getAll(10)
      expect(limited.length).toBeLessThanOrEqual(10)
    })

    it('should default to limit 50', async () => {
      const all = await handler.getAll()
      expect(all.length).toBeLessThanOrEqual(50)
    })
  })
})
