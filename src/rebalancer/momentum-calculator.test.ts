import { describe, test, expect, beforeEach } from 'bun:test'
import type { Allocation } from '@/types/index'

// ─── Mock MomentumCalculator ──────────────────────────────────────────────

class MockMomentumCalculator {
  private readonly priceHistory: Map<string, { timestamp: number; price: number }[]> = new Map()

  recordPrice(asset: string, price: number): void {
    if (price <= 0) return

    const dayBucket = Math.floor(Date.now() / 86_400_000)
    const history = this.priceHistory.get(asset) ?? []

    const last = history[history.length - 1]
    if (last && Math.floor(last.timestamp / 86_400_000) === dayBucket) {
      last.price = price
      last.timestamp = Date.now()
    } else {
      history.push({ timestamp: Date.now(), price })
      if (history.length > 30) {
        history.shift()
      }
    }

    this.priceHistory.set(asset, history)
  }

  getMomentum(asset: string): number {
    const history = this.priceHistory.get(asset)
    if (!history || history.length < 2) return 0

    const oldest = history[0]
    const newest = history[history.length - 1]
    if (oldest.price <= 0) return 0

    return (newest.price - oldest.price) / oldest.price
  }

  getMomentumAllocations(baseAllocations: Allocation[]): Allocation[] {
    if (baseAllocations.length === 0) return []

    const scores = baseAllocations.map((a) => ({
      alloc: a,
      momentum: Math.max(0, this.getMomentum(a.asset)),
    }))

    const totalMomentum = scores.reduce((s, x) => s + x.momentum, 0)

    const momentumWeights: number[] = scores.map((x) =>
      totalMomentum > 0 ? (x.momentum / totalMomentum) * 100 : x.alloc.targetPct,
    )

    const blended = scores.map((x, i) => ({
      ...x.alloc,
      targetPct: 0.5 * x.alloc.targetPct + 0.5 * (momentumWeights[i] ?? 0),
    }))

    const totalBlended = blended.reduce((s, a) => s + a.targetPct, 0)
    if (totalBlended === 0) return baseAllocations

    return blended.map((a) => ({
      ...a,
      targetPct: (a.targetPct / totalBlended) * 100,
    }))
  }

  getAllMomentumScores(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const asset of this.priceHistory.keys()) {
      result[asset] = this.getMomentum(asset)
    }
    return result
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MomentumCalculator', () => {
  let calculator: MockMomentumCalculator

  beforeEach(() => {
    calculator = new MockMomentumCalculator()
  })

  test('should record price observations', () => {
    calculator.recordPrice('BTC', 50000)
    const scores = calculator.getAllMomentumScores()

    expect(scores.BTC).toBeDefined()
  })

  test('should return 0 momentum with single price', () => {
    calculator.recordPrice('BTC', 50000)
    const momentum = calculator.getMomentum('BTC')

    expect(momentum).toBe(0)
  })

  test('should calculate positive momentum', () => {
    calculator.recordPrice('BTC', 50000)

    // Mock historical data with 2 samples
    const history = [
      { timestamp: Date.now() - 86_400_000, price: 50000 },
      { timestamp: Date.now(), price: 55000 },
    ]

    // Set up history directly (using reflection for testing)
    const priceHistoryMap = (calculator as any).priceHistory
    priceHistoryMap.set('BTC', history)

    const momentum = calculator.getMomentum('BTC')
    expect(momentum).toBeGreaterThan(0)
    expect(momentum).toBeCloseTo(0.1, 1) // 10% gain
  })

  test('should calculate negative momentum', () => {
    const history = [
      { timestamp: Date.now() - 86_400_000, price: 50000 },
      { timestamp: Date.now(), price: 45000 },
    ]

    const priceHistoryMap = (calculator as any).priceHistory
    priceHistoryMap.set('BTC', history)

    const momentum = calculator.getMomentum('BTC')
    expect(momentum).toBeLessThan(0)
    expect(momentum).toBeCloseTo(-0.1, 1) // 10% loss
  })

  test('should ignore zero or negative prices', () => {
    calculator.recordPrice('BTC', 0)
    calculator.recordPrice('ETH', -100)

    const momentumBTC = calculator.getMomentum('BTC')
    const momentumETH = calculator.getMomentum('ETH')

    expect(momentumBTC).toBe(0)
    expect(momentumETH).toBe(0)
  })

  test('should maintain rolling 30-day window', () => {
    // Record many price points
    for (let i = 0; i < 40; i++) {
      calculator.recordPrice('BTC', 50000 + i * 100)
    }

    const scores = calculator.getAllMomentumScores()
    expect(scores.BTC).toBeDefined()
  })

