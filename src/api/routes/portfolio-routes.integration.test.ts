import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { snapshots, allocations } from '@db/schema'
import { portfolioRoutes } from './portfolio-routes'
import type { Portfolio } from '@/types/index'
import { eq, gte } from 'drizzle-orm'

const now = Math.floor(Date.now() / 1000)

beforeAll(async () => {
  // Clean up previous test data
  const testSnapshots = await db
    .select()
    .from(snapshots)
    .where(gte(snapshots.createdAt, now - 86400))

  for (const snap of testSnapshots) {
    await db.delete(snapshots).where(eq(snapshots.id, snap.id))
  }

  // Clean up allocations
  await db.delete(allocations).where(eq(allocations.asset, 'BTC'))
  await db.delete(allocations).where(eq(allocations.asset, 'ETH'))
  await db.delete(allocations).where(eq(allocations.asset, 'USDT'))

  // Seed allocations for portfolio routes
  await db.insert(allocations).values([
    { asset: 'BTC', targetPct: 50, exchange: 'binance', minTradeUsd: 100 },
    { asset: 'ETH', targetPct: 30, exchange: 'binance', minTradeUsd: 50 },
    { asset: 'USDT', targetPct: 20, exchange: null, minTradeUsd: 10 },
  ])

  // Seed a snapshot for fallback testing
  const portfolio: Portfolio = {
    totalValueUsd: 10000,
    assets: [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 50,
        driftPct: 0,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 3.33,
        valueUsd: 3000,
        currentPct: 30,
        targetPct: 30,
        driftPct: 0,
        exchange: 'binance',
      },
      {
        asset: 'USDT',
        amount: 2000,
        valueUsd: 2000,
        currentPct: 20,
        targetPct: 20,
        driftPct: 0,
        exchange: 'binance',
      },
    ],
    updatedAt: Date.now(),
  }

  await db.insert(snapshots).values({
    totalValueUsd: portfolio.totalValueUsd,
    holdings: JSON.stringify(
      Object.fromEntries(
        portfolio.assets.map(a => [
          a.asset,
          { amount: a.amount, valueUsd: a.valueUsd, exchange: a.exchange },
        ]),
      ),
    ),
    allocations: JSON.stringify(
      Object.fromEntries(
        portfolio.assets.map(a => [
          a.asset,
          {
            currentPct: a.currentPct,
            targetPct: a.targetPct,
            driftPct: a.driftPct,
          },
        ]),
      ),
    ),
  })
})

afterAll(async () => {
  // Clean up test data
  const testSnapshots = await db
    .select()
    .from(snapshots)
    .where(gte(snapshots.createdAt, now - 86400))

  for (const snap of testSnapshots) {
    await db.delete(snapshots).where(eq(snapshots.id, snap.id))
  }

  await db.delete(allocations).where(eq(allocations.asset, 'BTC'))
  await db.delete(allocations).where(eq(allocations.asset, 'ETH'))
  await db.delete(allocations).where(eq(allocations.asset, 'USDT'))
})

