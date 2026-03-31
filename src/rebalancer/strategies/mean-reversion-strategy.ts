import type { MeanReversionParamsSchema } from "@rebalancer/strategies/strategy-config-types";
import type { z } from "zod";

type MeanReversionParams = z.infer<typeof MeanReversionParamsSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Population standard deviation of a number array. Returns 0 if fewer than 2 values. */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── MeanReversionStrategy ───────────────────────────────────────────────────

/**
 * Bollinger-band style rebalancing strategy.
 *
 * Tracks rolling drift history per asset and triggers rebalancing only when
 * an asset's absolute drift exceeds its dynamically computed band boundary.
 * The band is widened/narrowed based on recent drift volatility.
 */
class MeanReversionStrategy {
  /** Rolling drift samples per asset: asset → list of recent drift readings (%) */
  private driftHistory: Map<string, number[]> = new Map();

  /**
   * Record a drift reading for an asset.
   * Older samples beyond lookbackDays are pruned using a fixed-size approximation
   * (1 sample ≈ 1 day of data; capped at lookbackDays).
   */
  recordDrift(asset: string, driftPct: number, lookbackDays = 30): void {
    const history = this.driftHistory.get(asset) ?? [];
    history.push(driftPct);
    // Keep only the most recent lookbackDays samples
    if (history.length > lookbackDays) history.shift();
    this.driftHistory.set(asset, history);
  }

  /**
   * Compute the band boundary for an asset.
   *
   * band = bandWidthSigma × stddev(driftHistory[asset])
   * The result is floored at minDriftPct to prevent bands from collapsing near zero.
   */
  getBandWidth(asset: string, params: MeanReversionParams): number {
    const history = this.driftHistory.get(asset) ?? [];
    const sigma = stddev(history);
    const band = params.bandWidthSigma * sigma;
    return Math.max(band, params.minDriftPct);
  }

  /**
   * Returns true when any asset's absolute drift exceeds its computed band.
   *
   * @param drifts - map of asset → current drift (%)
   * @param params - strategy parameters
   */
  shouldRebalance(drifts: Map<string, number>, params: MeanReversionParams): boolean {
    for (const [asset, drift] of drifts) {
      const band = this.getBandWidth(asset, params);
      if (Math.abs(drift) > band) return true;
    }
    return false;
  }

  /** Reset drift history (useful for testing or on config change). */
  reset(): void {
    this.driftHistory.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const meanReversionStrategy = new MeanReversionStrategy();

export { MeanReversionStrategy };
