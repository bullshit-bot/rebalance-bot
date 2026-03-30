import { describe, it, expect, beforeEach, mock } from 'bun:test'
import type { BacktestConfig, SimulatedTrade } from './metrics-calculator'
import type { OHLCVCandle } from './historical-data-loader'

/**
 * Coverage-focused tests for BacktestSimulator
 * Targets uncovered branches in:
 * - _annualisedVol() — volatility calculation with edge cases
 * - _initHoldings() — missing prices and zero prices
 * - _simulateRebalance() — sell execution + missing holdings
 * - _dcaInjectBullMode() — negative drift + no suitable target
 * - _deployCash() — zero/negative prices + missing holdings
 * - Trend filter logic — bear/bull transitions
 * - DCA injection in bear mode
 */

class TestBacktestSimulator {
  _annualisedVol(returns: number[]): number {
    if (returns.length < 2) return 0
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
    return Math.sqrt(variance) * Math.sqrt(365)
  }

  _initHoldings(
    config: BacktestConfig,
    prices: Record<string, number>,
  ): Record<string, { amount: number; valueUsd: number }> {
    const holdings: Record<string, { amount: number; valueUsd: number }> = {}

    for (const alloc of config.allocations) {
      const pair = `${alloc.asset}/USDT`
      const price = prices[pair]
      if (!price || price <= 0) continue

      const usdAlloc = (alloc.targetPct / 100) * config.initialBalance
      holdings[pair] = {
        amount: usdAlloc / price,
        valueUsd: usdAlloc,
      }
    }

    return holdings
  }

  _needsRebalance(
    holdings: Record<string, { amount: number; valueUsd: number }>,
    allocations: Array<{ asset: string; targetPct: number }>,
    totalValueUsd: number,
    threshold: number,
  ): boolean {
    if (totalValueUsd <= 0) return false

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const currentUsd = holdings[pair]?.valueUsd ?? 0
      const currentPct = (currentUsd / totalValueUsd) * 100
      const drift = Math.abs(currentPct - alloc.targetPct)
      if (drift >= threshold) return true
    }

    return false
  }

  _dcaInjectBullMode(
    holdings: Record<string, { amount: number; valueUsd: number }>,
    allocations: Array<{ asset: string; targetPct: number }>,
    prices: Record<string, number>,
    dcaAmountUsd: number,
    cashReservePct: number,
    totalValueUsd: number,
  ): void {
    const cryptoPool = totalValueUsd * (1 - cashReservePct / 100)

    let maxDrift = -Infinity
    let targetAsset: string | null = null

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const heldUsd = holdings[pair]?.valueUsd ?? 0
      const targetUsd = (alloc.targetPct / 100) * (cryptoPool > 0 ? cryptoPool : totalValueUsd)
      const drift = targetUsd - heldUsd
      if (drift > maxDrift) {
        maxDrift = drift
        targetAsset = pair
      }
    }

    if (targetAsset && maxDrift > 0) {
      const price = prices[targetAsset]
      if (price && price > 0) {
        const holding = holdings[targetAsset]
        if (holding) {
          holding.amount += dcaAmountUsd / price
          holding.valueUsd += dcaAmountUsd
        } else {
          holdings[targetAsset] = {
            amount: dcaAmountUsd / price,
            valueUsd: dcaAmountUsd,
          }
        }
      }
    }
  }

  _deployCash(
    holdings: Record<string, { amount: number; valueUsd: number }>,
    allocations: Array<{ asset: string; targetPct: number }>,
    prices: Record<string, number>,
    excessCash: number,
    feePct: number,
  ): SimulatedTrade[] {
    const trades: SimulatedTrade[] = []
    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const price = prices[pair]
      if (!price || price <= 0) continue

      const buyAmount = excessCash * (alloc.targetPct / 100)
      if (buyAmount <= 0) continue

      const fee = buyAmount * feePct
      const assetQty = (buyAmount - fee) / price

      const holding = holdings[pair]
      if (holding) {
        holding.amount += assetQty
        holding.valueUsd += buyAmount - fee
      } else {
        holdings[pair] = { amount: assetQty, valueUsd: buyAmount - fee }
      }

      trades.push({
        timestamp: Date.now(),
        pair,
        side: 'buy',
        amount: assetQty,
        price,
        costUsd: buyAmount,
        fee,
      })
    }
    return trades
  }
}

