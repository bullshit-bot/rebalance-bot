import { describe, it, expect, beforeEach } from 'bun:test'
import { BenchmarkComparator, type BenchmarkResult } from './benchmark-comparator'
import type { BacktestConfig, BacktestMetrics, SimulatedTrade } from './metrics-calculator'
import type { OHLCVCandle } from './historical-data-loader'

let comparator: BenchmarkComparator

beforeEach(() => {
  comparator = new BenchmarkComparator()
})

describe('BenchmarkComparator', () => {
  it('compares strategy to buy-and-hold baseline', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 10500 },
      { timestamp: now + 2 * dayMs, value: 11000 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 10,
      annualizedReturnPct: 15,
      sharpeRatio: 1.5,
      maxDrawdownPct: 2,
      winRate: 80,
      totalTrades: 5,
      totalFeesPaid: 50,
      avgTradeSize: 2000,
      volatility: 8,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 2 * dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 32000, low: 29000, close: 31500, volume: 120 },
        { timestamp: now + 2 * dayMs, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.strategy).toBeDefined()
    expect(result.buyAndHold).toBeDefined()
    expect(result.outperformancePct).toBeDefined()
  })

  it('calculates outperformance correctly', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 11000 },
      { timestamp: now + 2 * dayMs, value: 12000 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 20, // Strategy returns 20%
      annualizedReturnPct: 20,
      sharpeRatio: 1,
      maxDrawdownPct: 5,
      winRate: 100,
      totalTrades: 2,
      totalFeesPaid: 10,
      avgTradeSize: 1000,
      volatility: 5,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 2 * dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 32000, low: 29000, close: 31500, volume: 120 },
        { timestamp: now + 2 * dayMs, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    // Buy-and-hold from 30k to 32.5k = 8.33% return
    // Outperformance = 20% - 8.33% = ~11.67%
    expect(result.outperformancePct).toBeGreaterThan(5)
  })

  it('handles underperforming strategy', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 10200 },
      { timestamp: now + 2 * dayMs, value: 10500 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 5, // Strategy returns 5%
      annualizedReturnPct: 5,
      sharpeRatio: 0.5,
      maxDrawdownPct: 3,
      winRate: 50,
      totalTrades: 3,
      totalFeesPaid: 30,
      avgTradeSize: 1000,
      volatility: 10,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 2 * dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 33000, low: 29000, close: 32500, volume: 120 },
        { timestamp: now + 2 * dayMs, open: 32500, high: 34000, low: 32000, close: 33500, volume: 130 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    // Buy-and-hold returns ~11.67%
    // Strategy underperforms: 5% - 11.67% = negative
    expect(result.outperformancePct).toBeLessThan(0)
  })

  it('builds buy-and-hold equity curve', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 10500 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 5,
      annualizedReturnPct: 5,
      sharpeRatio: 1,
      maxDrawdownPct: 0,
      winRate: 100,
      totalTrades: 0,
      totalFeesPaid: 0,
      avgTradeSize: 0,
      volatility: 0,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT', 'ETH/USDT'],
      allocations: [
        { asset: 'BTC', targetPct: 60, exchange: 'binance' },
        { asset: 'ETH', targetPct: 40, exchange: 'binance' },
      ],
      startDate: now,
      endDate: now + dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 32000, low: 29000, close: 31500, volume: 120 },
      ],
      'ETH/USDT': [
        { timestamp: now, open: 2000, high: 2100, low: 1900, close: 2000, volume: 500 },
        { timestamp: now + dayMs, open: 2000, high: 2200, low: 1900, close: 2100, volume: 600 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.buyAndHold.finalValue).toBeGreaterThan(0)
    expect(result.buyAndHold.returnPct).toBeGreaterThan(0)
  })

  it('compares Sharpe ratios', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 10100 },
      { timestamp: now + 2 * dayMs, value: 10300 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 3,
      annualizedReturnPct: 3,
      sharpeRatio: 2, // High risk-adjusted return
      maxDrawdownPct: 1,
      winRate: 100,
      totalTrades: 2,
      totalFeesPaid: 5,
      avgTradeSize: 500,
      volatility: 1.5,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 2 * dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 32000, low: 29000, close: 31500, volume: 120 },
        { timestamp: now + 2 * dayMs, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.strategy.sharpe).toBe(2)
  })

  it('compares max drawdowns', () => {
    const now = Date.now()
    const dayMs = 86400000

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + dayMs, value: 10500 },
      { timestamp: now + 2 * dayMs, value: 10200 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 2,
      annualizedReturnPct: 2,
      sharpeRatio: 1,
      maxDrawdownPct: 2.86, // (10500 - 10200) / 10500 = ~2.86%
      winRate: 50,
      totalTrades: 1,
      totalFeesPaid: 5,
      avgTradeSize: 1000,
      volatility: 5,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 2 * dayMs,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 32000, low: 29000, close: 31500, volume: 120 },
        { timestamp: now + 2 * dayMs, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.strategy.maxDrawdown).toBeCloseTo(2.86, 1)
    expect(result.buyAndHold.maxDrawdown).toBeGreaterThanOrEqual(0)
  })

  it('handles empty OHLCV data gracefully', () => {
    const now = Date.now()

    const strategyEquityCurve = [
      { timestamp: now, value: 10000 },
      { timestamp: now + 86400000, value: 11000 },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 10,
      annualizedReturnPct: 10,
      sharpeRatio: 1,
      maxDrawdownPct: 0,
      winRate: 100,
      totalTrades: 0,
      totalFeesPaid: 0,
      avgTradeSize: 0,
      volatility: 0,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 86400000,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {}

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.buyAndHold.finalValue).toBe(config.initialBalance)
  })

  it('uses initial balance when no equity curve', () => {
    const now = Date.now()

    const strategyEquityCurve: { timestamp: number; value: number }[] = []

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 0,
      annualizedReturnPct: 0,
      sharpeRatio: 0,
      maxDrawdownPct: 0,
      winRate: 0,
      totalTrades: 0,
      totalFeesPaid: 0,
      avgTradeSize: 0,
      volatility: 0,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + 86400000,
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.strategy.finalValue).toBe(config.initialBalance)
  })

  it('calculates final values correctly', () => {
    const now = Date.now()
    const dayMs = 86400000

    const initialBalance = 10000
    const finalValue = 12500

    const strategyEquityCurve = [
      { timestamp: now, value: initialBalance },
      { timestamp: now + dayMs, value: finalValue },
    ]

    const strategyMetrics: BacktestMetrics = {
      totalReturnPct: 25,
      annualizedReturnPct: 25,
      sharpeRatio: 1,
      maxDrawdownPct: 0,
      winRate: 100,
      totalTrades: 1,
      totalFeesPaid: 10,
      avgTradeSize: 5000,
      volatility: 5,
    }

    const trades: SimulatedTrade[] = []

    const config: BacktestConfig = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100, exchange: 'binance' }],
      startDate: now,
      endDate: now + dayMs,
      initialBalance,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1d',
      exchange: 'binance',
    }

    const ohlcvData: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': [
        { timestamp: now, open: 30000, high: 31000, low: 29000, close: 30000, volume: 100 },
        { timestamp: now + dayMs, open: 30000, high: 33000, low: 29000, close: 33000, volume: 120 },
      ],
    }

    const result = comparator.compare(
      { config, metrics: strategyMetrics, trades, equityCurve: strategyEquityCurve },
      ohlcvData,
    )

    expect(result.strategy.finalValue).toBe(finalValue)
    expect(result.strategy.returnPct).toBeCloseTo(25, 1)
  })
})
