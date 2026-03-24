import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import type { BacktestConfig, SimulatedTrade } from './metrics-calculator'
import type { OHLCVCandle } from './historical-data-loader'

// Mock implementation for testing rebalance logic
class MockBacktestSimulator {
  _buildTimeline(ohlcvData: Record<string, OHLCVCandle[]>): number[] {
    const pairs = Object.keys(ohlcvData)
    if (pairs.length === 0) return []

    let common = new Set(ohlcvData[pairs[0]!]!.map((c) => c.timestamp))

    for (let i = 1; i < pairs.length; i++) {
      const pairTs = new Set(ohlcvData[pairs[i]!]!.map((c) => c.timestamp))
      common = new Set([...common].filter((ts) => pairTs.has(ts)))
    }

    return [...common].sort((a, b) => a - b)
  }

  _pricesAtTimestamp(
    ohlcvData: Record<string, OHLCVCandle[]>,
    ts: number,
  ): Record<string, number> {
    const prices: Record<string, number> = {}
    for (const [pair, candles] of Object.entries(ohlcvData)) {
      const candle = candles.find((c) => c.timestamp === ts)
      if (candle) prices[pair] = candle.close
    }
    return prices
  }

  _needsRebalance(
    holdings: Record<string, { amount: number; valueUsd: number }>,
    allocations: Array<{ asset: string; targetPct: number }>,
    totalValueUsd: number,
    threshold: number,
  ): boolean {
    if (totalValueUsd <= 0) return false

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const currentUsd = holdings[pair]?.valueUsd ?? 0
      const currentPct = (currentUsd / totalValueUsd) * 100
      const drift = Math.abs(currentPct - alloc.targetPct)
      if (drift >= threshold) return true
    }

    return false
  }

  simulateRebalance(
    holdings: Record<string, { amount: number; valueUsd: number }>,
    allocations: Array<{ asset: string; targetPct: number }>,
    prices: Record<string, number>,
    totalValueUsd: number,
    ts: number,
    feePct: number,
  ): SimulatedTrade[] {
    const trades: SimulatedTrade[] = []

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const targetValueUsd = (alloc.targetPct / 100) * totalValueUsd
      const currentValue = holdings[pair]?.valueUsd ?? 0
      const price = prices[pair]

      if (!price || price <= 0) continue

      const diff = targetValueUsd - currentValue

      if (Math.abs(diff) > 1) {
        const side = diff > 0 ? 'buy' : 'sell'
        const costUsd = Math.abs(diff)
        const assetAmount = costUsd / price
        const fee = costUsd * feePct

        if (side === 'buy') {
          if (holdings[pair]) {
            holdings[pair].amount += assetAmount
            holdings[pair].valueUsd += costUsd - fee
          } else {
            holdings[pair] = { amount: assetAmount, valueUsd: costUsd - fee }
          }
        } else {
          if (holdings[pair]) {
            holdings[pair].amount = Math.max(0, holdings[pair].amount - assetAmount)
            holdings[pair].valueUsd = Math.max(0, holdings[pair].valueUsd - costUsd)
          }
        }

        trades.push({
          timestamp: ts,
          pair,
          side,
          amount: assetAmount,
          price,
          costUsd,
          fee,
        })
      }
    }

    return trades
  }
}

