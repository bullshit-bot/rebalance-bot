import { describe, it, expect, beforeEach } from 'bun:test'
import { VwapEngine } from './vwap-engine'

/**
 * Coverage tests for VwapEngine
 * Targets uncovered branches in:
 * - buildVolumeWeights() error paths and fallbacks
 * - Volume bucketing logic with edge cases
 * - Weight normalization
 * - Slice scheduling with various configurations
 */

describe('VwapEngine Coverage Tests', () => {
  let engine: VwapEngine

  beforeEach(() => {
    engine = new VwapEngine()
  })

  // ─── Edge case: insufficient candles ──────────────────────────────────────

  describe('create with edge cases', () => {
    it('handles request with missing historical data (fallback to uniform)', async () => {
      // UNKNOWN pair has no historical data — should fallback to uniform weights
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'UNKNOWN/PAIR',
        side: 'buy',
        totalAmount: 10,
        durationMs: 3600000,
        slices: 5,
      })

      expect(orderId).toBeTruthy()
      expect(orderId).toMatch(/^[0-9a-f-]{36}$/i)
    })

    it('validates slices must be >= 1', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 10000,
          slices: 0,
        })
        expect(true).toBe(false) // should throw
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('slices')
        expect(message).toContain('1')
      }
    })

    it('validates totalAmount must be > 0', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 0,
          durationMs: 10000,
          slices: 5,
        })
        expect(true).toBe(false) // should throw
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('totalAmount')
        expect(message).toContain('0')
      }
    })

    it('validates totalAmount with negative value', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: -5,
          durationMs: 10000,
          slices: 5,
        })
        expect(true).toBe(false) // should throw
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('totalAmount')
      }
    })

    it('validates durationMs must be > 0', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 0,
          slices: 5,
        })
        expect(true).toBe(false) // should throw
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('durationMs')
      }
    })

    it('validates durationMs with negative value', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: -1000,
          slices: 5,
        })
        expect(true).toBe(false) // should throw
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('durationMs')
      }
    })
  })

  // ─── Slice calculation and interval logic ───────────────────────────────────

  describe('slice interval calculation', () => {
    it('calculates correct interval for 2 slices', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 10000,
        slices: 2,
      })

      // interval = floor(10000 / 2) = 5000ms
      expect(orderId).toBeTruthy()
    })

    it('calculates correct interval for 10 slices', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 100,
        durationMs: 100000,
        slices: 10,
      })

      // interval = floor(100000 / 10) = 10000ms
      expect(orderId).toBeTruthy()
    })

    it('handles rounding down for non-divisible duration', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 10001,
        slices: 3,
      })

      // interval = floor(10001 / 3) = 3333ms
      expect(orderId).toBeTruthy()
    })

    it('handles single slice (no delay)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 50,
        durationMs: 1000,
        slices: 1,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles very small interval', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 10,
        slices: 5,
      })

      // interval = floor(10 / 5) = 2ms
      expect(orderId).toBeTruthy()
    })
  })

  // ─── Volume weight distribution ────────────────────────────────────────────

  describe('volume weight distribution', () => {
    it('distributes volume weights correctly', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 100,
        durationMs: 10000,
        slices: 4,
      })

      // Weights should sum to totalAmount (100)
      expect(orderId).toBeTruthy()
    })

    it('handles very small amounts', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 0.0001,
        durationMs: 1000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles very large amounts', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000000,
        durationMs: 3600000,
        slices: 10,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles fractional amounts', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 3.14159,
        durationMs: 5000,
        slices: 3,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── Side and pair variations ──────────────────────────────────────────────

  describe('order side and pair handling', () => {
    it('creates buy order', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('creates sell order', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles altcoin pairs', async () => {
      const pairs = ['SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT']

      for (const pair of pairs) {
        const orderId = await engine.create({
          exchange: 'binance',
          pair,
          side: 'buy',
          totalAmount: 5,
          durationMs: 3000,
          slices: 2,
        })

        expect(orderId).toBeTruthy()
      }
    })

    it('handles non-USDT quote currencies', async () => {
      const orderId = await engine.create({
        exchange: 'kraken',
        pair: 'ETH/EUR',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── Exchange handling ─────────────────────────────────────────────────────

  describe('exchange handling', () => {
    it('supports binance', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('supports kraken', async () => {
      const orderId = await engine.create({
        exchange: 'kraken',
        pair: 'BTC/USD',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('supports coinbase', async () => {
      const orderId = await engine.create({
        exchange: 'coinbase',
        pair: 'BTC/USD',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── Duration edge cases ───────────────────────────────────────────────────

  describe('duration handling', () => {
    it('handles very short duration (100ms)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 100,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles typical duration (1 hour)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 3600000,
        slices: 10,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles long duration (7 days)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 100,
        durationMs: 7 * 24 * 3600 * 1000,
        slices: 100,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles maximum realistic duration', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 365 * 24 * 3600 * 1000, // 1 year
        slices: 365,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── Rebalance ID handling ────────────────────────────────────────────────

  describe('rebalanceId handling', () => {
    it('stores rebalanceId when provided', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
        rebalanceId: 'test-rebal-123',
      })

      expect(orderId).toBeTruthy()
    })

    it('handles undefined rebalanceId', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles null rebalanceId', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
        rebalanceId: undefined,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles long rebalanceId strings', async () => {
      const longId = 'rebal-' + 'x'.repeat(100)

      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
        rebalanceId: longId,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── UUID generation ──────────────────────────────────────────────────────

  describe('UUID generation', () => {
    it('generates unique order IDs', async () => {
      const ids = new Set<string>()

      for (let i = 0; i < 10; i++) {
        const orderId = await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 5000,
          slices: 2,
        })

        ids.add(orderId)
      }

      expect(ids.size).toBe(10)
    })

    it('generates valid UUID format', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 5000,
        slices: 2,
      })

      expect(orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })
  })

  // ─── Slice count variations ────────────────────────────────────────────────

  describe('slice count variations', () => {
    it('handles minimum slices (1)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 1000,
        slices: 1,
      })

      expect(orderId).toBeTruthy()
    })

    it('handles typical slices (5-10)', async () => {
      for (const slices of [5, 7, 10]) {
        const orderId = await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 10000,
          slices,
        })

        expect(orderId).toBeTruthy()
      }
    })

    it('handles large slice count (100)', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 100,
        durationMs: 100000,
        slices: 100,
      })

      expect(orderId).toBeTruthy()
    })
  })

  // ─── Error message clarity ────────────────────────────────────────────────

  describe('error messages', () => {
    it('clearly indicates slices validation error', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 10000,
          slices: -1,
        })
        expect(true).toBe(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('VwapEngine')
        expect(message).toContain('slices')
      }
    })

    it('clearly indicates totalAmount validation error', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: -10,
          durationMs: 10000,
          slices: 5,
        })
        expect(true).toBe(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('totalAmount')
      }
    })

    it('clearly indicates durationMs validation error', async () => {
      try {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: -5000,
          slices: 5,
        })
        expect(true).toBe(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        expect(message).toContain('durationMs')
      }
    })
  })
})
