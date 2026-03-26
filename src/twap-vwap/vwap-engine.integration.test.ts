import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { SmartOrderModel } from '@db/database'
import { vwapEngine } from './vwap-engine'
import { executionTracker } from './execution-tracker'
import type { VwapCreateParams } from './vwap-engine'

describe('VwapEngine integration', () => {
  const testOrderIds: string[] = []

  beforeAll(async () => {
    await setupTestDB()
  })

  afterAll(async () => {
    await teardownTestDB()
  })

  test('create validates slices parameter', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 1,
      durationMs: 3600000,
      slices: 0,
    }

    try {
      await vwapEngine.create(params)
      expect(true).toBe(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain('slices must be >= 1')
    }
  })

  test('create validates totalAmount parameter', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 0,
      durationMs: 3600000,
      slices: 5,
    }

    try {
      await vwapEngine.create(params)
      expect(true).toBe(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain('totalAmount must be > 0')
    }
  })

  test('create validates durationMs parameter', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 1,
      durationMs: 0,
      slices: 5,
    }

    try {
      await vwapEngine.create(params)
      expect(true).toBe(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain('durationMs must be > 0')
    }
  })

  test('create persists order to database', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 10,
      durationMs: 3600000,
      slices: 5,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    expect(orderId).toBeDefined()
    expect(typeof orderId).toBe('string')
    expect(orderId.length).toBeGreaterThan(0)

    const doc = await SmartOrderModel.findById(orderId).lean()
    expect(doc).toBeDefined()
    expect(doc!.type).toBe('vwap')
    expect(doc!.exchange).toBe('binance')
    expect(doc!.pair).toBe('BTC/USDT')
    expect(doc!.side).toBe('buy')
    expect(doc!.totalAmount).toBe(10)
    expect(doc!.slicesTotal).toBe(5)
    expect(doc!.status).toBe('active')
  })

  test('create registers order with execution tracker', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'sell',
      totalAmount: 5,
      durationMs: 1800000,
      slices: 3,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const progress = executionTracker.getProgress(orderId)
    expect(progress).toBeDefined()
    expect(progress?.id).toBe(orderId)
    expect(progress?.type).toBe('vwap')
    expect(progress?.totalAmount).toBe(5)
    expect(progress?.slicesTotal).toBe(3)
    expect(progress?.status).toBe('active')
  })

  test('create calculates interval correctly', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'SOL/USDT',
      side: 'buy',
      totalAmount: 100,
      durationMs: 3600000,
      slices: 10,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    const config = typeof doc!.config === 'string' ? JSON.parse(doc!.config) : doc!.config

    expect(config.intervalMs).toBe(360000)
    expect(config.slices).toBe(10)
  })

  test('create assigns rebalanceId when provided', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'ADA/USDT',
      side: 'buy',
      totalAmount: 50,
      durationMs: 1800000,
      slices: 6,
      rebalanceId: 'rebalance-123',
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    expect(doc!.rebalanceId).toBe('rebalance-123')
  })

  test('create handles missing rebalanceId', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'XRP/USDT',
      side: 'sell',
      totalAmount: 1000,
      durationMs: 7200000,
      slices: 12,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    expect(doc!.rebalanceId).toBeNull()
  })

  test('create initializes filledAmount to 0', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'DOGE/USDT',
      side: 'buy',
      totalAmount: 10000,
      durationMs: 3600000,
      slices: 8,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    expect(doc!.filledAmount).toBe(0)
    expect(doc!.slicesCompleted).toBe(0)
  })

  test('create stores config with volume weights', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'LTC/USDT',
      side: 'buy',
      totalAmount: 50,
      durationMs: 1800000,
      slices: 5,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    const config = typeof doc!.config === 'string' ? JSON.parse(doc!.config) : doc!.config

    expect(config.weights).toBeDefined()
    expect(Array.isArray(config.weights)).toBe(true)
    expect(config.weights.length).toBe(5)

    const sum = config.weights.reduce((a: number, b: number) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  test('create generates unique order IDs', async () => {
    const params1: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 10,
      durationMs: 3600000,
      slices: 5,
    }

    const params2: VwapCreateParams = {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'buy',
      totalAmount: 20,
      durationMs: 3600000,
      slices: 5,
    }

    const id1 = await vwapEngine.create(params1)
    const id2 = await vwapEngine.create(params2)

    testOrderIds.push(id1, id2)

    expect(id1).not.toBe(id2)
  })

  test('create handles single slice order', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 100,
      durationMs: 60000,
      slices: 1,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    const config = typeof doc!.config === 'string' ? JSON.parse(doc!.config) : doc!.config

    expect(config.slices).toBe(1)
    expect(config.intervalMs).toBe(60000)
    expect(config.weights.length).toBe(1)
  })

  test('create handles large number of slices', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'sell',
      totalAmount: 50,
      durationMs: 86400000,
      slices: 288,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    const config = typeof doc!.config === 'string' ? JSON.parse(doc!.config) : doc!.config

    expect(config.slices).toBe(288)
    expect(config.intervalMs).toBe(300000)
    expect(config.weights.length).toBe(288)
  })

  test('create returns valid UUID format', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 10,
      durationMs: 3600000,
      slices: 5,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(uuidPattern.test(orderId)).toBe(true)
  })

  test('create persists weights proportional to slices', async () => {
    const params: VwapCreateParams = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 100,
      durationMs: 3600000,
      slices: 10,
    }

    const orderId = await vwapEngine.create(params)
    testOrderIds.push(orderId)

    const doc = await SmartOrderModel.findById(orderId).lean()
    const config = typeof doc!.config === 'string' ? JSON.parse(doc!.config) : doc!.config

    const weightsSum = config.weights.reduce((a: number, b: number) => a + b, 0)
    expect(Math.abs(weightsSum - 1.0) < 0.01).toBe(true)
  })
})
