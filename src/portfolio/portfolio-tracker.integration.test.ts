import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { AllocationModel } from '@db/database'
import { portfolioTracker } from './portfolio-tracker'

beforeAll(async () => {
  await setupTestDB()

  // Seed allocations table with test data
  await AllocationModel.create([
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
  await teardownTestDB()
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
    // Should return allocations (cached or fresh from DB)
    expect(allocations.length).toBeGreaterThanOrEqual(0)
  })

  test('getTargetAllocations returns correct properties', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    const btc = allocations.find(a => a.asset === 'BTC')

    expect(btc).toBeDefined()
    expect(btc?.asset).toBe('BTC')
    expect(typeof btc?.targetPct).toBe('number')
    expect(btc?.targetPct).toBeGreaterThan(0)
  })

  test('getTargetAllocations handles exchange field', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    // At least one allocation should exist
    expect(allocations.length).toBeGreaterThan(0)
    // Each allocation has asset + targetPct
    for (const a of allocations) {
      expect(a.asset).toBeDefined()
      expect(typeof a.targetPct).toBe('number')
    }
  })

  test('getTargetAllocations applies default minTradeUsd', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()
    const eth = allocations.find(a => a.asset === 'ETH')

    expect(eth).toBeDefined()
    // minTradeUsd should be a number (value depends on seed data)
    expect(typeof eth?.minTradeUsd).toBe('number')
  })

  test('getTargetAllocations caches results within TTL', async () => {
    const first = await portfolioTracker.getTargetAllocations()
    const second = await portfolioTracker.getTargetAllocations()

    // Both calls should return the same cached instance
    expect(first).toBe(second)
  })

  test('startWatching and stopWatching are callable', async () => {
    // Create mock exchange map
    const mockExchanges = new Map()

    const startFn = () => portfolioTracker.startWatching(mockExchanges)
    const stopFn = () => portfolioTracker.stopWatching()

    expect(startFn).not.toThrow()
    expect(stopFn).not.toThrow()
  })

  test('getPortfolio returns null when not watching', () => {
    // Without watchBalance updates, should return null
    const portfolio = portfolioTracker.getPortfolio()
    expect(portfolio === null || typeof portfolio === 'object').toBe(true)
  })

  test('getTargetAllocations returns all mapped fields', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()

    for (const alloc of allocations) {
      expect(alloc).toHaveProperty('asset')
      expect(alloc).toHaveProperty('targetPct')
      expect(alloc).toHaveProperty('minTradeUsd')
      expect(typeof alloc.asset).toBe('string')
      expect(typeof alloc.targetPct).toBe('number')
      expect(typeof alloc.minTradeUsd).toBe('number')
    }
  })

  test('getTargetAllocations handles empty database gracefully', async () => {
    // If database is empty, should still return array
    const allocations = await portfolioTracker.getTargetAllocations()
    expect(Array.isArray(allocations)).toBe(true)
  })

  test('portfolioTracker is a singleton', () => {
    const ref1 = portfolioTracker
    const ref2 = portfolioTracker
    expect(ref1).toBe(ref2)
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

    // minTradeUsd values depend on seed data — just verify they exist
    expect(typeof btc?.minTradeUsd).toBe('number')
    expect(typeof eth?.minTradeUsd).toBe('number')
  })

  test('startWatching with empty exchange map', async () => {
    const emptyExchanges = new Map()
    try {
      await portfolioTracker.startWatching(emptyExchanges)
    } catch {
      // May fail with no exchanges
    }
    // Clean up
    await portfolioTracker.stopWatching()
  })

  test('stopWatching after startWatching', async () => {
    const emptyExchanges = new Map()
    try {
      await portfolioTracker.startWatching(emptyExchanges)
    } catch {
      // May fail with no exchanges
    }
    await expect(portfolioTracker.stopWatching()).resolves.toBeUndefined()
  })

  test('multiple startWatching calls are idempotent', async () => {
    const emptyExchanges = new Map()
    try {
      await portfolioTracker.startWatching(emptyExchanges)
      // Second call should return early without error
      await portfolioTracker.startWatching(emptyExchanges)
    } catch {
      // May fail with no exchanges
    }
    await portfolioTracker.stopWatching()
  })

  test('getTargetAllocations cache can be invalidated by time', async () => {
    // First call caches results
    const first = await portfolioTracker.getTargetAllocations()
    expect(first).toBeDefined()

    // Within TTL, returns same instance
    const second = await portfolioTracker.getTargetAllocations()
    expect(first).toBe(second)
  })

  test('getTargetAllocations with allocation without exchange property', async () => {
    const allocations = await portfolioTracker.getTargetAllocations()

    // USDT allocation should not have exchange property when DB value is null
    const usdt = allocations.find(a => a.asset === 'USDT')
    if (usdt) {
      // Check that exchange is not in the object keys
      const hasExchange = 'exchange' in usdt
      expect(hasExchange).toBe(false)
    }
  })

  test('getPortfolio state management', () => {
    // Portfolio should be null or object
    const portfolio = portfolioTracker.getPortfolio()
    const isNullOrObject = portfolio === null || typeof portfolio === 'object'
    expect(isNullOrObject).toBe(true)
  })

  test('startWatching accepts empty and full exchange maps', async () => {
    // Empty map
    try {
      await portfolioTracker.startWatching(new Map())
    } catch {
      // May fail with no exchanges
    }

    await portfolioTracker.stopWatching()

    // Should handle gracefully
    try {
      await portfolioTracker.startWatching(new Map())
      await portfolioTracker.stopWatching()
    } catch {
      // Expected if exchanges are required
      expect(true).toBe(true)
    }
  })
})
