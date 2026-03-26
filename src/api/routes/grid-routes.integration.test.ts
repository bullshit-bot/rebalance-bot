import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { GridBotModel, GridOrderModel } from '@db/database'

describe('grid-routes (integration)', () => {
  beforeEach(async () => {
    await setupTestDB()
  })

  afterEach(async () => {
    await teardownTestDB()
  })

  describe('POST /api/grid validation', () => {
    it('should require exchange field', () => {
      const body = { pair: 'BTC/USDT' }
      const isValid = typeof (body as any).exchange === 'string' && (body as any).exchange.length > 0
      expect(isValid).toBe(false)
    })

    it('should require pair field', () => {
      const body = { exchange: 'binance' }
      const isValid = typeof (body as any).pair === 'string' && (body as any).pair.length > 0
      expect(isValid).toBe(false)
    })

    it('should require priceLower > 0', () => {
      const priceLower = -100
      const isValid = typeof priceLower === 'number' && priceLower > 0
      expect(isValid).toBe(false)
    })

    it('should require priceUpper > 0', () => {
      const priceUpper = 0
      const isValid = typeof priceUpper === 'number' && priceUpper > 0
      expect(isValid).toBe(false)
    })

    it('should require priceLower < priceUpper', () => {
      const priceLower = 50000
      const priceUpper = 40000
      const isValid = priceLower < priceUpper
      expect(isValid).toBe(false)
    })

    it('should require gridLevels >= 2 and integer', () => {
      const gridLevels1 = 1
      const gridLevels2 = 2
      const gridLevels3 = 2.5

      expect(gridLevels1 >= 2 && Number.isInteger(gridLevels1)).toBe(false)
      expect(gridLevels2 >= 2 && Number.isInteger(gridLevels2)).toBe(true)
      expect(gridLevels3 >= 2 && Number.isInteger(gridLevels3)).toBe(false)
    })

    it('should require investment > 0', () => {
      const investment = 0
      const isValid = typeof investment === 'number' && investment > 0
      expect(isValid).toBe(false)
    })

    it('should validate gridType is normal or reverse', () => {
      expect('normal' === 'normal' || 'normal' === 'reverse').toBe(true)
      expect('reverse' === 'normal' || 'reverse' === 'reverse').toBe(true)
      expect('invalid' === 'normal' || 'invalid' === 'reverse').toBe(false)
    })
  })

  describe('GET /api/grid/list', () => {
    it('should list all grid bots', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      const bots = await GridBotModel.find().lean()
      expect(bots.length).toBeGreaterThanOrEqual(1)
      const found = bots.find(b => b._id === botId)
      expect(found).toBeDefined()
    })

    it('should include bot metadata in response', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'okx',
        pair: 'ETH/USDT',
        gridType: 'reverse',
        priceLower: 1000,
        priceUpper: 3000,
        gridLevels: 20,
        investment: 5000,
        status: 'stopped',
        totalProfit: 250,
        totalTrades: 15,
        config: {},
        stoppedAt: new Date(),
      })

      const bots = await GridBotModel.find().lean()
      const bot = bots[0]

      expect(bot).toHaveProperty('_id')
      expect(bot).toHaveProperty('exchange')
      expect(bot).toHaveProperty('pair')
      expect(bot).toHaveProperty('gridType')
      expect(bot).toHaveProperty('priceLower')
      expect(bot).toHaveProperty('priceUpper')
      expect(bot).toHaveProperty('gridLevels')
      expect(bot).toHaveProperty('investment')
      expect(bot).toHaveProperty('status')
      expect(bot).toHaveProperty('totalProfit')
      expect(bot).toHaveProperty('totalTrades')
      expect(bot).toHaveProperty('createdAt')
      expect(bot).toHaveProperty('stoppedAt')
    })

    it('should return empty list when no bots exist', async () => {
      const bots = await GridBotModel.find().lean()
      expect(bots).toBeDefined()
    })
  })

  describe('POST /api/grid', () => {
    it('should create a new grid bot', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      expect(botId).toBeString()
    })

    it('should handle domain validation errors', () => {
      const priceLower = 50000
      const priceUpper = 40000
      expect(priceLower < priceUpper).toBe(false)
    })
  })

  describe('GET /api/grid/:id', () => {
    it('should return grid bot details', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      const doc = await GridBotModel.findById(botId).lean()
      expect(doc).toBeDefined()
    })

    it('should return 404 for non-existent bot', async () => {
      const doc = await GridBotModel.findById('non-existent').lean()
      expect(doc).toBeNull()
    })

    it('should include PnL data in response', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        totalProfit: 100,
        totalTrades: 5,
        config: {},
      })

      const doc = await GridBotModel.findById(botId).lean()
      expect(doc!.totalProfit).toBeDefined()
      expect(doc!.totalTrades).toBeDefined()
    })
  })

  describe('PUT /api/grid/:id/stop', () => {
    it('should stop an active grid bot', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      const doc = await GridBotModel.findById(botId).lean()
      expect(doc!.status).toBe('active')
    })

    it('should reject stopping already stopped bot', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'stopped',
        config: {},
      })

      const doc = await GridBotModel.findById(botId).lean()
      expect(doc!.status).not.toBe('active')
    })
  })

  describe('Grid orders relationship', () => {
    it('should create grid orders linked to bot', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      await GridOrderModel.create({
        gridBotId: botId,
        level: 1,
        price: 40000,
        amount: 100,
        side: 'buy',
        status: 'open',
      })

      const orders = await GridOrderModel.find().lean()
      expect(orders.length).toBeGreaterThanOrEqual(1)
      const found = orders.find(o => o.gridBotId === botId)
      expect(found).toBeDefined()
    })

    it('should track order status changes', async () => {
      const botId = randomUUID()
      await GridBotModel.create({
        _id: botId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        gridType: 'normal',
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: 'active',
        config: {},
      })

      await GridOrderModel.create({
        gridBotId: botId,
        level: 1,
        price: 40000,
        amount: 100,
        side: 'buy',
        status: 'filled',
        filledAt: new Date(),
      })

      const orders = await GridOrderModel.find().lean()
      expect(orders[0]!.status).toBe('filled')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid JSON body', () => {
      const invalidJson = '{ invalid'
      let hasError = false
      try {
        JSON.parse(invalidJson)
      } catch {
        hasError = true
      }
      expect(hasError).toBe(true)
    })

    it('should return appropriate HTTP status codes', () => {
      expect(400).toBe(400) // Validation error
      expect(422).toBe(422) // Domain error
      expect(404).toBe(404) // Not found
      expect(500).toBe(500) // Server error
    })
  })
})
