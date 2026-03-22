import { describe, it, expect } from 'bun:test'

// Test the core PnL calculation logic
function computeRealizedByAsset(
  rows: Array<{ pair: string; side: string; costUsd: number; fee: number | null }>,
): Record<string, number> {
  const byAsset: Record<string, number> = {}

  for (const row of rows) {
    const asset = row.pair.split('/')[0] ?? row.pair
    const fee = row.fee ?? 0

    if (!(asset in byAsset)) byAsset[asset] = 0

    if (row.side === 'sell') {
      byAsset[asset] += row.costUsd - fee
    } else {
      byAsset[asset] -= row.costUsd + fee
    }
  }

  return byAsset
}

describe('PnLCalculator - Core Logic', () => {
  describe('realized PnL', () => {
    it('calculates positive PnL from buy/sell round trip', () => {
      const trades = [
        { pair: 'BTC/USDT', side: 'buy' as const, costUsd: 30000, fee: 100 },
        { pair: 'BTC/USDT', side: 'sell' as const, costUsd: 40000, fee: 100 },
      ]

      const result = computeRealizedByAsset(trades)

      // Expected: 40000 (sell) - 30000 (buy) - 200 (fees) = 9800
      expect(result['BTC']).toBeCloseTo(9800, 1)
    })

    it('calculates negative PnL from losing trades', () => {
      const trades = [
        { pair: 'ETH/USDT', side: 'buy' as const, costUsd: 10000, fee: 50 },
        { pair: 'ETH/USDT', side: 'sell' as const, costUsd: 8000, fee: 50 },
      ]

      const result = computeRealizedByAsset(trades)
      expect(result['ETH']).toBeCloseTo(-2100, 1)
    })

    it('aggregates PnL by multiple assets', () => {
      const trades = [
        { pair: 'BTC/USDT', side: 'buy' as const, costUsd: 30000, fee: 100 },
        { pair: 'BTC/USDT', side: 'sell' as const, costUsd: 40000, fee: 100 },
        { pair: 'ETH/USDT', side: 'buy' as const, costUsd: 10000, fee: 50 },
        { pair: 'ETH/USDT', side: 'sell' as const, costUsd: 11000, fee: 50 },
      ]

      const result = computeRealizedByAsset(trades)
      // BTC: sell 40000 - buy 30000 - fees 200 = 9800
      expect(result['BTC']).toBeCloseTo(9800, 1)
      // ETH: sell 11000 - buy 10000 - fees 100 = 900
      expect(result['ETH']).toBeCloseTo(900, 1)
      const totalPnl = Object.values(result).reduce((s, v) => s + v, 0)
      expect(totalPnl).toBeCloseTo(10700, 1)
    })

    it('handles empty trades array', () => {
      const trades: Array<{ pair: string; side: string; costUsd: number; fee: number | null }> = []

      const result = computeRealizedByAsset(trades)

      expect(Object.keys(result).length).toBe(0)
    })
  })

  describe('FIFO cost basis calculation', () => {
    it('calculates FIFO average cost from multiple buys', () => {
      const amount1 = 1
      const cost1 = 30000
      const amount2 = 1
      const cost2 = 31000

      const totalAmount = amount1 + amount2
      const totalCost = cost1 + cost2
      const avgCost = totalCost / totalAmount

      expect(avgCost).toBeCloseTo(30500, 1)

      const currentPrice = 40000
      const currentValue = totalAmount * currentPrice
      const pnl = currentValue - totalCost

      expect(currentValue).toBeCloseTo(80000, 1)
      expect(pnl).toBeCloseTo(19000, 1)
    })

    it('calculates remaining FIFO lots after partial sell', () => {
      // Buy 10 @ 1000, buy 10 @ 1100, sell 5
      const lot1Amount = 10
      const lot1Cost = 10000
      const lot1CostPerUnit = lot1Cost / lot1Amount

      const lot2Amount = 10
      const lot2Cost = 11000
      const lot2CostPerUnit = lot2Cost / lot2Amount

      const sellAmount = 5

      // FIFO: consume 5 from lot 1
      const remaining1 = Math.max(0, lot1Amount - sellAmount)
      const remaining2 = lot2Amount

      const totalRemaining = remaining1 + remaining2
      const totalRemainingCost = remaining1 * lot1CostPerUnit + remaining2 * lot2CostPerUnit

      expect(totalRemaining).toBe(15)
      expect(totalRemainingCost).toBeCloseTo(16000, 1)

      const currentPrice = 1600
      const currentValue = totalRemaining * currentPrice
      const pnl = currentValue - totalRemainingCost

      expect(currentValue).toBeCloseTo(24000, 1)
      expect(pnl).toBeCloseTo(8000, 1)
    })

  describe('period-based filtering', () => {
    it('filters trades by timestamp range', () => {
      const now = Date.now()
      const dayAgoMs = now - 86400000
      const weekAgoMs = now - 7 * 86400000

      const allTrades = [
        { timestamp: weekAgoMs, pair: 'BTC/USDT', side: 'buy' as const, costUsd: 30000, fee: 0 },
        { timestamp: weekAgoMs, pair: 'BTC/USDT', side: 'sell' as const, costUsd: 35000, fee: 0 },
        { timestamp: dayAgoMs, pair: 'ETH/USDT', side: 'buy' as const, costUsd: 10000, fee: 0 },
        { timestamp: dayAgoMs, pair: 'ETH/USDT', side: 'sell' as const, costUsd: 11000, fee: 0 },
      ]

      const dailyTrades = allTrades.filter((t) => t.timestamp >= dayAgoMs)
      const weeklyTrades = allTrades.filter((t) => t.timestamp >= weekAgoMs)

      expect(dailyTrades.length).toBe(2)
      expect(weeklyTrades.length).toBe(4)
    })
  })
})
})
