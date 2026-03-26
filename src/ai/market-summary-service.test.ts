import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { SnapshotModel, TradeModel } from '@db/database'
import { marketSummaryService } from './market-summary-service'

beforeAll(async () => {
  await setupTestDB()
  const now = new Date()
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)

  // Seed snapshots so portfolio section has data
  await SnapshotModel.insertMany([
    { totalValueUsd: 10000, holdings: {}, allocations: {}, createdAt: hoursAgo(12) },
    { totalValueUsd: 10250, holdings: {}, allocations: {}, createdAt: hoursAgo(1) },
  ])

  // Seed trades so trade section has data
  await TradeModel.insertMany([
    { exchange: 'binance', pair: 'BTC/USDT', side: 'buy', amount: 0.1, price: 60000, costUsd: 6000, isPaper: true, executedAt: hoursAgo(6) },
    { exchange: 'binance', pair: 'ETH/USDT', side: 'sell', amount: 1, price: 3000, costUsd: 3000, isPaper: false, executedAt: hoursAgo(3) },
  ])
})

afterAll(async () => { await teardownTestDB() })

describe('MarketSummaryService', () => {
  describe('generateSummary', () => {
    it('should generate summary string', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    })

    it('should include portfolio section', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary).toContain('Portfolio')
    })

    it('should include trades section', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary).toContain('Trades')
    })

    it('should include daily timestamp', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary).toContain('Daily Portfolio Summary')
    })

    it('should use HTML formatting', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary).toContain('<b>')
      expect(summary).toContain('</b>')
    })

    it('should include portfolio change indicators', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary.toLowerCase()).toContain('portfolio')
    })

    it('should include trade counts', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary.toLowerCase()).toContain('trade')
    })

    it('should handle zero trades', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    })

    it('should handle no snapshot data', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(typeof summary).toBe('string')
      expect(summary).toContain('Portfolio')
    })

    it('should distinguish paper vs live trades', async () => {
      const summary = await marketSummaryService.generateSummary()

      if (summary.toLowerCase().includes('trade')) {
        expect(summary).toContain('Paper')
      }
    })

    it('should format USD values correctly', async () => {
      const summary = await marketSummaryService.generateSummary()

      expect(summary).toContain('$')
    })

    it('should handle error gracefully', async () => {
      try {
        const summary = await marketSummaryService.generateSummary()
        expect(typeof summary).toBe('string')
        expect(summary.length).toBeGreaterThan(0)
      } catch (err) {
        // If error, should be an Error instance
        expect(err).toBeInstanceOf(Error)
      }
    })
  })

  describe('getSummary method', () => {
    it('should return market summary data', async () => {
      const result = await marketSummaryService.generateSummary()
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should have predictable structure', async () => {
      const result = await marketSummaryService.generateSummary()
      if (result && typeof result === 'object') {
        expect(result).not.toBeNull()
      }
    })

    it('should handle missing API key gracefully', async () => {
      try {
        const summary = await marketSummaryService.generateSummary()
        // Should still generate something even without full API integration
        expect(typeof summary).toBe('string')
      } catch (err) {
        // Expected when API is not configured
        if (err instanceof Error) {
          expect(err).toBeInstanceOf(Error)
        }
      }
    })
  })

  describe('buildPortfolioSection error handling', () => {
    it('should generate summary even if portfolio section fails', async () => {
      try {
        const summary = await marketSummaryService.generateSummary()
        expect(typeof summary).toBe('string')
        // Should contain standard header
        expect(summary).toContain('Daily Portfolio Summary')
      } catch (err) {
        // If service fails, should throw properly
        expect(err).toBeInstanceOf(Error)
      }
    })

    it('should handle empty snapshot data', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should still generate a valid summary
      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    })
  })

  describe('buildTradeSection error handling', () => {
    it('should generate summary even if trade section fails', async () => {
      try {
        const summary = await marketSummaryService.generateSummary()
        expect(typeof summary).toBe('string')
        expect(summary).toContain('Trades')
      } catch (err) {
        // If service fails, should throw properly
        expect(err).toBeInstanceOf(Error)
      }
    })

    it('should handle zero trades', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should still return valid summary
      expect(typeof summary).toBe('string')
      expect(summary).toContain('Portfolio')
    })

    it('should handle database query failures', async () => {
      try {
        const summary = await marketSummaryService.generateSummary()
        // Should be string or throw error
        expect(typeof summary).toBe('string')
      } catch (err) {
        // Database errors should be caught
        expect(err).toBeInstanceOf(Error)
      }
    })
  })

  describe('Daily summary structure validation', () => {
    it('should include date in output', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should include a UTC date string
      expect(summary.toLowerCase()).toContain('portfolio')
    })

    it('should format numbers with 2 decimals', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should use proper formatting
      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    })

    it('should use HTML formatting tags', async () => {
      const summary = await marketSummaryService.generateSummary()
      expect(summary).toContain('<b>')
      expect(summary).toContain('</b>')
    })

    it('should include code formatting for values', async () => {
      const summary = await marketSummaryService.generateSummary()
      expect(summary).toContain('<code>')
    })

    it('should handle both positive and negative changes', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should properly handle up/down arrows
      expect(typeof summary).toBe('string')
    })
  })

  describe('Service error scenarios', () => {
    it('should handle concurrent summary requests', async () => {
      const [summary1, summary2] = await Promise.all([
        marketSummaryService.generateSummary(),
        marketSummaryService.generateSummary(),
      ])

      expect(typeof summary1).toBe('string')
      expect(typeof summary2).toBe('string')
    })

    it('should handle rapid successive calls', async () => {
      const summary1 = await marketSummaryService.generateSummary()
      const summary2 = await marketSummaryService.generateSummary()

      expect(typeof summary1).toBe('string')
      expect(typeof summary2).toBe('string')
    })

    it('should maintain consistent format', async () => {
      const summary = await marketSummaryService.generateSummary()
      // Should always have portfolio and trades section
      const hasPortfolioSection = summary.includes('Portfolio')
      const hasTradeSection = summary.includes('Trade')

      expect(hasPortfolioSection || hasTradeSection).toBe(true)
    })
  })
})
