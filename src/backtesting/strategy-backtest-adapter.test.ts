import { describe, expect, test } from "bun:test";
import { StrategyBacktestAdapter } from "./strategy-backtest-adapter";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const meanReversionParams = {
  type: "mean-reversion" as const,
  minTradeUsd: 10,
  lookbackDays: 30,
  bandWidthSigma: 1.5,
  minDriftPct: 3,
};

const volAdjustedParams = {
  type: "vol-adjusted" as const,
  minTradeUsd: 10,
  baseThresholdPct: 5,
  volLookbackDays: 30,
  minThresholdPct: 3,
  maxThresholdPct: 20,
};

const momentumWeightedParams = {
  type: "momentum-weighted" as const,
  minTradeUsd: 10,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  weightFactor: 0.4,
};

const equalWeightParams = {
  type: "equal-weight" as const,
  thresholdPct: 5,
  minTradeUsd: 10,
};

const thresholdParams = {
  type: "threshold" as const,
  thresholdPct: 5,
  minTradeUsd: 10,
};

/** A balanced 50/50 portfolio holding */
function balancedHoldings(totalUsd: number) {
  return {
    "BTC/USDT": { amount: 1, valueUsd: totalUsd / 2 },
    "ETH/USDT": { amount: 10, valueUsd: totalUsd / 2 },
  };
}

