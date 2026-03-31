import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { GridBotManager } from './grid-bot-manager'
import { priceCache } from '@price/price-cache'
import { GridBotModel, GridOrderModel } from '@db/database'

beforeAll(async () => { await setupTestDB() })
afterAll(async () => { await teardownTestDB() })

// ─── Helpers ────────────────────────────────────────────────────────────────

function seedPrices() {
  const now = Date.now()
  const prices: Record<string, number> = {
    'BTC/USDT': 45000,
    'ETH/USDT': 3500,
    'SOL/USDT': 180,
    'ADA/USDT': 1.0,
  }
  for (const [pair, price] of Object.entries(prices)) {
    priceCache.set(pair, {
      exchange: 'binance',
      pair,
      price,
      bid: price * 0.999,
      ask: price * 1.001,
      volume24h: 1000,
      change24h: 1.5,
      timestamp: now,
    })
  }
}

describe('GridBotManager', () => {
  let manager: GridBotManager

  beforeEach(async () => {
    await setupTestDB()
    manager = new GridBotManager()
    seedPrices()
  })

  afterEach(async () => {
    await teardownTestDB()
  })

  describe('create', () => {
    it('should create a new grid bot with unique UUID', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      expect(botId).toBeTruthy()
      expect(botId.length).toBe(36) // UUID length

      // Verify bot exists in DB
      const bot = await GridBotModel.findById(botId)
      expect(bot).toBeTruthy()
      expect(bot?.exchange).toBe('binance')
      expect(bot?.pair).toBe('BTC/USDT')
    })

    it('should persist bot configuration', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 3000,
        priceUpper: 4000,
        gridLevels: 10,
        investment: 5000,
        gridType: 'reverse',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.gridLevels).toBe(10)
      expect(bot?.investment).toBe(5000)
      expect(bot?.gridType).toBe('reverse')
      expect(bot?.status).toBe('active')
      expect(bot?.totalProfit).toBe(0)
      expect(bot?.totalTrades).toBe(0)
    })

    it('should reject when price not cached', async () => {
      try {
        await manager.create({
          exchange: 'binance',
          pair: 'UNKNOWN/PAIR',
          priceLower: 1,
          priceUpper: 100,
          gridLevels: 5,
          investment: 1000,
          gridType: 'normal',
        })
        expect(false).toBe(true) // Should have thrown
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('No price cached')
      }
    })

    it('should reject when current price outside range', async () => {
      try {
        await manager.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          priceLower: 50000, // Current price is 45000
          priceUpper: 55000,
          gridLevels: 5,
          investment: 1000,
          gridType: 'normal',
        })
        expect(false).toBe(true) // Should have thrown
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('outside grid range')
      }
    })

    it('should support multiple grid types', async () => {
      const normalBotId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const reverseBotId = await manager.create({
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 3000,
        priceUpper: 4000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'reverse',
      })

      const normalBot = await GridBotModel.findById(normalBotId)
      const reverseBot = await GridBotModel.findById(reverseBotId)

      expect(normalBot?.gridType).toBe('normal')
      expect(reverseBot?.gridType).toBe('reverse')
    })

    it('should handle large investments', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 100000,
        gridType: 'normal',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.investment).toBe(100000)
    })

    it('should handle different exchanges', async () => {
      const botId = await manager.create({
        exchange: 'kraken',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.exchange).toBe('kraken')
    })

    it('should store config in bot document', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.config).toBeTruthy()
      expect(bot?.config?.priceLower).toBe(40000)
      expect(bot?.config?.priceUpper).toBe(50000)
      expect(bot?.config?.gridLevels).toBe(5)
    })

    it('should place initial grid orders', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const orders = await GridOrderModel.find({ gridBotId: botId })
      expect(orders.length).toBeGreaterThan(0)
    })
  })

  describe('getBot', () => {
    it('should retrieve existing bot', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const bot = await manager.getBot(botId)
      expect(bot).toBeTruthy()
      expect(bot?._id.toString()).toBe(botId)
    })

    it('should return null for missing bot', async () => {
      const bot = await manager.getBot('nonexistent-bot-id')
      expect(bot).toBeNull()
    })
  })

  describe('listBots', () => {
    it('should list all bots', async () => {
      const bot1Id = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const bot2Id = await manager.create({
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 3000,
        priceUpper: 4000,
        gridLevels: 5,
        investment: 500,
        gridType: 'normal',
      })

      const bots = await manager.listBots()
      expect(bots.length).toBeGreaterThanOrEqual(2)

      const ids = bots.map((b: any) => b._id.toString())
      expect(ids).toContain(bot1Id)
      expect(ids).toContain(bot2Id)
    })

    it('should return empty list when no bots exist', async () => {
      const bots = await manager.listBots()
      expect(Array.isArray(bots)).toBe(true)
    })
  })

  describe('stop', () => {
    it('should stop an active bot', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const result = await manager.stop(botId)

      expect(result).toHaveProperty('totalProfit')
      expect(result).toHaveProperty('totalTrades')

      const bot = await GridBotModel.findById(botId)
      expect(bot?.status).toBe('stopped')
      expect(bot?.stoppedAt).toBeTruthy()
    })

    it('should reject stopping already stopped bot', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      await manager.stop(botId)

      try {
        await manager.stop(botId)
        expect(false).toBe(true) // Should have thrown
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('already stopped')
      }
    })

    it('should reject stopping non-existent bot', async () => {
      try {
        await manager.stop('nonexistent-bot-id')
        expect(false).toBe(true) // Should have thrown
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('not found')
      }
    })

    it('should cancel all open orders when stopping', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const ordersBefore = await GridOrderModel.find({ gridBotId: botId, status: 'open' })
      expect(ordersBefore.length).toBeGreaterThan(0)

      await manager.stop(botId)

      const ordersAfter = await GridOrderModel.find({ gridBotId: botId, status: 'open' })
      expect(ordersAfter.length).toBe(0)
    })

    it('should return PnL information', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const result = await manager.stop(botId)

      expect(typeof result.totalProfit).toBe('number')
      expect(typeof result.totalTrades).toBe('number')
      expect(result.totalProfit).toBeGreaterThanOrEqual(0)
      expect(result.totalTrades).toBeGreaterThanOrEqual(0)
    })
  })

  describe('validation & edge cases', () => {
    it('should validate price range inclusivity', async () => {
      try {
        // Price equal to upper bound should fail
        await manager.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          priceLower: 40000,
          priceUpper: 45000, // Current price is 45000
          gridLevels: 5,
          investment: 1000,
          gridType: 'normal',
        })
        expect(false).toBe(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toContain('outside')
      }
    })

    it('should handle high grid level counts', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 50,
        investment: 10000,
        gridType: 'normal',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.gridLevels).toBe(50)
    })

    it('should handle different pairs', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'SOL/USDT',
        priceLower: 100,
        priceUpper: 200,
        gridLevels: 5,
        investment: 1000,
        gridType: 'normal',
      })

      const bot = await GridBotModel.findById(botId)
      expect(bot?.pair).toBe('SOL/USDT')
    })
  })
})
