// MA-based trend filter for bear market protection.
// Tracks daily BTC closes and determines bull/bear regime.
// Persists daily closes to MongoDB for restart resilience.

import { OhlcvCandleModel } from '@db/models/ohlcv-candle-model'
import { eventBus } from '@events/event-bus'

class TrendFilter {
  /** Rolling daily BTC close prices (capped at 400 entries) */
  private dailyCloses: number[] = []

  /** Day number (floor(epoch_ms / 86400000)) of the last recorded entry */
  private lastRecordedDay = 0

  /** Previous bull/bear state — null until first evaluation (avoids false flip on startup) */
  private lastBullish: boolean | null = null

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Hydrate dailyCloses from MongoDB on startup.
   * Safe to call when DB is empty — defaults to bull (no data).
   */
  async loadFromDb(): Promise<void> {
    try {
      const candles = await OhlcvCandleModel.find({
        exchange: 'trend-filter',
        pair: 'BTC/USDT',
        timeframe: '1d',
      })
        .sort({ timestamp: 1 })
        .limit(400)
        .lean()

      if (candles.length === 0) {
        console.info('[TrendFilter] No persisted candles found — starting fresh')
        return
      }

      this.dailyCloses = candles.map((c) => c.close)
      this.lastRecordedDay = Math.floor(candles[candles.length - 1]!.timestamp / 86_400_000)
      console.info('[TrendFilter] Loaded %d data points from DB', candles.length)
    } catch (err) {
      console.error('[TrendFilter] Failed to load from DB — starting fresh:', err)
    }
  }

  /**
   * Record the current BTC price.
   * Call on every price update — dedupes within the same calendar day.
   * Persists new day entries to MongoDB (fire-and-forget).
   */
  recordPrice(btcPrice: number): void {
    const today = Math.floor(Date.now() / 86_400_000)
    if (today === this.lastRecordedDay) {
      // Update today's close with the latest price
      this.dailyCloses[this.dailyCloses.length - 1] = btcPrice
    } else {
      this.dailyCloses.push(btcPrice)
      this.lastRecordedDay = today
      // Cap at 400 entries — more than any MA period we'd use
      if (this.dailyCloses.length > 400) this.dailyCloses.shift()

      // Persist new day entry to MongoDB (fire-and-forget)
      const dayStartMs = today * 86_400_000
      OhlcvCandleModel.updateOne(
        { exchange: 'trend-filter', pair: 'BTC/USDT', timeframe: '1d', timestamp: dayStartMs },
        { $set: { open: btcPrice, high: btcPrice, low: btcPrice, close: btcPrice, volume: 0 } },
        { upsert: true },
      ).catch((err) => {
        console.error('[TrendFilter] Failed to persist daily close:', err)
      })
    }
  }

  /**
   * Returns true when BTC is above the MA (with optional % buffer).
   * Defaults to bull when insufficient data — avoids selling on first run.
   *
   * @param maPeriod  Number of daily closes to average (default 100)
   * @param bufferPct % below MA still treated as bull (default 2)
   */
  isBullish(maPeriod = 100, bufferPct = 2): boolean {
    const ma = this.sma(maPeriod)
    if (ma === null) return true // not enough data → assume bull (safe default)
    const currentPrice = this.dailyCloses[this.dailyCloses.length - 1] ?? 0
    // Bull if price >= MA * (1 - buffer/100)
    const bullish = currentPrice >= ma * (1 - bufferPct / 100)

    // Emit trend:changed only on actual state flip (skip first evaluation)
    if (this.lastBullish !== null && bullish !== this.lastBullish) {
      eventBus.emit('trend:changed', { bullish, price: currentPrice, ma })
    }
    this.lastBullish = bullish

    return bullish
  }

  /**
   * Read-only bull/bear query — does NOT emit trend:changed events.
   * Use this in health endpoints, status displays, and startup messages.
   */
  isBullishReadOnly(maPeriod = 100, bufferPct = 2): boolean {
    const ma = this.sma(maPeriod)
    if (ma === null) return true
    const currentPrice = this.dailyCloses[this.dailyCloses.length - 1] ?? 0
    return currentPrice >= ma * (1 - bufferPct / 100)
  }

  /** Current MA value, or null if not enough data points. */
  getMA(period: number): number | null {
    return this.sma(period)
  }

  /** Most recently recorded BTC price (0 if none). */
  getCurrentPrice(): number {
    return this.dailyCloses[this.dailyCloses.length - 1] ?? 0
  }

  /** Number of daily data points collected. */
  getDataPoints(): number {
    return this.dailyCloses.length
  }

  /**
   * Persist the current day's latest close to MongoDB.
   * Call during graceful shutdown to avoid losing intra-day price updates.
   */
  async persistCurrentClose(): Promise<void> {
    if (this.dailyCloses.length === 0 || this.lastRecordedDay === 0) return

    const price = this.dailyCloses[this.dailyCloses.length - 1]!
    const dayStartMs = this.lastRecordedDay * 86_400_000

    try {
      await OhlcvCandleModel.updateOne(
        { exchange: 'trend-filter', pair: 'BTC/USDT', timeframe: '1d', timestamp: dayStartMs },
        { $set: { close: price } },
        { upsert: true },
      )
    } catch (err) {
      console.error('[TrendFilter] Failed to persist close on shutdown:', err)
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Simple Moving Average over the last `period` closes. Null if insufficient data. */
  private sma(period: number): number | null {
    if (this.dailyCloses.length < period) return null
    let sum = 0
    for (let i = this.dailyCloses.length - period; i < this.dailyCloses.length; i++) {
      sum += this.dailyCloses[i]!
    }
    return sum / period
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const trendFilter = new TrendFilter()

export { TrendFilter }
