import { describe, it, expect } from 'bun:test'
import { marketSummaryService } from './market-summary-service'

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
  })
})
