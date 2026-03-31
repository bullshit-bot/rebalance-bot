import { describe, expect, it } from "bun:test";

// Drawdown calculation logic
function calculateMaxDrawdown(curve: Array<{ valueUsd: number }>): number {
  if (curve.length < 2) return 0;

  let runningPeak = curve[0]!.valueUsd;
  let maxDD = 0;

  for (const point of curve) {
    if (point.valueUsd > runningPeak) {
      runningPeak = point.valueUsd;
    }
    const dd = runningPeak > 0 ? (runningPeak - point.valueUsd) / runningPeak : 0;
    maxDD = Math.max(maxDD, dd);
  }

  return maxDD;
}

describe("DrawdownAnalyzer - Core Logic", () => {
  it("calculates max drawdown from peak to trough", () => {
    // Equity curve: 100 -> 120 (peak) -> 84 (trough) = 30% drawdown
    const curve = [{ valueUsd: 100 }, { valueUsd: 120 }, { valueUsd: 84 }];

    const maxDD = calculateMaxDrawdown(curve);

    expect(maxDD).toBeCloseTo(0.3, 2);
  });

  it("returns zero drawdown when portfolio only goes up", () => {
    const curve = [{ valueUsd: 100 }, { valueUsd: 110 }, { valueUsd: 120 }];

    const maxDD = calculateMaxDrawdown(curve);

    expect(maxDD).toBeCloseTo(0, 2);
  });

  it("identifies largest drawdown across multiple cycles", () => {
    // Cycle 1: peak 120, trough 96 = 20% drawdown
    // Cycle 2: peak 120, trough 84 = 30% drawdown (maximum)
    const curve = [
      { valueUsd: 100 },
      { valueUsd: 120 },
      { valueUsd: 96 },
      { valueUsd: 105 },
      { valueUsd: 84 },
    ];

    const maxDD = calculateMaxDrawdown(curve);

    // Max is from 120 to 84 = 30%
    expect(maxDD).toBeCloseTo(0.3, 2);
  });

  it("returns zero with insufficient data", () => {
    const curve = [{ valueUsd: 100 }];

    const maxDD = calculateMaxDrawdown(curve);

    expect(maxDD).toBe(0);
  });

  it("handles zero peak correctly", () => {
    const curve = [{ valueUsd: 0 }, { valueUsd: 100 }, { valueUsd: 50 }];

    const maxDD = calculateMaxDrawdown(curve);

    // From peak 100 to trough 50 = 50%
    expect(maxDD).toBeCloseTo(0.5, 2);
  });

  it("calculates correct percentage drawdown", () => {
    const curve = [{ valueUsd: 10000 }, { valueUsd: 11000 }, { valueUsd: 9900 }];

    const maxDD = calculateMaxDrawdown(curve);

    // From peak 11000 to trough 9900 = (11000-9900)/11000 = 10%
    expect(maxDD).toBeCloseTo(0.1, 2);
  });

  it("tracks running peak correctly", () => {
    const curve = [
      { valueUsd: 100 },
      { valueUsd: 150 }, // New peak
      { valueUsd: 120 }, // Drawdown from 150
      { valueUsd: 130 },
      { valueUsd: 160 }, // New all-time peak
      { valueUsd: 140 }, // Final drawdown from 160
    ];

    const maxDD = calculateMaxDrawdown(curve);

    // Maximum drawdown: from 150 to 120 = 20%
    expect(maxDD).toBeCloseTo(0.2, 2);
  });

  it("returns 100% for total portfolio loss", () => {
    const curve = [{ valueUsd: 10000 }, { valueUsd: 5000 }, { valueUsd: 0 }];

    const maxDD = calculateMaxDrawdown(curve);

    expect(maxDD).toBeCloseTo(1.0, 2);
  });
});