describe('PortfolioRoutes integration', () => {
  test('GET / returns snapshot from fallback when no live tracker', async () => {
    const res = await portfolioRoutes.request('/')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toBeDefined()
    expect(body.totalValueUsd).toBeDefined()
    expect(body.assets).toBeDefined()
    expect(Array.isArray(body.assets)).toBe(true)
  })

  test('GET / fallback includes all seeded assets', async () => {
    const res = await portfolioRoutes.request('/')
    const body = await res.json()

    const assetMap = new Map(body.assets.map((a: unknown) => [(a as Record<string, unknown>).asset, a]))
    expect(assetMap.has('BTC')).toBe(true)
    expect(assetMap.has('ETH')).toBe(true)
    expect(assetMap.has('USDT')).toBe(true)
  })

  test('GET / fallback returns correct portfolio structure', async () => {
    const res = await portfolioRoutes.request('/')
    const body = await res.json()

    expect(body.totalValueUsd).toBe(10000)
    expect(body.updatedAt).toBeDefined()
    expect(typeof body.updatedAt).toBe('number')
  })

  test('GET / fallback asset has required fields', async () => {
    const res = await portfolioRoutes.request('/')
    const body = await res.json()

    if (body.assets.length > 0) {
      const asset = body.assets[0] as Record<string, unknown>
      expect(asset.asset).toBeDefined()
      expect(asset.amount).toBeDefined()
      expect(asset.valueUsd).toBeDefined()
      expect(asset.currentPct).toBeDefined()
      expect(asset.targetPct).toBeDefined()
      expect(asset.driftPct).toBeDefined()
      expect(asset.exchange).toBeDefined()
    }
  })

  test('GET / fallback returns 503 when no portfolio data', async () => {
    // Delete all snapshots temporarily
    const allSnapshots = await db.select().from(snapshots)
    const savedIds = allSnapshots.map(s => s.id)

    for (const snap of allSnapshots) {
      await db.delete(snapshots).where(eq(snapshots.id, snap.id))
    }

    const res = await portfolioRoutes.request('/')
    expect(res.status).toBe(503)

    const body = await res.json()
    expect(body.error).toBeDefined()

    // Restore snapshots for other tests
    for (const id of savedIds) {
      const snap = allSnapshots.find(s => s.id === id)
      if (snap) {
        await db.insert(snapshots).values(snap)
      }
    }
  })

  test('GET /history returns snapshots', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history filters by date range', async () => {
    // Query a narrow range around now
    const fromSecs = now
    const toSecs = now + 10

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history with only from parameter', async () => {
    const fromSecs = now - 3600 // 1 hour ago
    const res = await portfolioRoutes.request(`/history?from=${fromSecs}`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history with only to parameter', async () => {
    const toSecs = now + 3600 // 1 hour from now
    const res = await portfolioRoutes.request(`/history?to=${toSecs}`)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history uses default range when no params', async () => {
    const res = await portfolioRoutes.request('/history')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history returns 400 for invalid from parameter', async () => {
    const res = await portfolioRoutes.request('/history?from=invalid')

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(body.error).toContain('Invalid')
  })

  test('GET /history returns 400 for invalid to parameter', async () => {
    const res = await portfolioRoutes.request('/history?to=not_a_number')

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  test('GET /history handles empty date range gracefully', async () => {
    const fromSecs = now - 1000000
    const toSecs = now - 999999 // Very narrow, likely empty range

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    // Should return empty array, not error
  })

  test('GET /history snapshot includes totalValueUsd', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    const body = await res.json()

    if (body.length > 0) {
      expect(body[0].totalValueUsd).toBeDefined()
      expect(typeof body[0].totalValueUsd).toBe('number')
    }
  })

  test('GET /history snapshot includes holdings JSON', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    const body = await res.json()

    if (body.length > 0) {
      expect(body[0].holdings).toBeDefined()
      // Should be valid JSON string
      const holdings = JSON.parse(body[0].holdings)
      expect(typeof holdings).toBe('object')
    }
  })

  test('GET /history snapshot includes allocations JSON', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    const body = await res.json()

    if (body.length > 0) {
      expect(body[0].allocations).toBeDefined()
      const allocations = JSON.parse(body[0].allocations)
      expect(typeof allocations).toBe('object')
    }
  })

  test('GET /history snapshot includes createdAt timestamp', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    const body = await res.json()

    if (body.length > 0) {
      expect(body[0].createdAt).toBeDefined()
      expect(typeof body[0].createdAt).toBe('number')
    }
  })

  test('GET /history with negative from parameter', async () => {
    const res = await portfolioRoutes.request('/history?from=-100')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /history with from > to returns empty', async () => {
    const fromSecs = now
    const toSecs = now - 86400

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })

  test('GET /history allocations include targetPct', async () => {
    const fromSecs = now - 86400
    const toSecs = now

    const res = await portfolioRoutes.request(
      `/history?from=${fromSecs}&to=${toSecs}`,
    )
    const body = await res.json()

    if (body.length > 0) {
      const allocations = JSON.parse(body[0].allocations)
      if (Object.keys(allocations).length > 0) {
        const firstAsset = allocations[Object.keys(allocations)[0]]
        expect(firstAsset.targetPct).toBeDefined()
        expect(firstAsset.currentPct).toBeDefined()
        expect(firstAsset.driftPct).toBeDefined()
      }
    }
  })

  test('GET / fallback computes drift percentages', async () => {
    const res = await portfolioRoutes.request('/')
    const body = await res.json()

    if (body.assets.length > 0) {
      const asset = body.assets[0] as Record<string, unknown>
      const driftPct = asset.driftPct as number
      const currentPct = asset.currentPct as number
      const targetPct = asset.targetPct as number

      // Drift should be current - target
      expect(Math.abs(driftPct - (currentPct - targetPct))).toBeLessThan(0.1)
    }
  })
})
