import type { PriceData } from '@/types/index'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Entries older than this are considered stale and pruned on clearStale() */
const STALE_THRESHOLD_MS = 60_000

// ─── PriceCache ───────────────────────────────────────────────────────────────

/**
 * In-memory cache for the best (most-recently-updated) price per trading pair.
 * Keyed by pair symbol only (e.g. "BTC/USDT") — multi-exchange comparison
 * happens here: whichever exchange supplied the most recent update wins.
 */
class PriceCache {
  private readonly cache: Map<string, PriceData> = new Map()

  /**
   * Upsert a price entry. Overwrites any existing entry for the same pair
   * only when the incoming data is newer or from the same timestamp.
   */
  set(pair: string, data: PriceData): void {
    const existing = this.cache.get(pair)
    if (existing === undefined || data.timestamp >= existing.timestamp) {
      this.cache.set(pair, data)
    }
  }

  /** Retrieve cached data for a pair, or undefined if not yet populated. */
  get(pair: string): PriceData | undefined {
    return this.cache.get(pair)
  }

  /** Snapshot of every cached pair → PriceData entry. */
  getAll(): Record<string, PriceData> {
    const result: Record<string, PriceData> = {}
    for (const [pair, data] of this.cache) {
      result[pair] = data
    }
    return result
  }

  /**
   * Return the last-known price for a pair.
   * Because the cache already stores the most-recent exchange update,
   * this is effectively the best available price at the time of the last tick.
   */
  getBestPrice(pair: string): number | undefined {
    return this.cache.get(pair)?.price
  }

  /**
   * Remove all entries whose timestamp is older than STALE_THRESHOLD_MS.
   * Call periodically (e.g. every 60 s) to prevent unbounded memory growth
   * when pairs stop trading.
   */
  clearStale(): void {
    const cutoff = Date.now() - STALE_THRESHOLD_MS
    for (const [pair, data] of this.cache) {
      if (data.timestamp < cutoff) {
        this.cache.delete(pair)
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const priceCache = new PriceCache()

export { PriceCache }
