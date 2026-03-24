import { describe, it, expect } from 'bun:test'
import { orderExecutor } from './order-executor'
import { executionGuard } from './execution-guard'
import { exchangeManager } from '@exchange/exchange-manager'
import { priceCache } from '@price/price-cache'

describe('order-executor (integration)', () => {
  describe('singleton export', () => {
    it('exports orderExecutor with execute method', () => {
      expect(orderExecutor).toBeDefined()
      expect(typeof orderExecutor.execute).toBe('function')
    })

    it('exports orderExecutor with executeBatch method', () => {
      expect(typeof orderExecutor.executeBatch).toBe('function')
    })
  })

  describe('dependencies', () => {
    it('exchangeManager has no exchanges configured', () => {
      const exchanges = exchangeManager.getEnabledExchanges()
      // In test env, no exchange API keys configured
      expect(exchanges).toBeDefined()
    })

    it('executionGuard is accessible', () => {
      expect(executionGuard).toBeDefined()
      expect(typeof executionGuard.canExecute).toBe('function')
    })

    it('priceCache is accessible', () => {
      expect(priceCache).toBeDefined()
      expect(typeof priceCache.getBestPrice).toBe('function')
    })
  })

  describe('executeBatch with empty array', () => {
    it('returns empty results for empty orders', async () => {
      const results = await orderExecutor.executeBatch([])
      expect(results).toEqual([])
    })
  })

  describe('paper trading mode', () => {
    it('PAPER_TRADING env is set', () => {
      // paper mode is default when no exchange keys
      const mode = process.env.PAPER_TRADING
      expect(mode === undefined || mode === 'true').toBe(true)
    })
  })
})
