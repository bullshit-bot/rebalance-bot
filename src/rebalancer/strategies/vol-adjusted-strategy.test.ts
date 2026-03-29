import { describe, test, expect, beforeEach } from 'bun:test'
import { VolAdjustedStrategy } from '@rebalancer/strategies/vol-adjusted-strategy'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const params = {
  type: 'vol-adjusted' as const,
  minTradeUsd: 10,
  baseThresholdPct: 5,
  volLookbackDays: 30,
  minThresholdPct: 3,
  maxThresholdPct: 20,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VolAdjustedStrategy', () => {
  let strategy: VolAdjustedStrategy

  beforeEach(() => {
    strategy = new VolAdjustedStrategy()
  })

  // ── recordVolatility ─────────────────────────────────────────────────────

  test('recordVolatility stores values correctly', () => {
    strategy.recordVolatility(10)
    strategy.recordVolatility(20)
    // Average should be (10+20)/2 = 15
    expect(strategy.getAverageVol()).toBeCloseTo(15, 5)
  })

  test('recordVolatility trims beyond lookbackDays', () => {
    // Fill with lookbackDays=3 cap
    for (let i = 1; i <= 5; i++) {
      strategy.recordVolatility(i, 3)
    }
    // Only last 3 values remain: [3, 4, 5] → avg = 4
    expect(strategy.getAverageVol()).toBeCloseTo(4, 5)
  })

  // ── getAverageVol ────────────────────────────────────────────────────────

  test('getAverageVol returns 0 with no history', () => {
    expect(strategy.getAverageVol()).toBe(0)
  })

  test('getAverageVol computes correct average', () => {
    strategy.recordVolatility(10)
    strategy.recordVolatility(20)
    strategy.recordVolatility(30)
    expect(strategy.getAverageVol()).toBeCloseTo(20, 5)
  })

  // ── getDynamicThreshold ──────────────────────────────────────────────────

  test('getDynamicThreshold returns baseThresholdPct with no history', () => {
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBe(params.baseThresholdPct)
  })

  test('getDynamicThreshold scales up when current vol > average vol', () => {
    // Add several low-vol readings, then a high one at the end
    strategy.recordVolatility(5)
    strategy.recordVolatility(5)
    strategy.recordVolatility(5)
    strategy.recordVolatility(5)
    // Current vol (last entry) = 5, avg = 5 → threshold = base = 5
    // Now push a high vol reading
    strategy.recordVolatility(20) // current=20, avg=(5+5+5+5+20)/5=8
    // raw = 5 * (20/8) = 12.5 → within [3,20]
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBeGreaterThan(params.baseThresholdPct)
    expect(threshold).toBeCloseTo(12.5, 1)
  })

  test('getDynamicThreshold scales down when current vol < average vol', () => {
    // Add several high-vol readings then a calm one
    strategy.recordVolatility(20)
    strategy.recordVolatility(20)
    strategy.recordVolatility(20)
    strategy.recordVolatility(20)
    strategy.recordVolatility(1) // current=1, avg=(20*4+1)/5=16.2
    // raw = 5 * (1/16.2) ≈ 0.308 → clamped at minThresholdPct=3
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBeLessThan(params.baseThresholdPct)
    expect(threshold).toBe(params.minThresholdPct)
  })

  test('getDynamicThreshold is clamped at maxThresholdPct', () => {
    // Very high current vol vs low average → raw would exceed max
    strategy.recordVolatility(1)   // low avg
    strategy.recordVolatility(1)
    strategy.recordVolatility(1)
    strategy.recordVolatility(1)
    strategy.recordVolatility(1000) // massive spike; avg=(1*4+1000)/5=200.8
    // raw = 5 * (1000/200.8) ≈ 24.9 → clamped at maxThresholdPct=20
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBe(params.maxThresholdPct)
  })

  test('getDynamicThreshold is clamped at minThresholdPct', () => {
    // Very low current vol vs high average
    strategy.recordVolatility(100)
    strategy.recordVolatility(100)
    strategy.recordVolatility(100)
    strategy.recordVolatility(100)
    strategy.recordVolatility(0.001) // near-zero current; avg ≈ 80
    // raw = 5 * (0.001/80) ≈ 0.0000625 → clamped at minThresholdPct=3
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBe(params.minThresholdPct)
  })

  test('getDynamicThreshold with equal current and average vol returns base', () => {
    // Same value for all readings → current == avg → ratio = 1 → raw = base
    strategy.recordVolatility(10)
    strategy.recordVolatility(10)
    strategy.recordVolatility(10)
    // current=10, avg=10, raw=5*(10/10)=5 → within [3,20]
    const threshold = strategy.getDynamicThreshold(params)
    expect(threshold).toBeCloseTo(params.baseThresholdPct, 5)
  })

  // ── reset ────────────────────────────────────────────────────────────────

  test('reset clears volatility history', () => {
    strategy.recordVolatility(50)
    strategy.recordVolatility(50)
    strategy.reset()
    expect(strategy.getAverageVol()).toBe(0)
    // After reset, getDynamicThreshold should return base (no history)
    expect(strategy.getDynamicThreshold(params)).toBe(params.baseThresholdPct)
  })
})
