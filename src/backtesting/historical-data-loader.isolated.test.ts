import { describe, it, expect, beforeEach, mock } from 'bun:test'

const mockExchange = {
  id: 'binance',
  fetchOHLCV: async (pair: string, timeframe: string, since?: number, limit?: number) => {
    const now = Date.now()
    const bars = limit ?? 10
    const interval = timeframe === '1d' ? 86400000 : 3600000
    const candles: number[][] = []
    for (let i = 0; i < bars; i++) {
      const timestamp = (since ?? now - bars * interval) + i * interval
      candles.push([
        timestamp,
        48000 + Math.random() * 2000,
        49000,
        47000,
        48500,
        1000 + Math.random() * 500,
      ])
    }
    return candles
  },
  loadMarkets: async () => ({}),
  close: async () => {},
}

mock.module('@exchange/exchange-manager', () => ({
  exchangeManager: {
    getExchange: () => mockExchange,
    getEnabledExchanges: () => new Map([['binance', mockExchange]]),
  },
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

import { historicalDataLoader } from './historical-data-loader'

describe('HistoricalDataLoader', () => {
  it('should load historical data', async () => {
    const candles = await historicalDataLoader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      startDate: new Date(Date.now() - 24 * 3600000),
      endDate: new Date(),
    })
    expect(candles).toBeDefined()
    expect(Array.isArray(candles)).toBe(true)
  })

  it('should load multiple timeframes', async () => {
    const candles = await historicalDataLoader.loadData({
      exchange: 'binance',
      pair: 'ETH/USDT',
      timeframe: '1d',
      startDate: new Date(Date.now() - 30 * 86400000),
      endDate: new Date(),
    })
    expect(Array.isArray(candles)).toBe(true)
  })
})
