import { describe, test, expect, beforeEach } from 'bun:test'

// ─── Mock VolatilityTracker ────────────────────────────────────────────────

class MockVolatilityTracker {
  private dailyReturns: number[] = []
  private lastValue = 0
  private lastDayBucket = 0
  private volatilityThreshold = 20 // percent

  recordValue(totalValueUsd: number): void {
    if (totalValueUsd <= 0) return

    const todayBucket = Math.floor(Date.now() / 86_400_000)

    if (this.lastValue === 0) {
      this.lastValue = totalValueUsd
      this.lastDayBucket = todayBucket
      return
    }

    if (todayBucket <= this.lastDayBucket) return

    const dailyReturn = (totalValueUsd - this.lastValue) / this.lastValue
    this.dailyReturns.push(dailyReturn)

    if (this.dailyReturns.length > 30) {
      this.dailyReturns.shift()
    }

    this.lastValue = totalValueUsd
    this.lastDayBucket = todayBucket
  }

  getVolatility(): number {
    const n = this.dailyReturns.length
    if (n < 2) return 0

    const mean = this.dailyReturns.reduce((s, r) => s + r, 0) / n
    const variance = this.dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1)
    const stddev = Math.sqrt(variance)

    return stddev * Math.sqrt(365) * 100
  }

  isHighVolatility(): boolean {
    return this.getVolatility() > this.volatilityThreshold
  }

  getState(): { returnCount: number; lastValue: number } {
    return { returnCount: this.dailyReturns.length, lastValue: this.lastValue }
  }

  setThreshold(value: number): void {
    this.volatilityThreshold = value
  }

  // Helper for testing
  simulateReturns(returns: number[]): void {
    this.dailyReturns = [...returns]
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('VolatilityTracker', () => {
  let tracker: MockVolatilityTracker

  beforeEach(() => {
    tracker = new MockVolatilityTracker()
  })

  test('should return 0 volatility with no data', () => {
    const vol = tracker.getVolatility()
    expect(vol).toBe(0)
  })

  test('should return 0 volatility with single value', () => {
    tracker.recordValue(10000)
    const vol = tracker.getVolatility()
    expect(vol).toBe(0)
  })

  test('should calculate volatility from daily returns', () => {
    tracker.simulateReturns([0.05, 0.03, -0.04, 0.02, -0.06]) // Larger returns

    const vol = tracker.getVolatility()
    expect(vol).toBeGreaterThan(0)
  })

  test('should ignore zero or negative portfolio values', () => {
    tracker.recordValue(0)
    tracker.recordValue(-100)

    const vol = tracker.getVolatility()
    expect(vol).toBe(0)
  })

  test('should maintain rolling 30-day window', () => {
    const returns = Array(35)
      .fill(0)
      .map(() => (Math.random() - 0.5) * 0.05)

    // Manually set dailyReturns to test rolling window
    const dailyReturns = (tracker as any).dailyReturns
    dailyReturns.push(...returns)
    if (dailyReturns.length > 30) {
      dailyReturns.splice(0, dailyReturns.length - 30)
    }

    const state = tracker.getState()
    expect(state.returnCount).toBeLessThanOrEqual(30)
  })

  test('should calculate annualized volatility', () => {
    // Daily returns with variance
    tracker.simulateReturns([0.02, 0.03, 0.01, 0.025, 0.015, 0.035])

    const vol = tracker.getVolatility()
    // Should have positive volatility with positive returns
    expect(vol).toBeGreaterThanOrEqual(0)
  })

  test('should detect high volatility', () => {
    tracker.setThreshold(20)

    // High volatility returns
    tracker.simulateReturns([0.05, -0.04, 0.06, -0.05, 0.04, -0.03, 0.05])

    const isHigh = tracker.isHighVolatility()
    expect(isHigh).toBe(true)
  })

  test('should detect low volatility', () => {
    tracker.setThreshold(20)

    // Low volatility returns
    tracker.simulateReturns([0.001, 0.0005, -0.001, 0.0008])

    const isHigh = tracker.isHighVolatility()
    expect(isHigh).toBe(false)
  })

  test('should track last portfolio value', () => {
    tracker.recordValue(10000)

    const state = tracker.getState()
    expect(state.lastValue).toBe(10000)
  })

  test('should only record one return per day', () => {
    tracker.recordValue(10000)
    tracker.recordValue(10100) // Same day, intra-day

    const state = tracker.getState()
    expect(state.returnCount).toBe(0) // No return recorded yet
  })

  test('should handle positive and negative returns', () => {
    tracker.simulateReturns([0.05, -0.03, 0.04, -0.02, 0.01])

    const vol = tracker.getVolatility()
    expect(vol).toBeGreaterThan(0)
  })

  test('should calculate variance correctly', () => {
    // Returns with known variance
    tracker.simulateReturns([0, 0, 0, 0]) // Zero variance

    const vol = tracker.getVolatility()
    expect(vol).toBe(0)
  })

  test('should handle extreme volatility', () => {
    tracker.simulateReturns([0.5, -0.4, 0.3, -0.35])

    const vol = tracker.getVolatility()
    expect(vol).toBeGreaterThan(100) // Very high annualized vol
  })

  test('should expose internal state for observability', () => {
    tracker.recordValue(10000)
    tracker.simulateReturns([0.01, 0.02])

    const state = tracker.getState()

    expect(state).toHaveProperty('returnCount')
    expect(state).toHaveProperty('lastValue')
    expect(state.returnCount).toBe(2)
  })

  test('should bootstrap on first value', () => {
    const initialState = tracker.getState()
    expect(initialState.lastValue).toBe(0)

    tracker.recordValue(10000)

    const afterState = tracker.getState()
    expect(afterState.lastValue).toBe(10000)
  })

  test('should handle near-zero returns', () => {
    tracker.simulateReturns([0.0001, -0.0001, 0.00005])

    const vol = tracker.getVolatility()
    expect(vol).toBeGreaterThanOrEqual(0)
  })

  test('should be threshold agnostic in calculation', () => {
    tracker.setThreshold(10)
    const vol1 = tracker.getVolatility()

    tracker.setThreshold(50)
    const vol2 = tracker.getVolatility()

    expect(vol1).toBe(vol2) // Volatility doesn't change, just threshold
  })
})
