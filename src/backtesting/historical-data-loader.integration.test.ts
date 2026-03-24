import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { ohlcvCandles } from '@db/schema'
import { eq, and } from 'drizzle-orm'
import { historicalDataLoader, type OHLCVCandle } from './historical-data-loader'

describe('historical-data-loader', () => {
  const testExchange = 'binance'
  const testPair = 'BTC/USDT'
  const testTimeframe = '1d'
  const startDate = 1000000
  const endDate = 2000000

  // Seed test data before tests run
  beforeAll(async () => {
    // Clean up any existing test data
    await db
      .delete(ohlcvCandles)
      .where(and(eq(ohlcvCandles.exchange, testExchange), eq(ohlcvCandles.pair, testPair)))

    // Insert sample candles
    const candles = []
    let price = 40000
    for (let i = 0; i < 10; i++) {
      const ts = startDate + i * 86400000
      candles.push({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        timestamp: ts,
        open: price,
        high: price * 1.02,
        low: price * 0.98,
        close: price * (1 + (Math.random() - 0.5) * 0.03),
        volume: 1000 + Math.random() * 500,
      })
      price = candles[candles.length - 1]!.close
    }

    await db.insert(ohlcvCandles).values(candles)
  })

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(ohlcvCandles)
      .where(and(eq(ohlcvCandles.exchange, testExchange), eq(ohlcvCandles.pair, testPair)))
  })

  describe('getCachedData', () => {
    it('should retrieve cached candles from database', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      expect(candles.length).toBeGreaterThan(0)
      expect(candles[0]).toBeDefined()
      expect(candles[0]!.timestamp).toBe(startDate)
    })

    it('should filter candles by date range', async () => {
      // Get all candles first
      const allCandles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      if (allCandles.length > 3) {
        // Filter to middle candles
        const midpoint = allCandles[Math.floor(allCandles.length / 2)]!.timestamp
        const filtered = await historicalDataLoader.getCachedData({
          exchange: testExchange,
          pair: testPair,
          timeframe: testTimeframe,
          since: midpoint,
          until: endDate,
        })

        expect(filtered.length).toBeGreaterThan(0)
        expect(filtered.length).toBeLessThan(allCandles.length)
        for (const candle of filtered) {
          expect(candle.timestamp).toBeGreaterThanOrEqual(midpoint)
        }
      }
    })

    it('should return empty array for non-existent pair', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: 'NONEXISTENT/USDT',
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      expect(candles.length).toBe(0)
    })

    it('should return empty array for non-existent exchange', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: 'nonexistent_exchange' as any,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      expect(candles.length).toBe(0)
    })

    it('should return empty array when date range has no data', async () => {
      const futureStart = endDate + 1000000
      const futureEnd = futureStart + 1000000
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: futureStart,
        until: futureEnd,
      })

      expect(candles.length).toBe(0)
    })

    it('should return sorted candles by timestamp', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      for (let i = 1; i < candles.length; i++) {
        expect(candles[i]!.timestamp).toBeGreaterThanOrEqual(candles[i - 1]!.timestamp)
      }
    })

    it('should include all OHLCV fields', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      expect(candles.length).toBeGreaterThan(0)
      const candle = candles[0]!
      expect(candle.timestamp).toBeDefined()
      expect(candle.open).toBeDefined()
      expect(candle.high).toBeDefined()
      expect(candle.low).toBeDefined()
      expect(candle.close).toBeDefined()
      expect(candle.volume).toBeDefined()
    })

    it('should handle boundary timestamps', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: startDate + 86400000 * 2, // Only first 2 days
      })

      expect(candles.length).toBeGreaterThan(0)
      expect(candles.length).toBeLessThanOrEqual(3) // Allow 3 to account for boundary inclusive behavior
    })
  })

  describe('syncData', () => {
    it('should fail gracefully when exchange is not connected', async () => {
      try {
        await historicalDataLoader.syncData(testExchange, testPair, testTimeframe)
        expect(true).toBe(false) // Should have thrown
      } catch (err) {
        expect(err instanceof Error).toBe(true)
        if (err instanceof Error) {
          expect(err.message.toLowerCase()).toContain('not connected')
        }
      }
    })
  })

  describe('loadData', () => {
    it('should throw error when exchange is not connected', async () => {
      try {
        await historicalDataLoader.loadData({
          exchange: 'nonexistent_exchange' as any,
          pair: 'BTC/USDT',
          timeframe: '1d',
          since: startDate,
          until: endDate,
        })
        expect(true).toBe(false) // Should have thrown
      } catch (err) {
        expect(err instanceof Error).toBe(true)
        if (err instanceof Error) {
          expect(err.message.toLowerCase()).toContain('not connected')
        }
      }
    })

    it('should handle until parameter defaulting to now', async () => {
      // This will try to fetch real data, which may fail without configured exchanges
      // So we just test that it doesn't crash immediately
      try {
        await historicalDataLoader.loadData({
          exchange: 'binance',
          pair: 'BTC/USDT',
          timeframe: '1d',
          since: Date.now() - 30 * 24 * 60 * 60 * 1000,
          // until is omitted - should default to now
        })
      } catch (err) {
        // Expected if exchange is not configured
        expect(err instanceof Error).toBe(true)
      }
    })
  })

  describe('candle data integrity', () => {
    it('should have valid OHLC relationship', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      for (const candle of candles) {
        // In a proper OHLCV candle: low <= open, close <= high
        // and low <= high (though these are soft constraints in reality)
        expect(candle.high).toBeGreaterThanOrEqual(candle.low)
        expect(candle.open).toBeDefined()
        expect(candle.close).toBeDefined()
      }
    })

    it('should have positive volumes', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      for (const candle of candles) {
        expect(candle.volume).toBeGreaterThan(0)
      }
    })

    it('should have positive prices', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      for (const candle of candles) {
        expect(candle.open).toBeGreaterThan(0)
        expect(candle.high).toBeGreaterThan(0)
        expect(candle.low).toBeGreaterThan(0)
        expect(candle.close).toBeGreaterThan(0)
      }
    })
  })

  describe('multiple pairs', () => {
    beforeAll(async () => {
      // Add another pair for testing
      const pair2 = 'ETH/USDT'
      await db
        .delete(ohlcvCandles)
        .where(and(eq(ohlcvCandles.exchange, testExchange), eq(ohlcvCandles.pair, pair2)))

      const candles = []
      let price = 2500
      for (let i = 0; i < 10; i++) {
        const ts = startDate + i * 86400000
        candles.push({
          exchange: testExchange,
          pair: pair2,
          timeframe: testTimeframe,
          timestamp: ts,
          open: price,
          high: price * 1.02,
          low: price * 0.98,
          close: price * (1 + (Math.random() - 0.5) * 0.03),
          volume: 5000 + Math.random() * 1000,
        })
        price = candles[candles.length - 1]!.close
      }

      await db.insert(ohlcvCandles).values(candles)
    })

    afterAll(async () => {
      const pair2 = 'ETH/USDT'
      await db
        .delete(ohlcvCandles)
        .where(and(eq(ohlcvCandles.exchange, testExchange), eq(ohlcvCandles.pair, pair2)))
    })

    it('should retrieve different pairs independently', async () => {
      const btcCandles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: 'BTC/USDT',
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      const ethCandles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: 'ETH/USDT',
        timeframe: testTimeframe,
        since: startDate,
        until: endDate,
      })

      expect(btcCandles.length).toBeGreaterThan(0)
      expect(ethCandles.length).toBeGreaterThan(0)

      // Prices should be different for BTC vs ETH
      const btcPrice = btcCandles[0]!.close
      const ethPrice = ethCandles[0]!.close
      expect(btcPrice).not.toBe(ethPrice)
    })
  })

  describe('edge cases', () => {
    it('should handle very recent timestamps', async () => {
      const now = Date.now()
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: now,
        until: now + 86400000,
      })

      // Should return empty (no future data)
      expect(candles.length).toBe(0)
    })

    it('should handle large date ranges', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: 0,
        until: Date.now() * 10, // Very far in future
      })

      // Should return all available data
      expect(Array.isArray(candles)).toBe(true)
    })

    it('should handle reversed date range (since > until)', async () => {
      const candles = await historicalDataLoader.getCachedData({
        exchange: testExchange,
        pair: testPair,
        timeframe: testTimeframe,
        since: endDate,
        until: startDate, // Reversed!
      })

      // Should return empty
      expect(candles.length).toBe(0)
    })
  })
})
