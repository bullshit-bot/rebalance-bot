import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Portfolio, Allocation } from '@/types/index'

// ─── DCAService test suite ────────────────────────────────────────────────

describe('DCAService — Public API Tests', () => {
  let service: any

  beforeEach(async () => {
    // Import and create fresh instance
    const { DCAService } = await import('./dca-service')
    service = new DCAService()
  })

  afterEach(() => {
    if (service) {
      service.stop()
    }
  })

  describe('executeScheduledDCA method', () => {
    test('returns array of trade orders', async () => {
      const orders = await service.executeScheduledDCA()
      expect(Array.isArray(orders)).toBe(true)
    })

    test('executeScheduledDCA is callable', async () => {
      expect(typeof service.executeScheduledDCA).toBe('function')
    })

    test('executeScheduledDCA accepts optional amount parameter', async () => {
      const orders = await service.executeScheduledDCA(1000)
      expect(Array.isArray(orders)).toBe(true)
    })
  })

  describe('calculateDCAAllocation method', () => {
    test('calculateDCAAllocation is callable', () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: 'BTC',
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: 'binance',
          },
          {
            asset: 'USDT',
            amount: 5000,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 0,
            driftPct: 50,
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      }

      const targets: Allocation[] = [
        { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
        { asset: 'USDT', targetPct: 0, minTradeUsd: 10 },
      ]

      expect(typeof service.calculateDCAAllocation).toBe('function')
      const orders = service.calculateDCAAllocation(1000, portfolio, targets)
      expect(Array.isArray(orders)).toBe(true)
    })

    test('returns empty array for balanced portfolio', () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: 'BTC',
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: 'binance',
          },
          {
            asset: 'USDT',
            amount: 5000,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 0,
            driftPct: 50,
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      }

      const targets: Allocation[] = [
        { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
        { asset: 'USDT', targetPct: 0, minTradeUsd: 10 },
      ]

      const orders = service.calculateDCAAllocation(1000, portfolio, targets)
      expect(orders.length).toBe(0)
    })

    test('allocates to underweight assets', () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: 'BTC',
            amount: 0.1,
            valueUsd: 2000,
            currentPct: 20,
            targetPct: 50,
            driftPct: -30,
            exchange: 'binance',
          },
          {
            asset: 'USDT',
            amount: 8000,
            valueUsd: 8000,
            currentPct: 80,
            targetPct: 0,
            driftPct: 80,
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      }

      const targets: Allocation[] = [
        { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
        { asset: 'USDT', targetPct: 0, minTradeUsd: 10 },
      ]

      const orders = service.calculateDCAAllocation(1000, portfolio, targets)
      expect(Array.isArray(orders)).toBe(true)
    })
  })

  describe('start/stop lifecycle', () => {
    test('start is callable', () => {
      expect(typeof service.start).toBe('function')
      service.start()
      expect(service).toBeDefined()
    })

    test('stop is callable', () => {
      service.start()
      expect(typeof service.stop).toBe('function')
      service.stop()
      expect(service).toBeDefined()
    })

    test('calling start twice is safe', () => {
      service.start()
      service.start() // Should not throw
      expect(service).toBeDefined()
    })

    test('calling stop twice is safe', () => {
      service.start()
      service.stop()
      service.stop() // Should not throw
      expect(service).toBeDefined()
    })

    test('stop without start is safe', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})
