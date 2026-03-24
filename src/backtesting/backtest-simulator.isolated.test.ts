import { describe, it, expect, beforeEach, mock } from 'bun:test'

const mockLoader = {
  loadData: async () => [
    { timestamp: Date.now() - 86400000, open: 48000, high: 49000, low: 47000, close: 48500, volume: 1000 },
    { timestamp: Date.now() - 3600000, open: 48500, high: 49500, low: 47500, close: 49000, volume: 1100 },
    { timestamp: Date.now(), open: 49000, high: 49500, low: 48500, close: 49250, volume: 1200 },
  ],
  getCachedData: async () => [],
}

mock.module('./historical-data-loader', () => ({
  historicalDataLoader: mockLoader,
}))

mock.module('@db/database', () => ({
  db: {
    query: async () => [],
    insert: () => ({ values: async () => ({}) }),
  },
}))

mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: () => {},
  },
}))

import { backtestSimulator } from './backtest-simulator'

describe('BacktestSimulator', () => {
  it('should create simulator instance', () => {
    expect(backtestSimulator).toBeDefined()
  })

  it('should run backtest with config', async () => {
    const config = {
      pairs: ['BTC/USDT'],
      allocations: [{ asset: 'BTC', targetPct: 100 }],
      startDate: Date.now() - 7 * 86400000,
      endDate: Date.now(),
      initialBalance: 10000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1h' as const,
      exchange: 'binance' as const,
    }

    const result = await backtestSimulator.run(config)
    expect(result).toBeDefined()
    expect(typeof result.metrics.totalReturnPct).toBe('number')
  })

  it('should calculate backtest metrics', async () => {
    const config = {
      pairs: ['ETH/USDT'],
      allocations: [{ asset: 'ETH', targetPct: 100 }],
      startDate: Date.now() - 3 * 86400000,
      endDate: Date.now(),
      initialBalance: 5000,
      threshold: 5,
      feePct: 0.001,
      timeframe: '1h' as const,
      exchange: 'binance' as const,
    }

    const result = await backtestSimulator.run(config)
    expect(result.trades).toBeDefined()
  })
})
