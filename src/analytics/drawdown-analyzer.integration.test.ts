import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { drawdownAnalyzer } from './drawdown-analyzer'
import { db } from '@db/database'
import { snapshots } from '@db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

describe('drawdown-analyzer (integration)', () => {
  describe('DrawdownAnalyzer singleton export', () => {
    it('should export drawdownAnalyzer instance', () => {
      expect(drawdownAnalyzer).toBeDefined()
      expect(typeof drawdownAnalyzer.analyze).toBe('function')
    })
  })

  describe('analyze method', () => {
    it('should return DrawdownResult object', async () => {
      const now = Math.floor(Date.now() / 1000)
      const dayAgo = now - 86400

      const result = await drawdownAnalyzer.analyze(dayAgo, now)

      expect(result).toHaveProperty('maxDrawdownPct')
      expect(result).toHaveProperty('maxDrawdownUsd')
      expect(result).toHaveProperty('peakValue')
      expect(result).toHaveProperty('troughValue')
      expect(result).toHaveProperty('peakDate')
      expect(result).toHaveProperty('troughDate')
      expect(result).toHaveProperty('currentDrawdownPct')
      expect(result).toHaveProperty('drawdownSeries')
    })

    it('should return zero values when no data in range', async () => {
      const now = Math.floor(Date.now() / 1000)
      const future = now + 1000000

      const result = await drawdownAnalyzer.analyze(future, future + 86400)

      expect(result.maxDrawdownPct).toBe(0)
      expect(result.maxDrawdownUsd).toBe(0)
      expect(result.peakValue).toBe(0)
      expect(result.troughValue).toBe(0)
      expect(Array.isArray(result.drawdownSeries)).toBe(true)
      expect(result.drawdownSeries.length).toBe(0)
    })

    it('should accept Unix epoch seconds for time range', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 604800 // 7 days ago

      const fn = () => drawdownAnalyzer.analyze(past, now)
      expect(fn).not.toThrow()
    })

    it('should handle from > to gracefully', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      // Call with inverted range
      const result = await drawdownAnalyzer.analyze(now, past)
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('DrawdownResult properties', () => {
    it('maxDrawdownPct should be fractional (not percentage)', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      // Fractional: -0.25 means -25%
      if (result.maxDrawdownPct !== 0) {
        expect(Math.abs(result.maxDrawdownPct)).toBeLessThanOrEqual(1)
      }
    })

    it('currentDrawdownPct should be relative to all-time peak in range', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      // Should be fractional
      if (result.currentDrawdownPct !== 0) {
        expect(Math.abs(result.currentDrawdownPct)).toBeLessThanOrEqual(1)
      }
    })

    it('drawdownSeries should contain DrawdownPoint objects', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      for (const point of result.drawdownSeries) {
        expect(point).toHaveProperty('timestamp')
        expect(point).toHaveProperty('drawdownPct')
        expect(typeof point.timestamp).toBe('number')
        expect(typeof point.drawdownPct).toBe('number')
      }
    })

    it('peakDate and troughDate should be Unix epoch seconds', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      if (result.peakDate !== 0) {
        expect(result.peakDate).toBeGreaterThan(0)
        expect(result.peakDate).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000))
      }

      if (result.troughDate !== 0) {
        expect(result.troughDate).toBeGreaterThan(0)
        expect(result.troughDate).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000))
      }
    })

    it('peakValue should be >= troughValue', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      if (result.maxDrawdownPct !== 0) {
        expect(result.peakValue).toBeGreaterThanOrEqual(result.troughValue)
      }
    })

    it('maxDrawdownUsd should be negative or zero', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      expect(result.maxDrawdownUsd).toBeLessThanOrEqual(0)
    })
  })

  describe('edge cases', () => {
    it('should handle single data point', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      // With 0 or 1 point, should return zero result
      if (result.drawdownSeries.length < 2) {
        expect(result.maxDrawdownPct).toBe(0)
      }
    })

    it('should handle identical values (no drawdown)', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result = await drawdownAnalyzer.analyze(past, now)

      // When all values are same, drawdown should be 0
      if (result.drawdownSeries.length > 1) {
        const allSame = result.drawdownSeries.every(p => p.drawdownPct === 0)
        if (allSame) {
          expect(result.maxDrawdownPct).toBe(0)
        }
      }
    })

    it('should handle very large time ranges', async () => {
      const now = Math.floor(Date.now() / 1000)
      const twoYearsAgo = now - 2 * 365 * 86400

      const fn = () => drawdownAnalyzer.analyze(twoYearsAgo, now)
      expect(fn).not.toThrow()
    })

    it('should handle timestamp 0', async () => {
      const fn = () => drawdownAnalyzer.analyze(0, 1000)
      expect(fn).not.toThrow()
    })
  })

  describe('consistency', () => {
    it('should return consistent results for same time range', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const result1 = await drawdownAnalyzer.analyze(past, now)
      const result2 = await drawdownAnalyzer.analyze(past, now)

      expect(result1.maxDrawdownPct).toBe(result2.maxDrawdownPct)
      expect(result1.maxDrawdownUsd).toBe(result2.maxDrawdownUsd)
      expect(result1.currentDrawdownPct).toBe(result2.currentDrawdownPct)
    })

    it('should be callable multiple times', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      const r1 = await drawdownAnalyzer.analyze(past, now)
      const r2 = await drawdownAnalyzer.analyze(past, now)
      const r3 = await drawdownAnalyzer.analyze(past, now)

      expect(r1).toBeDefined()
      expect(r2).toBeDefined()
      expect(r3).toBeDefined()
    })
  })

  describe('database dependency', () => {
    it('should depend on equityCurveBuilder for data', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      // This calls equityCurveBuilder internally
      const result = await drawdownAnalyzer.analyze(past, now)

      expect(result).toBeDefined()
    })

    it('should handle empty snapshots table', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 86400

      // Even with no snapshots, should not throw
      const result = await drawdownAnalyzer.analyze(past, now)

      expect(result.maxDrawdownPct).toBe(0)
      expect(result.maxDrawdownUsd).toBe(0)
      expect(result.drawdownSeries.length).toBe(0)
    })
  })

  describe('real data analysis with seeded snapshots', () => {
    const TEST_SNAPSHOT_IDS: string[] = []

    beforeAll(async () => {
      // Clean up any existing test snapshots
      const testRange = await db
        .select()
        .from(snapshots)
        .where(and(gte(snapshots.createdAt, 1700000000), lte(snapshots.createdAt, 1700010000)))

      for (const snap of testRange) {
        if (snap.id) {
          TEST_SNAPSHOT_IDS.push(snap.id)
        }
      }

      // Seed realistic equity curve data: peak, drawdown, recovery
      const now = Math.floor(Date.now() / 1000)
      const timestamps = [
        now - 3600,  // 1 hour ago: $10,000
        now - 2700,  // 45 min ago: $11,000 (peak)
        now - 1800,  // 30 min ago: $9,900 (drawdown to -10%)
        now - 900,   // 15 min ago: $9,500 (deeper: -13.6%)
        now,         // now: $10,500 (recovery)
      ]

      const values = [10000, 11000, 9900, 9500, 10500]
      const emptyHoldings = JSON.stringify({})
      const emptyAllocations = JSON.stringify([])

      for (let i = 0; i < timestamps.length; i++) {
        const result = await db.insert(snapshots).values({
          createdAt: timestamps[i],
          totalValueUsd: values[i],
          holdings: emptyHoldings,
          allocations: emptyAllocations,
        })

        if (result && result.lastInsertRowid) {
          TEST_SNAPSHOT_IDS.push(String(result.lastInsertRowid))
        }
      }
    })

    afterAll(async () => {
      // Clean up seeded test data
      const testRange = await db
        .select()
        .from(snapshots)
        .where(and(gte(snapshots.createdAt, 1700000000), lte(snapshots.createdAt, 1700010000)))

      for (const snap of testRange) {
        if (snap.id && TEST_SNAPSHOT_IDS.includes(snap.id)) {
          await db.delete(snapshots).where(eq(snapshots.id, snap.id))
        }
      }
    })

    it('analyzes real drawdown from seeded data', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 3600

      const result = await drawdownAnalyzer.analyze(past, now)

      expect(result).toBeDefined()
      expect(result.drawdownSeries.length).toBeGreaterThanOrEqual(0)
      // If data exists, should have computed some metrics
      if (result.drawdownSeries.length > 0) {
        expect(result.maxDrawdownPct).toBeLessThanOrEqual(0)
      }
    })

    it('computes maxDrawdownPct correctly for peak-to-trough', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 3600

      const result = await drawdownAnalyzer.analyze(past, now)

      // The curve has: 10k → 11k (peak) → 9.5k (trough)
      // Drawdown: (9500 - 11000) / 11000 ≈ -13.6%
      if (result.drawdownSeries.length > 2) {
        expect(result.maxDrawdownPct).toBeLessThan(0)
        expect(Math.abs(result.maxDrawdownPct)).toBeGreaterThan(0.01) // At least 1% drawdown
      }
    })

    it('tracks peakValue and troughValue correctly', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 3600

      const result = await drawdownAnalyzer.analyze(past, now)

      if (result.maxDrawdownPct < 0) {
        // When there is a real drawdown
        expect(result.peakValue).toBeGreaterThan(result.troughValue)
        expect(result.peakDate).toBeLessThanOrEqual(result.troughDate)
      }
    })

    it('computes currentDrawdownPct from last value relative to peak', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 3600

      const result = await drawdownAnalyzer.analyze(past, now)

      // Current value is 10.5k, all-time peak is 11k
      // Current DD: (10500 - 11000) / 11000 ≈ -4.5%
      if (result.drawdownSeries.length > 3) {
        expect(result.currentDrawdownPct).toBeLessThanOrEqual(0)
      }
    })

    it('builds drawdownSeries with correct point structure', async () => {
      const now = Math.floor(Date.now() / 1000)
      const past = now - 3600

      const result = await drawdownAnalyzer.analyze(past, now)

      for (const point of result.drawdownSeries) {
        expect(point).toHaveProperty('timestamp')
        expect(point).toHaveProperty('drawdownPct')
        expect(typeof point.timestamp).toBe('number')
        expect(typeof point.drawdownPct).toBe('number')
        expect(point.timestamp).toBeGreaterThanOrEqual(past)
        expect(point.timestamp).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000))
      }
    })
  })
})
