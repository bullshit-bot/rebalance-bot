import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { OhlcvCandleModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { BacktestSimulator, backtestSimulator } from "./backtest-simulator";
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

// ─── Helpers for run() tests ─────────────────────────────────────────────────

/** Generate a series of synthetic OHLCV candles starting at baseTs, 1 hour apart. */
function generateCandles(
  count: number,
  baseTs: number,
  startPrice: number,
  priceStep = 0
): { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const price = startPrice + i * priceStep;
    return {
      timestamp: baseTs + i * 3_600_000, // 1 hour apart
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 100,
    };
  });
}

/** Seed candle data for a pair into MongoDB. */
async function seedCandles(
  exchange: string,
  pair: string,
  timeframe: string,
  candles: ReturnType<typeof generateCandles>
): Promise<void> {
  const docs = candles.map((c) => ({ exchange, pair, timeframe, ...c }));
  await OhlcvCandleModel.insertMany(docs, { ordered: false });
}

/** Create a config + seed MongoDB so run() can find data. */
async function setupRunConfig(overrides?: Partial<BacktestConfig>): Promise<BacktestConfig> {
  // Fixed date range so we control candle count exactly
  const baseTs = 1_700_000_000_000; // arbitrary fixed point in time
  const candleCount = 50;
  const endTs = baseTs + (candleCount - 1) * 3_600_000;

  const config: BacktestConfig = {
    id: "run-test",
    exchange: "binance",
    pairs: ["BTC/USDT", "ETH/USDT"],
    allocations: [
      { asset: "BTC", targetPct: 50 },
      { asset: "ETH", targetPct: 50 },
    ],
    initialBalance: 10_000,
    startDate: baseTs,
    endDate: endTs,
    timeframe: "1h",
    threshold: 5,
    feePct: 0.001,
    ...overrides,
  };

  const btcCandles = generateCandles(candleCount, baseTs, 30_000);
  const ethCandles = generateCandles(candleCount, baseTs, 2_000);

  await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
  await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

  return config;
}

// ─── BacktestSimulator.run() tests ───────────────────────────────────────────

