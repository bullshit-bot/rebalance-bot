import { describe, test, expect, beforeEach } from 'bun:test'
import type { Portfolio } from '@/types/index'

// ─── Mock SnapshotService ──────────────────────────────────────────────────

class MockSnapshotService {
  private snapshots: any[] = []

  async saveSnapshot(portfolio: Portfolio): Promise<void> {
    const holdingsMap: Record<string, any> = {}
    const allocationsMap: Record<string, any> = {}

    for (const asset of portfolio.assets) {
      holdingsMap[asset.asset] = {
        amount: asset.amount,
        valueUsd: asset.valueUsd,
        exchange: asset.exchange,
      }
      allocationsMap[asset.asset] = {
        currentPct: asset.currentPct,
        targetPct: asset.targetPct,
        driftPct: asset.driftPct,
      }
    }

    const snapshot = {
      id: this.snapshots.length + 1,
      totalValueUsd: portfolio.totalValueUsd,
      holdings: JSON.stringify(holdingsMap),
      allocations: JSON.stringify(allocationsMap),
      createdAt: Math.floor(Date.now() / 1000),
    }

    this.snapshots.push(snapshot)
  }

  async getSnapshots(from: number, to: number): Promise<any[]> {
    return this.snapshots.filter(
      (s) => s.createdAt >= from && s.createdAt <= to,
    ).sort((a, b) => a.createdAt - b.createdAt)
  }

  async getLatest(): Promise<any | null> {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null
  }

  // Helper for testing
  getAll(): any[] {
    return [...this.snapshots]
  }

  clear(): void {
    this.snapshots = []
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SnapshotService', () => {
  let service: MockSnapshotService

  beforeEach(() => {
    service = new MockSnapshotService()
  })

  test('should save portfolio snapshot', async () => {
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
          amount: 3,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()

    expect(snapshots.length).toBe(1)
    expect(snapshots[0].totalValueUsd).toBe(10000)
  })

  test('should serialize holdings correctly', async () => {
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
      ],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()
    const holdings = JSON.parse(snapshots[0].holdings)

    expect(holdings.BTC).toBeDefined()
    expect(holdings.BTC.amount).toBe(0.1)
    expect(holdings.BTC.valueUsd).toBe(5000)
    expect(holdings.BTC.exchange).toBe('binance')
  })

  test('should serialize allocations correctly', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5000,
          currentPct: 45,
          targetPct: 50,
          driftPct: -5,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()
    const allocations = JSON.parse(snapshots[0].allocations)

    expect(allocations.BTC.currentPct).toBe(45)
    expect(allocations.BTC.targetPct).toBe(50)
    expect(allocations.BTC.driftPct).toBe(-5)
  })

  test('should retrieve snapshots within date range', async () => {
    const now = Math.floor(Date.now() / 1000)

    // Save multiple snapshots
    const portfolio1: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio1)

    // Simulate time passing
    const from = now
    const to = now + 3600 // 1 hour later

    const snapshots = await service.getSnapshots(from, to)
    expect(snapshots.length).toBeGreaterThan(0)
  })

  test('should filter snapshots correctly', async () => {
    const baseTime = Math.floor(Date.now() / 1000)

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)

    const snapshots = await service.getSnapshots(baseTime - 100, baseTime + 100)
    expect(snapshots.length).toBe(1)
  })

  test('should return empty array for out-of-range query', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)

    const snapshots = await service.getSnapshots(1, 2) // Very old time range
    expect(snapshots.length).toBe(0)
  })

  test('should return latest snapshot', async () => {
    const portfolio1: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    const portfolio2: Portfolio = {
      totalValueUsd: 20000,
      assets: [],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio1)
    await service.saveSnapshot(portfolio2)

    const latest = await service.getLatest()
    expect(latest).not.toBeNull()
    expect(latest.totalValueUsd).toBe(20000)
  })

  test('should return null when no snapshots exist', async () => {
    const latest = await service.getLatest()
    expect(latest).toBeNull()
  })

  test('should handle empty assets', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 0,
      assets: [],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()

    expect(snapshots[0].holdings).toBe('{}')
    expect(snapshots[0].allocations).toBe('{}')
  })

  test('should handle multiple assets in snapshot', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 15000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5000,
          currentPct: 33,
          targetPct: 33,
          driftPct: 0,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 5,
          valueUsd: 5000,
          currentPct: 33,
          targetPct: 33,
          driftPct: 0,
          exchange: 'binance',
        },
        {
          asset: 'USDT',
          amount: 5000,
          valueUsd: 5000,
          currentPct: 34,
          targetPct: 34,
          driftPct: 0,
          exchange: 'okx',
        },
      ],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()
    const holdings = JSON.parse(snapshots[0].holdings)

    expect(Object.keys(holdings).length).toBe(3)
    expect(holdings.BTC).toBeDefined()
    expect(holdings.ETH).toBeDefined()
    expect(holdings.USDT).toBeDefined()
  })

  test('should preserve exchange information', async () => {
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
          amount: 5,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'okx',
        },
      ],
      updatedAt: Date.now(),
    }

    await service.saveSnapshot(portfolio)
    const snapshots = service.getAll()
    const holdings = JSON.parse(snapshots[0].holdings)

    expect(holdings.BTC.exchange).toBe('binance')
    expect(holdings.ETH.exchange).toBe('okx')
  })
})
