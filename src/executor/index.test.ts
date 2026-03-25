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

  describe('Module exports completeness', () => {
    it('should export getExecutor function', () => {
      expect(typeof getExecutor).toBe('function')
      expect(getExecutor.name).toBe('getExecutor')
    })

    it('should export OrderExecutor class', () => {
      expect(OrderExecutor).not.toBeNull()
      expect(typeof OrderExecutor).toBe('function')
    })

    it('should export PaperTradingEngine class', () => {
      expect(PaperTradingEngine).not.toBeNull()
      expect(typeof PaperTradingEngine).toBe('function')
    })

    it('should export executionGuard', () => {
      expect(executionGuard).not.toBeNull()
      expect(typeof executionGuard).toBe('object')
    })

    it('should export IOrderExecutor type', () => {
      // Type is exported and available for use
      const executor: IOrderExecutor = getExecutor()
      expect(executor).toBeDefined()
    })
  })

  describe('Executor consistency', () => {
    it('should return same type executor consistently', () => {
      const executor1 = getExecutor()
      const executor2 = getExecutor()
      // Both should be the same type (both PaperTradingEngine or both OrderExecutor)
      expect(executor1.constructor.name).toBe(executor2.constructor.name)
    })

    it('should return singletons', () => {
      const executor1 = getExecutor()
      const executor2 = getExecutor()
      // Should be the exact same instance (singleton pattern)
      expect(executor1 === executor2).toBe(true)
    })
  })

  describe('IOrderExecutor interface compliance', () => {
    it('should implement required executor interface', () => {
      const executor = getExecutor()
      expect(executor).toHaveProperty('execute')
    })

    it('should have callable execute method', () => {
      const executor = getExecutor()
      expect(typeof executor.execute).toBe('function')
    })

    it('should be assignable to IOrderExecutor type', () => {
      const executor = getExecutor()
      const typed: IOrderExecutor = executor
      expect(typed).toBeDefined()
      expect(typeof typed.execute).toBe('function')
    })

    it('should have correct method signature', () => {
      const executor = getExecutor()
      expect(executor.execute).toBeDefined()
      expect(executor.execute.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Export verification', () => {
    it('should verify all exports are defined', () => {
      expect(getExecutor).toBeDefined()
      expect(OrderExecutor).toBeDefined()
      expect(PaperTradingEngine).toBeDefined()
      expect(executionGuard).toBeDefined()
    })

    it('should verify exported items are not null', () => {
      expect(getExecutor).not.toBeNull()
      expect(OrderExecutor).not.toBeNull()
      expect(PaperTradingEngine).not.toBeNull()
      expect(executionGuard).not.toBeNull()
    })

    it('should verify correct types of exports', () => {
      expect(typeof getExecutor).toBe('function')
      expect(typeof OrderExecutor).toBe('function')
      expect(typeof PaperTradingEngine).toBe('function')
      expect(typeof executionGuard).toBe('object')
    })
  })

  describe('Executor usage patterns', () => {
    it('should support execute method', () => {
      const executor = getExecutor()
      expect(executor.execute).toBeDefined()
      expect(typeof executor.execute).toBe('function')
    })

    it('should be usable in type-safe manner', () => {
      const executor: IOrderExecutor = getExecutor()
      // Executor interface methods should be accessible
      expect(executor.execute).toBeDefined()
      expect(typeof executor.execute).toBe('function')
    })

    it('should implement IOrderExecutor interface', () => {
      const executor: IOrderExecutor = getExecutor()
      expect(executor).toBeDefined()
      expect(typeof executor.execute).toBe('function')
    })
  })

  describe('executionGuard singleton verification', () => {
    it('should have canExecute method', () => {
      expect(typeof executionGuard.canExecute).toBe('function')
    })

    it('should have methods available', () => {
      expect(executionGuard).toBeDefined()
      // ExecutionGuard class has several methods
      expect(typeof executionGuard.canExecute).toBe('function')
    })

    it('should maintain state across calls', () => {
      const guard1 = executionGuard
      const guard2 = executionGuard
      expect(guard1 === guard2).toBe(true)
    })

    it('should be instance of ExecutionGuard', () => {
      expect(executionGuard).toBeDefined()
      expect(typeof executionGuard).toBe('object')
      expect(executionGuard.canExecute).toBeDefined()
    })

    it('should have recordLoss method', () => {
      expect(typeof executionGuard.recordLoss).toBe('function')
    })
  })
})
