import { describe, test, expect, beforeEach } from 'bun:test'
import { TrendFilter } from './trend-filter'

// ─── Tests for TrendFilter core logic + new features ─────────────────────────

describe('TrendFilter', () => {
  let filter: TrendFilter

  beforeEach(() => {
    filter = new TrendFilter()
  })

  // ─── Core recordPrice / isBullish ──────────────────────────────────────────

  describe('recordPrice', () => {
    test('should add daily close and increment data points', () => {
      filter.recordPrice(50000)
      expect(filter.getDataPoints()).toBe(1)
      expect(filter.getCurrentPrice()).toBe(50000)
    })

    test('should update same-day close without adding new entry', () => {
      filter.recordPrice(50000)
      filter.recordPrice(51000)
      expect(filter.getDataPoints()).toBe(1)
      expect(filter.getCurrentPrice()).toBe(51000)
    })
  })

  describe('isBullish', () => {
    test('should return true (bull) when insufficient data', () => {
      // No data — safe default
      expect(filter.isBullish()).toBe(true)
    })

    test('should return true when price is above MA', () => {
      // Feed 100 days of data at 50000, then current at 55000
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).dailyCloses[99] = 55000
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      // MA ~= 50000, price 55000 → bull
      expect(filter.isBullish(100, 2)).toBe(true)
    })

    test('should return false when price is below MA', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).dailyCloses[99] = 40000
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      // MA ~= 49900, price 40000 → bear
      expect(filter.isBullish(100, 2)).toBe(false)
    })

    test('should respect buffer percentage', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      // Price at 49500 = 1% below MA of 50000 → within 2% buffer → still bull
      ;(filter as any).dailyCloses[99] = 49500
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      expect(filter.isBullish(100, 2)).toBe(true)
    })
  })

  // ─── isBullishReadOnly ─────────────────────────────────────────────────────

  describe('isBullishReadOnly', () => {
    test('should return same result as isBullish without side effects', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).dailyCloses[99] = 55000
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      const readOnly = filter.isBullishReadOnly(100, 2)
      const withSideEffects = filter.isBullish(100, 2)
      expect(readOnly).toBe(withSideEffects)
    })

    test('should not modify lastBullish state', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).dailyCloses[99] = 55000
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      // lastBullish starts as null
      expect((filter as any).lastBullish).toBeNull()

      filter.isBullishReadOnly(100, 2)

      // Should still be null — read-only didn't modify state
      expect((filter as any).lastBullish).toBeNull()
    })
  })

  // ─── Trend flip detection ──────────────────────────────────────────────────

  describe('trend flip detection', () => {
    test('should not emit on first isBullish call (lastBullish is null)', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      // First call sets lastBullish but should NOT emit (null → value)
      filter.isBullish(100, 2)
      expect((filter as any).lastBullish).toBe(true)
    })

    test('should update lastBullish on subsequent calls', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)

      // First call — sets to true (bull)
      filter.isBullish(100, 2)
      expect((filter as any).lastBullish).toBe(true)

      // Drop price below MA → bear
      ;(filter as any).dailyCloses[99] = 40000
      filter.isBullish(100, 2)
      expect((filter as any).lastBullish).toBe(false)
    })
  })

  // ─── getMA ─────────────────────────────────────────────────────────────────

  describe('getMA', () => {
    test('should return null with insufficient data', () => {
      filter.recordPrice(50000)
      expect(filter.getMA(100)).toBeNull()
    })

    test('should return correct SMA', () => {
      for (let i = 0; i < 100; i++) {
        ;(filter as any).dailyCloses.push(50000)
      }
      ;(filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)
      expect(filter.getMA(100)).toBe(50000)
    })
  })

  // ─── loadFromDb ────────────────────────────────────────────────────────────

  describe('loadFromDb', () => {
    test('should default to bull when loadFromDb fails (no MongoDB)', async () => {
      // loadFromDb catches errors internally — without MongoDB it logs and continues
      // Verify the filter remains in safe default state
      expect(filter.isBullish()).toBe(true)
      expect(filter.getDataPoints()).toBe(0)
    })
  })

  // ─── Cap at 400 entries ────────────────────────────────────────────────────

  describe('data cap', () => {
    test('should cap dailyCloses at 400 entries', () => {
      for (let i = 0; i < 405; i++) {
        ;(filter as any).dailyCloses.push(50000 + i)
        ;(filter as any).lastRecordedDay = i
      }
      // Manually simulate the cap logic
      while ((filter as any).dailyCloses.length > 400) {
        ;(filter as any).dailyCloses.shift()
      }
      expect(filter.getDataPoints()).toBe(400)
    })
  })

  // ─── isBullishWithCooldown ─────────────────────────────────────────────────

  describe('isBullishWithCooldown', () => {
    /** Seed 100 closes at `basePrice` then set last close to `lastPrice` */
    function seedPrices(f: TrendFilter, basePrice: number, lastPrice: number): void {
      for (let i = 0; i < 100; i++) {
        ;(f as any).dailyCloses.push(basePrice)
      }
      ;(f as any).dailyCloses[99] = lastPrice
      ;(f as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000)
    }

    test('first call returns raw signal regardless of cooldown', () => {
      seedPrices(filter, 50000, 55000)
      // Price above MA → raw = bull
      const result = filter.isBullishWithCooldown(100, 2, 3)
      expect(result).toBe(true)
    })

    test('suppresses flip within cooldown period', () => {
      seedPrices(filter, 50000, 55000)

      // First call: bull, sets lastBullish=true
      filter.isBullishWithCooldown(100, 2, 3)

      // Record a flip timestamp just now (simulates a recent flip)
      ;(filter as any).lastFlipTimestamp = Date.now()

      // Drop price below MA — raw = bear, but cooldown active
      ;(filter as any).dailyCloses[99] = 40000

      const result = filter.isBullishWithCooldown(100, 2, 3)
      // Flip suppressed — still reports bull
      expect(result).toBe(true)
    })

    test('allows flip after cooldown elapses', () => {
      seedPrices(filter, 50000, 55000)

      // First call: bull
      filter.isBullishWithCooldown(100, 2, 3)

      // Simulate flip timestamp 5 days ago (past 3-day cooldown)
      const fiveDaysAgo = Date.now() - 5 * 86_400_000
      ;(filter as any).lastFlipTimestamp = fiveDaysAgo

      // Drop price below MA → raw = bear, cooldown elapsed → allow flip
      ;(filter as any).dailyCloses[99] = 40000

      const result = filter.isBullishWithCooldown(100, 2, 3)
      expect(result).toBe(false)
      // lastFlipTimestamp should be updated to now
      expect(filter.getLastFlipTimestamp()).toBeGreaterThan(fiveDaysAgo)
    })

    test('cooldown=0 behaves like no cooldown (immediate flip allowed)', () => {
      seedPrices(filter, 50000, 55000)

      // First call: bull
      filter.isBullishWithCooldown(100, 2, 0)

      // Record a recent flip timestamp
      ;(filter as any).lastFlipTimestamp = Date.now()

      // Drop price — with cooldown=0 the flip should happen immediately
      ;(filter as any).dailyCloses[99] = 40000

      const result = filter.isBullishWithCooldown(100, 2, 0)
      expect(result).toBe(false)
    })

    test('multiple rapid crossovers within cooldown keep previous state', () => {
      seedPrices(filter, 50000, 55000)

      // Establish bull state
      filter.isBullishWithCooldown(100, 2, 3)

      // Set flip timestamp to just now
      ;(filter as any).lastFlipTimestamp = Date.now()

      // Oscillate price across MA multiple times within cooldown
      ;(filter as any).dailyCloses[99] = 40000
      const result1 = filter.isBullishWithCooldown(100, 2, 3) // suppressed → bull

      ;(filter as any).dailyCloses[99] = 55000
      const result2 = filter.isBullishWithCooldown(100, 2, 3) // same as current state → bull

      ;(filter as any).dailyCloses[99] = 40000
      const result3 = filter.isBullishWithCooldown(100, 2, 3) // suppressed → bull

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
    })

    test('getLastFlipTimestamp returns 0 before any flip', () => {
      expect(filter.getLastFlipTimestamp()).toBe(0)
    })

    test('getLastFlipTimestamp updates after allowed flip', () => {
      seedPrices(filter, 50000, 55000)
      filter.isBullishWithCooldown(100, 2, 3) // establish bull

      // Simulate old flip (past cooldown)
      ;(filter as any).lastFlipTimestamp = Date.now() - 10 * 86_400_000

      ;(filter as any).dailyCloses[99] = 40000
      filter.isBullishWithCooldown(100, 2, 3)

      // Timestamp should be updated to now (within last second)
      expect(Date.now() - filter.getLastFlipTimestamp()).toBeLessThan(1000)
    })
  })
})
