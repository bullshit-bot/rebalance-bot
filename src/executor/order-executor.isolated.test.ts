import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { randomUUID } from 'node:crypto'

// Mock exchangeManager BEFORE importing OrderExecutor
const mockExchange = {
  id: 'binance',
  loadMarkets: async () => ({}),
  watchBalance: async () => ({ free: { BTC: 1, USDT: 50000 }, total: { BTC: 1, USDT: 50000 } }),
  createOrder: async (_p: string, _t: string, _s: string, amt: number, price?: number) => ({
    id: 'ord-' + randomUUID().slice(0, 8),
    status: 'closed',
    filled: amt,
    remaining: 0,
    average: price ?? 50000,
    fee: { cost: amt * (price ?? 50000) * 0.001, currency: 'USDT' },
  }),
  fetchOrder: async () => ({ id: 'ord-1', status: 'closed', filled: 1, remaining: 0 }),
  cancelOrder: async () => ({ id: 'ord-1', status: 'cancelled' }),
  fetchOHLCV: async () => [[Date.now(), 48000, 49000, 47000, 48500, 1000]],
  close: async () => {},
}

mock.module('@exchange/exchange-manager', () => ({
  exchangeManager: {
    getExchange: () => mockExchange,
    getEnabledExchanges: () => new Map([['binance', mockExchange]]),
    initialize: async () => {},
    shutdown: async () => {},
    getStatus: () => ({ binance: 'connected' }),
  },
}))

mock.module('@price/price-cache', () => ({
  priceCache: {
    getBestPrice: (pair: string) => (pair.includes('BTC') ? 50000 : pair.includes('ETH') ? 3500 : 180),
    set: () => {},
    get: () => ({ price: 50000, bid: 49999, ask: 50001, exchange: 'binance', pair: 'BTC/USDT' }),
    getAll: () => [],
  },
}))

mock.module('@executor/execution-guard', () => ({
  executionGuard: {
    canExecute: () => ({ allowed: true, reason: 'OK' }),
    recordTrade: () => {},
    recordLoss: () => {},
  },
}))

mock.module('@db/database', () => {
  const mockDb = {
    insert: (table: unknown) => ({
      values: async () => ({}),
    }),
    update: async () => ({}),
    query: async () => [],
  }
  return { db: mockDb }
})

mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
    off: () => {},
  },
}))

import { OrderExecutor } from '@executor/order-executor'
import type { TradeOrder } from '@/types/index'

describe('OrderExecutor', () => {
  let executor: OrderExecutor

  beforeEach(() => {
    executor = new OrderExecutor()
  })

  it('should execute a successful buy order', async () => {
    const order: TradeOrder = {
      id: 'test-' + randomUUID().slice(0, 8),
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.5,
      price: 50000,
      type: 'limit',
      createdAt: Date.now(),
    }

    const result = await executor.execute(order)
    expect(result).toBeDefined()
    expect(result.pair).toBe('BTC/USDT')
    expect(result.exchange).toBe('binance')
  })

  it('should execute a sell order', async () => {
    const order: TradeOrder = {
      id: 'test-' + randomUUID().slice(0, 8),
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'sell',
      amount: 1,
      price: 3500,
      type: 'limit',
      createdAt: Date.now(),
    }

    const result = await executor.execute(order)
    expect(result).toBeDefined()
    expect(result.side).toBe('sell')
  })

  it('should handle batch execution', async () => {
    const orders: TradeOrder[] = [
      {
        id: 'batch-1',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
        type: 'limit',
        createdAt: Date.now(),
      },
      {
        id: 'batch-2',
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        amount: 1,
        price: 3500,
        type: 'limit',
        createdAt: Date.now(),
      },
    ]

    const results = await executor.executeBatch(orders)
    expect(results.length).toBe(2)
    expect(results[0]).toBeDefined()
    expect(results[1]).toBeDefined()
  })

  it('should handle empty batch', async () => {
    const results = await executor.executeBatch([])
    expect(results).toEqual([])
  })

  afterEach(() => {
    // Cleanup
  })
})
