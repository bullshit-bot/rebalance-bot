import { and, eq, gte, lte, max } from 'drizzle-orm'
import { db } from '@db/database'
import { ohlcvCandles } from '@db/schema'
import { exchangeManager } from '@exchange/exchange-manager'
import type { ExchangeName } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OHLCVCandle {
  timestamp: number // unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Parameters for fetching OHLCV data (with optional exchange-level caching). */
interface LoadDataParams {
  exchange: ExchangeName
  pair: string
  timeframe: '1h' | '1d'
  since: number  // unix ms inclusive start
  until?: number // unix ms inclusive end; defaults to now
}

interface GetCachedDataParams {
  exchange: ExchangeName
  pair: string
  timeframe: '1h' | '1d'
  since: number  // unix ms
  until: number  // unix ms
}

/** Number of candles fetched per CCXT request (exchange limit is typically 1000). */
const FETCH_LIMIT = 1000

/** Delay between paginated API requests to respect exchange rate limits. */
const REQUEST_DELAY_MS = 1_000

// ─── HistoricalDataLoader ─────────────────────────────────────────────────────

/**
 * Loads and caches OHLCV candle data.
 *
 * Flow:
 *  1. loadData — fetch from exchange, persist to DB, return candles
 *  2. getCachedData — read from DB only
 *  3. syncData — incremental: find last cached ts → fetch only new candles
 */
class HistoricalDataLoader {
  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetches OHLCV candles from the exchange for [since, until], caches them in
   * the DB (upsert), and returns the full set.
   *
   * Uses paginated fetching (1000 candles per request) with a 1 s sleep between
   * pages to stay within exchange rate limits.
   */
  async loadData(params: LoadDataParams): Promise<OHLCVCandle[]> {
    const { exchange: exchangeName, pair, timeframe, since } = params
    const until = params.until ?? Date.now()

    const ccxtExchange = exchangeManager.getExchange(exchangeName)
    if (!ccxtExchange) {
      throw new Error(`[HistoricalDataLoader] Exchange '${exchangeName}' is not connected`)
    }

    const candles: OHLCVCandle[] = []
    let cursor = since

    // Paginate until we reach 'until' or the exchange returns no more data
    while (cursor < until) {
      const raw = await ccxtExchange.fetchOHLCV(pair, timeframe, cursor, FETCH_LIMIT)
      if (!raw || raw.length === 0) break

      const batch: OHLCVCandle[] = raw
        .filter((c): c is [number, number, number, number, number, number] => c[0] !== null)
        .filter(([ts]) => ts <= until)
        .map(([ts, open, high, low, close, volume]) => ({
          timestamp: ts,
          open,
          high,
          low,
          close,
          volume,
        }))

      if (batch.length === 0) break

      candles.push(...batch)

      // Advance cursor past the last candle we received
      const lastTs = raw[raw.length - 1]?.[0]
      if (lastTs === undefined || lastTs === null || lastTs <= cursor) break
      cursor = lastTs + 1

      // Persist this batch before moving on
      await this._upsertCandles(exchangeName, pair, timeframe, batch)

      // Respect rate limits between pages
      if (raw.length === FETCH_LIMIT && cursor < until) {
        await sleep(REQUEST_DELAY_MS)
      } else {
        break
      }
    }

    return candles
  }

  /**
   * Returns candles from the local DB cache for the given symbol and time range.
   * Does not hit the exchange.
   */
  async getCachedData(params: GetCachedDataParams): Promise<OHLCVCandle[]> {
    const { exchange: exchangeName, pair, timeframe, since, until } = params

    const rows = await db
      .select({
        timestamp: ohlcvCandles.timestamp,
        open: ohlcvCandles.open,
        high: ohlcvCandles.high,
        low: ohlcvCandles.low,
        close: ohlcvCandles.close,
        volume: ohlcvCandles.volume,
      })
      .from(ohlcvCandles)
      .where(
        and(
          eq(ohlcvCandles.exchange, exchangeName),
          eq(ohlcvCandles.pair, pair),
          eq(ohlcvCandles.timeframe, timeframe),
          gte(ohlcvCandles.timestamp, since),
          lte(ohlcvCandles.timestamp, until),
        ),
      )
      .orderBy(ohlcvCandles.timestamp)

    return rows
  }

  /**
   * Incrementally syncs candle data by finding the last cached timestamp and
   * fetching only newer candles from the exchange.
   *
   * @returns Number of new candles inserted.
   */
  async syncData(exchange: ExchangeName, pair: string, timeframe: '1h' | '1d'): Promise<number> {
    // Find the most recent cached timestamp for this series
    const [result] = await db
      .select({ lastTs: max(ohlcvCandles.timestamp) })
      .from(ohlcvCandles)
      .where(
        and(
          eq(ohlcvCandles.exchange, exchange),
          eq(ohlcvCandles.pair, pair),
          eq(ohlcvCandles.timeframe, timeframe),
        ),
      )

    // Default: if no cached data, start 30 days back
    const lastTs = result?.lastTs ?? Date.now() - 30 * 24 * 60 * 60 * 1_000
    const since = lastTs + 1 // exclusive of the last cached candle

    const candles = await this.loadData({ exchange, pair, timeframe, since })
    return candles.length
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Batch-upserts candles into the DB.
   * The unique index on (exchange, pair, timeframe, timestamp) makes ON CONFLICT
   * handled gracefully via drizzle's onConflictDoNothing.
   */
  private async _upsertCandles(
    exchange: ExchangeName,
    pair: string,
    timeframe: string,
    candles: OHLCVCandle[],
  ): Promise<void> {
    if (candles.length === 0) return

    const rows = candles.map((c) => ({
      exchange,
      pair,
      timeframe,
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }))

    await db.insert(ohlcvCandles).values(rows).onConflictDoNothing()
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide historical data loader singleton.
 *
 * @example
 * import { historicalDataLoader } from '@backtesting/historical-data-loader'
 * const candles = await historicalDataLoader.loadData({ exchange: 'binance', pair: 'BTC/USDT', timeframe: '1d', since: Date.now() - 90*24*60*60*1000 })
 */
export const historicalDataLoader = new HistoricalDataLoader()
