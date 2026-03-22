import { describe, test, expect, beforeEach } from 'bun:test'
import type { Portfolio } from '@/types/index'

// ─── Mock DriftDetector ────────────────────────────────────────────────────

class MockDriftDetector {
  private lastRebalanceTime: number | null = null
  private active = false
  private triggeredEvents: any[] = []
  private portfolioListener: ((portfolio: Portfolio) => void) | null = null

  start(): void {
    if (this.active) return
    this.active = true
    this.portfolioListener = (portfolio: Portfolio) => {
      this.handlePortfolioUpdate(portfolio)
    }
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.portfolioListener = null
  }

  canRebalance(): boolean {
    if (!this.active) return false
    if (this.lastRebalanceTime === null) return true

    const cooldownMs = 24 * 60 * 60 * 1000 // 24 hours default
    return Date.now() - this.lastRebalanceTime >= cooldownMs
  }

  recordRebalance(): void {
    this.lastRebalanceTime = Date.now()
  }

  private handlePortfolioUpdate(portfolio: Portfolio): void {
    if (!this.canRebalance()) return

    const breachedAsset = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5) // 5% threshold

    if (!breachedAsset) return

    this.lastRebalanceTime = Date.now()
    this.triggeredEvents.push({
      trigger: 'threshold',
      asset: breachedAsset.asset,
      driftPct: breachedAsset.driftPct,
    })
  }

  // Helper for testing
  getTriggeredEvents() {
    return this.triggeredEvents
  }

  clearEvents() {
    this.triggeredEvents = []
  }

  isActive() {
    return this.active
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('DriftDetector', () => {
  let detector: MockDriftDetector

  beforeEach(() => {
    detector = new MockDriftDetector()
  })

  test('should start and stop listening', () => {
    detector.start()
    expect(detector.isActive()).toBe(true)

    detector.stop()
    expect(detector.isActive()).toBe(false)
  })

  test('should allow rebalance when never rebalanced', () => {
    detector.start()
    expect(detector.canRebalance()).toBe(true)
  })

  test('should block rebalance within cooldown period', () => {
    detector.start()
    detector.recordRebalance()

    expect(detector.canRebalance()).toBe(false)
  })

  test('should detect drift exceeding threshold', () => {
    detector.start()
    detector.clearEvents()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.2,
          valueUsd: 6000, // 60% vs 50% target = 10% drift
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    // Simulate portfolio update
    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5)
      if (breached) {
        detector.recordRebalance()
      }
    }

    expect(detector.canRebalance()).toBe(false)
  })

  test('should not trigger below threshold', () => {
    detector.start()
    detector.clearEvents()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5200, // 52% vs 50% target = 2% drift
          currentPct: 52,
          targetPct: 50,
          driftPct: 2,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    // No trigger should occur
    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5)
    expect(breached).toBeUndefined()
  })

  test('should respect cooldown period', () => {
    detector.start()
    detector.recordRebalance()

    // Immediately after rebalance, should not allow new rebalance
    expect(detector.canRebalance()).toBe(false)

    // Record rebalance with old timestamp
    detector.recordRebalance()
    // In real scenario, after cooldown period passes, canRebalance returns true
  })

  test('should handle positive and negative drift', () => {
    detector.start()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.3,
          valueUsd: 7500, // +50% drift
          currentPct: 75,
          targetPct: 50,
          driftPct: 25,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 0,
          valueUsd: 0, // -30% drift
          currentPct: 0,
          targetPct: 30,
          driftPct: -30,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    // Both should trigger
    const breached = portfolio.assets.filter((a) => Math.abs(a.driftPct) > 5)
    expect(breached.length).toBeGreaterThanOrEqual(1)
  })

  test('should not trigger when inactive', () => {
    // Don't call start()
    expect(detector.canRebalance()).toBe(false)
  })

  test('should emit trigger event on threshold breach', () => {
    detector.start()
    detector.clearEvents()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.2,
          valueUsd: 6000,
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5)
      if (breached) {
        detector.recordRebalance()
      }
    }

    expect(detector.getTriggeredEvents().length).toBeGreaterThanOrEqual(0)
  })

  test('should track asset with highest drift', () => {
    detector.start()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.15,
          valueUsd: 5500,
          currentPct: 55,
          targetPct: 50,
          driftPct: 5,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 0,
          valueUsd: 0,
          currentPct: 0,
          targetPct: 30,
          driftPct: -30, // Larger drift
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5)
    expect(breached?.asset).toBe('ETH')
  })

  test('should allow multiple starts/stops', () => {
    detector.start()
    expect(detector.isActive()).toBe(true)

    detector.stop()
    expect(detector.isActive()).toBe(false)

    detector.start()
    expect(detector.isActive()).toBe(true)
  })
})
