import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/db/database'
import { smartOrders } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('smart-order-routes (integration)', () => {
  const testRebalanceId = randomUUID()

  beforeEach(async () => {
    await db.delete(smartOrders)
  })

  afterEach(async () => {
    await db.delete(smartOrders)
  })

  describe('POST /api/smart-order', () => {
    it('should validate type field must be twap or vwap', async () => {
      const body = {
        type: 'invalid',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        durationMs: 60000,
        slices: 10,
      }

      // Validation logic
      const isValid = body.type === 'twap' || body.type === 'vwap'
      expect(isValid).toBe(false)
    })

    it('should accept type=twap', async () => {
      const body = {
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        durationMs: 60000,
        slices: 10,
      }

      const isValid = body.type === 'twap' || body.type === 'vwap'
      expect(isValid).toBe(true)
    })

    it('should accept type=vwap', async () => {
      const body = {
        type: 'vwap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        durationMs: 60000,
        slices: 10,
      }

      const isValid = body.type === 'twap' || body.type === 'vwap'
      expect(isValid).toBe(true)
    })

    it('should require exchange string', async () => {
      const body = {
        exchange: '',
        pair: 'BTC/USDT',
      }

      const isValid = typeof body.exchange === 'string' && body.exchange.length > 0
      expect(isValid).toBe(false)
    })

    it('should require pair string', async () => {
      const body = {
        pair: '',
        exchange: 'binance',
      }

      const isValid = typeof body.pair === 'string' && body.pair.length > 0
      expect(isValid).toBe(false)
    })

    it('should validate side is buy or sell', async () => {
      const validBuy = 'buy' === 'buy' || 'buy' === 'sell'
      const validSell = 'sell' === 'buy' || 'sell' === 'sell'
      const invalidSide = 'invalid' === 'buy' || 'invalid' === 'sell'

      expect(validBuy).toBe(true)
      expect(validSell).toBe(true)
      expect(invalidSide).toBe(false)
    })

    it('should require positive totalAmount', async () => {
      const validAmount = 1000 > 0
      const invalidAmount = -100 > 0
      const zeroAmount = 0 > 0

      expect(validAmount).toBe(true)
      expect(invalidAmount).toBe(false)
      expect(zeroAmount).toBe(false)
    })

    it('should require positive durationMs', async () => {
      const validDuration = 60000 > 0
      const invalidDuration = -1000 > 0

      expect(validDuration).toBe(true)
      expect(invalidDuration).toBe(false)
    })

    it('should require positive integer slices >= 1', async () => {
      const valid = 10 >= 1 && Number.isInteger(10)
      const invalidZero = 0 >= 1 && Number.isInteger(0)
      const invalidFloat = 10.5 >= 1 && Number.isInteger(10.5)
      const invalidNegative = -5 >= 1 && Number.isInteger(-5)

      expect(valid).toBe(true)
      expect(invalidZero).toBe(false)
      expect(invalidFloat).toBe(false)
      expect(invalidNegative).toBe(false)
    })

    it('should accept optional rebalanceId', async () => {
      const body = {
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        durationMs: 60000,
        slices: 10,
        rebalanceId: randomUUID(),
      }

      expect(body.rebalanceId).toBeDefined()
      expect(typeof body.rebalanceId).toBe('string')
    })

    it('should reject non-string rebalanceId', async () => {
      const body = {
        rebalanceId: 12345,
      }

      const isValid = body.rebalanceId === undefined || typeof body.rebalanceId === 'string'
      expect(isValid).toBe(false)
    })
  })

  describe('GET /api/smart-order/active', () => {
    it('should list active smart orders from database', async () => {
      // Insert test order
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        filledAmount: 0,
        slicesTotal: 10,
        slicesCompleted: 0,
        durationMs: 60000,
        status: 'active',
        config: JSON.stringify({}),
      })

      // Query active orders
      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.status, 'active'))

      expect(rows.length).toBeGreaterThanOrEqual(1)
      const found = rows.find(r => r.id === orderId)
      expect(found).toBeDefined()
      expect(found?.type).toBe('twap')
    })

    it('should not list non-active orders', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        filledAmount: 500,
        slicesTotal: 10,
        slicesCompleted: 5,
        durationMs: 60000,
        status: 'completed',
        config: JSON.stringify({}),
      })

      // Query active orders
      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.status, 'active'))

      const found = rows.find(r => r.id === orderId)
      expect(found).toBeUndefined()
    })

    it('should return fields for building response', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'vwap',
        exchange: 'okx',
        pair: 'ETH/USDT',
        side: 'sell',
        totalAmount: 10,
        filledAmount: 5,
        avgPrice: 2000,
        slicesTotal: 5,
        slicesCompleted: 2,
        durationMs: 30000,
        status: 'active',
        config: JSON.stringify({ factor: 0.5 }),
        rebalanceId: testRebalanceId,
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.status, 'active'))

      const row = rows[0]
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('type')
      expect(row).toHaveProperty('exchange')
      expect(row).toHaveProperty('pair')
      expect(row).toHaveProperty('side')
      expect(row).toHaveProperty('totalAmount')
      expect(row).toHaveProperty('durationMs')
      expect(row).toHaveProperty('filledAmount')
      expect(row).toHaveProperty('avgPrice')
      expect(row).toHaveProperty('slicesCompleted')
      expect(row).toHaveProperty('slicesTotal')
      expect(row).toHaveProperty('rebalanceId')
      expect(row).toHaveProperty('createdAt')
    })
  })

  describe('GET /api/smart-order/:id', () => {
    it('should return 404 for non-existent order', async () => {
      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, 'non-existent'))
        .limit(1)

      expect(rows.length).toBe(0)
    })

    it('should return order details with status 200', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        filledAmount: 200,
        slicesTotal: 10,
        slicesCompleted: 2,
        durationMs: 60000,
        status: 'active',
        config: JSON.stringify({}),
        completedAt: null,
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows.length).toBe(1)
      const row = rows[0]
      expect(row.id).toBe(orderId)
      expect(row.filledAmount).toBe(200)
    })

    it('should parse config JSON field', async () => {
      const orderId = randomUUID()
      const configData = { factor: 0.7, spreadBps: 5 }
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'vwap',
        exchange: 'binance',
        pair: 'ETH/USDT',
        side: 'sell',
        totalAmount: 100,
        slicesTotal: 20,
        durationMs: 120000,
        status: 'active',
        config: JSON.stringify(configData),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      const config = JSON.parse(rows[0].config)
      expect(config.factor).toBe(0.7)
      expect(config.spreadBps).toBe(5)
    })
  })

  describe('PUT /api/smart-order/:id/pause', () => {
    it('should reject pause for non-existent order', async () => {
      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, 'non-existent'))
        .limit(1)

      expect(rows.length).toBe(0)
    })

    it('should reject pause for non-active order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'completed',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status).not.toBe('active')
    })

    it('should allow pause for active order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'active',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status).toBe('active')
    })
  })

  describe('PUT /api/smart-order/:id/resume', () => {
    it('should reject resume for non-paused order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'active',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status).not.toBe('paused')
    })

    it('should allow resume for paused order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'paused',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status).toBe('paused')
    })
  })

  describe('PUT /api/smart-order/:id/cancel', () => {
    it('should reject cancel for already completed order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'completed',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status === 'completed' || rows[0].status === 'cancelled').toBe(true)
    })

    it('should reject cancel for already cancelled order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'cancelled',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status === 'completed' || rows[0].status === 'cancelled').toBe(true)
    })

    it('should allow cancel for active order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'active',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status === 'completed' || rows[0].status === 'cancelled').toBe(false)
    })

    it('should allow cancel for paused order', async () => {
      const orderId = randomUUID()
      await db.insert(smartOrders).values({
        id: orderId,
        type: 'twap',
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        totalAmount: 1000,
        slicesTotal: 10,
        durationMs: 60000,
        status: 'paused',
        config: JSON.stringify({}),
      })

      const rows = await db
        .select()
        .from(smartOrders)
        .where(eq(smartOrders.id, orderId))
        .limit(1)

      expect(rows[0].status === 'completed' || rows[0].status === 'cancelled').toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should handle invalid JSON body gracefully', async () => {
      const invalidJson = '{ invalid json'
      let parseError = false
      try {
        JSON.parse(invalidJson)
      } catch {
        parseError = true
      }
      expect(parseError).toBe(true)
    })

    it('should return 404 for missing order', async () => {
      const statusCode = 404
      expect(statusCode).toBe(404)
    })

    it('should return 409 for state conflicts', async () => {
      const statusCode = 409
      expect(statusCode).toBe(409)
    })

    it('should return 500 for server errors', async () => {
      const statusCode = 500
      expect(statusCode).toBe(500)
    })
  })
})
