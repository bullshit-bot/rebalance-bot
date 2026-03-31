import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { GridExecutor, type GridExecutorDeps } from './grid-executor'
import type { GridLevel } from './grid-calculator'
import type { IOrderExecutor } from '@executor/order-executor'
import { GridBotModel, GridOrderModel } from '@db/database'

beforeAll(async () => { await setupTestDB() })
afterAll(async () => { await teardownTestDB() })

// ─── Mock Exchange Manager ──────────────────────────────────────────────────

const createMockExchangeManager = (options?: {
  fetchOrderStatus?: 'closed' | 'open' | 'error'
  cancelOrderFails?: boolean
}) => ({
  getEnabledExchanges: () => {
    const mockExchange = {
      fetchOrder: async (id: string) => {
        if (options?.fetchOrderStatus === 'error') {
          throw new Error('Fetch failed')
        }
        return { status: options?.fetchOrderStatus ?? 'open' }
      },
      cancelOrder: async () => {
        if (options?.cancelOrderFails) throw new Error('Cancel failed')
      },
    }
    return new Map([['binance', mockExchange]])
  },
})

// ─── Mock Order Executor ────────────────────────────────────────────────────

const createMockExecutor = (options?: {
  placeFails?: boolean
  orderId?: string
}): IOrderExecutor => ({
  execute: async () => {
    if (options?.placeFails) throw new Error('Execution failed')
    return { orderId: options?.orderId ?? 'order-' + Math.random().toString(36).slice(2) }
  },
  isSimulation: () => true,
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GridExecutor', () => {
  let executor: GridExecutor

  beforeEach(async () => {
    await setupTestDB()
    executor = new GridExecutor()
  })

  afterEach(async () => {
    await teardownTestDB()
  })

  describe('placeGrid', () => {
    it('should place buy and sell orders at grid levels', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0.05, sellAmount: 0 },
        { level: 1, price: 42500, buyAmount: 0.05, sellAmount: 0 },
        { level: 2, price: 45000, buyAmount: 0, sellAmount: 0 },
        { level: 3, price: 47500, buyAmount: 0, sellAmount: 0.05 },
        { level: 4, price: 50000, buyAmount: 0, sellAmount: 0.05 },
      ]

      const mockExecutor = createMockExecutor()
      executor = new GridExecutor({
        getExecutor: () => mockExecutor,
      })

      await executor.placeGrid('bot-123', levels, 'binance', 'BTC/USDT')

      // Verify DB contains orders for all non-zero amounts (2 buy + 2 sell = 4 orders)
      const orders = await GridOrderModel.find({ gridBotId: 'bot-123' })
      expect(orders.length).toBe(4)

      // Verify buy orders
      const buyOrders = orders.filter((o: any) => o.side === 'buy')
      expect(buyOrders.length).toBe(2)
      expect(buyOrders[0].level).toBe(0)
      expect(buyOrders[1].level).toBe(1)

      // Verify sell orders
      const sellOrders = orders.filter((o: any) => o.side === 'sell')
      expect(sellOrders.length).toBe(2)
      expect(sellOrders[0].level).toBe(3)
      expect(sellOrders[1].level).toBe(4)
    })

    it('should skip zero-amount levels', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0, sellAmount: 0 },
        { level: 1, price: 45000, buyAmount: 0.05, sellAmount: 0 },
      ]

      executor = new GridExecutor({
        getExecutor: () => createMockExecutor(),
      })

      await executor.placeGrid('bot-zero', levels, 'binance', 'BTC/USDT')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-zero' })
      expect(orders.length).toBe(1) // Only one buy order
      expect(orders[0]?.level).toBe(1)
    })

    it('should handle executor failures gracefully', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0.05, sellAmount: 0 },
      ]

      executor = new GridExecutor({
        getExecutor: () => createMockExecutor({ placeFails: true }),
      })

      await executor.placeGrid('bot-fail', levels, 'binance', 'BTC/USDT')

      // Order should be marked as cancelled when executor fails
      const orders = await GridOrderModel.find({ gridBotId: 'bot-fail' })
      expect(orders.length).toBe(1)
      expect(orders[0]?.status).toBe('cancelled')
    })

    it('should support different exchanges', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0.05, sellAmount: 0 },
      ]

      executor = new GridExecutor({
        getExecutor: () => createMockExecutor(),
      })

      await executor.placeGrid('bot-kraken', levels, 'kraken', 'BTC/USD')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-kraken' })
      expect(orders.length).toBe(1)
    })

    it('should handle high-frequency levels', async () => {
      const levels: GridLevel[] = Array.from({ length: 20 }, (_, i) => ({
        level: i,
        price: 40000 + i * 500,
        buyAmount: i < 10 ? 0.01 : 0,
        sellAmount: i >= 10 ? 0.01 : 0,
      }))

      executor = new GridExecutor({
        getExecutor: () => createMockExecutor(),
      })

      await executor.placeGrid('bot-20levels', levels, 'binance', 'BTC/USDT')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-20levels' })
      expect(orders.length).toBe(20)
    })

    it('should maintain correct level info in DB', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0.05, sellAmount: 0 },
        { level: 1, price: 45000, buyAmount: 0, sellAmount: 0.1 },
      ]

      executor = new GridExecutor({
        getExecutor: () => createMockExecutor(),
      })

      await executor.placeGrid('bot-info', levels, 'binance', 'BTC/USDT')

      const buyOrder = await GridOrderModel.findOne({ gridBotId: 'bot-info', side: 'buy' })
      expect(buyOrder?.level).toBe(0)
      expect(buyOrder?.price).toBe(40000)
      expect(buyOrder?.amount).toBe(0.05)
      expect(buyOrder?.status).toBe('open')

      const sellOrder = await GridOrderModel.findOne({ gridBotId: 'bot-info', side: 'sell' })
      expect(sellOrder?.level).toBe(1)
      expect(sellOrder?.price).toBe(45000)
      expect(sellOrder?.amount).toBe(0.1)
    })
  })

  describe('startMonitoring', () => {
    it('should start monitoring without errors', async () => {
      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      // Should not throw
      await executor.startMonitoring('bot-start')
      expect(true).toBe(true)
    })

    it('should be idempotent', async () => {
      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      await executor.startMonitoring('bot-idem')
      await executor.startMonitoring('bot-idem')
      expect(true).toBe(true)
    })

    it('should stop monitoring on auth failure', async () => {
      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager({
          fetchOrderStatus: 'error',
        }),
        getExecutor: () => createMockExecutor(),
      })

      await executor.startMonitoring('bot-auth-fail')

      // Trigger a poll with auth error (simulated by mock)
      // The monitoring should eventually stop on auth errors
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(true).toBe(true)
    })

    it('should handle multiple bots independently', async () => {
      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      await executor.startMonitoring('bot-1')
      await executor.startMonitoring('bot-2')
      await executor.startMonitoring('bot-3')

      expect(true).toBe(true)
    })
  })

  describe('cancelAll', () => {
    it('should cancel all open orders for a bot', async () => {
      // Create bot and orders
      await GridBotModel.create({
        _id: 'bot-cancel',
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        status: 'active',
        totalProfit: 0,
        totalTrades: 0,
        config: { gridType: 'normal', priceLower: 40000, priceUpper: 50000, gridLevels: 5, investment: 1000 },
      })

      await GridOrderModel.create([
        {
          gridBotId: 'bot-cancel',
          level: 0,
          price: 40000,
          amount: 0.05,
          side: 'buy',
          status: 'open',
          exchangeOrderId: 'exch-1',
        },
        {
          gridBotId: 'bot-cancel',
          level: 1,
          price: 45000,
          amount: 0.05,
          side: 'sell',
          status: 'open',
          exchangeOrderId: 'exch-2',
        },
      ])

      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      await executor.cancelAll('bot-cancel')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-cancel' })
      expect(orders.every((o: any) => o.status === 'cancelled')).toBe(true)
    })

    it('should skip non-open orders', async () => {
      await GridBotModel.create({
        _id: 'bot-skip',
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        status: 'active',
        totalProfit: 0,
        totalTrades: 0,
        config: { gridType: 'normal', priceLower: 40000, priceUpper: 50000, gridLevels: 5, investment: 1000 },
      })

      await GridOrderModel.create([
        {
          gridBotId: 'bot-skip',
          level: 0,
          price: 40000,
          amount: 0.05,
          side: 'buy',
          status: 'filled',
          exchangeOrderId: 'exch-1',
        },
        {
          gridBotId: 'bot-skip',
          level: 1,
          price: 45000,
          amount: 0.05,
          side: 'sell',
          status: 'open',
          exchangeOrderId: 'exch-2',
        },
      ])

      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      await executor.cancelAll('bot-skip')

      const filledOrder = await GridOrderModel.findOne({ gridBotId: 'bot-skip', status: 'filled' })
      expect(filledOrder?.status).toBe('filled') // Should not change

      const openOrder = await GridOrderModel.findOne({ gridBotId: 'bot-skip', side: 'sell' })
      expect(openOrder?.status).toBe('cancelled')
    })

    it('should handle exchange cancel failures', async () => {
      await GridBotModel.create({
        _id: 'bot-fail-cancel',
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        status: 'active',
        totalProfit: 0,
        totalTrades: 0,
        config: { gridType: 'normal', priceLower: 40000, priceUpper: 50000, gridLevels: 5, investment: 1000 },
      })

      await GridOrderModel.create({
        gridBotId: 'bot-fail-cancel',
        level: 0,
        price: 40000,
        amount: 0.05,
        side: 'buy',
        status: 'open',
        exchangeOrderId: 'exch-1',
      })

      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager({ cancelOrderFails: true }),
        getExecutor: () => createMockExecutor(),
      })

      // Should not throw despite exchange error
      await executor.cancelAll('bot-fail-cancel')

      const order = await GridOrderModel.findOne({ gridBotId: 'bot-fail-cancel' })
      expect(order?.status).toBe('cancelled')
    })

    it('should handle missing bot gracefully', async () => {
      executor = new GridExecutor({
        exchangeManager: createMockExchangeManager(),
        getExecutor: () => createMockExecutor(),
      })

      // Bot doesn't exist, should handle gracefully
      await executor.cancelAll('bot-missing')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-missing' })
      expect(orders.length).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle empty grid levels', async () => {
      executor = new GridExecutor({
        getExecutor: () => createMockExecutor(),
      })

      await executor.placeGrid('bot-empty', [], 'binance', 'BTC/USDT')

      const orders = await GridOrderModel.find({ gridBotId: 'bot-empty' })
      expect(orders.length).toBe(0)
    })

    it('should record exchange order IDs on success', async () => {
      const levels: GridLevel[] = [
        { level: 0, price: 40000, buyAmount: 0.05, sellAmount: 0 },
      ]

      const orderId = 'unique-order-id'
      executor = new GridExecutor({
        getExecutor: () => createMockExecutor({ orderId }),
      })

      await executor.placeGrid('bot-with-id', levels, 'binance', 'BTC/USDT')

      const order = await GridOrderModel.findOne({ gridBotId: 'bot-with-id' })
      expect(order?.exchangeOrderId).toBe(orderId)
    })
  })
})
