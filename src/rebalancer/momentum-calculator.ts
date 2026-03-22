import type { Allocation } from "@/types/index";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Keep at most this many price samples per asset (one per day = 30 days) */
const MAX_PRICE_SAMPLES = 30;

// ─── MomentumCalculator ───────────────────────────────────────────────────────

/**
 * Computes 30-day price momentum per asset and derives momentum-tilted
 * target allocations.
 *
 * Momentum = (current_price - price_30d_ago) / price_30d_ago
 *
 * Momentum tilt blends 50% base allocation + 50% momentum-weighted allocation,
 * using only assets with positive momentum to avoid crowding losers.
 *
 * Call recordPrice() on each price update.
 * Call getMomentumAllocations() when building effective targets.
 */
class MomentumCalculator {
  private readonly priceHistory: Map<string, { timestamp: number; price: number }[]> = new Map();

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Record a price observation for an asset.
   * One sample per calendar day is kept; intra-day calls update the current
   * day's entry so we always have the freshest price for that bucket.
   */
  recordPrice(asset: string, price: number): void {
    if (price <= 0) return;

    const dayBucket = Math.floor(Date.now() / 86_400_000);
    const history = this.priceHistory.get(asset) ?? [];

    const last = history[history.length - 1];
    if (last && Math.floor(last.timestamp / 86_400_000) === dayBucket) {
      // Update today's sample in place
      last.price = price;
      last.timestamp = Date.now();
    } else {
      history.push({ timestamp: Date.now(), price });
      // Trim to rolling window
      if (history.length > MAX_PRICE_SAMPLES) {
        history.shift();
      }
    }

    this.priceHistory.set(asset, history);
  }

  /**
   * 30-day momentum score for an asset.
   * Returns 0 when fewer than 2 samples are available.
   */
  getMomentum(asset: string): number {
    const history = this.priceHistory.get(asset);
    if (!history || history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];
    if (oldest.price <= 0) return 0;

    return (newest.price - oldest.price) / oldest.price;
  }

  /**
   * Returns allocations blended 50/50 between base weights and momentum weights.
   *
   * Momentum weights are derived by normalising positive momentum scores across
   * all assets in the base allocation list. Assets with zero or negative
   * momentum contribute 0 to the momentum sleeve; their base weight is
   * redistributed proportionally through the blend arithmetic.
   *
   * Final weights are renormalised to sum to 100.
   */
  getMomentumAllocations(baseAllocations: Allocation[]): Allocation[] {
    if (baseAllocations.length === 0) return [];

    // Collect positive momentum scores
    const scores = baseAllocations.map((a) => ({
      alloc: a,
      momentum: Math.max(0, this.getMomentum(a.asset)),
    }));

    const totalMomentum = scores.reduce((s, x) => s + x.momentum, 0);

    // Momentum weight: 0 when no asset has positive momentum (fall back to base)
    const momentumWeights: number[] = scores.map((x) =>
      totalMomentum > 0 ? (x.momentum / totalMomentum) * 100 : x.alloc.targetPct
    );

    // Blend 50% base + 50% momentum
    const blended = scores.map((x, i) => ({
      ...x.alloc,
      targetPct: 0.5 * x.alloc.targetPct + 0.5 * (momentumWeights[i] ?? 0),
    }));

    // Renormalise to exactly 100
    const totalBlended = blended.reduce((s, a) => s + a.targetPct, 0);
    if (totalBlended === 0) return baseAllocations;

    return blended.map((a) => ({
      ...a,
      targetPct: (a.targetPct / totalBlended) * 100,
    }));
  }

  /** All current momentum scores keyed by asset symbol. */
  getAllMomentumScores(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const asset of this.priceHistory.keys()) {
      result[asset] = this.getMomentum(asset);
    }
    return result;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const momentumCalculator = new MomentumCalculator();

export { MomentumCalculator };
