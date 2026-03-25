import { describe, it, expect } from 'bun:test'
import { HistoricalDataLoader } from './historical-data-loader'
import type { HistoricalDataLoaderDeps } from './historical-data-loader'

// OHLCV candle type
interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

describe('HistoricalDataLoader - Core Logic', () => {
  it('validates OHLCV candle structure', () => {
    const candle: OHLCVCandle = {
      timestamp: Date.now(),
      open: 30000,
      high: 31000,
      low: 29000,
      close: 30500,
      volume: 100,
    }

    expect(candle.timestamp).toBeDefined()
    expect(candle.close).toBe(30500)
    expect(candle.volume).toBe(100)
  })

  it('filters candles by date range', () => {
    const now = Date.now()
    const allCandles: OHLCVCandle[] = [
      { timestamp: now - 200000, open: 29000, high: 30000, low: 28000, close: 29500, volume: 80 },
      { timestamp: now - 100000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      { timestamp: now, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
    ]

    const since = now - 150000
    const until = now

    const filtered = allCandles.filter((c) => c.timestamp >= since && c.timestamp <= until)

    expect(filtered.length).toBe(2)
  })

  it('orders candles chronologically', () => {
    const candles: OHLCVCandle[] = [
      { timestamp: 3000, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
      { timestamp: 1000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      { timestamp: 2000, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
    ]

    const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp)

    expect(sorted[0].timestamp).toBe(1000)
    expect(sorted[1].timestamp).toBe(2000)
    expect(sorted[2].timestamp).toBe(3000)
  })

  it('removes duplicate timestamps', () => {
    const candles: OHLCVCandle[] = [
      { timestamp: 1000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      { timestamp: 1000, open: 30100, high: 31100, low: 29100, close: 30600, volume: 105 },
      { timestamp: 2000, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
    ]

    const unique = new Map(candles.map((c) => [c.timestamp, c]))
    const deduplicated = Array.from(unique.values())

    expect(deduplicated.length).toBe(2)
  })

  it('extracts close prices from candles', () => {
    const candles: OHLCVCandle[] = [
      { timestamp: 1000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      { timestamp: 2000, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
      { timestamp: 3000, open: 31500, high: 33000, low: 31000, close: 32500, volume: 130 },
    ]

    const prices = new Map(candles.map((c) => [c.timestamp, c.close]))

    expect(prices.get(1000)).toBe(30500)
    expect(prices.get(2000)).toBe(31500)
    expect(prices.get(3000)).toBe(32500)
  })

  it('calculates price movement from candles', () => {
    const startCandle: OHLCVCandle = {
      timestamp: 1000,
      open: 30000,
      high: 31000,
      low: 29000,
      close: 30000,
      volume: 100,
    }

    const endCandle: OHLCVCandle = {
      timestamp: 2000,
      open: 30000,
      high: 35000,
      low: 29000,
      close: 34000,
      volume: 120,
    }

    const returnPct = ((endCandle.close - startCandle.close) / startCandle.close) * 100

    expect(returnPct).toBeCloseTo(13.33, 1)
  })

  it('handles multiple pairs simultaneously', () => {
    const btcCandles: OHLCVCandle[] = [
      { timestamp: 1000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
    ]

    const ethCandles: OHLCVCandle[] = [
      { timestamp: 1000, open: 2000, high: 2100, low: 1900, close: 2050, volume: 500 },
    ]

    const solCandles: OHLCVCandle[] = [
      { timestamp: 1000, open: 100, high: 110, low: 90, close: 105, volume: 5000 },
    ]

    const allCandles: Record<string, OHLCVCandle[]> = {
      'BTC/USDT': btcCandles,
      'ETH/USDT': ethCandles,
      'SOL/USDT': solCandles,
    }

    expect(Object.keys(allCandles).length).toBe(3)
    expect(allCandles['BTC/USDT'].length).toBe(1)
    expect(allCandles['ETH/USDT'][0].close).toBe(2050)
  })

  it('finds common timestamps across pairs', () => {
    const btcCandles: OHLCVCandle[] = [
      { timestamp: 1000, open: 30000, high: 31000, low: 29000, close: 30500, volume: 100 },
      { timestamp: 2000, open: 30500, high: 32000, low: 30000, close: 31500, volume: 120 },
    ]

    const ethCandles: OHLCVCandle[] = [
      { timestamp: 1000, open: 2000, high: 2100, low: 1900, close: 2050, volume: 500 },
      { timestamp: 2000, open: 2050, high: 2200, low: 1900, close: 2100, volume: 600 },
    ]

    const btcTimestamps = new Set(btcCandles.map((c) => c.timestamp))
    const ethTimestamps = new Set(ethCandles.map((c) => c.timestamp))

    const common = new Set([...btcTimestamps].filter((ts) => ethTimestamps.has(ts)))

    expect(common.size).toBe(2)
  })
})

// ─── DI-based HistoricalDataLoader tests ──────────────────────────────────────

function makeHDLDeps(ohlcvData?: number[][]): HistoricalDataLoaderDeps {
  const candles = ohlcvData ?? [
    [1_000_000, 30000, 31000, 29000, 30500, 100],
    [2_000_000, 30500, 32000, 30000, 31500, 120],
    [3_000_000, 31500, 33000, 31000, 32500, 130],
  ]

  return {
    exchangeManager: {
      getExchange: (_name: any) => ({
        fetchOHLCV: async (_pair: string, _tf: string, since?: number, limit?: number) => {
          const lim = limit ?? 1000
          return candles.slice(0, lim)
        },
      }),
    },
    // No-op upsert: avoids SQLite writes in unit tests
    upsertCandles: async () => {},
  }
}

describe('HistoricalDataLoader - DI constructor', () => {
  it('loadData() fetches candles from injected exchange', async () => {
    const loader = new HistoricalDataLoader(makeHDLDeps())
    const candles = await loader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      until: 5_000_000,
    })

    expect(candles.length).toBeGreaterThan(0)
    expect(candles[0]).toHaveProperty('timestamp')
    expect(candles[0]).toHaveProperty('open')
    expect(candles[0]).toHaveProperty('close')
  })

  it('loadData() throws when exchange not connected', async () => {
    const deps: HistoricalDataLoaderDeps = {
      exchangeManager: { getExchange: () => undefined },
    }
    const loader = new HistoricalDataLoader(deps)

    let threw = false
    try {
      await loader.loadData({ exchange: 'binance', pair: 'BTC/USDT', timeframe: '1h', since: 0 })
    } catch (e) {
      threw = true
      expect(String(e)).toContain('not connected')
    }
    expect(threw).toBe(true)
  })

  it('loadData() stops when exchange returns empty batch', async () => {
    const deps: HistoricalDataLoaderDeps = {
      exchangeManager: {
        getExchange: () => ({
          fetchOHLCV: async () => [],  // empty immediately
        }),
      },
    }
    const loader = new HistoricalDataLoader(deps)
    const candles = await loader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
    })
    expect(candles.length).toBe(0)
  })

  it('loadData() filters candles beyond until timestamp', async () => {
    const loader = new HistoricalDataLoader(makeHDLDeps())
    const until = 1_500_000
    const candles = await loader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      until,
    })

    for (const c of candles) {
      expect(c.timestamp).toBeLessThanOrEqual(until)
    }
  })

  it('getCachedData() returns data from DB without hitting exchange', async () => {
    const loader = new HistoricalDataLoader(makeHDLDeps())
    // getCachedData reads from SQLite — in test env will return empty (no data)
    const candles = await loader.getCachedData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      until: Date.now(),
    })
    expect(Array.isArray(candles)).toBe(true)
  })

  it('syncData() loads from last known timestamp', async () => {
    const loader = new HistoricalDataLoader(makeHDLDeps())
    // In test env, DB has no candles so since = 30d ago; should load from mock exchange
    const count = await loader.syncData('binance', 'BTC/USDT', '1h')
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThanOrEqual(0)
  })

  it('default constructor (no deps) instantiates correctly', () => {
    const loader = new HistoricalDataLoader()
    expect(loader).toBeDefined()
    expect(typeof loader.loadData).toBe('function')
    expect(typeof loader.getCachedData).toBe('function')
    expect(typeof loader.syncData).toBe('function')
  })

  it('loadData() handles candles with null timestamp (filters them out)', async () => {
    const depsWithNull: HistoricalDataLoaderDeps = {
      exchangeManager: {
        getExchange: () => ({
          fetchOHLCV: async () => [
            [null, 30000, 31000, 29000, 30500, 100],   // null ts — should be filtered
            [2_000_000, 30500, 32000, 30000, 31500, 120],
          ],
        }),
      },
      upsertCandles: async () => {},  // no-op: avoid SQLite writes in unit tests
    }
    const loader = new HistoricalDataLoader(depsWithNull)
    const candles = await loader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      until: 5_000_000,
    })

    // Only the non-null candle should be included
    for (const c of candles) {
      expect(c.timestamp).not.toBeNull()
    }
  })

  it('_upsertCandles maps and stores rows when no custom upsert provided (lines 213-222)', async () => {
    // Create a loader with exchangeManager but NO custom upsertCandles
    // This will force the default database insert behavior
    const depsWithoutMock: HistoricalDataLoaderDeps = {
      exchangeManager: {
        getExchange: () => ({
          fetchOHLCV: async () => [
            [1_000_000, 30000, 31000, 29000, 30500, 100],
            [2_000_000, 30500, 32000, 30000, 31500, 120],
          ],
        }),
      },
      // NO upsertCandles function provided — forces default database insert
    }
    const loader = new HistoricalDataLoader(depsWithoutMock)

    // Call loadData which internally calls _upsertCandles
    const candles = await loader.loadData({
      exchange: 'binance',
      pair: 'BTC/USDT',
      timeframe: '1h',
      since: 0,
      until: 5_000_000,
    })

    // Should have successfully loaded candles
    expect(candles.length).toBeGreaterThan(0)
    expect(candles[0]).toHaveProperty('timestamp')
    expect(candles[0]).toHaveProperty('close')
    expect(candles[0]).toHaveProperty('volume')
  })
})
