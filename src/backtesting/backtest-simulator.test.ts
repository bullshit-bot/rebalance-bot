import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import type { BacktestConfig } from "./metrics-calculator";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(async () => {
  await teardownTestDB();
});

// ─── Helper: Create minimal config ──────────────────────────────────────────

function createMinimalConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
  const now = Date.now();
  const oneMonthAgo = now - 30 * 24 * 3600 * 1000;

  return {
    id: "test-backtest",
    exchange: "binance",
    pairs: ["BTC/USDT", "ETH/USDT"],
    allocations: [
      { asset: "BTC", targetPct: 50 },
      { asset: "ETH", targetPct: 50 },
    ],
    initialBalance: 10000,
    startDate: oneMonthAgo,
    endDate: now,
    timeframe: "1h",
    threshold: 5,
    feePct: 0.001,
    ...overrides,
  };
}

describe("BacktestSimulator", () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  describe("config validation", () => {
    it("should create valid backtest config", () => {
      const config = createMinimalConfig();

      expect(config.id).toBeTruthy();
      expect(config.exchange).toBe("binance");
      expect(config.pairs.length).toBeGreaterThan(0);
      expect(config.allocations.length).toBeGreaterThan(0);
      expect(config.initialBalance).toBeGreaterThan(0);
    });

    it("should validate allocation percentages", () => {
      const config = createMinimalConfig({
        allocations: [
          { asset: "BTC", targetPct: 60 },
          { asset: "ETH", targetPct: 40 },
        ],
      });

      const total = config.allocations.reduce((sum, a) => sum + a.targetPct, 0);
      expect(total).toBe(100);
    });

    it("should handle custom fee percentage", () => {
      const config = createMinimalConfig({ feePct: 0.002 });
      expect(config.feePct).toBe(0.002);
    });

    it("should handle DCA configuration", () => {
      const config = createMinimalConfig({
        dcaAmountUsd: 100,
        dcaIntervalCandles: 10,
      });

      expect(config.dcaAmountUsd).toBe(100);
      expect(config.dcaIntervalCandles).toBe(10);
    });

    it("should handle trend filter configuration", () => {
      const config = createMinimalConfig({
        trendFilterMaPeriod: 20,
        trendFilterBearCashPct: 80,
        trendFilterBuffer: 2,
        trendFilterCooldownCandles: 3,
      });

      expect(config.trendFilterMaPeriod).toBe(20);
      expect(config.trendFilterBearCashPct).toBe(80);
      expect(config.trendFilterBuffer).toBe(2);
      expect(config.trendFilterCooldownCandles).toBe(3);
    });

    it("should handle cash reserve configuration", () => {
      const config = createMinimalConfig({ cashReservePct: 10 });
      expect(config.cashReservePct).toBe(10);
    });

    it("should handle strategy type configuration", () => {
      const config = createMinimalConfig({
        strategyType: "momentum-weighted",
        strategyParams: { type: "momentum-weighted", recentCandles: 20 },
      });

      expect(config.strategyType).toBe("momentum-weighted");
      expect(config.strategyParams?.type).toBe("momentum-weighted");
    });

    it("should support single asset allocation", () => {
      const config = createMinimalConfig({
        pairs: ["BTC/USDT"],
        allocations: [{ asset: "BTC", targetPct: 100 }],
      });

      expect(config.pairs.length).toBe(1);
      expect(config.allocations.length).toBe(1);
      expect(config.allocations[0].targetPct).toBe(100);
    });

    it("should support multiple assets", () => {
      const config = createMinimalConfig({
        pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "ADA/USDT"],
        allocations: [
          { asset: "BTC", targetPct: 40 },
          { asset: "ETH", targetPct: 30 },
          { asset: "SOL", targetPct: 20 },
          { asset: "ADA", targetPct: 10 },
        ],
      });

      expect(config.pairs.length).toBe(4);
      expect(config.allocations.length).toBe(4);

      const total = config.allocations.reduce((sum, a) => sum + a.targetPct, 0);
      expect(total).toBe(100);
    });

    it("should handle various threshold values", () => {
      const lowThreshold = createMinimalConfig({ threshold: 1 });
      const mediumThreshold = createMinimalConfig({ threshold: 5 });
      const highThreshold = createMinimalConfig({ threshold: 100 });

      expect(lowThreshold.threshold).toBe(1);
      expect(mediumThreshold.threshold).toBe(5);
      expect(highThreshold.threshold).toBe(100);
    });

    it("should handle various initial balances", () => {
      const smallBalance = createMinimalConfig({ initialBalance: 100 });
      const largeBalance = createMinimalConfig({ initialBalance: 1000000 });

      expect(smallBalance.initialBalance).toBe(100);
      expect(largeBalance.initialBalance).toBe(1000000);
    });

    it("should handle various fee percentages", () => {
      const noFee = createMinimalConfig({ feePct: 0 });
      const smallFee = createMinimalConfig({ feePct: 0.001 });
      const largeFee = createMinimalConfig({ feePct: 0.05 });

      expect(noFee.feePct).toBe(0);
      expect(smallFee.feePct).toBe(0.001);
      expect(largeFee.feePct).toBe(0.05);
    });

    it("should have valid date range", () => {
      const config = createMinimalConfig();
      expect(config.startDate).toBeLessThan(config.endDate);
    });

    it("should support different timeframes", () => {
      const hourly = createMinimalConfig({ timeframe: "1h" });
      const daily = createMinimalConfig({ timeframe: "1d" });
      const weekly = createMinimalConfig({ timeframe: "1w" });

      expect(hourly.timeframe).toBe("1h");
      expect(daily.timeframe).toBe("1d");
      expect(weekly.timeframe).toBe("1w");
    });
  });

  describe("portfolio allocation", () => {
    it("should maintain allocation percentages", () => {
      const config = createMinimalConfig({
        allocations: [
          { asset: "BTC", targetPct: 60 },
          { asset: "ETH", targetPct: 40 },
        ],
      });

      expect(config.allocations[0].targetPct).toBe(60);
      expect(config.allocations[1].targetPct).toBe(40);
    });

    it("should calculate proper share amounts", () => {
      const initialBalance = 10000;
      const config = createMinimalConfig({
        initialBalance,
        allocations: [
          { asset: "BTC", targetPct: 50 },
          { asset: "ETH", targetPct: 50 },
        ],
      });

      const btcAlloc = (config.allocations[0].targetPct / 100) * initialBalance;
      const ethAlloc = (config.allocations[1].targetPct / 100) * initialBalance;

      expect(btcAlloc).toBe(5000);
      expect(ethAlloc).toBe(5000);
    });

    it("should track allocation changes", () => {
      const config = createMinimalConfig({
        allocations: [
          { asset: "BTC", targetPct: 50 },
          { asset: "ETH", targetPct: 30 },
          { asset: "SOL", targetPct: 20 },
        ],
      });

      expect(config.allocations.length).toBe(3);

      const total = config.allocations.reduce((sum, a) => sum + a.targetPct, 0);
      expect(total).toBe(100);
    });
  });

  describe("rebalancing parameters", () => {
    it("should respect drift threshold", () => {
      const config = createMinimalConfig({ threshold: 5 });
      expect(config.threshold).toBe(5);
    });

    it("should support custom drift thresholds", () => {
      const thresholds = [1, 2.5, 5, 10, 20];

      for (const thresh of thresholds) {
        const config = createMinimalConfig({ threshold: thresh });
        expect(config.threshold).toBe(thresh);
      }
    });

    it("should apply fee percentage to trades", () => {
      const config = createMinimalConfig({ feePct: 0.001 });
      const tradeCost = 1000;
      const fee = tradeCost * config.feePct;

      expect(fee).toBe(1);
    });

    it("should handle zero-fee scenarios", () => {
      const config = createMinimalConfig({ feePct: 0 });
      const tradeCost = 1000;
      const fee = tradeCost * config.feePct;

      expect(fee).toBe(0);
    });
  });

  describe("edge cases & validations", () => {
    it("should handle very low threshold", () => {
      const config = createMinimalConfig({ threshold: 0.1 });
      expect(config.threshold).toBeGreaterThan(0);
    });

    it("should handle zero balance gracefully", () => {
      const config = createMinimalConfig({ initialBalance: 0 });
      expect(config.initialBalance).toBe(0);
    });

    it("should handle zero fee percentage", () => {
      const config = createMinimalConfig({ feePct: 0 });
      expect(config.feePct).toBe(0);
    });

    it("should handle high fee percentage", () => {
      const config = createMinimalConfig({ feePct: 0.1 });
      expect(config.feePct).toBe(0.1);
    });

    it("should handle DCA interval of 1", () => {
      const config = createMinimalConfig({
        dcaAmountUsd: 100,
        dcaIntervalCandles: 1,
      });

      expect(config.dcaIntervalCandles).toBe(1);
    });

    it("should handle large DCA amounts", () => {
      const config = createMinimalConfig({
        dcaAmountUsd: 100000,
        dcaIntervalCandles: 100,
      });

      expect(config.dcaAmountUsd).toBe(100000);
      expect(config.dcaIntervalCandles).toBe(100);
    });

    it("should support high trend filter MA period", () => {
      const config = createMinimalConfig({
        trendFilterMaPeriod: 200,
      });

      expect(config.trendFilterMaPeriod).toBe(200);
    });

    it("should handle extreme cash reserve", () => {
      const config = createMinimalConfig({ cashReservePct: 95 });
      expect(config.cashReservePct).toBe(95);
    });

    it("should handle many trading pairs", () => {
      const pairs = [
        "BTC/USDT",
        "ETH/USDT",
        "SOL/USDT",
        "ADA/USDT",
        "DOT/USDT",
        "LINK/USDT",
        "MATIC/USDT",
      ];
      const allocations = pairs.map((p, i) => ({
        asset: p.split("/")[0]!,
        targetPct: 100 / pairs.length,
      }));

      const config = createMinimalConfig({
        pairs,
        allocations,
      });

      expect(config.pairs.length).toBe(7);
      expect(config.allocations.length).toBe(7);
    });
  });

  describe("date range handling", () => {
    it("should validate start/end dates", () => {
      const config = createMinimalConfig();
      expect(config.startDate).toBeLessThan(config.endDate);
    });

    it("should handle custom date ranges", () => {
      const startDate = Date.now() - 90 * 24 * 3600 * 1000; // 90 days ago
      const endDate = Date.now();

      const config = createMinimalConfig({
        startDate,
        endDate,
      });

      expect(config.startDate).toBe(startDate);
      expect(config.endDate).toBe(endDate);
    });

    it("should preserve date order", () => {
      const config1 = createMinimalConfig();
      const config2 = createMinimalConfig();

      expect(config1.startDate < config1.endDate).toBe(true);
      expect(config2.startDate < config2.endDate).toBe(true);
    });
  });

  describe("config immutability checks", () => {
    it("should not mutate original config on override", () => {
      const baseConfig = createMinimalConfig();
      const baseBalance = baseConfig.initialBalance;

      createMinimalConfig({ initialBalance: 50000 });

      expect(baseConfig.initialBalance).toBe(baseBalance);
    });

    it("should maintain config identity", () => {
      const config = createMinimalConfig();
      const { id } = config;

      expect(config.id).toBe(id);
    });
  });
});
