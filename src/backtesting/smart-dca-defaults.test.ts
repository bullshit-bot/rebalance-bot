import { describe, expect, it } from "bun:test";

/**
 * Tests to verify Smart DCA default values are consistent
 * across backtest engine, schema, and DCA service.
 * Exposes the bug where backtest used 0.75 but schema/live used 0.5.
 */
describe("Smart DCA default consistency", () => {
  it("backtest simulator uses 0.5 as default highMultiplier", async () => {
    // Read backtest-simulator.ts source and verify default
    const source = await Bun.file("src/backtesting/backtest-simulator.ts").text();
    expect(source).toContain("config.smartDcaHighMultiplier ?? 0.5");
    expect(source).not.toContain("config.smartDcaHighMultiplier ?? 0.75");
  });

  it("GlobalSettings schema uses 0.5 as default highMultiplier", async () => {
    const source = await Bun.file("src/rebalancer/strategies/strategy-config-types.ts").text();
    expect(source).toContain("smartDcaHighMultiplier: z.number().min(0.1).max(1).default(0.5)");
  });

  it("DCA service uses 0.5 as default highMultiplier", async () => {
    const source = await Bun.file("src/dca/dca-service.ts").text();
    expect(source).toContain('smartDcaHighMultiplier === "number" ? gs.smartDcaHighMultiplier : 0.5');
  });

  it("backtest simulator uses 1.5 as default dipMultiplier", async () => {
    const source = await Bun.file("src/backtesting/backtest-simulator.ts").text();
    expect(source).toContain("config.smartDcaDipMultiplier ?? 1.5");
  });
});
