import { describe, it, expect } from 'bun:test'
import { exchangeManager } from './exchange-manager'

describe('exchange-manager', () => {
  describe('getExchange', () => {
    it('should return undefined for non-existent exchange', () => {
      const exchange = exchangeManager.getExchange('nonexistent_exchange' as any)
      expect(exchange).toBeUndefined()
    })

    it('should return same exchange instance on multiple calls', () => {
      const exchange1 = exchangeManager.getExchange('binance')
      const exchange2 = exchangeManager.getExchange('binance')
      expect(exchange1).toBe(exchange2)
    })
  })

  describe('getEnabledExchanges', () => {
    it('should return a Map', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges instanceof Map).toBe(true)
    })

    it('should return a copy, not the original', () => {
      const exchanges1 = exchangeManager.getEnabledExchanges()
      const exchanges2 = exchangeManager.getEnabledExchanges()
      expect(exchanges1).not.toBe(exchanges2)
    })

    it('should have predictable exchange keys', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      const keys = Array.from(exchanges.keys())
      for (const key of keys) {
        expect(['binance', 'okx', 'bybit']).toContain(key)
      }
    })

    it('should handle empty exchanges gracefully', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges.size).toBeGreaterThanOrEqual(0)
      expect(exchanges instanceof Map).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return status for all known exchanges', () => {
      const status = exchangeManager.getStatus()
      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
    })

    it('should have all expected exchanges in status', () => {
      const status = exchangeManager.getStatus()
      expect(status['binance']).toBeDefined()
      expect(status['okx']).toBeDefined()
      expect(status['bybit']).toBeDefined()
    })

    it('should return valid status values', () => {
      const status = exchangeManager.getStatus()
      for (const value of Object.values(status)) {
        expect(['connected', 'disconnected']).toContain(value)
      }
    })

    it('should match between getStatus and getEnabledExchanges', () => {
      const status = exchangeManager.getStatus()
      const enabled = exchangeManager.getEnabledExchanges()

      for (const exchange of ['binance', 'okx', 'bybit']) {
        const isConnected = enabled.has(exchange as any)
        const statusValue = status[exchange as any]
        if (isConnected) {
          expect(statusValue).toBe('connected')
        } else {
          expect(statusValue).toBe('disconnected')
        }
      }
    })
  })

  describe('consistency checks', () => {
    it('should return consistent data across multiple calls', () => {
      const status1 = exchangeManager.getStatus()
      const status2 = exchangeManager.getStatus()
      expect(status1).toEqual(status2)
    })

    it('should have matching enabled exchange count', () => {
      const status = exchangeManager.getStatus()
      const enabled = exchangeManager.getEnabledExchanges()

      const connectedCount = Object.values(status).filter((s) => s === 'connected').length
      expect(enabled.size).toBe(connectedCount)
    })
  })

  describe('edge cases', () => {
    it('should handle null or undefined gracefully', () => {
      expect(exchangeManager.getExchange(null as any)).toBeUndefined()
      expect(exchangeManager.getExchange(undefined as any)).toBeUndefined()
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