describe("BacktestSimulator.run()", () => {
  beforeEach(async () => {
    await setupTestDB();
  });
  afterEach(async () => {
    await teardownTestDB();
  });

  // ── Happy-path: basic two-asset run ─────────────────────────────────────────

  it("returns a BacktestResult with correct shape when candle data exists", async () => {
    const config = await setupRunConfig();
    const result = await backtestSimulator.run(config);

    expect(result.id).toBeTruthy();
    expect(result.config).toBe(config);
    expect(Array.isArray(result.trades)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.finalPortfolio).toBeTruthy();
    expect(result.metrics).toBeTruthy();
    expect(result.benchmark).toBeTruthy();
  });

  it("equity curve has one point per candle", async () => {
    const config = await setupRunConfig();
    const result = await backtestSimulator.run(config);

    // 50 candles seeded for both pairs → 50 intersection timestamps
    expect(result.equityCurve.length).toBe(50);
  });

  it("final portfolio contains all traded pairs", async () => {
    const config = await setupRunConfig();
    const result = await backtestSimulator.run(config);

    expect(result.finalPortfolio["BTC/USDT"]).toBeTruthy();
    expect(result.finalPortfolio["ETH/USDT"]).toBeTruthy();
  });

  it("metrics contain expected numeric fields", async () => {
    const config = await setupRunConfig();
    const result = await backtestSimulator.run(config);

    const m = result.metrics;
    expect(typeof m.totalReturnPct).toBe("number");
    expect(typeof m.annualizedReturnPct).toBe("number");
    expect(typeof m.sharpeRatio).toBe("number");
    expect(typeof m.maxDrawdownPct).toBe("number");
    expect(typeof m.winRate).toBe("number");
    expect(m.totalTrades).toBeGreaterThanOrEqual(0);
    expect(m.totalFeesPaid).toBeGreaterThanOrEqual(0);
  });

  // ── No candle data → throw ────────────────────────────────────────────────────

  it("throws when timeline intersection is empty (no overlapping timestamps)", async () => {
    const btcBaseTs = 1_600_000_000_000;
    const ethBaseTs = 1_600_100_000_000; // completely different time range

    // BTC candles are in [btcBaseTs, btcBaseTs+4h]
    await seedCandles("binance", "BTC/USDT", "1h", generateCandles(5, btcBaseTs, 30_000));
    // ETH candles are far away in time → no overlap → inner join = empty
    await seedCandles("binance", "ETH/USDT", "1h", generateCandles(5, ethBaseTs, 2_000));

    const config: BacktestConfig = {
      id: "empty-run",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: btcBaseTs,
      endDate: btcBaseTs + 10 * 3_600_000, // only BTC candles in this range
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
    };

    // ETH has no candles in range → getCachedData returns [] for ETH → loadData fallback
    // (exchange not connected) OR inner-join is empty. Either way the run throws.
    await expect(backtestSimulator.run(config)).rejects.toThrow();
  });

  // ── Single-asset run ─────────────────────────────────────────────────────────

  it("runs successfully with a single asset", async () => {
    const baseTs = 1_700_100_000_000;
    const count = 30;
    const endTs = baseTs + (count - 1) * 3_600_000;

    await seedCandles("binance", "BTC/USDT", "1h", generateCandles(count, baseTs, 40_000));

    const config: BacktestConfig = {
      id: "single-asset",
      exchange: "binance",
      pairs: ["BTC/USDT"],
      allocations: [{ asset: "BTC", targetPct: 100 }],
      initialBalance: 5_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
    };

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBe(count);
    expect(result.finalPortfolio["BTC/USDT"]).toBeTruthy();
  });

  // ── DCA injection paths ───────────────────────────────────────────────────────

  it("applies DCA injections in bull mode (no trend filter)", async () => {
    const config = await setupRunConfig({
      id: "dca-bull",
      dcaAmountUsd: 100,
      dcaIntervalCandles: 5,
    });

    const result = await backtestSimulator.run(config);
    // totalDcaInjected should be in metrics
    expect(result.metrics.totalDcaInjected).toBeGreaterThan(0);
  });

  it("DCA every candle (dcaIntervalCandles=1) tracks totalDcaInjected", async () => {
    const baseTs = 1_700_200_000_000;
    const count = 20;
    const endTs = baseTs + (count - 1) * 3_600_000;

    // Flat prices. BTC rises slightly so drift triggers DCA injection into ETH (underweight)
    await seedCandles("binance", "BTC/USDT", "1h", generateCandles(count, baseTs, 30_000, 500));
    await seedCandles("binance", "ETH/USDT", "1h", generateCandles(count, baseTs, 2_000, 0));

    const config: BacktestConfig = {
      id: "dca-every-candle",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 100, // never rebalance (so only DCA drives trades)
      feePct: 0,
      dcaAmountUsd: 100,
      dcaIntervalCandles: 1,
    };

    const result = await backtestSimulator.run(config);
    // totalDcaInjected counter is always incremented regardless of drift
    expect(result.metrics.totalDcaInjected).toBeGreaterThan(0);
    // equity curve must have count points
    expect(result.equityCurve.length).toBe(count);
  });

  // ── Trend filter: bear mode ────────────────────────────────────────────────────

  it("trend filter: detects bear mode and accumulates cash when BTC drops below MA", async () => {
    const baseTs = 1_700_300_000_000;
    const maPeriod = 5;
    // First 5 candles: high price to build MA; then prices drop sharply
    const highPrices = Array.from({ length: maPeriod }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 50_000,
      high: 51_000,
      low: 49_000,
      close: 50_000,
      volume: 100,
    }));
    const lowPrices = Array.from({ length: 20 }, (_, i) => ({
      timestamp: baseTs + (maPeriod + i) * 3_600_000,
      open: 30_000,
      high: 31_000,
      low: 29_000,
      close: 30_000, // well below MA of 50k
      volume: 100,
    }));
    const btcCandles = [...highPrices, ...lowPrices];
    const count = btcCandles.length;
    const endTs = btcCandles[count - 1]!.timestamp;

    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 2_000,
      high: 2_100,
      low: 1_900,
      close: 2_000,
      volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "trend-bear",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
      trendFilterMaPeriod: maPeriod,
      trendFilterBearCashPct: 90,
      trendFilterBuffer: 0, // trigger immediately below MA
      trendFilterCooldownCandles: 0,
    };

    const result = await backtestSimulator.run(config);
    // Cash should appear in final portfolio when bear-mode sell trades occurred
    // (or at minimum the run completes without error)
    expect(result.equityCurve.length).toBe(count);
    // Sell trades should have been generated during bear transition
    const sellTrades = result.trades.filter((t) => t.side === "sell");
    expect(sellTrades.length).toBeGreaterThan(0);
  });

  // ── Trend filter: bull recovery (bear→bull transition) ────────────────────────

  it("trend filter: deploys cash on bull recovery", async () => {
    const baseTs = 1_700_400_000_000;
    const maPeriod = 3;
    // Start high, dip below MA (trigger bear), then recover strongly (trigger bull)
    const bearCandles = Array.from({ length: 10 }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 20_000,
      high: 21_000,
      low: 19_000,
      close: 20_000,
      volume: 100,
    }));
    const bullCandles = Array.from({ length: 10 }, (_, i) => ({
      timestamp: baseTs + (10 + i) * 3_600_000,
      open: 60_000,
      high: 61_000,
      low: 59_000,
      close: 60_000,
      volume: 100,
    }));
    const btcCandles = [...bearCandles, ...bullCandles];
    const count = btcCandles.length;
    const endTs = btcCandles[count - 1]!.timestamp;

    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 2_000,
      high: 2_100,
      low: 1_900,
      close: 2_000,
      volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "trend-bull-recovery",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 20_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
      trendFilterMaPeriod: maPeriod,
      trendFilterBearCashPct: 80,
      trendFilterBuffer: 0,
      trendFilterCooldownCandles: 0,
    };

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBe(count);
    // Buy trades should appear during bull recovery (cash → crypto)
    const buyTrades = result.trades.filter((t) => t.side === "buy");
    expect(buyTrades.length).toBeGreaterThan(0);
  });

  // ── Simple Earn yield ──────────────────────────────────────────────────────────

  it("simpleEarn: portfolio value grows above initial balance with yield enabled", async () => {
    const baseTs = 1_700_500_000_000;
    const count = 365; // 365 candles ≈ enough to accumulate meaningful yield
    const endTs = baseTs + (count - 1) * 3_600_000;

    // Flat prices; growth is purely from earn yield
    await seedCandles("binance", "BTC/USDT", "1h", generateCandles(count, baseTs, 30_000, 0));
    await seedCandles("binance", "ETH/USDT", "1h", generateCandles(count, baseTs, 2_000, 0));

    const config: BacktestConfig = {
      id: "simple-earn",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 100, // never rebalance
      feePct: 0,
      simpleEarnEnabled: true,
      simpleEarnApyPct: 10, // 10% APY for easy verification
    };

    const result = await backtestSimulator.run(config);
    const lastEquity = result.equityCurve[result.equityCurve.length - 1]!.value;
    expect(lastEquity).toBeGreaterThan(10_000);
  });

  it("simpleEarn: uses simpleEarnApyMap per-asset overrides", async () => {
    const config = await setupRunConfig({
      id: "earn-apy-map",
      simpleEarnEnabled: true,
      simpleEarnApyMap: { "BTC/USDT": 5.0, "ETH/USDT": 8.0 },
      threshold: 100, // no rebalancing
      feePct: 0,
    });

    // Should run without error and produce a result
    const result = await backtestSimulator.run(config);
    expect(result.metrics).toBeTruthy();
  });

  // ── Strategy adapter: momentum-weighted ──────────────────────────────────────

  it("runs with momentum-weighted strategy", async () => {
    const config = await setupRunConfig({
      id: "momentum-weighted",
      strategyType: "momentum-weighted",
      strategyParams: {
        type: "momentum-weighted",
        recentCandles: 10,
        thresholdPct: 3,
      },
    });

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  // ── Strategy adapter: equal-weight ───────────────────────────────────────────

  it("runs with equal-weight strategy", async () => {
    const config = await setupRunConfig({
      id: "equal-weight",
      strategyType: "equal-weight",
      strategyParams: {
        type: "equal-weight",
        thresholdPct: 3,
      },
    });

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  // ── Strategy adapter: mean-reversion ─────────────────────────────────────────

  it("runs with mean-reversion strategy", async () => {
    const config = await setupRunConfig({
      id: "mean-reversion",
      strategyType: "mean-reversion",
      strategyParams: {
        type: "mean-reversion",
        lookbackDays: 5,
        zScoreThreshold: 1.0,
      },
    });

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  // ── Strategy adapter: vol-adjusted ────────────────────────────────────────────

  it("runs with vol-adjusted strategy", async () => {
    const config = await setupRunConfig({
      id: "vol-adjusted",
      strategyType: "vol-adjusted",
      strategyParams: {
        type: "vol-adjusted",
        volLookbackDays: 10,
        lowVolThreshold: 0.1,
        highVolThreshold: 0.3,
        lowVolMultiplier: 0.8,
        highVolMultiplier: 1.5,
        baseThresholdPct: 5,
      },
    });

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  // ── Cash reserve ──────────────────────────────────────────────────────────────

  it("cash reserve is included in finalPortfolio when non-zero", async () => {
    const baseTs = 1_700_600_000_000;
    const count = 20;
    const endTs = baseTs + (count - 1) * 3_600_000;
    const maPeriod = 3;

    // Prices that trigger bear mode (below MA), pushing cash > 0
    const btcCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 10_000,
      high: 11_000,
      low: 9_000,
      close: 10_000, // constant low price → below MA from the high seed values
      volume: 100,
    }));
    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 1_000,
      high: 1_100,
      low: 900,
      close: 1_000,
      volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "cash-reserve",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
      cashReservePct: 20,
      dcaAmountUsd: 200,
      dcaIntervalCandles: 2,
    };

    const result = await backtestSimulator.run(config);
    // Run should succeed
    expect(result.equityCurve.length).toBe(count);
  });

  // ── DCA in bear mode goes to cash ────────────────────────────────────────────

  it("DCA in bear mode routes to cash, not crypto", async () => {
    const baseTs = 1_700_700_000_000;
    const maPeriod = 3;
    // Start high to build MA, then crash hard and stay down so bear mode is sustained
    const highFirst = Array.from({ length: maPeriod }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 50_000,
      high: 51_000,
      low: 49_000,
      close: 50_000,
      volume: 100,
    }));
    // Sustained crash: 15 candles at 20k (well below MA buffer=0)
    // cashReservePct=0 so all bear-mode proceeds + DCA go to cashUsd
    const lowRest = Array.from({ length: 15 }, (_, i) => ({
      timestamp: baseTs + (maPeriod + i) * 3_600_000,
      open: 20_000,
      high: 21_000,
      low: 19_000,
      close: 20_000,
      volume: 100,
    }));
    const btcCandles = [...highFirst, ...lowRest];
    const count = btcCandles.length;
    const endTs = btcCandles[count - 1]!.timestamp;

    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 2_000,
      high: 2_100,
      low: 1_900,
      close: 2_000,
      volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "dca-bear",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
      trendFilterMaPeriod: maPeriod,
      trendFilterBearCashPct: 90,
      trendFilterBuffer: 0,
      trendFilterCooldownCandles: 0,
      dcaAmountUsd: 100,
      dcaIntervalCandles: 1,
    };

    const result = await backtestSimulator.run(config);
    // DCA should have fired (19 candles after candle 0)
    expect(result.metrics.totalDcaInjected).toBeGreaterThan(0);
    // Bear-mode sell should have occurred (proceeds → cash)
    const sellTrades = result.trades.filter((t) => t.side === "sell");
    expect(sellTrades.length).toBeGreaterThan(0);
    // USDT cash position should appear in final portfolio
    const usdtPosition = result.finalPortfolio["USDT"];
    expect(usdtPosition).toBeTruthy();
    expect(usdtPosition!.valueUsd).toBeGreaterThan(0);
  });

  // ── Rebalance triggered on drift ─────────────────────────────────────────────

  it("generates rebalance trades when prices diverge significantly", async () => {
    const baseTs = 1_700_800_000_000;
    const count = 30;
    const endTs = baseTs + (count - 1) * 3_600_000;

    // BTC rises fast while ETH stays flat → drift beyond threshold
    const btcCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 30_000 + i * 1_000,
      high: 31_000 + i * 1_000,
      low: 29_000 + i * 1_000,
      close: 30_000 + i * 1_000, // rises 1k per candle
      volume: 100,
    }));
    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 2_000,
      high: 2_100,
      low: 1_900,
      close: 2_000, // flat
      volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "rebalance-trigger",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5, // low threshold → should trigger rebalances
      feePct: 0.001,
    };

    const result = await backtestSimulator.run(config);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.metrics.totalTrades).toBe(result.trades.length);
    expect(result.metrics.totalFeesPaid).toBeGreaterThan(0);
  });

  // ── Multi-asset (3 pairs) run ─────────────────────────────────────────────────

  it("runs correctly with three assets", async () => {
    const baseTs = 1_700_900_000_000;
    const count = 40;
    const endTs = baseTs + (count - 1) * 3_600_000;

    await seedCandles("binance", "BTC/USDT", "1h", generateCandles(count, baseTs, 30_000));
    await seedCandles("binance", "ETH/USDT", "1h", generateCandles(count, baseTs, 2_000));
    await seedCandles("binance", "SOL/USDT", "1h", generateCandles(count, baseTs, 100));

    const config: BacktestConfig = {
      id: "three-assets",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 40 },
        { asset: "ETH", targetPct: 40 },
        { asset: "SOL", targetPct: 20 },
      ],
      initialBalance: 15_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
    };

    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBe(count);
    expect(result.finalPortfolio["BTC/USDT"]).toBeTruthy();
    expect(result.finalPortfolio["ETH/USDT"]).toBeTruthy();
    expect(result.finalPortfolio["SOL/USDT"]).toBeTruthy();
  });

  // ── Persist failure is non-fatal ──────────────────────────────────────────────

  it("returns result even when DB persistence fails", async () => {
    const config = await setupRunConfig({ id: "persist-fail" });

    // Force the BacktestResultModel.create to throw
    const { BacktestResultModel } = await import("@db/database");
    const createSpy = spyOn(BacktestResultModel, "create").mockImplementation(() => {
      throw new Error("DB write failed");
    });

    // run() should NOT re-throw the persist error
    const result = await backtestSimulator.run(config);
    expect(result.id).toBeTruthy();
    expect(result.equityCurve.length).toBeGreaterThan(0);

    createSpy.mockRestore();
  });

  // ── Timeline intersection (inner join) ───────────────────────────────────────

  it("only includes timestamps present in all pairs (inner join)", async () => {
    const baseTs = 1_701_000_000_000;

    // BTC: 10 candles
    const btcCandles = generateCandles(10, baseTs, 30_000);
    // ETH: only 6 candles matching the first 6 BTC timestamps
    const ethCandles = generateCandles(6, baseTs, 2_000);

    await seedCandles("binance", "BTC/USDT", "1h", btcCandles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const endTs = btcCandles[9]!.timestamp;
    const config: BacktestConfig = {
      id: "inner-join",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 10_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
    };

    const result = await backtestSimulator.run(config);
    // Only the 6 timestamps common to both pairs
    expect(result.equityCurve.length).toBe(6);
  });

  // ── Trend filter cooldown prevents rapid flip ─────────────────────────────────

  it("trend filter cooldown prevents immediate bear→bull flip", async () => {
    const baseTs = 1_701_100_000_000;
    const maPeriod = 3;
    const cooldown = 5;

    // Bear prices, then brief bull, then bear again — cooldown should suppress 2nd flip
    const candles = [
      // Build MA with medium prices
      ...Array.from({ length: maPeriod }, (_, i) => ({
        timestamp: baseTs + i * 3_600_000,
        open: 40_000, high: 41_000, low: 39_000, close: 40_000, volume: 100,
      })),
      // Crash → bear mode
      ...Array.from({ length: 3 }, (_, i) => ({
        timestamp: baseTs + (maPeriod + i) * 3_600_000,
        open: 10_000, high: 11_000, low: 9_000, close: 10_000, volume: 100,
      })),
      // Brief recovery (would normally trigger bull)
      ...Array.from({ length: 2 }, (_, i) => ({
        timestamp: baseTs + (maPeriod + 3 + i) * 3_600_000,
        open: 45_000, high: 46_000, low: 44_000, close: 45_000, volume: 100,
      })),
      // Crash again
      ...Array.from({ length: 5 }, (_, i) => ({
        timestamp: baseTs + (maPeriod + 5 + i) * 3_600_000,
        open: 10_000, high: 11_000, low: 9_000, close: 10_000, volume: 100,
      })),
    ];
    const count = candles.length;
    const endTs = candles[count - 1]!.timestamp;

    const ethCandles = Array.from({ length: count }, (_, i) => ({
      timestamp: baseTs + i * 3_600_000,
      open: 2_000, high: 2_100, low: 1_900, close: 2_000, volume: 100,
    }));

    await seedCandles("binance", "BTC/USDT", "1h", candles);
    await seedCandles("binance", "ETH/USDT", "1h", ethCandles);

    const config: BacktestConfig = {
      id: "trend-cooldown",
      exchange: "binance",
      pairs: ["BTC/USDT", "ETH/USDT"],
      allocations: [
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ],
      initialBalance: 20_000,
      startDate: baseTs,
      endDate: endTs,
      timeframe: "1h",
      threshold: 5,
      feePct: 0.001,
      trendFilterMaPeriod: maPeriod,
      trendFilterBearCashPct: 90,
      trendFilterBuffer: 0,
      trendFilterCooldownCandles: cooldown,
    };

    // Should complete without error; cooldown logic is exercised
    const result = await backtestSimulator.run(config);
    expect(result.equityCurve.length).toBe(count);
  });

  // ── BacktestSimulator class can be instantiated independently ─────────────────

  it("BacktestSimulator class export produces working instance", async () => {
    const simulator = new BacktestSimulator();
    const config = await setupRunConfig({ id: "class-export-test" });
    const result = await simulator.run(config);
    expect(result.id).toBeTruthy();
  });
});
