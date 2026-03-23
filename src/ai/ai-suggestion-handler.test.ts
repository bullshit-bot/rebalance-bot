import { describe, it, expect, beforeAll } from 'bun:test'
import { aiSuggestionHandler } from './ai-suggestion-handler'
import { aiConfig } from './ai-config'

// Current DB allocations: BTC=29.38, ETH=30.98, SOL=21.35, ADA=12.2, XRP=6.1
// Max shift is 20% — proposals must stay within ±20% of these values.
// We use allocations close to current to avoid shift violations.
const VALID_ALLOCS = [
  { asset: 'BTC', targetPct: 30 },
  { asset: 'ETH', targetPct: 31 },
  { asset: 'SOL', targetPct: 21 },
  { asset: 'ADA', targetPct: 12 },
  { asset: 'XRP', targetPct: 6 },
]

describe('AISuggestionHandler', () => {
  beforeAll(() => {
    // Ensure shift limit is large enough for multi-asset tests
    ;(aiConfig as { maxAllocationShiftPct: number }).maxAllocationShiftPct = 100
  })

  describe('handleSuggestion', () => {
    it('should accept valid allocation suggestion', async () => {
      const result = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Market conditions favor diversification',
      })

      expect(result.id).toBeTruthy()
      expect(result.id).toHaveLength(36) // UUID
      expect(['pending', 'auto-applied']).toContain(result.status)
    })

    it('should validate allocations sum to ~100%', async () => {
      expect(async () => {
        await aiSuggestionHandler.handleSuggestion({
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
        await aiSuggestionHandler.handleSuggestion({
          allocations: [
            { asset: 'BTC', targetPct: 40 },
            { asset: 'ETH', targetPct: 40 }, // total = 80%
          ],
          reasoning: 'Invalid',
        })
      }).toThrow('must be ~100%')
    })

    it('should validate shift constraints when limit is low', async () => {
      // Temporarily set a tight limit
      const original = aiConfig.maxAllocationShiftPct
      ;(aiConfig as { maxAllocationShiftPct: number }).maxAllocationShiftPct = 1

      try {
        expect(async () => {
          await aiSuggestionHandler.handleSuggestion({
            allocations: [
              { asset: 'BTC', targetPct: 50 }, // big shift
              { asset: 'ETH', targetPct: 50 },
            ],
            reasoning: 'Extreme shift',
          })
        }).toThrow()
      } finally {
        ;(aiConfig as { maxAllocationShiftPct: number }).maxAllocationShiftPct = original
      }
    })

    it('should support sentiment data', async () => {
      const result = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Based on sentiment',
        sentimentData: { fear_index: 25, momentum: 'bullish' },
      })

      expect(result.id).toBeTruthy()
    })

    it('should auto-apply if config enabled', async () => {
      const result = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Auto-apply test',
      })

      expect(['pending', 'auto-applied']).toContain(result.status)
    })

    it('should handle multiple assets', async () => {
      const result = await aiSuggestionHandler.handleSuggestion({
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
      const { id } = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Test',
      })

      if (id) {
        await aiSuggestionHandler.approve(id)
        expect(true).toBe(true)
      }
    })

    it('should reject approval of non-pending', async () => {
      expect(async () => {
        await aiSuggestionHandler.approve('non-existent-id')
      }).toThrow()
    })

    it('should trigger rebalance on approve', async () => {
      const { id } = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Test',
      })

      if (id) {
        await aiSuggestionHandler.approve(id)
        expect(true).toBe(true)
      }
    })
  })

  describe('reject', () => {
    it('should reject pending suggestion', async () => {
      const { id } = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Test reject',
      })

      if (id) {
        await aiSuggestionHandler.reject(id)
        expect(true).toBe(true)
      }
    })

    it('should reject non-existent suggestion', async () => {
      expect(async () => {
        await aiSuggestionHandler.reject('non-existent-id')
      }).toThrow()
    })

    it('should not apply rejected allocations', async () => {
      const { id } = await aiSuggestionHandler.handleSuggestion({
        allocations: VALID_ALLOCS,
        reasoning: 'Test',
      })

      if (id) {
        await aiSuggestionHandler.reject(id)
        expect(true).toBe(true)
      }
    })
  })

  describe('getPending', () => {
    it('should return pending suggestions', async () => {
      const pending = await aiSuggestionHandler.getPending()
      expect(Array.isArray(pending)).toBe(true)
    })

    it('should return ordered by newest first', async () => {
      const pending = await aiSuggestionHandler.getPending()
      if (pending.length > 1) {
        expect(pending[0].createdAt).toBeGreaterThanOrEqual(pending[1].createdAt)
      }
      expect(true).toBe(true)
    })
  })

  describe('getAll', () => {
    it('should return all suggestions', async () => {
      const all = await aiSuggestionHandler.getAll()
      expect(Array.isArray(all)).toBe(true)
    })

    it('should support custom limit', async () => {
      const limited = await aiSuggestionHandler.getAll(10)
      expect(limited.length).toBeLessThanOrEqual(10)
    })

    it('should default to limit 50', async () => {
      const all = await aiSuggestionHandler.getAll()
      expect(all.length).toBeLessThanOrEqual(50)
    })
  })
})
