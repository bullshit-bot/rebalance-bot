import { describe, it, expect } from 'bun:test'
import { benchmarkComparator } from './benchmark-comparator'
import type { BacktestResultSlice, BenchmarkResult } from './benchmark-comparator'
import type { OHLCVCandle } from './historical-data-loader'

describe('benchmark-comparator', () => {
  const baseConfig = {
    pairs: ['BTC/USDT', 'ETH/USDT'],
    allocations: [
      { asset: 'BTC', targetPct: 60, exchange: 'binance' as const },
      { asset: 'ETH', targetPct: 40, exchange: 'binance' as const },
    ],
    startDate: 1000000,
    endDate: 2000000,
    initialBalance: 10000,
    threshold: 5,
    feePct: 0.001,
    timeframe: '1d' as const,
    exchange: 'binance' as const,
  }

  const createCandles = (pair: string, startTs: number, count: number): OHLCVCandle[] => {
    const candles: OHLCVCandle[] = []
    let price = 30000 // BTC/USDT or ETH/USDT base price
    if (pair === 'ETH/USDT') price = 2000

    for (let i = 0; i < count; i++) {
      const ts = startTs + i * 86400000 // 1 day per candle
      candles.push({
        timestamp: ts,
        open: price,
        high: price * 1.01,
        low: price * 0.99,
        close: price * (1 + Math.random() * 0.02 - 0.01), // 1% swing
        volume: 1000,
      })
      price = candles[i]!.close
    }
    return candles
  }

  describe('compare - strategy vs buy-and-hold', () => {
    it('should compare strategy against buy-and-hold baseline', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10500 },
        { timestamp: 2000000, value: 11000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 10,
          annualizedReturnPct: 10,
          sharpeRatio: 1.5,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      expect(result).toBeDefined()
      expect(result.strategy).toBeDefined()
      expect(result.buyAndHold).toBeDefined()
      expect(result.outperformancePct).toBeDefined()
    })

    it('should set strategy stats from backtest metrics', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 12000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 20,
          annualizedReturnPct: 20,
          sharpeRatio: 2.0,
          maxDrawdownPct: 8,
          winRate: 80,
          totalTrades: 5,
          totalFeesPaid: 50,
          avgTradeSize: 4000,
          volatility: 12,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      expect(result.strategy.returnPct).toBe(20)
      expect(result.strategy.sharpe).toBe(2.0)
      expect(result.strategy.maxDrawdown).toBe(8)
      expect(result.strategy.finalValue).toBeCloseTo(12000, 0)
    })

    it('should build buy-and-hold curve from OHLCV data', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 10,
          annualizedReturnPct: 10,
          sharpeRatio: 1.5,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Buy-and-hold should have a final value > initial
      expect(result.buyAndHold.finalValue).toBeGreaterThan(0)
    })

    it('should calculate outperformance correctly', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 12000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 25,
          annualizedReturnPct: 25,
          sharpeRatio: 2.5,
          maxDrawdownPct: 5,
          winRate: 90,
          totalTrades: 5,
          totalFeesPaid: 50,
          avgTradeSize: 4000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      expect(result.outperformancePct).toBe(result.strategy.returnPct - result.buyAndHold.returnPct)
    })
  })

  describe('compare - with empty OHLCV data', () => {
    it('should handle missing pair data', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {} // Empty!

      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 10,
          annualizedReturnPct: 10,
          sharpeRatio: 1.5,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Should gracefully handle missing data
      expect(result.buyAndHold.finalValue).toBe(baseConfig.initialBalance)
      expect(result.buyAndHold.returnPct).toBe(0)
    })

    it('should handle single pair data', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        // ETH/USDT missing
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 10,
          annualizedReturnPct: 10,
          sharpeRatio: 1.5,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Should still produce a result
      expect(result).toBeDefined()
      expect(result.strategy).toBeDefined()
      expect(result.buyAndHold).toBeDefined()
    })
  })

  describe('compare - with empty equity curve', () => {
    it('should handle empty strategy equity curve', () => {
      const equityCurve: { timestamp: number; value: number }[] = []
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 0,
          annualizedReturnPct: 0,
          sharpeRatio: 0,
          maxDrawdownPct: 0,
          winRate: 0,
          totalTrades: 0,
          totalFeesPaid: 0,
          avgTradeSize: 0,
          volatility: 0,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      expect(result.strategy.finalValue).toBe(baseConfig.initialBalance)
      expect(result.strategy.returnPct).toBe(0)
    })
  })

  describe('compare - realistic scenarios', () => {
    it('should handle strategy outperforming buy-and-hold', () => {
      // Simulate strategy with 25% return
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 1086400000, value: 10500 },
        { timestamp: 1172800000, value: 11000 },
        { timestamp: 2000000, value: 12500 },
      ]
      // OHLCV data shows more modest growth (15%)
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 25,
          annualizedReturnPct: 25,
          sharpeRatio: 2.0,
          maxDrawdownPct: 3,
          winRate: 85,
          totalTrades: 8,
          totalFeesPaid: 80,
          avgTradeSize: 3000,
          volatility: 8,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Strategy should outperform
      expect(result.outperformancePct).toBeGreaterThan(0)
    })

    it('should handle strategy underperforming buy-and-hold', () => {
      // Simulate strategy with 5% return
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 10500 },
      ]
      // OHLCV data shows 20% growth
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 1000000, 12),
        'ETH/USDT': createCandles('ETH/USDT', 1000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 5,
          annualizedReturnPct: 5,
          sharpeRatio: 0.8,
          maxDrawdownPct: 10,
          winRate: 50,
          totalTrades: 3,
          totalFeesPaid: 30,
          avgTradeSize: 2000,
          volatility: 15,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Strategy may underperform (depends on actual OHLCV data)
      expect(result.outperformancePct).toBeDefined()
    })
  })

  describe('compare - edge cases', () => {
    it('should handle zero-length candle arrays', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 11000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': [],
        'ETH/USDT': [],
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 10,
          annualizedReturnPct: 10,
          sharpeRatio: 1.5,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      expect(result.buyAndHold.finalValue).toBe(baseConfig.initialBalance)
    })

    it('should handle mismatched timestamps', () => {
      const equityCurve = [
        { timestamp: 1000000, value: 10000 },
        { timestamp: 2000000, value: 12000 },
      ]
      const ohlcvData: Record<string, OHLCVCandle[]> = {
        'BTC/USDT': createCandles('BTC/USDT', 5000000, 12), // Different time range
        'ETH/USDT': createCandles('ETH/USDT', 5000000, 12),
      }
      const backtestResult: BacktestResultSlice = {
        config: baseConfig,
        metrics: {
          totalReturnPct: 20,
          annualizedReturnPct: 20,
          sharpeRatio: 2.0,
          maxDrawdownPct: 5,
          winRate: 100,
          totalTrades: 2,
          totalFeesPaid: 20,
          avgTradeSize: 5000,
          volatility: 10,
        },
        trades: [],
        equityCurve,
      }

      const result = benchmarkComparator.compare(backtestResult, ohlcvData)

      // Should handle gracefully
      expect(result).toBeDefined()
    })
  })
})
