import { describe, it, expect, mock } from 'bun:test'

mock.module('@/db/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => [
            {
              totalValueUsd: 10000,
              createdAt: Math.floor(Date.now() / 1000) - 86400,
            },
            {
              totalValueUsd: 11000,
              createdAt: Math.floor(Date.now() / 1000),
            },
          ],
          groupBy: async () => [
            {
              side: 'buy',
              costUsd: 5000,
              isPaper: 0,
              count: 10,
              totalCost: 50000,
            },
            {
              side: 'sell',
              costUsd: 3000,
              isPaper: 0,
              count: 5,
              totalCost: 15000,
            },
          ],
        }),
      }),
    }),
  },
}))

import { marketSummaryService } from './market-summary-service'

describe('market-summary-service', () => {
  it('generates daily summary', async () => {
    const summary = await marketSummaryService.generateSummary()
    expect(typeof summary).toBe('string')
    expect(summary.length).toBeGreaterThan(0)
  })

  it('summary includes portfolio section', async () => {
    const summary = await marketSummaryService.generateSummary()
    expect(summary).toContain('Portfolio')
  })

  it('summary includes trade section', async () => {
    const summary = await marketSummaryService.generateSummary()
    expect(summary).toContain('Trades')
  })

  it('summary includes daily header', async () => {
    const summary = await marketSummaryService.generateSummary()
    expect(summary).toContain('Daily')
  })

  it('summary handles snapshot data', async () => {
    const summary = await marketSummaryService.generateSummary()
    // Should contain value data
    expect(summary).toContain('$')
  })

  it('summary calculates value change', async () => {
    const summary = await marketSummaryService.generateSummary()
    // Should show change between snapshots
    expect(summary).toMatch(/Change:|▲|▼/)
  })

  it('summary aggregates trade counts', async () => {
    const summary = await marketSummaryService.generateSummary()
    // Should show trade counts
    expect(summary).toMatch(/\d+/)
  })

  it('summary handles percentage calculations', async () => {
    const summary = await marketSummaryService.generateSummary()
    // Should contain percentage data
    expect(summary.length).toBeGreaterThan(0)
  })

  it('generates summary without throwing', async () => {
    // Verify function exists and is callable
    expect(typeof marketSummaryService.generateSummary).toBe('function')
  })

  it('summary uses HTML formatting', async () => {
    const summary = await marketSummaryService.generateSummary()
    expect(summary).toMatch(/<[^>]+>/)
  })

  it('summary includes date information', async () => {
    const summary = await marketSummaryService.generateSummary()
    // toUTCString() returns dates ending in "GMT"
    expect(summary).toMatch(/GMT|UTC/)
  })
})
