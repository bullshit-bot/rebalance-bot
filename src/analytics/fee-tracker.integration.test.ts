import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { trades } from '@db/schema'
import { feeTracker } from './fee-tracker'
import { eq } from 'drizzle-orm'

// Unique tag for test cleanup
const TEST_REBALANCE_ID = '__fee_tracker_integration__'
const now = Math.floor(Date.now() / 1000)

beforeAll(async () => {
  // Clean up previous test data
  await db.delete(trades).where(eq(trades.rebalanceId, TEST_REBALANCE_ID))

  // Insert test trades with various fees
  await db.insert(trades).values([
    // Binance trades
    {
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy' as const,
      amount: 1,
      price: 50000,
      costUsd: 50000,
      fee: 100, // $100 fee
      feeCurrency: 'USDT',
      isPaper: 0,
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: now - 86400 * 2, // 2 days ago
    },
    {
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'buy' as const,
      amount: 10,
      price: 3000,
      costUsd: 30000,
      fee: 50, // $50 fee
      feeCurrency: 'USDT',
      isPaper: 0,
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: now - 3600, // 1 hour ago
    },
    // OKX trades
    {
      exchange: 'okx',
      pair: 'SOL/USDT',
      side: 'sell' as const,
      amount: 50,
      price: 180,
      costUsd: 9000,
      fee: 20, // $20 fee
      feeCurrency: 'USDT',
      isPaper: 0,
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: now - 86400 * 7, // 7 days ago
    },
    // Bybit trades
    {
      exchange: 'bybit',
      pair: 'XRP/USDT',
      side: 'buy' as const,
      amount: 1000,
      price: 2.5,
      costUsd: 2500,
      fee: 5, // $5 fee
      feeCurrency: 'USDT',
      isPaper: 0,
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: now - 86400 * 30, // 30 days ago
    },
    // Trade with null fee
    {
      exchange: 'binance',
      pair: 'ADA/USDT',
      side: 'buy' as const,
      amount: 500,
      price: 1.2,
      costUsd: 600,
      fee: null,
      feeCurrency: 'USDT',
      isPaper: 0,
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: now - 86400 * 5, // 5 days ago
    },
  ])
})

afterAll(async () => {
  // Clean up test data
  await db.delete(trades).where(eq(trades.rebalanceId, TEST_REBALANCE_ID))
})

describe('FeeTracker integration', () => {
  test('getFees returns correct total fees', async () => {
    const result = await feeTracker.getFees()
    expect(result).toBeDefined()
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(175) // At least 100 + 50 + 20 + 5 (null fee ignored)
  })

  test('getFees groups fees by exchange', async () => {
    const result = await feeTracker.getFees()
    expect(result.byExchange).toBeDefined()
    expect(result.byExchange['binance']).toBeGreaterThanOrEqual(150) // At least 100 + 50
    expect(result.byExchange['okx']).toBeGreaterThanOrEqual(20)
    expect(result.byExchange['bybit']).toBeGreaterThanOrEqual(5)
  })

  test('getFees groups fees by asset', async () => {
    const result = await feeTracker.getFees()
    expect(result.byAsset).toBeDefined()
    expect(result.byAsset['BTC']).toBeGreaterThanOrEqual(100)
    expect(result.byAsset['ETH']).toBeGreaterThanOrEqual(50)
    expect(result.byAsset['SOL']).toBeGreaterThanOrEqual(20)
    expect(result.byAsset['XRP']).toBeGreaterThanOrEqual(5)
  })

  test('getFees with date range filters correctly', async () => {
    const from = now - 86400 * 10 // 10 days ago
    const to = now
    const result = await feeTracker.getFees(from, to)

    // Should include: BTC (2 days), ETH (1 hour), SOL (7 days), XRP (30 days filtered out), ADA (5 days, no fee)
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(170) // At least 100 + 50 + 20
    expect(result.byAsset['BTC']).toBeGreaterThanOrEqual(100)
    expect(result.byAsset['ETH']).toBeGreaterThanOrEqual(50)
  })

  test('getFees with narrow date range', async () => {
    const from = now - 7200 // 2 hours ago
    const to = now
    const result = await feeTracker.getFees(from, to)

    // ETH trade from 1 hour ago should be included
    expect(result.byAsset['ETH']).toBeGreaterThanOrEqual(50)
  })

  test('getFees with no matching trades returns zero', async () => {
    const from = 100
    const to = 200
    const result = await feeTracker.getFees(from, to)

    expect(result.totalFeesUsd).toBe(0)
    expect(Object.keys(result.byExchange).length).toBe(0)
    expect(Object.keys(result.byAsset).length).toBe(0)
  })

  test('getFees computes rolling period totals (daily)', async () => {
    const result = await feeTracker.getFees()
    // ETH trade is 1 hour ago — should be in daily total
    expect(result.byPeriod.daily).toBeGreaterThan(0)
  })

  test('getFees computes rolling period totals (weekly)', async () => {
    const result = await feeTracker.getFees()
    // SOL trade is 7 days ago — should be in weekly total
    expect(result.byPeriod.weekly).toBeGreaterThan(0)
  })

  test('getFees computes rolling period totals (monthly)', async () => {
    const result = await feeTracker.getFees()
    // All trades within 30 days should be in monthly total
    expect(result.byPeriod.monthly).toBeGreaterThanOrEqual(175)
  })

  test('getFees with only from parameter', async () => {
    const from = now - 86400 * 3 // 3 days ago
    const result = await feeTracker.getFees(from)

    // Should include: BTC (2 days), ETH (1 hour), ADA (5 days filtered), SOL (7 days filtered)
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(150) // At least 100 + 50
  })

  test('getFees with only to parameter', async () => {
    const to = now - 86400 * 10 // 10 days ago
    const result = await feeTracker.getFees(undefined, to)

    // Should include: SOL (7 days), XRP (30 days), ADA (5 days)
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(25) // At least 20 + 5
  })
})
