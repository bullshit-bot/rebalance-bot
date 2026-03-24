import { describe, it, expect, mock } from 'bun:test'

const mockExecutor = {
  execute: async () => ({ id: 'test', filled: 0.5 }),
  executeBatch: async () => [],
}

const mockPaperEngine = {
  execute: async () => ({ id: 'test', filled: 0.5 }),
  executeBatch: async () => [],
}

const mockGuard = {
  canExecute: () => ({ allowed: true }),
  recordTrade: () => {},
}

mock.module('@executor/order-executor', () => ({
  OrderExecutor: class {},
  orderExecutor: mockExecutor,
}))

mock.module('@executor/paper-trading-engine', () => ({
  PaperTradingEngine: class {},
  paperTradingEngine: mockPaperEngine,
}))

mock.module('@executor/execution-guard', () => ({
  executionGuard: mockGuard,
}))

mock.module('@config/app-config', () => ({
  env: {
    PAPER_TRADING: true,
  },
}))

import { getExecutor, OrderExecutor, PaperTradingEngine, executionGuard } from '@executor/index'
import type { IOrderExecutor } from '@executor/index'

describe('Executor Index', () => {
  it('should export OrderExecutor class', () => {
    expect(OrderExecutor).toBeDefined()
  })

  it('should export PaperTradingEngine class', () => {
    expect(PaperTradingEngine).toBeDefined()
  })

  it('should export executionGuard', () => {
    expect(executionGuard).toBeDefined()
  })

  it('should return executor via getExecutor', () => {
    const executor = getExecutor()
    expect(executor).toBeDefined()
    expect(typeof executor.execute).toBe('function')
  })

  it('should implement IOrderExecutor interface', async () => {
    const executor = getExecutor()
    const result = await executor.execute({
      id: 'test',
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.5,
      price: 50000,
      type: 'limit',
      createdAt: Date.now(),
    })
    expect(result).toBeDefined()
  })
})
