import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { TradeModel } from '@db/database'
import { paperTradingEngine } from './paper-trading-engine'
import { priceCache } from '@price/price-cache'
import type { TradeOrder } from '@/types/index'

beforeAll(async () => {
  await setupTestDB()

  // Seed price cache with test prices
  priceCache.set('BTC/USDT', { pair: 'BTC/USDT', price: 50000, timestamp: Date.now() })
  priceCache.set('ETH/USDT', { pair: 'ETH/USDT', price: 3000, timestamp: Date.now() })
  priceCache.set('SOL/USDT', { pair: 'SOL/USDT', price: 180, timestamp: Date.now() })
})

afterAll(async () => {
  await teardownTestDB()
})

describe('PaperTradingEngine integration', () => {
  test('execute creates trade record in database', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await paperTradingEngine.execute(order)

    expect(result).toBeDefined()
    expect(result.exchange).toBe('binance')
    expect(result.pair).toBe('BTC/USDT')
    expect(result.side).toBe('buy')
    expect(result.amount).toBe(0.1)
    expect(result.isPaper).toBe(true)
    expect(result.fee).toBeGreaterThan(0)
    expect(result.feeCurrency).toBe('USDT')
  })

  test('execute applies slippage to fill price', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result = await paperTradingEngine.execute(order)

    // For a buy, slippage should push price up (0.01% to 0.1% above market)
    expect(result.price).toBeGreaterThan(3000)
    expect(result.price).toBeLessThan(3000 * 1.001) // 0.1% max slippage
  })

  test('execute calculates fee correctly', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'SOL/USDT',
      side: 'buy',
      type: 'market',
      amount: 100,
    }

    const result = await paperTradingEngine.execute(order)

    // Fee should be 0.1% of cost
    const expectedFee = result.costUsd * 0.001
    expect(Math.abs(result.fee - expectedFee)).toBeLessThan(1) // Allow small rounding
  })

  test('execute sell applies inverse slippage', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      amount: 0.05,
    }

    const result = await paperTradingEngine.execute(order)

    // For a sell, slippage should push price down (0.01% to 0.1% below market)
    expect(result.price).toBeLessThan(50000)
    expect(result.price).toBeGreaterThan(50000 * 0.999) // 0.1% max slippage
  })

  test('execute generates unique order IDs', async () => {
    const order1: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.01,
    }

    const order2: TradeOrder = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result1 = await paperTradingEngine.execute(order1)
    const result2 = await paperTradingEngine.execute(order2)

    expect(result1.orderId).not.toBe(result2.orderId)
  })

  test('execute persists trade to database', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'SOL/USDT',
      side: 'buy',
      type: 'market',
      amount: 50,
    }

    const result = await paperTradingEngine.execute(order)

    // Query the database to verify the trade was saved
    const saved = await TradeModel.findOne({ orderId: result.orderId }).lean()

    expect(saved).toBeDefined()
    expect(saved!.exchange).toBe('binance')
    expect(saved!.pair).toBe('SOL/USDT')
    expect(saved!.side).toBe('buy')
    expect(saved!.amount).toBe(50)
    expect(saved!.isPaper).toBe(true)
    expect(saved!.fee).toBeGreaterThan(0)
  })

  test('executeBatch executes multiple trades', async () => {
    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      },
      {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 5,
      },
      {
        exchange: 'binance',
        pair: 'SOL/USDT',
        side: 'sell',
        type: 'market',
        amount: 100,
      },
    ]

    const results = await paperTradingEngine.executeBatch(orders)

    expect(results.length).toBe(3)
    expect(results[0].pair).toBe('BTC/USDT')
    expect(results[1].pair).toBe('ETH/USDT')
    expect(results[2].pair).toBe('SOL/USDT')
  })

  test('executeBatch continues on partial failure', async () => {
    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      },
      // Order with missing price cache (will fail gracefully)
      {
        exchange: 'binance',
        pair: 'UNKNOWN/USDT',
        side: 'buy',
        type: 'market',
        amount: 1,
      },
      {
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'buy',
        type: 'market',
        amount: 1,
      },
    ]

    const results = await paperTradingEngine.executeBatch(orders)

    // Should have 2 results (first and last), middle one failed silently
    expect(results.length).toBe(2)
    expect(results[0].pair).toBe('BTC/USDT')
    expect(results[1].pair).toBe('ETH/USDT')
  })

  test('execute marks trade as isPaper', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.05,
    }

    const result = await paperTradingEngine.execute(order)

    expect(result.isPaper).toBe(true)

    // Verify in database
    const saved = await TradeModel.findOne({ orderId: result.orderId }).lean()
    expect(saved!.isPaper).toBe(true)
  })

  test('execute uses cached price when available', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await paperTradingEngine.execute(order)

    // Fill price should be derived from cached price (50000) with slippage
    const slippagePercent = (result.price - 50000) / 50000
    expect(slippagePercent).toBeGreaterThan(0.0001) // > 0.01%
    expect(slippagePercent).toBeLessThan(0.001) // < 0.1%
  })

  test('execute computes cost correctly', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'buy',
      type: 'market',
      amount: 10,
    }

    const result = await paperTradingEngine.execute(order)

    // costUsd should equal amount * price
    expect(Math.abs(result.costUsd - result.amount * result.price)).toBeLessThan(0.01)
  })

  test('execute persists trade without rebalanceId by default', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'SOL/USDT',
      side: 'buy',
      type: 'market',
      amount: 10,
    }

    const result = await paperTradingEngine.execute(order)

    // Verify in database - rebalanceId should be null by default
    const saved = await TradeModel.findOne({ orderId: result.orderId }).lean()
    expect(saved!.rebalanceId).toBeNull()
  })

  test('execute generates valid UUID for orderId', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.01,
    }

    const result = await paperTradingEngine.execute(order)

    // Order ID should start with "paper-" and contain a UUID
    expect(result.orderId).toMatch(/^paper-[a-f0-9-]{36}$/)
  })

  test('execute sets executedAt timestamp', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.05,
    }

    const beforeTime = new Date()
    const result = await paperTradingEngine.execute(order)
    const afterTime = new Date()

    expect(result.executedAt).toBeInstanceOf(Date)
    expect(result.executedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
    expect(result.executedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime())
  })

  test('execute handles very small amounts', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.001, // Very small BTC amount
    }

    const result = await paperTradingEngine.execute(order)

    expect(result.amount).toBe(0.001)
    expect(result.costUsd).toBeGreaterThan(0)
  })

  test('execute handles large amounts', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'SOL/USDT',
      side: 'buy',
      type: 'market',
      amount: 100000, // Very large SOL amount
    }

    const result = await paperTradingEngine.execute(order)

    expect(result.amount).toBe(100000)
    expect(result.costUsd).toBeGreaterThan(10000000) // Should be massive
  })
})
