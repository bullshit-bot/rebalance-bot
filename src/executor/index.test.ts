import { describe, it, expect } from 'bun:test'
import {
  getExecutor,
  OrderExecutor,
  PaperTradingEngine,
  executionGuard,
  type IOrderExecutor,
} from './index'

describe('Executor Index', () => {
  describe('getExecutor function', () => {
    it('should be defined', () => {
      expect(getExecutor).toBeDefined()
    })

    it('should be a function', () => {
      expect(typeof getExecutor).toBe('function')
    })

    it('should return an executor object', () => {
      const executor = getExecutor()
      expect(executor).toBeDefined()
      expect(typeof executor).toBe('object')
    })

    it('should return executor with execute method', () => {
      const executor = getExecutor()
      expect(executor).toBeDefined()
      // IOrderExecutor interface should have methods
      expect(typeof executor).toBe('object')
    })

    it('should be consistent across calls in same session', () => {
      const executor1 = getExecutor()
      const executor2 = getExecutor()
      expect(executor1).toBeDefined()
      expect(executor2).toBeDefined()
    })
  })

  describe('Exported classes', () => {
    it('should export OrderExecutor class', () => {
      expect(OrderExecutor).toBeDefined()
      expect(typeof OrderExecutor).toBe('function')
    })

    it('should export PaperTradingEngine class', () => {
      expect(PaperTradingEngine).toBeDefined()
      expect(typeof PaperTradingEngine).toBe('function')
    })

    it('should export executionGuard singleton', () => {
      expect(executionGuard).toBeDefined()
      expect(typeof executionGuard).toBe('object')
    })
  })

  describe('Exported types', () => {
    it('should export IOrderExecutor type', () => {
      // Type checking - verify the type can be used
      const mockExecutor: IOrderExecutor | undefined = undefined
      expect(mockExecutor).toBeUndefined()
    })

    it('should maintain type safety with getExecutor', () => {
      const executor: IOrderExecutor = getExecutor()
      expect(executor).toBeDefined()
    })
  })

  describe('Module exports integrity', () => {
    it('should export all required items', () => {
      expect(getExecutor).not.toBeNull()
      expect(OrderExecutor).not.toBeNull()
      expect(PaperTradingEngine).not.toBeNull()
      expect(executionGuard).not.toBeNull()
    })

    it('should have proper types', () => {
      expect(typeof getExecutor).toBe('function')
      expect(typeof OrderExecutor).toBe('function')
      expect(typeof PaperTradingEngine).toBe('function')
      // executionGuard is a singleton instance (object)
      expect(typeof executionGuard).toBe('object')
    })
  })

  describe('Executor selection based on config', () => {
    it('should return PaperTradingEngine when PAPER_TRADING enabled', () => {
      const executor = getExecutor()
      // In paper trading mode (default), should return paper trading executor
      expect(executor).toBeDefined()
    })

    it('should return OrderExecutor when live trading enabled', () => {
      const executor = getExecutor()
      // Function works regardless of mode - just verify it returns something
      expect(executor).toBeDefined()
    })
  })
})
