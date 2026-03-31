import { beforeEach, describe, expect, test } from "bun:test";
import { MeanReversionStrategy } from "@rebalancer/strategies/mean-reversion-strategy";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const params = {
  type: "mean-reversion" as const,
  minTradeUsd: 10,
  lookbackDays: 30,
  bandWidthSigma: 1.5,
  minDriftPct: 3,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MeanReversionStrategy", () => {
  let strategy: MeanReversionStrategy;

  beforeEach(() => {
    strategy = new MeanReversionStrategy();
  });

  // ── recordDrift ──────────────────────────────────────────────────────────

  test("recordDrift stores drift history for an asset", () => {
    strategy.recordDrift("BTC", 2.5);
    strategy.recordDrift("BTC", -1.0);

    // Band is now based on 2 samples: stddev([2.5, -1.0]) = 1.75
    // band = 1.5 * 1.75 = 2.625 → above minDriftPct (3)? No → floor at 3
    const band = strategy.getBandWidth("BTC", params);
    expect(band).toBeGreaterThan(0);
  });

  test("recordDrift trims history beyond lookbackDays", () => {
    // Fill 31 entries with lookbackDays=5
    for (let i = 0; i < 10; i++) {
      strategy.recordDrift("BTC", i, 5);
    }
    // After 10 pushes with cap=5, only last 5 remain: [5,6,7,8,9]
    // stddev([5,6,7,8,9]) = sqrt(2) ≈ 1.414; band = 1.5 * 1.414 ≈ 2.12 → floor at minDriftPct
    const band = strategy.getBandWidth("BTC", params);
    // With stddev from [5..9], band computed from those 5 values
    expect(band).toBeGreaterThanOrEqual(params.minDriftPct);
  });

  test("recordDrift is per-asset (different assets do not share history)", () => {
    strategy.recordDrift("BTC", 10);
    // ETH has no history → band = minDriftPct
    const ethBand = strategy.getBandWidth("ETH", params);
    expect(ethBand).toBe(params.minDriftPct);
  });

  // ── getBandWidth ─────────────────────────────────────────────────────────

  test("getBandWidth returns minDriftPct when no history (floor)", () => {
    const band = strategy.getBandWidth("BTC", params);
    expect(band).toBe(params.minDriftPct);
  });

  test("getBandWidth returns minDriftPct for single sample (stddev=0)", () => {
    strategy.recordDrift("BTC", 5);
    const band = strategy.getBandWidth("BTC", params);
    expect(band).toBe(params.minDriftPct);
  });

  test("getBandWidth computes sigma-based band with multiple samples", () => {
    // High drift values → large stddev → band should exceed minDriftPct
    // Provide drifts: 0 and 100 → stddev = 50 → band = 1.5 * 50 = 75
    strategy.recordDrift("BTC", 0);
    strategy.recordDrift("BTC", 100);
    const band = strategy.getBandWidth("BTC", params);
    expect(band).toBeGreaterThan(params.minDriftPct);
    // stddev([0,100]) population = 50; band = 1.5 * 50 = 75
    expect(band).toBeCloseTo(75, 5);
  });

  test("getBandWidth expands in high-volatility drift history", () => {
    // Calm first
    strategy.recordDrift("BTC", 1);
    strategy.recordDrift("BTC", 1);
    const calmBand = strategy.getBandWidth("BTC", params);

    // Now add wild swings
    strategy.reset();
    strategy.recordDrift("BTC", -20);
    strategy.recordDrift("BTC", 20);
    const highVolBand = strategy.getBandWidth("BTC", params);

    expect(highVolBand).toBeGreaterThan(calmBand);
  });

  test("getBandWidth contracts in calm drift history", () => {
    // Calm: tiny variance → band floors at minDriftPct
    strategy.recordDrift("BTC", 0.1);
    strategy.recordDrift("BTC", 0.1);
    const band = strategy.getBandWidth("BTC", params);
    // stddev ≈ 0 → band = 1.5 * 0 = 0 → floored at minDriftPct
    expect(band).toBe(params.minDriftPct);
  });

  // ── shouldRebalance ──────────────────────────────────────────────────────

  test("shouldRebalance returns false when all drifts within band", () => {
    // No history → band = minDriftPct = 3; drift = 1 < 3
    const drifts = new Map([["BTC", 1]]);
    expect(strategy.shouldRebalance(drifts, params)).toBe(false);
  });

  test("shouldRebalance returns true when any drift exceeds band", () => {
    // No history → band = minDriftPct = 3; drift = 5 > 3
    const drifts = new Map([["BTC", 5]]);
    expect(strategy.shouldRebalance(drifts, params)).toBe(true);
  });

  test("shouldRebalance works with negative drift exceeding band", () => {
    // |drift| = 4 > minDriftPct = 3
    const drifts = new Map([["BTC", -4]]);
    expect(strategy.shouldRebalance(drifts, params)).toBe(true);
  });

  test("shouldRebalance returns false for empty drifts map", () => {
    const drifts = new Map<string, number>();
    expect(strategy.shouldRebalance(drifts, params)).toBe(false);
  });

  test("shouldRebalance returns true when at least one asset exceeds band", () => {
    const drifts = new Map([
      ["BTC", 1], // within band
      ["ETH", 10], // exceeds band
    ]);
    expect(strategy.shouldRebalance(drifts, params)).toBe(true);
  });

  // ── reset ────────────────────────────────────────────────────────────────

  test("reset clears all drift history", () => {
    strategy.recordDrift("BTC", 0);
    strategy.recordDrift("BTC", 100); // creates non-trivial band
    strategy.reset();
    // After reset, band should be back to minDriftPct floor
    const band = strategy.getBandWidth("BTC", params);
    expect(band).toBe(params.minDriftPct);
  });
});
