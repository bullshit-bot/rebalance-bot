import { describe, expect, it } from "bun:test";
import { generateCashDCAGrid, generateParameterGrid } from "./optimizer-parameter-grids";

describe("generateParameterGrid", () => {
  it("returns all strategy combinations when no filter", () => {
    const grid = generateParameterGrid();
    expect(grid.length).toBeGreaterThan(50);
    // Should include all strategy types
    const types = new Set(grid.map((c) => c.strategyType));
    expect(types.has("threshold")).toBe(true);
    expect(types.has("equal-weight")).toBe(true);
    expect(types.has("mean-reversion")).toBe(true);
    expect(types.has("vol-adjusted")).toBe(true);
    expect(types.has("momentum-weighted")).toBe(true);
    expect(types.has("momentum-tilt")).toBe(true);
  });

  it("filters by strategy type", () => {
    const grid = generateParameterGrid(["threshold"]);
    expect(grid.length).toBe(6); // [2, 3, 5, 8, 10, 15]
    for (const combo of grid) {
      expect(combo.strategyType).toBe("threshold");
    }
  });

  it("filters by multiple strategy types", () => {
    const grid = generateParameterGrid(["threshold", "equal-weight"]);
    expect(grid.length).toBe(12); // 6 threshold + 6 equal-weight
    const types = new Set(grid.map((c) => c.strategyType));
    expect(types.size).toBe(2);
  });

  it("returns empty for unknown strategy type", () => {
    const grid = generateParameterGrid(["nonexistent" as any]);
    expect(grid.length).toBe(0);
  });

  it("threshold grid has correct param structure", () => {
    const grid = generateParameterGrid(["threshold"]);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("type", "threshold");
      expect(combo.strategyParams).toHaveProperty("thresholdPct");
      expect(combo.strategyParams).toHaveProperty("minTradeUsd", 10);
      expect(combo.label).toMatch(/^threshold-\d+%$/);
    }
  });

  it("equal-weight grid has correct param structure", () => {
    const grid = generateParameterGrid(["equal-weight"]);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("type", "equal-weight");
      expect(combo.label).toMatch(/^ew-\d+%$/);
    }
  });

  it("mean-reversion grid has 27 combos (3×3×3)", () => {
    const grid = generateParameterGrid(["mean-reversion"]);
    expect(grid.length).toBe(27);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("lookbackDays");
      expect(combo.strategyParams).toHaveProperty("bandWidthSigma");
      expect(combo.strategyParams).toHaveProperty("minDriftPct");
    }
  });

  it("vol-adjusted grid has correct structure", () => {
    const grid = generateParameterGrid(["vol-adjusted"]);
    expect(grid.length).toBeGreaterThan(0);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("type", "vol-adjusted");
      expect(combo.strategyParams).toHaveProperty("baseThresholdPct");
      expect(combo.strategyParams).toHaveProperty("volLookbackDays");
    }
  });

  it("momentum-weighted grid has correct structure", () => {
    const grid = generateParameterGrid(["momentum-weighted"]);
    expect(grid.length).toBeGreaterThan(0);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("type", "momentum-weighted");
    }
  });

  it("momentum-tilt grid has correct structure", () => {
    const grid = generateParameterGrid(["momentum-tilt"]);
    expect(grid.length).toBeGreaterThan(0);
    for (const combo of grid) {
      expect(combo.strategyParams).toHaveProperty("type", "momentum-tilt");
      expect(combo.strategyParams).toHaveProperty("momentumWindowDays");
      expect(combo.strategyParams).toHaveProperty("momentumWeight");
    }
  });

  it("all combos have required fields", () => {
    const grid = generateParameterGrid();
    for (const combo of grid) {
      expect(typeof combo.label).toBe("string");
      expect(combo.label.length).toBeGreaterThan(0);
      expect(typeof combo.strategyType).toBe("string");
      expect(typeof combo.strategyParams).toBe("object");
    }
  });
});

describe("generateCashDCAGrid", () => {
  it("returns combos with cash reserve and DCA settings", () => {
    const grid = generateCashDCAGrid();
    expect(grid.length).toBeGreaterThan(10);
  });

  it("all combos have cashReservePct", () => {
    const grid = generateCashDCAGrid();
    for (const combo of grid) {
      expect(combo.cashReservePct).toBeDefined();
      expect(typeof combo.cashReservePct).toBe("number");
    }
  });

  it("skips DCA routing when cashPct is 0", () => {
    const grid = generateCashDCAGrid();
    const zeroCashWithDCA = grid.filter(
      (c) => c.cashReservePct === 0 && c.dcaRebalanceEnabled === true
    );
    expect(zeroCashWithDCA.length).toBe(0);
  });

  it("includes DCA routing when cashPct > 0", () => {
    const grid = generateCashDCAGrid();
    const dcaEnabled = grid.filter((c) => c.dcaRebalanceEnabled === true);
    expect(dcaEnabled.length).toBeGreaterThan(0);
    for (const combo of dcaEnabled) {
      expect(combo.cashReservePct).toBeGreaterThan(0);
    }
  });

  it("uses only threshold and equal-weight strategies", () => {
    const grid = generateCashDCAGrid();
    const types = new Set(grid.map((c) => c.strategyType));
    expect(types.size).toBeLessThanOrEqual(2);
    for (const t of types) {
      expect(["threshold", "equal-weight"]).toContain(t);
    }
  });

  it("labels include strategy prefix and cash info", () => {
    const grid = generateCashDCAGrid();
    for (const combo of grid) {
      expect(combo.label).toMatch(/^(t|ew)-\d+%-cash\d+/);
      if (combo.dcaRebalanceEnabled) {
        expect(combo.label).toContain("-dca");
      }
    }
  });
});