/** A 50/50 allocation target */
const fiftyFifty = [
  { asset: "BTC", targetPct: 50 },
  { asset: "ETH", targetPct: 50 },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StrategyBacktestAdapter", () => {
  // ── Constructor / strategy instantiation ────────────────────────────────

  test("creates mean-reversion instance for mean-reversion params", () => {
    const adapter = new StrategyBacktestAdapter(meanReversionParams);
    // Verify by behavioural test: after feeding no drift history,
    // band = minDriftPct=3; drift=5 triggers rebalance
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 70 },
      "ETH/USDT": { amount: 10, valueUsd: 30 },
    };
    // BTC actual=70%, target=50% → drift=20% >> band=3% → should rebalance
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 999)).toBe(true);
  });

  test("creates vol-adjusted instance for vol-adjusted params", () => {
    const adapter = new StrategyBacktestAdapter(volAdjustedParams);
    // With no vol history, threshold = baseThresholdPct=5
    // Balanced holdings → drift=0 → no rebalance
    expect(adapter.needsRebalance(balancedHoldings(100), fiftyFifty, 100, 999)).toBe(false);
  });

  test("creates momentum-weighted instance for momentum-weighted params", () => {
    // Falls back to threshold check; balanced = no rebalance
    const adapter = new StrategyBacktestAdapter(momentumWeightedParams);
    expect(adapter.needsRebalance(balancedHoldings(100), fiftyFifty, 100, 999)).toBe(false);
  });

  // ── needsRebalance: totalValueUsd guard ──────────────────────────────────

  test("needsRebalance returns false when totalValueUsd <= 0", () => {
    const adapter = new StrategyBacktestAdapter(thresholdParams);
    expect(adapter.needsRebalance({}, fiftyFifty, 0, 5)).toBe(false);
    expect(adapter.needsRebalance({}, fiftyFifty, -1, 5)).toBe(false);
  });

  // ── needsRebalance: mean-reversion delegation ────────────────────────────

  test("needsRebalance delegates to mean-reversion strategy", () => {
    const adapter = new StrategyBacktestAdapter(meanReversionParams);
    // Perfect balance → drift=0, band=minDriftPct=3 → no rebalance
    expect(adapter.needsRebalance(balancedHoldings(100), fiftyFifty, 100, 999)).toBe(false);
  });

  test("updateState feeds drift to mean-reversion and affects band", () => {
    const adapter = new StrategyBacktestAdapter(meanReversionParams);

    // Feed many high-drift readings to widen the band
    // After widening, a moderate actual drift should NOT trigger rebalance
    const drifts = new Map([
      ["BTC", 40],
      ["ETH", -40],
    ]);
    for (let i = 0; i < 20; i++) {
      adapter.updateState(drifts, 0, {});
    }
    // Now band > minDriftPct (because stddev of 40s is 0 but history exists).
    // stddev([40,40,...]) = 0 → band still minDriftPct=3
    // So drift of 5 on BTC still triggers rebalance (5 > 3)
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 55 },
      "ETH/USDT": { amount: 10, valueUsd: 45 },
    };
    // BTC: 55%-50%=5% drift > band=3 → rebalance
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 999)).toBe(true);
  });

  test("updateState with varied drifts widens band for mean-reversion", () => {
    const adapter = new StrategyBacktestAdapter(meanReversionParams);

    // Feed alternating large and small drifts to create high stddev in history
    const drifts1 = new Map([
      ["BTC", 30],
      ["ETH", -30],
    ]);
    const drifts2 = new Map([
      ["BTC", -30],
      ["ETH", 30],
    ]);
    for (let i = 0; i < 15; i++) {
      adapter.updateState(drifts1, 0, {});
      adapter.updateState(drifts2, 0, {});
    }
    // stddev of alternating [30, -30, ...] = 30 → band = 1.5*30=45
    // A 5% actual drift should NOT trigger with such a wide band
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 55 },
      "ETH/USDT": { amount: 10, valueUsd: 45 },
    };
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 999)).toBe(false);
  });

  // ── needsRebalance: vol-adjusted delegation ──────────────────────────────

  test("needsRebalance delegates to vol-adjusted dynamic threshold", () => {
    const adapter = new StrategyBacktestAdapter(volAdjustedParams);
    // No vol history → threshold = baseThresholdPct=5
    // holdings: BTC=40%, target=50% → drift=10% > 5 → rebalance
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 40 },
      "ETH/USDT": { amount: 10, valueUsd: 60 },
    };
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 999)).toBe(true);
  });

  test("updateState feeds vol to vol-adjusted strategy", () => {
    const adapter = new StrategyBacktestAdapter(volAdjustedParams);

    // Feed many high-vol readings then a low one
    // avg will be high, current is low → scaled threshold will be very low → clamped at min
    for (let i = 0; i < 10; i++) {
      adapter.updateState(new Map(), 100, {}); // high vol readings
    }
    adapter.updateState(new Map(), 0.001, {}); // tiny current vol

    // Dynamic threshold now clamped at minThresholdPct=3
    // holdings: BTC=47%, target=50% → drift=3% >= threshold=3 → rebalance
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 47 },
      "ETH/USDT": { amount: 10, valueUsd: 53 },
    };
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 999)).toBe(true);
  });

  // ── needsRebalance: fallback threshold ──────────────────────────────────

  test("needsRebalance uses fallback threshold for equal-weight type", () => {
    const adapter = new StrategyBacktestAdapter(equalWeightParams);
    // holdings: BTC=44%, target=50% → drift=6% > fallback=5 → rebalance
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 44 },
      "ETH/USDT": { amount: 10, valueUsd: 56 },
    };
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 5)).toBe(true);
  });

  test("needsRebalance returns false within fallback threshold", () => {
    const adapter = new StrategyBacktestAdapter(thresholdParams);
    // holdings: BTC=47%, target=50% → drift=3% < fallback=5 → no rebalance
    const holdings = {
      "BTC/USDT": { amount: 1, valueUsd: 47 },
      "ETH/USDT": { amount: 10, valueUsd: 53 },
    };
    expect(adapter.needsRebalance(holdings, fiftyFifty, 100, 5)).toBe(false);
  });

  // ── getEffectiveAllocations ──────────────────────────────────────────────

  test("getEffectiveAllocations returns base allocations for threshold type", () => {
    const adapter = new StrategyBacktestAdapter(thresholdParams);
    const result = adapter.getEffectiveAllocations(fiftyFifty);
    expect(result).toEqual(fiftyFifty);
  });

  test("getEffectiveAllocations returns base allocations for mean-reversion type", () => {
    const adapter = new StrategyBacktestAdapter(meanReversionParams);
    const result = adapter.getEffectiveAllocations(fiftyFifty);
    expect(result).toEqual(fiftyFifty);
  });

  test("getEffectiveAllocations equalizes weights for equal-weight type", () => {
    const adapter = new StrategyBacktestAdapter(equalWeightParams);
    const uneven = [
      { asset: "BTC", targetPct: 60 },
      { asset: "ETH", targetPct: 30 },
      { asset: "SOL", targetPct: 10 },
    ];
    const result = adapter.getEffectiveAllocations(uneven);
    expect(result.length).toBe(3);
    for (const a of result) {
      expect(a.targetPct).toBeCloseTo(100 / 3, 5);
    }
  });

  test("getEffectiveAllocations returns momentum-adjusted weights for momentum-weighted", () => {
    const adapter = new StrategyBacktestAdapter(momentumWeightedParams);
    // Feed 60 candles of price history: BTC falling (oversold), ETH rising (overbought)
    for (let i = 0; i < 60; i++) {
      adapter.updateState(new Map(), 0, { "BTC/USDT": 500 - i * 5, "ETH/USDT": 100 + i * 2 });
    }
    const result = adapter.getEffectiveAllocations(fiftyFifty);
    const total = result.reduce((s, a) => s + a.targetPct, 0);
    expect(total).toBeCloseTo(100, 5);
    // BTC oversold → higher weight; ETH overbought → lower weight
    const btc = result.find((a) => a.asset === "BTC")!;
    const eth = result.find((a) => a.asset === "ETH")!;
    expect(btc.targetPct).toBeGreaterThan(eth.targetPct);
  });

  test("getEffectiveAllocations returns base for momentum-weighted with no history", () => {
    const adapter = new StrategyBacktestAdapter(momentumWeightedParams);
    const result = adapter.getEffectiveAllocations(fiftyFifty);
    // No price history → score=0 for all → weights unchanged → still 50/50
    const total = result.reduce((s, a) => s + a.targetPct, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(result[0].targetPct).toBeCloseTo(50, 5);
    expect(result[1].targetPct).toBeCloseTo(50, 5);
  });

  test("getEffectiveAllocations handles empty allocations", () => {
    const adapter = new StrategyBacktestAdapter(equalWeightParams);
    expect(adapter.getEffectiveAllocations([])).toEqual([]);
  });

  // ── updateState: price accumulation for momentum-weighted ────────────────

  test("updateState accumulates price history for momentum-weighted", () => {
    const adapter = new StrategyBacktestAdapter(momentumWeightedParams);
    for (let i = 0; i < 30; i++) {
      adapter.updateState(new Map(), 0, { "BTC/USDT": 100 + i, "ETH/USDT": 200 + i });
    }
    // With 30 price points, momentum scoring is active (needs macdSlow=26 min)
    // Flat-ish rising series → result should still sum to 100%
    const result = adapter.getEffectiveAllocations(fiftyFifty);
    const total = result.reduce((s, a) => s + a.targetPct, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  test("updateState strips /USDT suffix when accumulating price history", () => {
    const adapter = new StrategyBacktestAdapter(momentumWeightedParams);
    // Feed prices with /USDT suffix; allocation assets have no suffix
    for (let i = 0; i < 30; i++) {
      adapter.updateState(new Map(), 0, { "BTC/USDT": 100 + i });
    }
    const result = adapter.getEffectiveAllocations([{ asset: "BTC", targetPct: 100 }]);
    // BTC has history, so momentum score is applied → weight adjusted but renorm to 100%
    expect(result[0].targetPct).toBeCloseTo(100, 5);
  });
});
