import { describe, test, expect } from 'bun:test'
import type { Portfolio, PortfolioAsset, Allocation } from '@/types/index'
import { getDCATarget } from '@rebalancer/dca-target-resolver'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  return {
    asset: 'BTC',
    amount: 1,
    valueUsd: 50000,
    currentPct: 50,
    targetPct: 50,
    driftPct: 0,
    exchange: 'kraken',
    ...overrides,
  }
}

function createPortfolio(assets: PortfolioAsset[]): Portfolio {
  return {
    totalValueUsd: assets.reduce((s, a) => s + a.valueUsd, 0),
    assets,
    updatedAt: Date.now(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDCATarget', () => {
  test('should return asset with largest positive drift', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 40000 }),
      createAsset({ asset: 'ETH', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 60, minTradeUsd: 100 }, // Current: 44%, drift: +16%
      { asset: 'ETH', targetPct: 40, minTradeUsd: 100 }, // Current: 56%, drift: -16%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC') // Underweight, needs DCA
  })

  test('should return null when all assets at target', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 50000 }),
      createAsset({ asset: 'ETH', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBeNull()
  })

  test('should return null when all assets at or above target', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 60000 }),
      createAsset({ asset: 'ETH', valueUsd: 40000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 40, minTradeUsd: 100 }, // Only 50% target
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBeNull() // All at or above target, no positive drift
  })

  test('should ignore stablecoins in crypto value calculation', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 40000 }),
      createAsset({ asset: 'USDT', valueUsd: 60000 }), // Stablecoin, ignored
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 },
    ]

    // Crypto value = 40k (USDT ignored)
    // BTC: 40k/40k = 100%, target 50%, drift = -50%
    // ETH: 0k/40k = 0%, target 50%, drift = +50%
    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH')
  })

  test('should handle multiple stablecoins', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 30000 }),
      createAsset({ asset: 'USDT', valueUsd: 40000 }),
      createAsset({ asset: 'USDC', valueUsd: 30000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 },
    ]

    // Crypto value = 30k (stablecoins ignored)
    // BTC: 30k/30k = 100%, target 50%, drift = -50%
    // ETH: 0k/30k = 0%, target 50%, drift = +50%
    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH')
  })

  test('should pick highest target when crypto value is dust (< $10)', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 5 }),
      createAsset({ asset: 'ETH', valueUsd: 3 }),
      createAsset({ asset: 'USDT', valueUsd: 10000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 40, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 60, minTradeUsd: 100 }, // Highest target
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH')
  })

  test('should return highest target when crypto value exactly at dust threshold', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 10 }),
      createAsset({ asset: 'ETH', valueUsd: 0 }),
      createAsset({ asset: 'USDT', valueUsd: 10000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 30, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 70, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH')
  })

  test('should ignore zero or missing holdings in drift calculation', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 50000 }),
      // ETH not held
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 }, // 0%, target 50%, drift +50%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH')
  })

  test('should work with three-asset portfolio', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 30000 }),
      createAsset({ asset: 'ETH', valueUsd: 40000 }),
      createAsset({ asset: 'SOL', valueUsd: 30000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 }, // Current: 30%, drift: +20%
      { asset: 'ETH', targetPct: 30, minTradeUsd: 100 }, // Current: 40%, drift: -10%
      { asset: 'SOL', targetPct: 20, minTradeUsd: 100 }, // Current: 30%, drift: -10%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC')
  })

  test('should select asset with largest drift when multiple underweight', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 20000 }),
      createAsset({ asset: 'ETH', valueUsd: 70000 }),
      createAsset({ asset: 'SOL', valueUsd: 10000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 }, // Current: 20%, drift: +30%
      { asset: 'ETH', targetPct: 30, minTradeUsd: 100 }, // Current: 70%, drift: -40%
      { asset: 'SOL', targetPct: 20, minTradeUsd: 100 }, // Current: 10%, drift: +10%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC')
  })

  test('should handle equal-weight allocation', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 30000 }),
      createAsset({ asset: 'ETH', valueUsd: 20000 }),
      createAsset({ asset: 'SOL', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 33.33, minTradeUsd: 100 }, // 30%, drift: +3.33%
      { asset: 'ETH', targetPct: 33.33, minTradeUsd: 100 }, // 20%, drift: +13.33%
      { asset: 'SOL', targetPct: 33.33, minTradeUsd: 100 }, // 50%, drift: -16.67%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH') // Most underweight drift +13.33%
  })

  test('should work with very small allocations', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 0.01 }),
      createAsset({ asset: 'ETH', valueUsd: 0.02 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    // Crypto value ~0.03, which is < 10, so pick highest target
    expect(target).toBe('BTC') // Both targets equal (50%), first match wins
  })

  test('should prefer crypto assets over stablecoins in dust scenario', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 3 }),
      createAsset({ asset: 'USDT', valueUsd: 100000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 100, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC')
  })

  test('should calculate drift as target - current (underweight has positive drift)', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 9000 }), // 90% of 10k, target 10%, drift = -80%
      createAsset({ asset: 'ETH', valueUsd: 1000 }), // 10% of 10k, target 90%, drift = +80%
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 10, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 90, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH') // Underweight, drift = 90 - 10 = +80%
  })

  test('should handle allocation not in portfolio', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 40, minTradeUsd: 100 }, // 100%, drift -60%
      { asset: 'ETH', targetPct: 60, minTradeUsd: 100 }, // 0%, drift +60%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('ETH') // 0% vs 60% target
  })

  test('should handle empty allocations array', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 50000 }),
    ])

    const target = getDCATarget(portfolio, [])
    // With no allocations to iterate, nothing happens, returns null
    expect(target).toBeNull()
  })

  test('should handle empty portfolio', () => {
    const portfolio = createPortfolio([])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 100, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC')
  })

  test('should compute correct percentage with mixed assets', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 25000 }),
      createAsset({ asset: 'ETH', valueUsd: 25000 }),
      createAsset({ asset: 'USDT', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 60, minTradeUsd: 100 }, // Current: 50%, drift: +10%
      { asset: 'ETH', targetPct: 40, minTradeUsd: 100 }, // Current: 50%, drift: -10%
    ]

    const target = getDCATarget(portfolio, allocations)
    expect(target).toBe('BTC')
  })

  test('should handle identical drift values by picking first match', () => {
    const portfolio = createPortfolio([
      createAsset({ asset: 'BTC', valueUsd: 25000 }),
      createAsset({ asset: 'ETH', valueUsd: 25000 }),
      createAsset({ asset: 'SOL', valueUsd: 50000 }),
    ])

    const allocations: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 }, // Current: 25%, drift: +25%
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 }, // Current: 25%, drift: +25%
      { asset: 'SOL', targetPct: 0, minTradeUsd: 100 },
    ]

    const target = getDCATarget(portfolio, allocations)
    // When drifts are equal, the first asset with maxDrift wins
    expect(target).toBe('BTC')
  })
})
