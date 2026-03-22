import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { PaperTradingEngine } from './paper-trading-engine'
import { priceCache } from '@price/price-cache'
import { eventBus } from '@/events/event-bus'
import type { TradeOrder, PriceData } from '@/types/index'

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine
  let executedTrades: any[] = []

  beforeEach(() => {
    engine = new PaperTradingEngine()

    // Set up default price for BTC/USDT
    const btcPrice: PriceData = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 45000,
      bid: 44999,
      ask: 45001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    }
    priceCache.set('BTC/USDT', btcPrice)

    // Set up default price for ETH/USDT
    const ethPrice: PriceData = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      price: 3000,
      bid: 2999,
      ask: 3001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    }
    priceCache.set('ETH/USDT', ethPrice)

    // Listen for trade:executed events
    executedTrades = []
    eventBus.on('trade:executed', (trade) => {
      executedTrades.push(trade)
    })
  })

  afterEach(() => {
    eventBus.removeAllListeners('trade:executed')
  })

  test('executes a buy order with simulated fill', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await engine.execute(order)

    expect(result.pair).toBe('BTC/USDT')
    expect(result.side).toBe('buy')
    expect(result.amount).toBe(0.1)
    expect(result.isPaper).toBe(true)
    expect(result.price).toBeGreaterThan(45000) // Buy slippage (adverse)
  })

  test('executes a sell order with simulated fill', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      amount: 0.1,
    }

    const result = await engine.execute(order)

    expect(result.pair).toBe('BTC/USDT')
    expect(result.side).toBe('sell')
    expect(result.isPaper).toBe(true)
    expect(result.price).toBeLessThan(45000) // Sell slippage (adverse)
  })

  test('applies slippage to buy orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result = await engine.execute(order)

    // Buy fills slightly above market (1% to 10 bps above)
    expect(result.price).toBeGreaterThan(45000)
    expect(result.price).toBeLessThanOrEqual(45450) // 1% max slippage
  })

  test('applies slippage to sell orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'sell',
      type: 'market',
      amount: 1,
    }

    const result = await engine.execute(order)

    // Sell fills slightly below market (1% to 10 bps below)
    expect(result.price).toBeLessThan(45000)
    expect(result.price).toBeGreaterThanOrEqual(44550) // 1% max slippage
  })

  test('calculates fee at 0.1% of cost', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result = await engine.execute(order)

    const expectedFee = result.costUsd * 0.001 // 0.1%
    expect(result.fee).toBeCloseTo(expectedFee, 2)
  })

  test('marks trade as isPaper true', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.5,
    }

    const result = await engine.execute(order)

    expect(result.isPaper).toBe(true)
  })

  test('emits trade:executed event', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    await engine.execute(order)

    expect(executedTrades.length).toBe(1)
    expect(executedTrades[0].pair).toBe('BTC/USDT')
    expect(executedTrades[0].isPaper).toBe(true)
  })

  test('executeBatch executes multiple orders', async () => {
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
        amount: 1,
      },
    ]

    const results = await engine.executeBatch(orders)

    expect(results.length).toBe(2)
    expect(results[0].pair).toBe('BTC/USDT')
    expect(results[1].pair).toBe('ETH/USDT')
  })

  test('executeBatch continues on individual order failure', async () => {
    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'UNKNOWN/USDT', // Will fail due to no price
        side: 'buy',
        type: 'market',
        amount: 0.1,
      },
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
      },
    ]

    const results = await engine.executeBatch(orders)

    // Should have 1 successful result (the second one)
    expect(results.length).toBe(1)
    expect(results[0].pair).toBe('BTC/USDT')
  })

  test('throws error when price not cached', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'UNKNOWN/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    try {
      await engine.execute(order)
      throw new Error('Should have thrown')
    } catch (error) {
      expect(error instanceof Error).toBe(true)
      expect((error as Error).message).toContain('No cached price')
    }
  })

  test('generates unique orderId for each trade', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result1 = await engine.execute(order)
    const result2 = await engine.execute(order)

    expect(result1.orderId).not.toBe(result2.orderId)
    expect(result1.orderId).toMatch(/^paper-/)
  })

  test('costUsd equals amount * fillPrice', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.5,
    }

    const result = await engine.execute(order)

    expect(result.costUsd).toBeCloseTo(result.amount * result.price, 2)
  })

  test('feeCurrency is always USDT', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await engine.execute(order)

    expect(result.feeCurrency).toBe('USDT')
  })

  test('executedAt is set to current time', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const beforeTime = Date.now()
    const result = await engine.execute(order)
    const afterTime = Date.now()

    expect(result.executedAt.getTime()).toBeGreaterThanOrEqual(beforeTime)
    expect(result.executedAt.getTime()).toBeLessThanOrEqual(afterTime)
  })

  test('handles very small orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.00001,
    }

    const result = await engine.execute(order)

    expect(result.amount).toBe(0.00001)
    expect(result.price).toBeGreaterThan(0)
    expect(result.costUsd).toBeGreaterThan(0)
  })

  test('handles large orders', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 100,
    }

    const result = await engine.execute(order)

    expect(result.amount).toBe(100)
    expect(result.costUsd).toBeGreaterThan(4000000) // 100 BTC at 45k
  })

  test('different orders have different fill prices due to random slippage', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const results = []
    for (let i = 0; i < 10; i++) {
      const result = await engine.execute(order)
      results.push(result.price)
    }

    // Check that not all prices are identical (random slippage)
    const uniquePrices = new Set(results)
    expect(uniquePrices.size).toBeGreaterThan(1)
  })

  test('executeBatch emits event for each successful trade', async () => {
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
        side: 'sell',
        type: 'market',
        amount: 1,
      },
    ]

    executedTrades = [] // Reset
    await engine.executeBatch(orders)

    expect(executedTrades.length).toBe(2)
  })

  test('exchange field is preserved in result', async () => {
    const order: TradeOrder = {
      exchange: 'okx',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
      price: 45000,
    }

    const result = await engine.execute(order)

    expect(result.exchange).toBe('okx')
  })

  test('handles different quote currencies in price cache', async () => {
    const busdPrice: PriceData = {
      exchange: 'binance',
      pair: 'BTC/BUSD',
      price: 45000,
      bid: 44999,
      ask: 45001,
      volume24h: 500,
      change24h: 2.5,
      timestamp: Date.now(),
    }
    priceCache.set('BTC/BUSD', busdPrice)

    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/BUSD',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await engine.execute(order)

    expect(result.pair).toBe('BTC/BUSD')
    expect(result.price).toBeGreaterThan(45000)
  })

  test('result includes all required TradeResult fields', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 0.1,
    }

    const result = await engine.execute(order)

    expect(result.id).toBeDefined()
    expect(result.exchange).toBe('binance')
    expect(result.pair).toBe('BTC/USDT')
    expect(result.side).toBe('buy')
    expect(result.amount).toBe(0.1)
    expect(result.price).toBeGreaterThan(0)
    expect(result.costUsd).toBeGreaterThan(0)
    expect(result.fee).toBeGreaterThan(0)
    expect(result.feeCurrency).toBe('USDT')
    expect(result.orderId).toBeDefined()
    expect(result.executedAt).toBeDefined()
    expect(result.isPaper).toBe(true)
  })

  test('fee is reasonable (between 0.01% and 0.1% of cost)', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result = await engine.execute(order)

    const feeRatio = result.fee / result.costUsd
    expect(feeRatio).toBeGreaterThanOrEqual(0.0001) // Min 0.01%
    expect(feeRatio).toBeLessThanOrEqual(0.001) // Max 0.1%
  })

  test('slippage stays within bounds (0.01% to 0.1%)', async () => {
    const order: TradeOrder = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      type: 'market',
      amount: 1,
    }

    const result = await engine.execute(order)

    const slippageRatio = Math.abs(result.price - 45000) / 45000
    expect(slippageRatio).toBeGreaterThanOrEqual(0.0001) // Min 0.01%
    expect(slippageRatio).toBeLessThanOrEqual(0.001) // Max 0.1%
  })
})
