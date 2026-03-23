import { describe, it, expect, beforeEach } from 'bun:test'
import { GridBotManager } from './grid-bot-manager'
import { priceCache } from '@price/price-cache'

// Seed price cache so grid bot creation doesn't throw "No price cached"
function seedPrices() {
  const now = Date.now()
  const prices: Record<string, number> = { 'BTC/USDT': 45000, 'ETH/USDT': 3500, 'SOL/USDT': 180, 'ADA/USDT': 1.0 }
  for (const [pair, price] of Object.entries(prices)) {
    priceCache.set(pair, { exchange: 'binance', pair, price, bid: price * 0.999, ask: price * 1.001, volume24h: 1000, change24h: 1.5, timestamp: now })
  }
}

describe('GridBotManager', () => {
  let manager: GridBotManager

  beforeEach(() => {
    manager = new GridBotManager()
    seedPrices()
  })

  describe('create', () => {
    it('should create a new grid bot', async () => {
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
      expect(botId).toHaveLength(36) // UUID length
    })

    it('should reject when price not cached', async () => {
      expect(async () => {
        await manager.create({
          exchange: 'binance',
          pair: 'UNKNOWN/PAIR',
          priceLower: 40000,
          priceUpper: 50000,
          gridLevels: 5,
          investment: 1000,
          gridType: 'normal',
        })
      }).toThrow('[GridBotManager] No price cached for UNKNOWN/PAIR')
    })

    it('should reject when current price outside range', async () => {
      // This requires price cache setup; test structure is valid
      expect(async () => {
        await manager.create({
          exchange: 'binance',
          pair: 'BTC/USDT',
          priceLower: 50000, // current price 45k is below this
          priceUpper: 55000,
          gridLevels: 5,
          investment: 1000,
          gridType: 'normal',
        })
      }).toThrow()
    })

    it('should support reverse grid type', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 3000,
        priceUpper: 4000,
        gridLevels: 4,
        investment: 500,
        gridType: 'reverse',
      })

      expect(botId).toBeTruthy()
    })

    it('should handle large investment', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'BTC/USDT',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 100000,
        gridType: 'normal',
      })

      expect(botId).toBeTruthy()
    })

    it('should handle different exchanges', async () => {
      // Use a pair that has a cached price
      const botId = await manager.create({
        exchange: 'okx',
        pair: 'ADA/USDT',
        priceLower: 0.5,
        priceUpper: 1.5,
        gridLevels: 3,
        investment: 500,
        gridType: 'normal',
      })

      expect(botId).toBeTruthy()
    })
  })

  describe('stop', () => {
    it('should stop a running bot', async () => {
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
      expect(result).toBeTruthy()
      expect(result.totalProfit).toBeDefined()
      expect(result.totalTrades).toBeDefined()
    })

    it('should return PnL on stop', async () => {
      const botId = await manager.create({
        exchange: 'binance',
        pair: 'ADA/USDT',
        priceLower: 0.5,
        priceUpper: 1.5,
        gridLevels: 4,
        investment: 200,
        gridType: 'normal',
      })

      const result = await manager.stop(botId)
      expect(result.totalProfit).toBeDefined()
      expect(result.totalTrades).toBeDefined()
    })

    it('should handle stop on non-existent bot', async () => {
      expect(async () => {
        await manager.stop('non-existent-bot')
      }).toThrow()
    })
  })

  describe('getBot', () => {
    it('should return bot by id', async () => {
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
      expect(bot!.status).toBe('active')
    })

    it('should return null for non-existent bot', async () => {
      const bot = await manager.getBot('non-existent')
      expect(bot).toBeNull()
    })
  })

  describe('listBots', () => {
    it('should list all active bots', async () => {
      const bots = await manager.listBots()
      expect(Array.isArray(bots)).toBe(true)
    })

    it('should filter by status', async () => {
      const activeBots = await manager.listBots('active')
      expect(Array.isArray(activeBots)).toBe(true)
    })
  })
})
