import { describe, test, expect, beforeEach } from 'bun:test'
import type { Allocation } from '@/types/index'

// ─── Mock StrategyManager ──────────────────────────────────────────────────

type StrategyMode = 'threshold' | 'equal-weight' | 'momentum-tilt' | 'vol-adjusted'

class MockStrategyManager {
  private mode: StrategyMode
  private volatility = 0
  private momentumScores: Record<string, number> = {}

  constructor(mode: StrategyMode = 'threshold') {
    this.mode = mode
  }

  getEffectiveAllocations(baseAllocations: Allocation[]): Allocation[] {
    switch (this.mode) {
      case 'equal-weight':
        return this.toEqualWeight(baseAllocations)

      case 'momentum-tilt':
        return this.applyMomentumTilt(baseAllocations)

      default:
        return baseAllocations
    }
  }

  shouldRebalance(maxDriftPct: number): boolean {
    const threshold = this.getDynamicThreshold()

    if (this.mode === 'vol-adjusted') {
      if (this.volatility <= 20) return false // Not high volatility
    }

    return maxDriftPct >= threshold
  }

  getDynamicThreshold(): number {
    if (this.mode !== 'vol-adjusted') return 5 // Default threshold

    return this.volatility > 20 ? 3 : 7 // Dynamic based on vol
  }

  getStrategyInfo() {
    return {
      mode: this.mode,
      threshold: this.getDynamicThreshold(),
      volatility: this.volatility,
      momentumScores: this.momentumScores,
    }
  }

  setMode(mode: StrategyMode): void {
    this.mode = mode
  }

  getMode(): StrategyMode {
    return this.mode
  }

  // Helpers for testing
  setVolatility(vol: number): void {
    this.volatility = vol
  }

  setMomentumScores(scores: Record<string, number>): void {
    this.momentumScores = scores
  }

  private toEqualWeight(allocations: Allocation[]): Allocation[] {
    if (allocations.length === 0) return []
    const equalPct = 100 / allocations.length
    return allocations.map((a) => ({ ...a, targetPct: equalPct }))
  }

