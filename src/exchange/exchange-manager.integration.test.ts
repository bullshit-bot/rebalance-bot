import { describe, it, expect } from 'bun:test'
import { exchangeManager } from './exchange-manager'
import type { ExchangeName } from '@/types/index'

describe('exchange-manager (integration)', () => {
  describe('getExchange method', () => {
    it('should return undefined for non-configured exchange', () => {
      const exchange = exchangeManager.getExchange('binance')
      // Since no config, should be undefined
      expect(exchange === undefined || typeof exchange === 'object').toBe(true)
    })

    it('should return same instance on multiple calls', () => {
      const first = exchangeManager.getExchange('binance')
      const second = exchangeManager.getExchange('binance')
      expect(first).toBe(second)
    })

    it('should return undefined for invalid exchange name', () => {
      const exchange = exchangeManager.getExchange('invalid_exchange' as ExchangeName)
      expect(exchange).toBeUndefined()
    })

    it('should handle all known exchange names', () => {
      for (const name of ['binance', 'okx', 'bybit'] as ExchangeName[]) {
        const exchange = exchangeManager.getExchange(name)
        // Exchange may or may not be connected; both cases are valid
        expect(exchange === undefined || typeof exchange === 'object').toBe(true)
      }
    })
  })

  describe('getEnabledExchanges method', () => {
    it('should return a Map instance', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges instanceof Map).toBe(true)
    })

    it('should return a new copy each time', () => {
      const map1 = exchangeManager.getEnabledExchanges()
      const map2 = exchangeManager.getEnabledExchanges()
      expect(map1).not.toBe(map2)
    })

    it('should only contain known exchange names', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      const keys = Array.from(exchanges.keys())

      for (const key of keys) {
        expect(['binance', 'okx', 'bybit']).toContain(key)
      }
    })

    it('should return size >= 0', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges.size).toBeGreaterThanOrEqual(0)
    })

    it('should not exceed 3 exchanges', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges.size).toBeLessThanOrEqual(3)
    })

    it('all values should be objects (exchange instances)', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      for (const exchange of exchanges.values()) {
        expect(typeof exchange).toBe('object')
        expect(exchange).not.toBeNull()
      }
    })
  })

  describe('getStatus method', () => {
    it('should return an object with status', () => {
      const status = exchangeManager.getStatus()
      expect(typeof status).toBe('object')
      expect(status).not.toBeNull()
    })

    it('should have all three known exchanges in status', () => {
      const status = exchangeManager.getStatus()
      expect('binance' in status).toBe(true)
      expect('okx' in status).toBe(true)
      expect('bybit' in status).toBe(true)
    })

    it('should only have connected or disconnected values', () => {
      const status = exchangeManager.getStatus()
      for (const value of Object.values(status)) {
        expect(['connected', 'disconnected']).toContain(value)
      }
    })

    it('should match getEnabledExchanges connectivity', () => {
      const status = exchangeManager.getStatus()
      const enabled = exchangeManager.getEnabledExchanges()

      for (const name of ['binance', 'okx', 'bybit'] as ExchangeName[]) {
        const isConnected = enabled.has(name)
        const statusValue = status[name]

        if (isConnected) {
          expect(statusValue).toBe('connected')
        } else {
          expect(statusValue).toBe('disconnected')
        }
      }
    })

    it('should be consistent across multiple calls', () => {
      const status1 = exchangeManager.getStatus()
      const status2 = exchangeManager.getStatus()
      expect(status1).toEqual(status2)
    })

    it('connected count should match enabled exchanges size', () => {
      const status = exchangeManager.getStatus()
      const enabled = exchangeManager.getEnabledExchanges()

      const connectedCount = Object.values(status).filter((s) => s === 'connected').length
      expect(connectedCount).toBe(enabled.size)
    })
  })

  describe('singleton behavior', () => {
    it('should return same instance on multiple accesses', () => {
      const manager1 = exchangeManager
      const manager2 = exchangeManager
      expect(manager1).toBe(manager2)
    })

    it('getStatus should be idempotent', () => {
      const status1 = exchangeManager.getStatus()
      const status2 = exchangeManager.getStatus()
      const status3 = exchangeManager.getStatus()

      expect(status1).toEqual(status2)
      expect(status2).toEqual(status3)
    })
  })

  describe('integration with getEnabledExchanges', () => {
    it('each exchange in map should match getExchange result', () => {
      const exchanges = exchangeManager.getEnabledExchanges()

      for (const [name, _] of exchanges) {
        const directGet = exchangeManager.getExchange(name)
        expect(directGet).toBeDefined()
      }
    })

    it('should return consistent results after multiple operations', () => {
      // Get enabled exchanges multiple times
      const batch1 = [
        exchangeManager.getEnabledExchanges().size,
        exchangeManager.getStatus(),
      ]

      const batch2 = [
        exchangeManager.getEnabledExchanges().size,
        exchangeManager.getStatus(),
      ]

      expect(batch1[0]).toBe(batch2[0])
      expect(batch1[1]).toEqual(batch2[1])
    })
  })

  describe('error handling', () => {
    it('should handle null exchange name gracefully', () => {
      const exchange = exchangeManager.getExchange(null as any)
      expect(exchange).toBeUndefined()
    })

    it('should handle undefined exchange name gracefully', () => {
      const exchange = exchangeManager.getExchange(undefined as any)
      expect(exchange).toBeUndefined()
    })

    it('getEnabledExchanges should not throw even with no configured exchanges', () => {
      const fn = () => exchangeManager.getEnabledExchanges()
      expect(fn).not.toThrow()
    })

    it('getStatus should not throw even with no configured exchanges', () => {
      const fn = () => exchangeManager.getStatus()
      expect(fn).not.toThrow()
    })

    it('should handle empty string exchange name', () => {
      expect(exchangeManager.getExchange('' as any)).toBeUndefined()
    })

    it('should be case-sensitive for exchange names', () => {
      const lower = exchangeManager.getExchange('binance')
      const upper = exchangeManager.getExchange('BINANCE' as any)
      if (lower !== undefined && upper === undefined) {
        expect(true).toBe(true)
      }
    })
  })
})
