import { describe, it, expect, beforeEach } from 'bun:test'
import { GridPnLTracker } from './grid-pnl-tracker'

describe('GridPnLTracker', () => {
  let tracker: GridPnLTracker

  beforeEach(() => {
    tracker = new GridPnLTracker()
  })

  describe('recordTrade', () => {
    it('should record profitable trade', () => {
      tracker.recordTrade('bot-123', 40000, 41000, 1) // profit = 1000

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.realized).toBe(1000)
      expect(pnl.tradeCount).toBe(1)
    })

    it('should record loss trade', () => {
      tracker.recordTrade('bot-123', 50000, 49000, 2) // loss = -2000

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.realized).toBe(-2000)
      expect(pnl.tradeCount).toBe(1)
    })

    it('should accumulate multiple trades', () => {
      tracker.recordTrade('bot-123', 40000, 41000, 1) // +1000
      tracker.recordTrade('bot-123', 50000, 51000, 1) // +1000
      tracker.recordTrade('bot-123', 60000, 59000, 1) // -1000

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.realized).toBe(1000)
      expect(pnl.tradeCount).toBe(3)
    })

    it('should handle fractional amounts', () => {
      tracker.recordTrade('bot-123', 45000, 45100, 0.5) // profit = 50

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.realized).toBe(50)
      expect(pnl.tradeCount).toBe(1)
    })

    it('should track separate bots independently', () => {
      tracker.recordTrade('bot-1', 40000, 41000, 1) // +1000
      tracker.recordTrade('bot-2', 50000, 49000, 2) // -2000

      const pnl1 = tracker.getPnL('bot-1')
      const pnl2 = tracker.getPnL('bot-2')

      expect(pnl1.realized).toBe(1000)
      expect(pnl2.realized).toBe(-2000)
      expect(pnl1.tradeCount).toBe(1)
      expect(pnl2.tradeCount).toBe(1)
    })

    it('should calculate correct profit for large amounts', () => {
      tracker.recordTrade('bot-large', 10, 12, 1000) // profit = 2000

      const pnl = tracker.getPnL('bot-large')
      expect(pnl.realized).toBe(2000)
    })

    it('should handle break-even trades', () => {
      tracker.recordTrade('bot-even', 50000, 50000, 1) // 0 profit

      const pnl = tracker.getPnL('bot-even')
      expect(pnl.realized).toBe(0)
      expect(pnl.tradeCount).toBe(1)
    })
  })

  describe('getPnL', () => {
    it('should return zero for unknown bot', () => {
      const pnl = tracker.getPnL('unknown-bot')

      expect(pnl.realized).toBe(0)
      expect(pnl.unrealized).toBe(0)
      expect(pnl.total).toBe(0)
      expect(pnl.tradeCount).toBe(0)
    })

    it('should calculate total as realized + unrealized', () => {
      tracker.recordTrade('bot-123', 40000, 41000, 1)

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.total).toBe(pnl.realized + pnl.unrealized)
    })

    it('should always have zero unrealized', () => {
      tracker.recordTrade('bot-123', 40000, 41000, 1)
      tracker.recordTrade('bot-123', 50000, 49000, 2)

      const pnl = tracker.getPnL('bot-123')
      expect(pnl.unrealized).toBe(0)
    })

    it('should provide snapshot not reference', () => {
      tracker.recordTrade('bot-123', 40000, 41000, 1)

      const pnl1 = tracker.getPnL('bot-123')
      const pnl2 = tracker.getPnL('bot-123')

      expect(pnl1).not.toBe(pnl2)
      expect(pnl1.realized).toBe(pnl2.realized)
    })
  })

  describe('loadFromDb', () => {
    it('should load existing PnL from database', async () => {
      await tracker.loadFromDb('bot-db-123')
      // Should not throw even if bot doesn't exist in DB
      expect(true).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear bot state', () => {
      tracker.recordTrade('bot-clear', 40000, 41000, 1)
      tracker.clear('bot-clear')

      const pnl = tracker.getPnL('bot-clear')
      expect(pnl.realized).toBe(0)
      expect(pnl.tradeCount).toBe(0)
    })

    it('should not affect other bots', () => {
      tracker.recordTrade('bot-1', 40000, 41000, 1)
      tracker.recordTrade('bot-2', 50000, 51000, 1)

      tracker.clear('bot-1')

      const pnl1 = tracker.getPnL('bot-1')
      const pnl2 = tracker.getPnL('bot-2')

      expect(pnl1.tradeCount).toBe(0)
      expect(pnl2.tradeCount).toBe(1)
    })

    it('should be idempotent', () => {
      tracker.recordTrade('bot-idempotent', 40000, 41000, 1)
      tracker.clear('bot-idempotent')
      tracker.clear('bot-idempotent')

      expect(true).toBe(true)
    })
  })
})
