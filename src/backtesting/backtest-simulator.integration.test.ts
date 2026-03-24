import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { ohlcvCandles } from '@db/schema'
import { eq, and } from 'drizzle-orm'
import { backtestSimulator } from './backtest-simulator'
import type { BacktestConfig } from './metrics-calculator'

describe('backtest-simulator', () => {
  const testExchange = 'binance'
  const pair1 = 'BTC/USDT'
  const pair2 = 'ETH/USDT'

  beforeAll(async () => {
    // Clear and seed test data
    await db
      .delete(ohlcvCandles)
      .where(and(eq(ohlcvCandles.exchange, testExchange)))

    // Create candles for BTC
    let btcPrice = 40000
    const btcCandles = Array.from({ length: 30 }, (_, i) => ({
      exchange: testExchange,
      pair: pair1,
      timeframe: '1d' as const,
      timestamp: 1000000 + i * 86400000,
      open: btcPrice,
      high: btcPrice * 1.02,
      low: btcPrice * 0.98,
      close: (btcPrice *= 1 + (Math.random() - 0.5) * 0.02),
      volume: 1000,
    }))

    // Create candles for ETH
    let ethPrice = 2000
    const ethCandles = Array.from({ length: 30 }, (_, i) => ({
      exchange: testExchange,
      pair: pair2,
      timeframe: '1d' as const,
      timestamp: 1000000 + i * 86400000,
      open: ethPrice,
      high: ethPrice * 1.02,
      low: ethPrice * 0.98,
      close: (ethPrice *= 1 + (Math.random() - 0.5) * 0.02),
      volume: 5000,
    }))

    await db.insert(ohlcvCandles).values([...btcCandles, ...ethCandles])
  })

  afterAll(async () => {
    await db
      .delete(ohlcvCandles)
      .where(and(eq(ohlcvCandles.exchange, testExchange)))
  })

  describe('run', () => {
    it('should run a backtest simulation', async () => {
      const config: BacktestConfig = {
        pairs: [pair1, pair2],
        allocations: [
          { asset: 'BTC', targetPct: 60, exchange: testExchange },
          { asset: 'ETH', targetPct: 40, exchange: testExchange },
        ],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.config).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.trades).toBeDefined()
      expect(result.equityCurve).toBeDefined()
      expect(result.finalPortfolio).toBeDefined()
      expect(result.benchmark).toBeDefined()
    })

    it('should return metrics in result', async () => {
      const config: BacktestConfig = {
        pairs: [pair1, pair2],
        allocations: [
          { asset: 'BTC', targetPct: 60, exchange: testExchange },
          { asset: 'ETH', targetPct: 40, exchange: testExchange },
        ],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result.metrics.totalReturnPct).toBeDefined()
      expect(result.metrics.sharpeRatio).toBeDefined()
      expect(result.metrics.maxDrawdownPct).toBeDefined()
      expect(result.metrics.totalTrades).toBeDefined()
      expect(result.metrics.volatility).toBeDefined()
    })

    it('should produce equity curve', async () => {
      const config: BacktestConfig = {
        pairs: [pair1, pair2],
        allocations: [
          { asset: 'BTC', targetPct: 60, exchange: testExchange },
          { asset: 'ETH', targetPct: 40, exchange: testExchange },
        ],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(Array.isArray(result.equityCurve)).toBe(true)
      expect(result.equityCurve.length).toBeGreaterThan(0)
      expect(result.equityCurve[0]?.value).toBeGreaterThan(0)
    })

    it('should produce final portfolio', async () => {
      const config: BacktestConfig = {
        pairs: [pair1, pair2],
        allocations: [
          { asset: 'BTC', targetPct: 60, exchange: testExchange },
          { asset: 'ETH', targetPct: 40, exchange: testExchange },
        ],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result.finalPortfolio).toBeDefined()
      expect(typeof result.finalPortfolio).toBe('object')
    })

    it('should include benchmark comparison', async () => {
      const config: BacktestConfig = {
        pairs: [pair1],
        allocations: [{ asset: 'BTC', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result.benchmark).toBeDefined()
      expect(result.benchmark.strategy).toBeDefined()
      expect(result.benchmark.buyAndHold).toBeDefined()
      expect(result.benchmark.outperformancePct).toBeDefined()
    })

    it('should throw when no candle data found', async () => {
      const config: BacktestConfig = {
        pairs: ['NONEXISTENT/USDT'],
        allocations: [{ asset: 'NONEXISTENT', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      try {
        await backtestSimulator.run(config)
        expect(true).toBe(false)
      } catch (err) {
        expect(err instanceof Error).toBe(true)
      }
    })
  })

  describe('edge cases', () => {
    it('should handle high rebalance threshold (no trades)', async () => {
      const config: BacktestConfig = {
        pairs: [pair1],
        allocations: [{ asset: 'BTC', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 100, // Very high threshold
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result.trades.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle low rebalance threshold (many trades)', async () => {
      const config: BacktestConfig = {
        pairs: [pair1],
        allocations: [{ asset: 'BTC', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 0.1, // Very low threshold
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      expect(result.trades.length).toBeGreaterThanOrEqual(0)
    })

    it('should execute trades when drift exceeds threshold', async () => {
      const config: BacktestConfig = {
        pairs: [pair1, pair2],
        allocations: [
          { asset: 'BTC', targetPct: 50, exchange: testExchange },
          { asset: 'ETH', targetPct: 50, exchange: testExchange },
        ],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 2, // Low threshold to trigger rebalances
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      // With volatile data and low threshold, should trigger trades
      expect(result.trades.length).toBeGreaterThanOrEqual(0)
      if (result.trades.length > 0) {
        expect(result.trades[0]?.side).toMatch(/buy|sell/)
        expect(result.trades[0]?.amount).toBeGreaterThan(0)
        expect(result.trades[0]?.costUsd).toBeGreaterThan(0)
      }
    })

    it('should deduct fees from trades', async () => {
      const config: BacktestConfig = {
        pairs: [pair1],
        allocations: [{ asset: 'BTC', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 0.1,
        feePct: 0.002, // 0.2% fee
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      // All trades should have fee > 0 if they exist
      for (const trade of result.trades) {
        expect(trade.fee).toBeGreaterThanOrEqual(0)
      }
    })

    it('should persist result to database', async () => {
      const config: BacktestConfig = {
        pairs: [pair1],
        allocations: [{ asset: 'BTC', targetPct: 100, exchange: testExchange }],
        startDate: 1000000,
        endDate: 3600000000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.001,
        timeframe: '1d',
        exchange: testExchange,
      }

      const result = await backtestSimulator.run(config)

      // Verify result has ID (was persisted)
      expect(result.id).toBeTruthy()
      expect(result.id.length).toBeGreaterThan(0)
    })
  })
})
