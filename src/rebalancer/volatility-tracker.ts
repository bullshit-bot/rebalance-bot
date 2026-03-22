import { env } from "@config/app-config";

// ─── VolatilityTracker ────────────────────────────────────────────────────────

/**
 * Tracks 30-day annualized volatility of the total portfolio value.
 * Records daily returns (pct change) and computes stddev * sqrt(365).
 *
 * Call recordValue() on each portfolio update.
 * Call getVolatility() to read current annualized vol (%).
 * Call isHighVolatility() to check if vol exceeds VOLATILITY_THRESHOLD.
 */
class VolatilityTracker {
  /** Rolling buffer of daily returns (pct, e.g. 0.02 = 2%) */
  private dailyReturns: number[] = [];

  /** Last recorded portfolio total value (USD) */
  private lastValue = 0;

  /** Tracks when the last return was appended (epoch day bucket) */
  private lastDayBucket = 0;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record the current total portfolio value.
   * One return per calendar day is appended to the buffer; intra-day calls are
   * ignored to avoid inflating the sample count.
   */
  recordValue(totalValueUsd: number): void {
    if (totalValueUsd <= 0) return;

    const todayBucket = Math.floor(Date.now() / 86_400_000); // epoch day

    if (this.lastValue === 0) {
      // Bootstrap: just store the first value
      this.lastValue = totalValueUsd;
      this.lastDayBucket = todayBucket;
      return;
    }

    // Only record one return per day
    if (todayBucket <= this.lastDayBucket) return;

    const dailyReturn = (totalValueUsd - this.lastValue) / this.lastValue;
    this.dailyReturns.push(dailyReturn);

    // Keep a rolling 30-day window
    if (this.dailyReturns.length > 30) {
      this.dailyReturns.shift();
    }

    this.lastValue = totalValueUsd;
    this.lastDayBucket = todayBucket;
  }

  /**
   * Annualized volatility as a percentage.
   * Returns 0 if fewer than 2 data points are available.
   */
  getVolatility(): number {
    const n = this.dailyReturns.length;
    if (n < 2) return 0;

    const mean = this.dailyReturns.reduce((s, r) => s + r, 0) / n;
    const variance = this.dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
    const stddev = Math.sqrt(variance);

    // Annualize: stddev of daily returns * sqrt(365)
    return stddev * Math.sqrt(365) * 100;
  }

  /**
   * Returns true when current annualized volatility exceeds VOLATILITY_THRESHOLD.
   */
  isHighVolatility(): boolean {
    return this.getVolatility() > env.VOLATILITY_THRESHOLD;
  }

  /** Expose internal state for observability. */
  getState(): { returnCount: number; lastValue: number } {
    return { returnCount: this.dailyReturns.length, lastValue: this.lastValue };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const volatilityTracker = new VolatilityTracker();

export { VolatilityTracker };
