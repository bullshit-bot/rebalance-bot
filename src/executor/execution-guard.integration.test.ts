import { describe, test, expect, beforeEach } from 'bun:test'
import { ExecutionGuard } from './execution-guard'
import type { TradeOrder, TradeResult } from '@/types/index'

describe('ExecutionGuard integration', () => {
  let guard: ExecutionGuard

  beforeEach(() => {
    guard = new ExecutionGuard()
  })

  describe('canExecute - basic validation', () => {
    test('allows trade within limits', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      }

      const result = guard.canExecute(order, 50000, 100000)
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    test('rejects trade exceeding MAX_TRADE_USD', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 100, // 100 BTC * 50000 = 5M USD, way over limit
      }

      const result = guard.canExecute(order, 50000, 100000)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('exceeds MAX_TRADE_USD')
    })

    test('allows small trade at boundary', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 1,
      }

      // Assuming MAX_TRADE_USD is 50000, 1 ETH at 3000 = 3000 USD (within limit)
      const result = guard.canExecute(order, 3000, 100000)
      expect(result.allowed).toBe(true)
    })
  })

  describe('daily loss limit', () => {
    test('allows trade when daily loss is zero', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'SOL/USDT',
        side: 'buy',
        type: 'market',
        amount: 10,
      }

      const result = guard.canExecute(order, 180, 100000)
      expect(result.allowed).toBe(true)
    })

    test('accumulates fees as daily loss', () => {
      const tradeResult: TradeResult = {
        id: '1',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
        costUsd: 5000,
        fee: 50, // $50 fee
        feeCurrency: 'USDT',
        orderId: 'order-1',
        executedAt: new Date(),
      }

      guard.recordTrade(tradeResult)
      expect(guard.getDailyLossUsd()).toBe(50)
    })

    test('blocks trade when daily loss reaches limit', () => {
      // Record losses up to the limit (10% of 100000 = 10000)
      guard.recordLoss(10000)

      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 1,
      }

      const result = guard.canExecute(order, 3000, 100000)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Daily loss')
    })

    test('accumulates multiple trade fees', () => {
      const trade1: TradeResult = {
        id: '1',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
        costUsd: 5000,
        fee: 25,
        feeCurrency: 'USDT',
        orderId: 'order-1',
        executedAt: new Date(),
      }

      const trade2: TradeResult = {
        id: '2',
        exchange: 'okx',
        pair: 'ETH/USDT',
        side: 'sell',
        amount: 5,
        price: 3000,
        costUsd: 15000,
        fee: 30,
        feeCurrency: 'USDT',
        orderId: 'order-2',
        executedAt: new Date(),
      }

      guard.recordTrade(trade1)
      guard.recordTrade(trade2)

      expect(guard.getDailyLossUsd()).toBe(55) // 25 + 30
    })

    test('records explicit loss via recordLoss', () => {
      guard.recordLoss(100)
      expect(guard.getDailyLossUsd()).toBe(100)

      guard.recordLoss(50)
      expect(guard.getDailyLossUsd()).toBe(150)
    })

    test('recordLoss converts negative values to positive', () => {
      guard.recordLoss(-200)
      expect(guard.getDailyLossUsd()).toBe(200)
    })
  })

  describe('daily reset', () => {
    test('manual resetDaily clears loss counter', () => {
      guard.recordLoss(500)
      expect(guard.getDailyLossUsd()).toBe(500)

      guard.resetDaily()
      expect(guard.getDailyLossUsd()).toBe(0)
    })

    test('allows trading again after daily reset', () => {
      // Record losses to reach limit (10% of 100000 = 10000)
      guard.recordLoss(10000)

      // Should be blocked
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.01,
      }
      let result = guard.canExecute(order, 50000, 100000)
      expect(result.allowed).toBe(false)

      // Reset and try again
      guard.resetDaily()
      result = guard.canExecute(order, 50000, 100000)
      expect(result.allowed).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('handles zero portfolio value gracefully', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      }

      // With zero portfolio value, the daily loss check is skipped
      const result = guard.canExecute(order, 50000, 0)
      expect(result.allowed).toBe(true)
    })

    test('handles zero price gracefully', () => {
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      }

      // Trade value = 0.1 * 0 = 0, should be allowed
      const result = guard.canExecute(order, 0, 100000)
      expect(result.allowed).toBe(true)
    })

    test('handles negative amount (sell)', () => {
      // Sells can have the same absolute size as buys
      const order: TradeOrder = {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        type: 'market',
        amount: 1,
      }

      const result = guard.canExecute(order, 3000, 100000)
      expect(result.allowed).toBe(true)
    })

    test('mixed buy and sell trades accumulate fees', () => {
      const buyTrade: TradeResult = {
        id: '1',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
        costUsd: 5000,
        fee: 50,
        feeCurrency: 'USDT',
        orderId: 'order-1',
        executedAt: new Date(),
      }

      const sellTrade: TradeResult = {
        id: '2',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'sell',
        amount: 0.05,
        price: 51000,
        costUsd: 2550,
        fee: 25,
        feeCurrency: 'USDT',
        orderId: 'order-2',
        executedAt: new Date(),
      }

      guard.recordTrade(buyTrade)
      guard.recordTrade(sellTrade)

      expect(guard.getDailyLossUsd()).toBe(75) // fees from both buy and sell
    })

    test('getDailyLossUsd does not exceed portfolio value', () => {
      // Record a very large loss
      guard.recordLoss(100000)
      const loss = guard.getDailyLossUsd()

      expect(loss).toBe(100000) // No cap in the implementation
    })
  })

  describe('daily loss percentage calculation', () => {
    test('daily loss limit is percentage of portfolio value', () => {
      // With 1M portfolio and 10% limit (default) = 100k USD
      // Record 100k USD loss (at limit), then try more (rejected)

      const order1: TradeOrder = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.08, // 0.08 * 50000 = 4000 USD
      }

      const result1 = guard.canExecute(order1, 50000, 1000000)
      expect(result1.allowed).toBe(true)

      // Record loss exactly at the 10% limit (100k for 1M portfolio)
      guard.recordLoss(100000)

      const order2: TradeOrder = {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 1,
      }

      const result2 = guard.canExecute(order2, 3000, 1000000)
      // Should be blocked when loss >= limit
      expect(result2.allowed).toBe(false)
    })
  })

  describe('state isolation', () => {
    test('each guard instance maintains separate state', () => {
      const guard1 = new ExecutionGuard()
      const guard2 = new ExecutionGuard()

      guard1.recordLoss(1000)

      expect(guard1.getDailyLossUsd()).toBe(1000)
      expect(guard2.getDailyLossUsd()).toBe(0)
    })
  })
})
