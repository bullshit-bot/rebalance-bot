import type { VolAdjustedParamsSchema } from "@rebalancer/strategies/strategy-config-types";
import type { z } from "zod";

type VolAdjustedParams = z.infer<typeof VolAdjustedParamsSchema>;

// ─── VolAdjustedStrategy ─────────────────────────────────────────────────────

/**
 * Volatility-adjusted threshold strategy.
 *
 * Tracks recent volatility readings and computes a dynamic rebalance threshold
 * that scales proportionally with current vol vs. historical average vol.
 *
 * High vol → lower threshold (act sooner).
 * Low vol  → higher threshold (act later).
 * Result is always clamped to [minThresholdPct, maxThresholdPct].
 */
class VolAdjustedStrategy {
  /** Rolling volatility readings (one per update cycle). */
  private volHistory: number[] = [];

  /**
   * Record a volatility reading.
   * Capped at volLookbackDays samples (1 sample ≈ 1 day approximation).
   */
  recordVolatility(vol: number, lookbackDays = 30): void {
    this.volHistory.push(vol);
    if (this.volHistory.length > lookbackDays) this.volHistory.shift();
  }

  /** Average volatility across the recorded history. Returns 0 when empty. */
  getAverageVol(): number {
    if (this.volHistory.length === 0) return 0;
    return this.volHistory.reduce((s, v) => s + v, 0) / this.volHistory.length;
  }

  /**
   * Compute a dynamic rebalance threshold.
   *
   * Formula: threshold = baseThresholdPct × (currentVol / avgVol)
   * Clamped to [minThresholdPct, maxThresholdPct].
   *
   * Falls back to baseThresholdPct when no history is available.
   */
  getDynamicThreshold(params: VolAdjustedParams): number {
    const avgVol = this.getAverageVol();

    // No history yet — return base threshold unclamped
    if (avgVol === 0 || this.volHistory.length === 0) {
      return params.baseThresholdPct;
    }

    const currentVol = this.volHistory[this.volHistory.length - 1];
    const raw = params.baseThresholdPct * (currentVol / avgVol);

    return Math.min(Math.max(raw, params.minThresholdPct), params.maxThresholdPct);
  }

  /** Reset vol history (useful for testing or on config change). */
  reset(): void {
    this.volHistory = [];
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const volAdjustedStrategy = new VolAdjustedStrategy();

export { VolAdjustedStrategy };
