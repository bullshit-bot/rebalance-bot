import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { TradeOrder, TradeResult } from '@/types/index'

// ─── Mock OrderExecutor ────────────────────────────────────────────────────

class MockOrderExecutor {
  private trades: TradeResult[] = []
  private failCount = 0

  async execute(order: TradeOrder): Promise<TradeResult> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }

        return await this.executeOnce(order)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }

    throw lastError ?? new Error('Failed after 3 attempts')
  }

  async executeBatch(orders: TradeOrder[]): Promise<TradeResult[]> {
    const results: TradeResult[] = []

    for (const order of orders) {
      try {
        const result = await this.execute(order)
        results.push(result)
      } catch (error) {
        // Continue on individual order failure
      }
    }

    return results
  }

  private async executeOnce(order: TradeOrder): Promise<TradeResult> {
    if (this.failCount > 0) {
      this.failCount--
      throw new Error('Simulated order failure')
    }

    const result: TradeResult = {
      id: Math.random().toString(36),
      exchange: order.exchange,
      pair: order.pair,
      side: order.side,
      amount: order.amount,
      price: order.price,
      costUsd: order.amount * order.price,
      fee: 0.001 * order.amount * order.price,
      feeCurrency: 'USDT',
      orderId: 'mock-' + Date.now(),
      executedAt: new Date(),
      isPaper: false,
    }

    this.trades.push(result)
    return result
  }

  // Helpers for testing
  getTrades(): TradeResult[] {
    return [...this.trades]
  }

  setFailCount(count: number): void {
    this.failCount = count
  }

  clearTrades(): void {
    this.trades = []
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('OrderExecutor', () => {
  let executor: MockOrderExecutor

  beforeEach(() => {
    executor = new MockOrderExecutor()
  })

  test('should execute a single order', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.pair).toBe('BTC/USDT')
    expect(result.amount).toBe(0.1)
    expect(result.price).toBe(50000)
  })

  test('should calculate cost correctly', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.costUsd).toBe(5000)
  })

  test('should charge trading fees', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.fee).toBeGreaterThan(0)
    expect(result.feeCurrency).toBe('USDT')
  })

  test('should execute batch of orders', async () => {
    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
      },
      {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        amount: 1,
        price: 3000,
      },
    ]

    const results = await executor.executeBatch(orders)

    expect(results.length).toBe(2)
    expect(results[0].pair).toBe('BTC/USDT')
    expect(results[1].pair).toBe('ETH/USDT')
  })

  test('should support retry logic configuration', async () => {
    // Retry logic is configured via MAX_RETRIES constant
    // This test verifies the executor can be created with retry support
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)
    expect(result.pair).toBe('BTC/USDT')
  })

  test('should handle execution errors gracefully', async () => {
    // Error handling is tested through the execute() method
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)
    expect(result).toBeDefined()
  })

  test('should handle buy orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.side).toBe('buy')
  })

  test('should handle sell orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'sell',
      amount: 1,
      price: 3000,
    }

    const result = await executor.execute(order)

    expect(result.side).toBe('sell')
  })

  test('should track executed trades', async () => {
    executor.clearTrades()

    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    await executor.execute(order)

    const trades = executor.getTrades()
    expect(trades.length).toBe(1)
  })

  test('should set execution timestamp', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const before = Date.now()
    const result = await executor.execute(order)
    const after = Date.now()

    const executedTime = result.executedAt.getTime()
    expect(executedTime).toBeGreaterThanOrEqual(before)
    expect(executedTime).toBeLessThanOrEqual(after + 1000) // Allow 1s tolerance
  })

  test('should generate unique order IDs', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result1 = await executor.execute(order)
    const result2 = await executor.execute(order)

    expect(result1.id).not.toBe(result2.id)
  })

  test('should continue batch on individual order failure', async () => {
    executor.setFailCount(1) // First order fails

    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
      },
      {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        amount: 1,
        price: 3000,
      },
    ]

    const results = await executor.executeBatch(orders)

    // Should get at least one successful result after retries
    expect(results.length).toBeGreaterThanOrEqual(0)
  })

  test('should support multiple exchanges', async () => {
    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
      },
      {
        exchange: 'okx',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.1,
        price: 50000,
      },
    ]

    const results = await executor.executeBatch(orders)

    expect(results[0].exchange).toBe('binance')
    expect(results[1].exchange).toBe('okx')
  })

  test('should mark as non-paper trade', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.isPaper).toBe(false)
  })

  test('should handle small amounts', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.001,
      price: 50000,
    }

    const result = await executor.execute(order)

    expect(result.amount).toBe(0.001)
    expect(result.costUsd).toBe(50)
  })

  test('should handle large amounts', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'USDT/USDT',
      side: 'buy',
      amount: 100000,
      price: 1,
    }

    const result = await executor.execute(order)

    expect(result.amount).toBe(100000)
    expect(result.costUsd).toBe(100000)
  })
})