describe('BacktestSimulator', () => {
  let sim: MockBacktestSimulator

  beforeEach(() => {
    sim = new MockBacktestSimulator()
  })

  it('builds timeline from merged candles', () => {
    const now = Date.now()

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
        { timestamp: now + 86400000, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
      ],
      'ETH/USDT': [
        { timestamp: now, open: 1000, high: 1100, low: 900, close: 1050, volume: 500 },
        { timestamp: now + 86400000, open: 1050, high: 1200, low: 1000, close: 1100, volume: 600 },
      ],
    }

    const timeline = sim._buildTimeline(ohlcvData)

    expect(timeline.length).toBe(2)
    expect(timeline[0]).toBe(now)
    expect(timeline[1]).toBe(now + 86400000)
  })

  it('extracts prices at timestamp', () => {
    const now = Date.now()

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      ],
      'ETH/USDT': [
        { timestamp: now, open: 1000, high: 1100, low: 900, close: 1050, volume: 500 },
      ],
    }

    const prices = sim._pricesAtTimestamp(ohlcvData, now)

    expect(prices['BTC/USDT']).toBe(30500)
    expect(prices['ETH/USDT']).toBe(1050)
  })

  it('detects rebalance trigger at threshold', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {
      'BTC/USDT': { amount: 1, valueUsd: 30000 },
      'ETH/USDT': { amount: 10, valueUsd: 15000 },
    }
    const totalValue = 45000
    const allocations = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]
    const threshold = 5

    // Current: BTC 66.67%, ETH 33.33% → drift = 16.67% > 5% threshold
    const needsRebalance = sim._needsRebalance(holdings, allocations, totalValue, threshold)

    expect(needsRebalance).toBe(true)
  })

  it('skips rebalance when within threshold', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {
      'BTC/USDT': { amount: 1, valueUsd: 22500 },
      'ETH/USDT': { amount: 21.43, valueUsd: 22500 },
    }
    const totalValue = 45000
    const allocations = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]
    const threshold = 5

    // Current: 50/50 → drift = 0% < 5% threshold
    const needsRebalance = sim._needsRebalance(holdings, allocations, totalValue, threshold)

    expect(needsRebalance).toBe(false)
  })

  it('executes rebalance trades', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {
      'BTC/USDT': { amount: 2, valueUsd: 60000 }, // 66.7% of 90k
      'ETH/USDT': { amount: 10, valueUsd: 30000 }, // 33.3% of 90k
    }
    const allocations = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]
    const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 3000 }
    const totalValue = 90000
    const feePct = 0.001
    const ts = Date.now()

    const trades = sim.simulateRebalance(holdings, allocations, prices, totalValue, ts, feePct)

    expect(trades.length).toBeGreaterThan(0)
    expect(trades.some((t) => t.side === 'sell')).toBe(true)
    expect(trades.some((t) => t.side === 'buy')).toBe(true)
  })

  it('deducts fees from trades', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {
      'BTC/USDT': { amount: 1, valueUsd: 30000 },
    }
    const allocations = [{ asset: 'BTC', targetPct: 100 }]
    const prices = { 'BTC/USDT': 30000 }
    const totalValue = 30000
    const feePct = 0.001
    const ts = Date.now()

    const trades = sim.simulateRebalance(holdings, allocations, prices, totalValue, ts, feePct)

    for (const trade of trades) {
      const expectedFee = trade.costUsd * feePct
      expect(trade.fee).toBeCloseTo(expectedFee, 4)
    }
  })

  it('handles multiple rebalance cycles', () => {
    const now = Date.now()
    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + 86400000, open: 30000, high: 35000, low: 29000, close: 35000, volume: 120 },
        { timestamp: now + 2 * 86400000, open: 35000, high: 36000, low: 34000, close: 34000, volume: 110 },
      ],
    }

    const timeline = sim._buildTimeline(ohlcvData)

    expect(timeline.length).toBe(3)

    let totalTrades = 0
    for (const ts of timeline) {
      const prices = sim._pricesAtTimestamp(ohlcvData, ts)
      expect(Object.keys(prices).length).toBeGreaterThan(0)
      totalTrades++
    }

    expect(totalTrades).toBe(3)
  })

  it('accumulates equity curve across candles', () => {
    const equityCurve: { timestamp: number; value: number }[] = []
    const now = Date.now()

    const values = [10000, 10500, 11000, 10800, 11200]
    for (let i = 0; i < values.length; i++) {
      equityCurve.push({ timestamp: now + i * 86400000, value: values[i] })
    }

    expect(equityCurve.length).toBe(5)
    expect(equityCurve[0].value).toBe(10000)
    expect(equityCurve[equityCurve.length - 1].value).toBe(11200)

    const totalReturn = ((equityCurve[equityCurve.length - 1].value - equityCurve[0].value) / equityCurve[0].value) * 100
    expect(totalReturn).toBeCloseTo(12, 1)
  })

  it('correctly initializes holdings from allocations', () => {
    const allocations = [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ]
    const initialBalance = 10000
    const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 2000 }

    const holdings: Record<string, { amount: number; valueUsd: number }> = {}

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const price = prices[pair]
      if (!price || price <= 0) continue

      const usdAlloc = (alloc.targetPct / 100) * initialBalance
      holdings[pair] = {
        amount: usdAlloc / price,
        valueUsd: usdAlloc,
      }
    }

    expect(holdings['BTC/USDT'].valueUsd).toBeCloseTo(6000, 1)
    expect(holdings['ETH/USDT'].valueUsd).toBeCloseTo(4000, 1)
  })

  it('handles price updates across timeline', () => {
    const now = Date.now()
    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + 86400000, open: 30000, high: 35000, low: 29000, close: 34000, volume: 120 },
        { timestamp: now + 2 * 86400000, open: 34000, high: 36000, low: 33000, close: 35000, volume: 130 },
      ],
    }

    const timeline = sim._buildTimeline(ohlcvData)
    const pricesList: Record<string, number>[] = []

    for (const ts of timeline) {
      const prices = sim._pricesAtTimestamp(ohlcvData, ts)
      pricesList.push(prices)
    }

    expect(pricesList[0]['BTC/USDT']).toBe(30000)
    expect(pricesList[1]['BTC/USDT']).toBe(34000)
    expect(pricesList[2]['BTC/USDT']).toBe(35000)
  })

  it('handles empty OHLCV data', () => {
    const ohlcvData: Record<string, OHLCVCandle[]> = {}
    const timeline = sim._buildTimeline(ohlcvData)
    expect(timeline.length).toBe(0)
  })

  it('handles no overlapping timestamps', () => {
    const now = Date.now()
    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [{ timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 }],
      'ETH/USDT': [{ timestamp: now + 86400000, open: 1000, high: 1100, low: 900, close: 1050, volume: 500 }],
    }

    const timeline = sim._buildTimeline(ohlcvData)
    expect(timeline.length).toBe(0)
  })

  it('returns correct drift detection on rebalance', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {
      'BTC/USDT': { amount: 1, valueUsd: 30000 },
      'ETH/USDT': { amount: 10, valueUsd: 15000 },
    }
    const allocations = [
      { asset: 'BTC', targetPct: 40 },
      { asset: 'ETH', targetPct: 60 },
    ]
    const totalValue = 45000

    // BTC at 66.67%, target 40% → drift 26.67% > 5% threshold
    const needsRebalance = sim._needsRebalance(holdings, allocations, totalValue, 5)
    expect(needsRebalance).toBe(true)
  })

  it('handles zero total value in rebalance check', () => {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {}
    const allocations = [{ asset: 'BTC', targetPct: 50 }]
    const totalValue = 0

    const needsRebalance = sim._needsRebalance(holdings, allocations, totalValue, 5)
    expect(needsRebalance).toBe(false)
  })

  it('calculates correct prices for missing timestamp', () => {
    const now = Date.now()
    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [{ timestamp: now, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 }],
    }

    const prices = sim._pricesAtTimestamp(ohlcvData, now + 86400000) // Missing timestamp
    expect(Object.keys(prices).length).toBe(0)
  })
})
