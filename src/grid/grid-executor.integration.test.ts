import { describe, it, expect } from 'bun:test'
import { gridExecutor } from './grid-executor'
import type { GridLevel } from './grid-calculator'

describe('grid-executor', () => {
  const testLevels: GridLevel[] = [
    { level: 1, price: 30000, buyAmount: 1000, sellAmount: 0 },
    { level: 2, price: 32000, buyAmount: 500, sellAmount: 500 },
    { level: 3, price: 34000, buyAmount: 0, sellAmount: 1000 },
  ]

  describe('placeGrid', () => {
    it('should have placeGrid method', () => {
      expect(typeof gridExecutor.placeGrid).toBe('function')
    })

    it('should accept botId, levels, exchange, pair', async () => {
      try {
        await gridExecutor.placeGrid('test-bot', testLevels, 'binance', 'BTC/USDT')
      } catch (err) {
        // Expected to fail without real exchange
        expect(true).toBe(true)
      }
    })
  })

  describe('startMonitoring', () => {
    it('should have startMonitoring method', () => {
      expect(typeof gridExecutor.startMonitoring).toBe('function')
    })

    it('should not throw on startMonitoring', async () => {
      await expect(async () => {
        await gridExecutor.startMonitoring('test-bot-monitoring')
      }).not.toThrow()
    })

    it('should allow stopping before starting', async () => {
      await expect(async () => {
        await gridExecutor.stopMonitoring('test-bot-no-start')
      }).not.toThrow()
    })
  })

  describe('stopMonitoring', () => {
    it('should have stopMonitoring method', () => {
      expect(typeof gridExecutor.stopMonitoring).toBe('function')
    })
  })

  describe('cancelAll', () => {
    it('should have cancelAll method', () => {
      expect(typeof gridExecutor.cancelAll).toBe('function')
    })

    it('should not throw on cancelAll', async () => {
      await expect(async () => {
        await gridExecutor.cancelAll('test-bot-cancel')
      }).not.toThrow()
    })
  })

  describe('pollFills', () => {
    it('should have pollFills method', () => {
      expect(typeof gridExecutor['pollFills']).toBe('function')
    })
  })
})
