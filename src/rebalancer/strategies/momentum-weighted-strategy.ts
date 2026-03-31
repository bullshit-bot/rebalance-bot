import type { Allocation } from "@/types/index";
import type { MomentumWeightedParamsSchema } from "@rebalancer/strategies/strategy-config-types";
import type { z } from "zod";

type MomentumWeightedParams = z.infer<typeof MomentumWeightedParamsSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average of a price series.
 * Returns the final EMA value. Returns last price if series is too short.
 */
function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values[values.length - 1];

  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }
  return result;
}

// ─── MomentumWeightedStrategy ────────────────────────────────────────────────

/**
 * Momentum-weighted allocation strategy using RSI + MACD composite signal.
 *
 * RSI signal: low RSI (oversold) → positive score (buy signal)
 * MACD signal: positive histogram → upward momentum → negative score (already rising)
 * Composite: average of the two signals → [-1, +1]
 *
 * Allocations are scaled by (1 + weightFactor × score) then renormalised to 100%.
 */
class MomentumWeightedStrategy {
  /**
   * Compute RSI (0–100) for a price series.
   *
   * Uses Wilder's smoothing (SMA seed for first period, then EMA-style).
   * Returns 50 (neutral) when insufficient data.
   */
  computeRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    // Seed: first `period` changes
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Wilder smoothing for remaining candles
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Compute MACD histogram value (fast EMA − slow EMA).
   * Returns 0 when insufficient data.
   */
  computeMACD(prices: number[], fast: number, slow: number): number {
    if (prices.length < slow) return 0;
    return ema(prices, fast) - ema(prices, slow);
  }

  /**
   * Composite momentum score in [-1, +1].
   *
   * RSI signal  = (50 − rsi) / 50   → oversold (low RSI) → positive
   * MACD signal = histogram / maxAbsHistogram  → normalised histogram
   * score = (rsiSignal + macdSignal) / 2
   */
  getCompositeScore(prices: number[], params: MomentumWeightedParams): number {
    const rsi = this.computeRSI(prices, params.rsiPeriod);
    const histogram = this.computeMACD(prices, params.macdFast, params.macdSlow);

    // RSI signal: oversold = positive, overbought = negative
    const rsiSignal = (50 - rsi) / 50;

    // MACD signal: normalise histogram relative to price scale
    // Use price mean as denominator to get a dimensionless ratio
    const priceMean = prices.reduce((s, p) => s + p, 0) / prices.length || 1;
    const macdSignal = Math.min(Math.max(histogram / priceMean, -1), 1);

    const score = (rsiSignal + macdSignal) / 2;
    return Math.min(Math.max(score, -1), 1);
  }

  /**
   * Adjust base allocations using composite momentum scores.
   *
   * Each asset's targetPct is scaled by (1 + weightFactor × score).
   * Results are renormalised so they sum to 100%.
   * Assets with no price history keep their base allocation.
   */
  getAdjustedAllocations(
    baseAllocations: Allocation[],
    priceHistories: Map<string, number[]>,
    params: MomentumWeightedParams
  ): Allocation[] {
    if (baseAllocations.length === 0) return [];

    const scaled = baseAllocations.map((alloc) => {
      const prices = priceHistories.get(alloc.asset);
      const score = prices && prices.length > 0 ? this.getCompositeScore(prices, params) : 0;
      const adjusted = alloc.targetPct * (1 + params.weightFactor * score);
      return { ...alloc, targetPct: Math.max(adjusted, 0) };
    });

    const total = scaled.reduce((s, a) => s + a.targetPct, 0);
    if (total === 0) return baseAllocations;

    return scaled.map((a) => ({
      ...a,
      targetPct: (a.targetPct / total) * 100,
    }));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const momentumWeightedStrategy = new MomentumWeightedStrategy();

export { MomentumWeightedStrategy };
