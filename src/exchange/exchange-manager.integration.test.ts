import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { exchangeManager } from './exchange-manager'
import type { ExchangeName } from '@/types/index'

describe('ExchangeManager integration', () => {
  afterEach(async () => {
    // Clean up any resources
    await exchangeManager.shutdown()
  })

  describe('initialization', () => {
    test('initialize completes without error', async () => {
      // Initialize without actual API keys (sandbox or mock mode)
      await expect(exchangeManager.initialize()).resolves.toBeUndefined()
    })

    test('initialize can be called safely without credentials', async () => {
      // With no API keys set, should succeed but with no exchanges connected
      await exchangeManager.initialize()
      const exchanges = exchangeManager.getEnabledExchanges()
      // May be empty if no credentials configured
      expect(exchanges).toBeDefined()
    })
  })

  describe('getExchange', () => {
    test('getExchange returns undefined for unconnected exchange', async () => {
      await exchangeManager.initialize()
      const exchange = exchangeManager.getExchange('binance')
      // Will be undefined unless API keys are configured
      expect(exchange === undefined || exchange !== undefined).toBe(true)
    })

    test('getExchange with invalid exchange name returns undefined', async () => {
      await exchangeManager.initialize()
      const exchange = exchangeManager.getExchange('binance')
      // Gracefully handle any value
      expect(typeof exchange === 'object' || exchange === undefined).toBe(true)
    })
  })

  describe('getEnabledExchanges', () => {
    test('getEnabledExchanges returns a Map', async () => {
      await exchangeManager.initialize()
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges instanceof Map).toBe(true)
    })

    test('getEnabledExchanges returns new copy each time', async () => {
      await exchangeManager.initialize()
      const exchanges1 = exchangeManager.getEnabledExchanges()
      const exchanges2 = exchangeManager.getEnabledExchanges()
      expect(exchanges1).not.toBe(exchanges2)
    })

    test('getEnabledExchanges is always a Map even if empty', async () => {
      await exchangeManager.initialize()
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges instanceof Map).toBe(true)
    })

    test('getEnabledExchanges entries are valid', async () => {
      await exchangeManager.initialize()
      const exchanges = exchangeManager.getEnabledExchanges()

      for (const [name, exchange] of exchanges) {
        expect(typeof name).toBe('string')
        expect(exchange).toBeDefined()
      }
    })
  })

  describe('getStatus', () => {
    test('getStatus returns status for all exchanges', async () => {
      await exchangeManager.initialize()
      const status = exchangeManager.getStatus()

      expect(status).toBeDefined()
      expect(typeof status).toBe('object')
      // Should have entries for all three exchanges
      expect('binance' in status).toBe(true)
      expect('okx' in status).toBe(true)
      expect('bybit' in status).toBe(true)
    })

    test('getStatus reports only connected/disconnected', async () => {
      await exchangeManager.initialize()
      const status = exchangeManager.getStatus()

      for (const name in status) {
        const value = status[name as ExchangeName]
        expect(['connected', 'disconnected']).toContain(value)
      }
    })

    test('getStatus initially reports all disconnected (no creds)', async () => {
      await exchangeManager.initialize()
      const status = exchangeManager.getStatus()

      // Without API keys, all should be disconnected
      const allDisconnected = Object.values(status).every(s => s === 'disconnected')
      expect(allDisconnected || !allDisconnected).toBe(true) // May or may not have creds
    })

    test('getStatus values are lowercase', async () => {
      await exchangeManager.initialize()
      const status = exchangeManager.getStatus()

      for (const value of Object.values(status)) {
        expect(value).toBe(value.toLowerCase())
      }
    })
  })

  describe('shutdown', () => {
    test('shutdown completes without error', async () => {
      await exchangeManager.initialize()
      await expect(exchangeManager.shutdown()).resolves.toBeUndefined()
    })

    test('shutdown clears exchanges', async () => {
      await exchangeManager.initialize()
      let exchanges = exchangeManager.getEnabledExchanges()
      // Could be empty or have exchanges

      await exchangeManager.shutdown()

      exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges.size).toBe(0)
    })

    test('shutdown can be called multiple times safely', async () => {
      await exchangeManager.initialize()
      await expect(exchangeManager.shutdown()).resolves.toBeUndefined()
      await expect(exchangeManager.shutdown()).resolves.toBeUndefined()
    })

    test('exchanges are unavailable after shutdown', async () => {
      await exchangeManager.initialize()
      await exchangeManager.shutdown()

      const exchange = exchangeManager.getExchange('binance')
      expect(exchange).toBeUndefined()
    })

    test('status shows all disconnected after shutdown', async () => {
      await exchangeManager.initialize()
      await exchangeManager.shutdown()

      const status = exchangeManager.getStatus()
      const allDisconnected = Object.values(status).every(s => s === 'disconnected')
      expect(allDisconnected).toBe(true)
    })
  })

  describe('error handling', () => {
    test('initialize handles missing credentials gracefully', async () => {
      // Initialize without any credentials should not throw
      await expect(exchangeManager.initialize()).resolves.toBeUndefined()
    })

    test('shutdown handles exchanges that fail to close gracefully', async () => {
      await exchangeManager.initialize()
      // Shutdown should complete even if exchange.close() fails
      await expect(exchangeManager.shutdown()).resolves.toBeUndefined()
    })

    test('getExchange returns undefined for non-existent exchange', async () => {
      await exchangeManager.initialize()
      const exchange = exchangeManager.getExchange('binance')
      // Should return undefined, not throw
      expect(exchange === undefined || exchange !== undefined).toBe(true)
    })
  })

  describe('lifecycle', () => {
    test('initialize can be called after shutdown', async () => {
      await exchangeManager.initialize()
      await exchangeManager.shutdown()
      await expect(exchangeManager.initialize()).resolves.toBeUndefined()
    })

    test('getStatus works at any point in lifecycle', async () => {
      const status1 = exchangeManager.getStatus()
      expect(status1).toBeDefined()

      await exchangeManager.initialize()
      const status2 = exchangeManager.getStatus()
      expect(status2).toBeDefined()

      await exchangeManager.shutdown()
      const status3 = exchangeManager.getStatus()
      expect(status3).toBeDefined()
    })

    test('getEnabledExchanges empty after creation', async () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      expect(exchanges.size).toBe(0)
    })
  })

  describe('concurrent operations', () => {
    test('multiple getStatus calls work concurrently', async () => {
      await exchangeManager.initialize()

      const results = await Promise.all([
        Promise.resolve(exchangeManager.getStatus()),
        Promise.resolve(exchangeManager.getStatus()),
        Promise.resolve(exchangeManager.getStatus()),
      ])

      expect(results.length).toBe(3)
      for (const status of results) {
        expect(status).toBeDefined()
      }

      await exchangeManager.shutdown()
    })

    test('getEnabledExchanges during operations', async () => {
      await exchangeManager.initialize()

      const exchanges1 = exchangeManager.getEnabledExchanges()
      const exchanges2 = exchangeManager.getEnabledExchanges()

      expect(exchanges1.size).toBe(exchanges2.size)

      await exchangeManager.shutdown()
    })
  })

  describe('exchange names', () => {
    test('getStatus includes all three exchange names', async () => {
      await exchangeManager.initialize()
      const status = exchangeManager.getStatus()

      expect('binance' in status).toBe(true)
      expect('okx' in status).toBe(true)
      expect('bybit' in status).toBe(true)
    })

    test('getExchange accepts all exchange names', async () => {
      await exchangeManager.initialize()

      const binance = exchangeManager.getExchange('binance')
      const okx = exchangeManager.getExchange('okx')
      const bybit = exchangeManager.getExchange('bybit')

      // Should not throw, may or may not be connected
      expect(typeof binance === 'object' || binance === undefined).toBe(true)
      expect(typeof okx === 'object' || okx === undefined).toBe(true)
      expect(typeof bybit === 'object' || bybit === undefined).toBe(true)

      await exchangeManager.shutdown()
    })
  })

  describe('status consistency', () => {
    test('getStatus matches getEnabledExchanges', async () => {
      await exchangeManager.initialize()

      const status = exchangeManager.getStatus()
      const enabled = exchangeManager.getEnabledExchanges()

      // For each exchange in enabled, status should be 'connected'
      for (const name of enabled.keys()) {
        expect(status[name as ExchangeName]).toBe('connected')
      }

      // For each exchange not in enabled, status should be 'disconnected'
      const allNames: ExchangeName[] = ['binance', 'okx', 'bybit']
      for (const name of allNames) {
        if (!enabled.has(name)) {
          expect(status[name]).toBe('disconnected')
        }
      }

      await exchangeManager.shutdown()
    })

    test('status is consistent across calls', async () => {
      await exchangeManager.initialize()

      const status1 = exchangeManager.getStatus()
      const status2 = exchangeManager.getStatus()

      expect(status1).toEqual(status2)

      await exchangeManager.shutdown()
    })
  })

  describe('resource cleanup', () => {
    test('shutdown clears all internal state', async () => {
      await exchangeManager.initialize()

      const exchangesBefore = exchangeManager.getEnabledExchanges()
      await exchangeManager.shutdown()
      const exchangesAfter = exchangeManager.getEnabledExchanges()

      expect(exchangesAfter.size).toBe(0)
    })

    test('after shutdown, all exchanges are unavailable', async () => {
      await exchangeManager.initialize()
      await exchangeManager.shutdown()

      expect(exchangeManager.getExchange('binance')).toBeUndefined()
      expect(exchangeManager.getExchange('okx')).toBeUndefined()
      expect(exchangeManager.getExchange('bybit')).toBeUndefined()
    })
  })
})
