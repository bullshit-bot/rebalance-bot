import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { OhlcvCandleModel } from "@db/database";
import { backtestSimulator } from "./backtest-simulator";

/**
 * Tests to verify Smart DCA default values are consistent
 * across backtest engine, schema, and DCA service.
 * Exposes the bug where backtest used 0.75 but schema/live used 0.5.
 */
describe("Smart DCA + Trailing Stop default consistency", () => {
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

describe("Trailing stop backtest simulation", () => {
  beforeAll(async () => {
    await setupTestDB();
    // Seed 30 days of BTC data: rises to peak then crashes 25%
    const start = new Date("2024-01-01").getTime();
    const candles = [];
    for (let i = 0; i < 30; i++) {
      const ts = start + i * 86400000;
      // Price rises from 40k to 50k (days 0-14), then crashes to 37.5k (days 15-29)
      let price: number;
      if (i < 15) {
        price = 40000 + (i * 10000) / 14; // 40k → 50k
      } else {
        price = 50000 - ((i - 14) * 12500) / 15; // 50k → 37.5k
      }
      candles.push({
        exchange: "binance", pair: "BTC/USDT", timeframe: "1d",
        timestamp: ts, open: price, high: price * 1.01, low: price * 0.99,
        close: price, volume: 1000,
      });
    }
    await OhlcvCandleModel.insertMany(candles);
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("trailing stop sells asset when price drops from peak", async () => {
    const result = await backtestSimulator.run({
      pairs: ["BTC/USDT"],
      allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" as const, minTradeUsd: 10 }],
      startDate: new Date("2024-01-01").getTime(),
      endDate: new Date("2024-01-30").getTime(),
      initialBalance: 1000,
      threshold: 50, // high threshold to prevent normal rebalance
      feePct: 0.001,
      timeframe: "1d" as const,
      exchange: "binance" as const,
      trailingStopPct: 15,
      trailingStopCooldownCandles: 5,
    });

    // Should have at least one sell trade from trailing stop
    const sells = result.trades.filter((t) => t.side === "sell");
    expect(sells.length).toBeGreaterThan(0);
  });

  it("no trailing stop trades when trailingStopPct is 0", async () => {
    const result = await backtestSimulator.run({
      pairs: ["BTC/USDT"],
      allocations: [{ asset: "BTC", targetPct: 100, exchange: "binance" as const, minTradeUsd: 10 }],
      startDate: new Date("2024-01-01").getTime(),
      endDate: new Date("2024-01-30").getTime(),
      initialBalance: 1000,
      threshold: 50,
      feePct: 0.001,
      timeframe: "1d" as const,
      exchange: "binance" as const,
      trailingStopPct: 0,
    });

    // No trailing stop sells — only initial buy
    const sells = result.trades.filter((t) => t.side === "sell");
    expect(sells.length).toBe(0);
  });
});