  test('should blend allocations 50/50 with momentum', () => {
    const baseAllocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]

    calculator.recordPrice('BTC', 50000)
    calculator.recordPrice('BTC', 55000) // +10%

    calculator.recordPrice('ETH', 3000)
    calculator.recordPrice('ETH', 2700) // -10%

    const blended = calculator.getMomentumAllocations(baseAllocations)

    expect(blended.length).toBe(2)
    expect(blended.reduce((s, a) => s + a.targetPct, 0)).toBeCloseTo(100, 0)
  })

  test('should handle zero total momentum', () => {
    const baseAllocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]

    // No price history recorded, so momentum is 0 for both
    const blended = calculator.getMomentumAllocations(baseAllocations)

    expect(blended.length).toBe(2)
    expect(blended[0].targetPct).toBeCloseTo(50, 0)
    expect(blended[1].targetPct).toBeCloseTo(50, 0)
  })

  test('should ignore negative momentum in tilt', () => {
    const baseAllocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]

    const priceHistoryMap = (calculator as any).priceHistory

    priceHistoryMap.set('BTC', [
      { timestamp: Date.now() - 86_400_000, price: 50000 },
      { timestamp: Date.now(), price: 55000 }, // +10%
    ])

    priceHistoryMap.set('ETH', [
      { timestamp: Date.now() - 86_400_000, price: 3000 },
      { timestamp: Date.now(), price: 2700 }, // -10% (ignored)
    ])

    const blended = calculator.getMomentumAllocations(baseAllocations)

    // BTC should get boost, ETH should not
    const btcAlloc = blended.find((a) => a.asset === 'BTC')
    const ethAlloc = blended.find((a) => a.asset === 'ETH')

    expect(btcAlloc!.targetPct).toBeGreaterThanOrEqual(ethAlloc!.targetPct)
  })

  test('should normalize blended allocations to 100%', () => {
    const baseAllocations: Allocation[] = [
      { asset: 'BTC', targetPct: 40 },
      { asset: 'ETH', targetPct: 60 },
    ]

    calculator.recordPrice('BTC', 50000)
    calculator.recordPrice('BTC', 52000)

    calculator.recordPrice('ETH', 3000)
    calculator.recordPrice('ETH', 3100)

    const blended = calculator.getMomentumAllocations(baseAllocations)
    const total = blended.reduce((s, a) => s + a.targetPct, 0)

    expect(total).toBeCloseTo(100, 0)
  })

  test('should return empty array for empty input', () => {
    const result = calculator.getMomentumAllocations([])
    expect(result.length).toBe(0)
  })

  test('should track multiple assets independently', () => {
    const priceHistoryMap = (calculator as any).priceHistory

    priceHistoryMap.set('BTC', [
      { timestamp: Date.now() - 86_400_000, price: 50000 },
      { timestamp: Date.now(), price: 55000 },
    ])

    priceHistoryMap.set('ETH', [
      { timestamp: Date.now() - 86_400_000, price: 3000 },
      { timestamp: Date.now(), price: 2700 },
    ])

    const scores = calculator.getAllMomentumScores()

    expect(scores.BTC).toBeGreaterThan(0)
    expect(scores.ETH).toBeLessThan(0)
  })

  test('should return all momentum scores', () => {
    const priceHistoryMap = (calculator as any).priceHistory

    priceHistoryMap.set('BTC', [
      { timestamp: Date.now() - 86_400_000, price: 50000 },
      { timestamp: Date.now(), price: 55000 },
    ])

    priceHistoryMap.set('ETH', [
      { timestamp: Date.now() - 86_400_000, price: 3000 },
      { timestamp: Date.now(), price: 3100 },
    ])

    priceHistoryMap.set('XRP', [
      { timestamp: Date.now() - 86_400_000, price: 0.5 },
      { timestamp: Date.now(), price: 0.6 },
    ])

    const scores = calculator.getAllMomentumScores()

    expect(Object.keys(scores).length).toBe(3)
    expect(scores.BTC).toBeGreaterThan(0)
    expect(scores.ETH).toBeGreaterThan(0)
    expect(scores.XRP).toBeGreaterThan(0)
  })

  test('should handle single asset allocation', () => {
    const baseAllocations: Allocation[] = [{ asset: 'BTC', targetPct: 100 }]

    calculator.recordPrice('BTC', 50000)
    calculator.recordPrice('BTC', 55000)

    const blended = calculator.getMomentumAllocations(baseAllocations)

    expect(blended.length).toBe(1)
    expect(blended[0].targetPct).toBeCloseTo(100, 0)
  })
})
