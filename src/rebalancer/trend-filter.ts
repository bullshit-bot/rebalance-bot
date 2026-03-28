// MA-based trend filter for bear market protection.
// Tracks daily BTC closes and determines bull/bear regime.

class TrendFilter {
  /** Rolling daily BTC close prices (capped at 400 entries) */
  private dailyCloses: number[] = []

  /** Day number (floor(epoch_ms / 86400000)) of the last recorded entry */
  private lastRecordedDay = 0

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record the current BTC price.
   * Call on every price update — dedupes within the same calendar day.
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
