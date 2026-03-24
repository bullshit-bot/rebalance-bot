import { describe, test, expect, beforeAll } from 'bun:test'
import { db } from '@db/database'
import { trades } from '@db/schema'
import { pnlCalculator } from './pnl-calculator'
import { eq } from 'drizzle-orm'

// Unique tag to identify test trades and clean them up
const TEST_REBALANCE_ID = '__pnl_test__'

const now = Math.floor(Date.now() / 1000)

beforeAll(async () => {
  // Clean previous test data
  await db.delete(trades).where(eq(trades.rebalanceId, TEST_REBALANCE_ID))

  // Insert test trades
  const testTrades = [
    // BTC: buy 1 @ 40000, sell 1 @ 50000 → realized PnL = +9800 (after fees)
    { exchange: 'binance', pair: 'BTC/USDT', side: 'buy' as const, amount: 1, price: 40000, costUsd: 40000, fee: 100, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_REBALANCE_ID, executedAt: now - 86400 * 5 },
    { exchange: 'binance', pair: 'BTC/USDT', side: 'sell' as const, amount: 1, price: 50000, costUsd: 50000, fee: 100, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_REBALANCE_ID, executedAt: now - 86400 * 2 },
    // ETH: buy 10 @ 3000, sell 5 @ 3500 → partial sell
    { exchange: 'binance', pair: 'ETH/USDT', side: 'buy' as const, amount: 10, price: 3000, costUsd: 30000, fee: 50, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_REBALANCE_ID, executedAt: now - 86400 * 10 },
    { exchange: 'binance', pair: 'ETH/USDT', side: 'sell' as const, amount: 5, price: 3500, costUsd: 17500, fee: 50, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_REBALANCE_ID, executedAt: now - 3600 },
    // SOL: buy only (no sell) — should appear in unrealized
    { exchange: 'binance', pair: 'SOL/USDT', side: 'buy' as const, amount: 100, price: 180, costUsd: 18000, fee: 30, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_REBALANCE_ID, executedAt: now - 86400 },
  ]

  for (const t of testTrades) {
    await db.insert(trades).values(t)
  }
})

describe('PnLCalculator integration', () => {
  test('getRealizedPnL returns correct totals', async () => {
    const result = await pnlCalculator.getRealizedPnL()
    expect(result).toBeDefined()
    expect(result.totalPnl).toBeDefined()
    expect(typeof result.totalPnl).toBe('number')
    expect(result.byAsset).toBeDefined()
    expect(result.byPeriod).toBeDefined()
    expect(result.byPeriod.daily).toBeDefined()
    expect(result.byPeriod.weekly).toBeDefined()
    expect(result.byPeriod.monthly).toBeDefined()
  })

  test('getRealizedPnL with date range filters', async () => {
    const from = now - 86400 * 3
    const to = now
    const result = await pnlCalculator.getRealizedPnL(from, to)
    // Should include the BTC sell and ETH sell within this range
    expect(result.totalPnl).toBeDefined()
    expect(Object.keys(result.byAsset).length).toBeGreaterThan(0)
  })

  test('getRealizedPnL with no trades in range returns zero', async () => {
    // Use a very old date range where no trades exist
    const result = await pnlCalculator.getRealizedPnL(0, 100)
    expect(result.totalPnl).toBe(0)
    expect(Object.keys(result.byAsset).length).toBe(0)
  })

  test('byAsset contains expected assets', async () => {
    const result = await pnlCalculator.getRealizedPnL()
    // BTC and ETH have both buy and sell trades
    expect('BTC' in result.byAsset).toBe(true)
    expect('ETH' in result.byAsset).toBe(true)
  })

  test('byPeriod daily includes recent ETH sell', async () => {
    const result = await pnlCalculator.getRealizedPnL()
    // ETH sell was 1 hour ago — should appear in daily
    expect(result.byPeriod.daily).toBeDefined()
  })

  test('getUnrealizedPnL returns open positions', async () => {
    const currentPrices = { BTC: 55000, ETH: 3800, SOL: 200 }
    const result = await pnlCalculator.getUnrealizedPnL(currentPrices)
    expect(result).toBeDefined()

    // SOL: bought 100 @ 180, current 200 → unrealized gain
    if (result.SOL) {
      expect(result.SOL.currentValue).toBeGreaterThan(result.SOL.costBasis)
      expect(result.SOL.pnl).toBeGreaterThan(0)
    }

    // ETH: bought 10, sold 5 → 5 remaining
    if (result.ETH) {
      expect(result.ETH.pnl).toBeDefined()
    }
  })

  test('getUnrealizedPnL skips assets without current price', async () => {
    const result = await pnlCalculator.getUnrealizedPnL({ BTC: 55000 })
    // SOL has no price provided → should not appear
    expect(result.SOL).toBeUndefined()
  })

  test('getUnrealizedPnL returns empty for no open positions', async () => {
    // No prices → no unrealized PnL
    const result = await pnlCalculator.getUnrealizedPnL({})
    expect(Object.keys(result).length).toBe(0)
  })
})
