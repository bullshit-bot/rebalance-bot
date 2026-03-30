import { describe, it, expect, mock } from 'bun:test'

const mockExecutor = {
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

mock.module('@executor/execution-guard', () => ({
  executionGuard: mockGuard,
}))

import { getExecutor, OrderExecutor, executionGuard } from '@executor/index'
import type { IOrderExecutor } from '@executor/index'

describe('Executor Index (isolated)', () => {
  it('should export OrderExecutor class', () => {
    expect(OrderExecutor).toBeDefined()
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
    const executor: IOrderExecutor = getExecutor()
    const result = await executor.execute({
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.5,
      price: 50000,
      type: 'market',
    })
    expect(result).toBeDefined()
  })

  it('always returns orderExecutor (real execution)', () => {
    const executor = getExecutor()
    expect(executor).toBe(mockExecutor)
  })
})
