import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { allocations } from '@db/schema'
import { portfolioTracker } from './portfolio-tracker'
import { eq } from 'drizzle-orm'

const TEST_ALLOCATION_ASSETS = ['BTC', 'ETH', 'USDT']

beforeAll(async () => {
  // Clean up previous test allocations
  for (const asset of TEST_ALLOCATION_ASSETS) {
    await db.delete(allocations).where(eq(allocations.asset, asset))
  }

  // Seed allocations table with test data
  await db.insert(allocations).values([
    {
      asset: 'BTC',
      targetPct: 50,
      exchange: 'binance',
      minTradeUsd: 100,
    },
    {
      asset: 'ETH',
      targetPct: 30,
      exchange: 'binance',
      minTradeUsd: 50,
    },
    {
      asset: 'USDT',
      targetPct: 20,
      exchange: null,
      minTradeUsd: 10,
    },
  ])
})

afterAll(async () => {
  // Clean up test allocations
  for (const asset of TEST_ALLOCATION_ASSETS) {
    await db.delete(allocations).where(eq(allocations.asset, asset))
  }
})

describe('PortfolioTracker integration', () => {
  test('getPortfolio returns null initially', () => {
    const portfolio = portfolioTracker.getPortfolio()
    expect(portfolio).toBeNull()
  })

  test('getTargetAllocations reads from database', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    expect(allocations).toBeDefined()
    expect(Array.isArray(allocations)).toBe(true)
    expect(allocations.length).toBeGreaterThanOrEqual(3)

    // Verify all seeded allocations are present
    const assetMap = new Map(allocations.map(a => [a.asset, a]))
    expect(assetMap.has('BTC')).toBe(true)
    expect(assetMap.has('ETH')).toBe(true)
    expect(assetMap.has('USDT')).toBe(true)
  })

  test('getTargetAllocations returns correct properties', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    const btc = allocations.find(a => a.asset === 'BTC')

    expect(btc).toBeDefined()
    expect(btc?.asset).toBe('BTC')
    expect(btc?.targetPct).toBe(50)
    expect(btc?.exchange).toBe('binance')
    expect(btc?.minTradeUsd).toBe(100)
  })

  test('getTargetAllocations handles null exchange', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    const usdt = allocations.find(a => a.asset === 'USDT')

    expect(usdt).toBeDefined()
    expect(usdt?.asset).toBe('USDT')
    expect(usdt?.targetPct).toBe(20)
    // Exchange should not be present in the object when null in DB
    expect('exchange' in usdt!).toBe(false)
  })

  test('getTargetAllocations applies default minTradeUsd', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    const eth = allocations.find(a => a.asset === 'ETH')

    expect(eth).toBeDefined()
    // DB stores 50, should be returned as 50
    expect(eth?.minTradeUsd).toBe(50)
  })

  test('getTargetAllocations caches results within TTL', async () => {
    const first = await portfolioTracker.getTargetAllocations()
    const second = await portfolioTracker.getTargetAllocations()

    // Both calls should return the same cached instance
    expect(first).toBe(second)
  })

  test('stopWatching completes without error', async () => {
    // stopWatching should be safe to call even if not watching
    await expect(portfolioTracker.stopWatching()).resolves.toBeUndefined()
  })

  test('getTargetAllocations with custom minTradeUsd', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()

    // Verify allocations maintain their seeded minTradeUsd values
    const btc = allocations.find(a => a.asset === 'BTC')
    const eth = allocations.find(a => a.asset === 'ETH')

    expect(btc?.minTradeUsd).toBe(100)
    expect(eth?.minTradeUsd).toBe(50)
  })
})
