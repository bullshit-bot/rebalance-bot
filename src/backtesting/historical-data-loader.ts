import { OhlcvCandleModel } from '@db/database'
import { exchangeManager } from '@exchange/exchange-manager'
import type { ExchangeName } from '@/types/index'

// ─── Dependency injection ─────────────────────────────────────────────────────

export interface IExchangeLookupDep {
  getExchange(name: ExchangeName): { fetchOHLCV(pair: string, timeframe: string, since?: number, limit?: number): Promise<(number | null)[][]> } | undefined
}

export interface HistoricalDataLoaderDeps {
  exchangeManager: IExchangeLookupDep
  /** Optional: override candle persistence (e.g. no-op in tests). */
  upsertCandles: ((exchange: ExchangeName, pair: string, timeframe: string, candles: OHLCVCandle[]) => Promise<void>) | undefined
}

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
  private readonly deps: HistoricalDataLoaderDeps

  constructor(deps?: Partial<HistoricalDataLoaderDeps>) {
    this.deps = {
      exchangeManager: deps?.exchangeManager ?? (exchangeManager as unknown as IExchangeLookupDep),
      upsertCandles: deps?.upsertCandles,
    }
  }

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

    const ccxtExchange = this.deps.exchangeManager.getExchange(exchangeName)
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
   * timestamp is stored as Number (unix ms) in the model.
   */
  async getCachedData(params: GetCachedDataParams): Promise<OHLCVCandle[]> {
    const { exchange: exchangeName, pair, timeframe, since, until } = params

    const rows = await OhlcvCandleModel.find({
      exchange: exchangeName,
      pair,
      timeframe,
      timestamp: { $gte: since, $lte: until },
    })
      .sort({ timestamp: 1 })
      .lean()

    return rows.map((r) => ({
      timestamp: r.timestamp,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))
  }

  /**
   * Incrementally syncs candle data by finding the last cached timestamp and
   * fetching only newer candles from the exchange.
   *
   * @returns Number of new candles inserted.
   */
  async syncData(exchange: ExchangeName, pair: string, timeframe: '1h' | '1d'): Promise<number> {
    // Find the most recent cached timestamp for this series
    const latest = await OhlcvCandleModel.findOne({ exchange, pair, timeframe })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean()

    // Default: if no cached data, start 30 days back
    const lastTs = latest?.timestamp ?? Date.now() - 30 * 24 * 60 * 60 * 1_000
    const since = lastTs + 1 // exclusive of the last cached candle

    const candles = await this.loadData({ exchange, pair, timeframe, since })
    return candles.length
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Batch-upserts candles into the DB.
   * The unique index on (exchange, pair, timeframe, timestamp) handles duplicates
   * gracefully — conflicting docs are skipped via ordered:false bulk write.
   */
  private async _upsertCandles(
    exchange: ExchangeName,
    pair: string,
    timeframe: string,
    candles: OHLCVCandle[],
  ): Promise<void> {
    if (candles.length === 0) return

    // Use injected upsert implementation if provided (e.g. no-op in tests)
    if (this.deps.upsertCandles) {
      await this.deps.upsertCandles(exchange, pair, timeframe, candles)
      return
    }

    const ops = candles.map((c) => ({
      updateOne: {
        filter: { exchange, pair, timeframe, timestamp: c.timestamp },
        update: { $setOnInsert: { exchange, pair, timeframe, ...c } },
        upsert: true,
      },
    }))

    await OhlcvCandleModel.bulkWrite(ops, { ordered: false })
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
export { HistoricalDataLoader }
export const historicalDataLoader = new HistoricalDataLoader()