  private applyMomentumTilt(allocations: Allocation[]): Allocation[] {
    // Simplified: just blend with momentum scores
    const scores = allocations.map((a) => ({
      alloc: a,
      momentum: Math.max(0, this.momentumScores[a.asset] ?? 0),
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
    if (totalBlended === 0) return allocations

    return blended.map((a) => ({
      ...a,
      targetPct: (a.targetPct / totalBlended) * 100,
    }))
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('StrategyManager', () => {
  let manager: MockStrategyManager

  beforeEach(() => {
    manager = new MockStrategyManager('threshold')
  })

  test('should default to threshold mode', () => {
    expect(manager.getMode()).toBe('threshold')
  })

  test('should allow mode changes', () => {
    manager.setMode('equal-weight')
    expect(manager.getMode()).toBe('equal-weight')
  })

  test('should return base allocations for threshold mode', () => {
    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]

    const effective = manager.getEffectiveAllocations(allocations)

    expect(effective[0].targetPct).toBe(50)
    expect(effective[1].targetPct).toBe(50)
  })

  test('should equalize allocations in equal-weight mode', () => {
    manager.setMode('equal-weight')

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 70 },
      { asset: 'ETH', targetPct: 30 },
    ]

    const effective = manager.getEffectiveAllocations(allocations)

    expect(effective[0].targetPct).toBeCloseTo(50, 0)
    expect(effective[1].targetPct).toBeCloseTo(50, 0)
  })

  test('should apply momentum tilt in momentum-tilt mode', () => {
    manager.setMode('momentum-tilt')
    manager.setMomentumScores({ BTC: 0.1, ETH: -0.05 })

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 50 },
    ]

    const effective = manager.getEffectiveAllocations(allocations)

    expect(effective[0].targetPct).toBeGreaterThan(effective[1].targetPct)
  })

  test('should use dynamic threshold in vol-adjusted mode', () => {
    manager.setMode('vol-adjusted')

    manager.setVolatility(10) // Low vol
    let threshold = manager.getDynamicThreshold()
    expect(threshold).toBe(7) // High threshold

    manager.setVolatility(30) // High vol
    threshold = manager.getDynamicThreshold()
    expect(threshold).toBe(3) // Low threshold
  })

  test('should require high vol for rebalance in vol-adjusted mode', () => {
    manager.setMode('vol-adjusted')
    manager.setVolatility(10) // Low volatility

    const shouldRebalance = manager.shouldRebalance(10) // High drift
    expect(shouldRebalance).toBe(false) // Still no rebalance
  })

  test('should rebalance on high vol with vol-adjusted', () => {
    manager.setMode('vol-adjusted')
    manager.setVolatility(30) // High volatility
    manager.setVolatility(30)

    const shouldRebalance = manager.shouldRebalance(5) // Drift >= dynamic threshold
    expect(shouldRebalance).toBe(true)
  })

  test('should use fixed threshold for non-vol-adjusted modes', () => {
    manager.setMode('threshold')
    manager.setVolatility(100) // Should be ignored

    const threshold = manager.getDynamicThreshold()
    expect(threshold).toBe(5)
  })

  test('should return strategy info', () => {
    manager.setMode('momentum-tilt')
    manager.setVolatility(15)
    manager.setMomentumScores({ BTC: 0.1, ETH: 0.05 })

    const info = manager.getStrategyInfo()

    expect(info.mode).toBe('momentum-tilt')
    expect(info.volatility).toBe(15)
    expect(info.momentumScores.BTC).toBe(0.1)
  })

  test('should check rebalance threshold in threshold mode', () => {
    manager.setMode('threshold')

    expect(manager.shouldRebalance(4)).toBe(false) // Below 5%
    expect(manager.shouldRebalance(5)).toBe(true) // At 5%
    expect(manager.shouldRebalance(6)).toBe(true) // Above 5%
  })

  test('should handle single-asset allocation for equal-weight', () => {
    manager.setMode('equal-weight')

    const allocations: Allocation[] = [{ asset: 'BTC', targetPct: 50 }]

    const effective = manager.getEffectiveAllocations(allocations)

    expect(effective.length).toBe(1)
    expect(effective[0].targetPct).toBeCloseTo(100, 0)
  })

  test('should handle empty allocations', () => {
    const effective = manager.getEffectiveAllocations([])

    expect(effective.length).toBe(0)
  })

  test('should handle three-asset allocation for equal-weight', () => {
    manager.setMode('equal-weight')

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50 },
      { asset: 'ETH', targetPct: 30 },
      { asset: 'USDT', targetPct: 20 },
    ]

    const effective = manager.getEffectiveAllocations(allocations)

    expect(effective.length).toBe(3)
    expect(effective[0].targetPct).toBeCloseTo(33.33, 1)
    expect(effective[1].targetPct).toBeCloseTo(33.33, 1)
    expect(effective[2].targetPct).toBeCloseTo(33.33, 1)
  })

  test('should normalize momentum-tilt allocations to 100%', () => {
    manager.setMode('momentum-tilt')
    manager.setMomentumScores({ BTC: 0.1, ETH: 0.05 })

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 40 },
      { asset: 'ETH', targetPct: 60 },
    ]

    const effective = manager.getEffectiveAllocations(allocations)
    const total = effective.reduce((s, a) => s + a.targetPct, 0)

    expect(total).toBeCloseTo(100, 0)
  })

  test('should support all four strategy modes', () => {
    const modes: StrategyMode[] = ['threshold', 'equal-weight', 'momentum-tilt', 'vol-adjusted']

    for (const mode of modes) {
      manager.setMode(mode)
      expect(manager.getMode()).toBe(mode)
    }
  })
})