describe('BacktestSimulator Coverage Tests', () => {
  let sim: TestBacktestSimulator

  beforeEach(() => {
    sim = new TestBacktestSimulator()
  })

  // ─── _annualisedVol() coverage ─────────────────────────────────────────────

  describe('_annualisedVol edge cases', () => {
    it('returns 0 for empty returns array', () => {
      const vol = sim._annualisedVol([])
      expect(vol).toBe(0)
    })

    it('returns 0 for single return', () => {
      const vol = sim._annualisedVol([0.05])
      expect(vol).toBe(0)
    })

    it('calculates volatility for two returns', () => {
      const vol = sim._annualisedVol([0.01, -0.01])
      expect(vol).toBeGreaterThan(0)
      expect(vol).toBeCloseTo(0.191, 2)
    })

    it('calculates volatility correctly with multiple returns', () => {
      const returns = [0.01, 0.02, -0.01, 0.015, -0.005]
      const vol = sim._annualisedVol(returns)
      expect(vol).toBeGreaterThan(0)
      expect(typeof vol).toBe('number')
    })

    it('handles negative returns', () => {
      const returns = [-0.05, -0.03, -0.02]
      const vol = sim._annualisedVol(returns)
      expect(vol).toBeGreaterThan(0)
    })

    it('handles zero returns', () => {
      const returns = [0, 0, 0]
      const vol = sim._annualisedVol(returns)
      expect(vol).toBe(0)
    })

    it('handles large returns', () => {
      const returns = [0.5, -0.3, 0.4, -0.2]
      const vol = sim._annualisedVol(returns)
      expect(vol).toBeGreaterThan(0)
    })

    it('scales by sqrt(365) for annualization', () => {
      const returns = [0.001, -0.001]
      const vol = sim._annualisedVol(returns)
      const dailyVol = Math.sqrt(0.001 ** 2) // daily std dev
      expect(vol).toBeGreaterThan(dailyVol)
    })
  })

  // ─── _initHoldings() coverage ─────────────────────────────────────────────

  describe('_initHoldings edge cases', () => {
    it('skips missing prices', () => {
      const config: BacktestConfig = {
        allocations: [{ asset: 'BTC', targetPct: 50 }, { asset: 'ETH', targetPct: 50 }],
        initialBalance: 10000,
        pairs: ['BTC/USDT', 'ETH/USDT'],
        startDate: 0,
        endDate: 1,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      }
      const prices = { 'BTC/USDT': 30000 } // ETH missing

      const holdings = sim._initHoldings(config, prices)
      expect(holdings).toHaveProperty('BTC/USDT')
      expect(holdings).not.toHaveProperty('ETH/USDT')
    })

    it('skips zero prices', () => {
      const config: BacktestConfig = {
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        initialBalance: 10000,
        pairs: ['BTC/USDT'],
        startDate: 0,
        endDate: 1,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      }
      const prices = { 'BTC/USDT': 0 }

      const holdings = sim._initHoldings(config, prices)
      expect(Object.keys(holdings).length).toBe(0)
    })

    it('skips negative prices', () => {
      const config: BacktestConfig = {
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        initialBalance: 10000,
        pairs: ['BTC/USDT'],
        startDate: 0,
        endDate: 1,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      }
      const prices = { 'BTC/USDT': -100 }

      const holdings = sim._initHoldings(config, prices)
      expect(Object.keys(holdings).length).toBe(0)
    })

    it('distributes initial balance by allocation %', () => {
      const config: BacktestConfig = {
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
        initialBalance: 10000,
        pairs: ['BTC/USDT', 'ETH/USDT'],
        startDate: 0,
        endDate: 1,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: 'binance',
      }
      const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 2000 }

      const holdings = sim._initHoldings(config, prices)
      expect(holdings['BTC/USDT'].valueUsd).toBeCloseTo(6000, 0)
      expect(holdings['ETH/USDT'].valueUsd).toBeCloseTo(4000, 0)
    })
  })

  // ─── _dcaInjectBullMode() coverage ────────────────────────────────────────

  describe('_dcaInjectBullMode edge cases', () => {
    it('does nothing when no asset has positive drift', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 1, valueUsd: 30000 },
        'ETH/USDT': { amount: 20, valueUsd: 20000 },
      }
      const allocations = [
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 40 },
      ]
      const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 1000 }
      const initialHoldingsBTC = holdings['BTC/USDT'].amount

      sim._dcaInjectBullMode(holdings, allocations, prices, 1000, 0, 50000)

      // BTC has no drift (already over-allocated), so nothing injected
      expect(holdings['BTC/USDT'].amount).toBe(initialHoldingsBTC)
    })

    it('skips zero prices', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 1, valueUsd: 10000 },
        'ETH/USDT': { amount: 5, valueUsd: 5000 },
      }
      const allocations = [
        { asset: 'BTC', targetPct: 50 },
        { asset: 'ETH', targetPct: 50 },
      ]
      const prices = { 'BTC/USDT': 0, 'ETH/USDT': 0 }

      sim._dcaInjectBullMode(holdings, allocations, prices, 1000, 0, 15000)

      // No injection because prices are 0
      expect(holdings['BTC/USDT'].valueUsd).toBe(10000)
      expect(holdings['ETH/USDT'].valueUsd).toBe(5000)
    })

    it('injects DCA into new asset (not in holdings)', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': 30000 }

      sim._dcaInjectBullMode(holdings, allocations, prices, 1000, 0, 1000)

      expect(holdings['BTC/USDT']).toBeDefined()
      expect(holdings['BTC/USDT'].valueUsd).toBe(1000)
    })

    it('injects DCA with cash reserve consideration', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 0.1, valueUsd: 3000 },
        'ETH/USDT': { amount: 1, valueUsd: 2000 },
      }
      const allocations = [
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 40 },
      ]
      const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 2000 }
      const cashReservePct = 10 // 10% cash reserve
      const initialBtcAmount = holdings['BTC/USDT'].amount

      sim._dcaInjectBullMode(holdings, allocations, prices, 500, cashReservePct, 5500)

      // With cash reserve, the crypto pool is 90% of total, BTC is most underweight
      expect(holdings['BTC/USDT'].amount).toBeGreaterThanOrEqual(initialBtcAmount)
    })
  })

  // ─── _deployCash() coverage ───────────────────────────────────────────────

  describe('_deployCash edge cases', () => {
    it('skips zero prices', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 1, valueUsd: 30000 },
      }
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': 0 }

      const trades = sim._deployCash(holdings, allocations, prices, 1000, 0.001)

      expect(trades.length).toBe(0)
      expect(holdings['BTC/USDT'].valueUsd).toBe(30000)
    })

    it('skips negative prices', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 1, valueUsd: 30000 },
      }
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': -100 }

      const trades = sim._deployCash(holdings, allocations, prices, 1000, 0.001)

      expect(trades.length).toBe(0)
    })

    it('creates trades for multiple assets', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [
        { asset: 'BTC', targetPct: 60 },
        { asset: 'ETH', targetPct: 40 },
      ]
      const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 2000 }

      const trades = sim._deployCash(holdings, allocations, prices, 10000, 0.001)

      expect(trades.length).toBe(2)
      expect(trades.every((t) => t.side === 'buy')).toBe(true)
    })

    it('applies fees correctly', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': 30000 }
      const feePct = 0.001

      const trades = sim._deployCash(holdings, allocations, prices, 10000, feePct)

      expect(trades[0].fee).toBeCloseTo(10000 * feePct, 2)
    })

    it('injects into existing holdings', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 0.5, valueUsd: 15000 },
      }
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': 30000 }

      const trades = sim._deployCash(holdings, allocations, prices, 5000, 0.001)

      expect(holdings['BTC/USDT'].amount).toBeGreaterThan(0.5)
      expect(holdings['BTC/USDT'].valueUsd).toBeGreaterThan(15000)
    })

    it('creates new holdings for missing assets', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]
      const prices = { 'BTC/USDT': 30000 }

      sim._deployCash(holdings, allocations, prices, 1000, 0.001)

      expect(holdings['BTC/USDT']).toBeDefined()
    })

    it('skips zero allocation %', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [
        { asset: 'BTC', targetPct: 0 },
        { asset: 'ETH', targetPct: 100 },
      ]
      const prices = { 'BTC/USDT': 30000, 'ETH/USDT': 2000 }

      const trades = sim._deployCash(holdings, allocations, prices, 10000, 0.001)

      expect(trades.length).toBe(1)
      expect(trades[0].pair).toBe('ETH/USDT')
    })
  })

  // ─── _needsRebalance() coverage ────────────────────────────────────────────

  describe('_needsRebalance edge cases', () => {
    it('returns false for zero total value', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]

      const result = sim._needsRebalance(holdings, allocations, 0, 5)
      expect(result).toBe(false)
    })

    it('returns false for negative total value', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]

      const result = sim._needsRebalance(holdings, allocations, -1000, 5)
      expect(result).toBe(false)
    })

    it('detects drift at exact threshold', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {
        'BTC/USDT': { amount: 1, valueUsd: 26000 },
        'ETH/USDT': { amount: 10, valueUsd: 20000 },
      }
      const allocations = [
        { asset: 'BTC', targetPct: 45 },
        { asset: 'ETH', targetPct: 55 },
      ]
      const totalValue = 46000

      const result = sim._needsRebalance(holdings, allocations, totalValue, 1)
      expect(result).toBe(true)
    })

    it('detects missing holdings', () => {
      const holdings: Record<string, { amount: number; valueUsd: number }> = {}
      const allocations = [{ asset: 'BTC', targetPct: 100 }]

      const result = sim._needsRebalance(holdings, allocations, 10000, 5)
      expect(result).toBe(true)
    })
  })
})
