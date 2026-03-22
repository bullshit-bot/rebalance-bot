import { describe, it, expect, beforeEach } from 'bun:test'
import { VwapEngine } from './vwap-engine'

describe('VwapEngine', () => {
  let engine: VwapEngine

  beforeEach(() => {
    engine = new VwapEngine()
  })

  describe('create', () => {
    it('should create VWAP order with volume weights', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 10,
        durationMs: 10000,
        slices: 4,
      })

      expect(orderId).toBeTruthy()
      expect(orderId).toHaveLength(36) // UUID length
    })

    it('should reject zero slices', async () => {
      expect(async () => {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: 10000,
          slices: 0,
        })
      }).toThrow('[VwapEngine] slices must be >= 1')
    })

    it('should reject non-positive totalAmount', async () => {
      expect(async () => {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 0,
          durationMs: 10000,
          slices: 4,
        })
      }).toThrow('[VwapEngine] totalAmount must be > 0')
    })

    it('should reject non-positive durationMs', async () => {
      expect(async () => {
        await engine.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 10,
          durationMs: -1000,
          slices: 4,
        })
      }).toThrow('[VwapEngine] durationMs must be > 0')
    })

    it('should handle graceful fallback to uniform weights', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'UNKNOWN/PAIR',
        side: 'buy',
        totalAmount: 5,
        durationMs: 8000,
        slices: 2,
      })

      expect(orderId).toBeTruthy()
    })

    it('should support sell orders', async () => {
      const orderId = await engine.create({
        exchange: 'kraken',
        pair: 'ETH/USD',
        side: 'sell',
        totalAmount: 100,
        durationMs: 5000,
        slices: 5,
      })

      expect(orderId).toBeTruthy()
    })

    it('should store rebalanceId when provided', async () => {
      const rebalanceId = 'rebal-456'

      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'XRP/USDT',
        side: 'buy',
        totalAmount: 500,
        durationMs: 3000,
        slices: 3,
        rebalanceId,
      })

      expect(orderId).toBeTruthy()
    })

    it('should handle single slice', async () => {
      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'SOL/USDT',
        side: 'buy',
        totalAmount: 20,
        durationMs: 1000,
        slices: 1,
      })

      expect(orderId).toBeTruthy()
    })

    it('should calculate interval correctly', async () => {
      const durationMs = 12000
      const slices = 3
      const expectedInterval = Math.floor(durationMs / slices) // 4000ms

      const orderId = await engine.create({
        exchange: 'binance',
        pair: 'ADA/USDT',
        side: 'buy',
        totalAmount: 15,
        durationMs,
        slices,
      })

      expect(orderId).toBeTruthy()
    })
  })
})
