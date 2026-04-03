// Non-isolated TrendFilter tests — runs in the main bun test suite.
// No mock.module() used. DB tests use real MongoDB via test-helpers.
// Event emission verified via spyOn(eventBus, 'emit').

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn, test } from "bun:test";
import mongoose from "mongoose";

import { OhlcvCandleModel } from "@db/models/ohlcv-candle-model";
import { eventBus } from "@events/event-bus";
import { TrendFilter } from "./trend-filter";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seed `count` daily closes into a fresh TrendFilter's private array. */
function seedCloses(f: TrendFilter, prices: number[]): void {
  (f as any).dailyCloses = [...prices];
  (f as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);
}

/** Seed 100 entries at basePrice, override last entry to lastPrice. */
function seed100(f: TrendFilter, basePrice: number, lastPrice: number): void {
  const arr: number[] = [];
  for (let i = 0; i < 100; i++) arr.push(basePrice);
  arr[99] = lastPrice;
  seedCloses(f, arr);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

// Connect once for the whole suite and disconnect at the end.
// beforeAll ensures the OhlcvCandleModel collection is registered
// before any individual test's setupTestDB() call enumerates collections.
beforeAll(async () => {
  const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/rebalance-test";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  // Wipe any stale data from previous runs
  await OhlcvCandleModel.deleteMany({});
});

afterAll(async () => {
  await OhlcvCandleModel.deleteMany({});
});

describe("TrendFilter (non-isolated)", () => {
  let filter: TrendFilter;

  beforeEach(() => {
    filter = new TrendFilter();
  });

  // Drain any fire-and-forget DB writes from recordPrice / isBullishWithCooldown
  // before subsequent tests pick up. Without this, upserts from one test's
  // fire-and-forget land in the DB after the next test's beforeEach cleanup.
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 20));
    await OhlcvCandleModel.deleteMany({});
  });

  // ─── getCurrentPrice ──────────────────────────────────────────────────────

  describe("getCurrentPrice", () => {
    test("returns 0 when no data", () => {
      expect(filter.getCurrentPrice()).toBe(0);
    });

    test("returns last recorded price", () => {
      seedCloses(filter, [10000, 20000, 30000]);
      expect(filter.getCurrentPrice()).toBe(30000);
    });
  });

  // ─── getDataPoints ────────────────────────────────────────────────────────

  describe("getDataPoints", () => {
    test("returns 0 initially", () => {
      expect(filter.getDataPoints()).toBe(0);
    });

    test("returns count after seeding prices", () => {
      seedCloses(filter, [1, 2, 3, 4, 5]);
      expect(filter.getDataPoints()).toBe(5);
    });
  });

  // ─── getLastFlipTimestamp ─────────────────────────────────────────────────

  describe("getLastFlipTimestamp", () => {
    test("returns 0 before any flip", () => {
      expect(filter.getLastFlipTimestamp()).toBe(0);
    });

    test("returns updated value after directly setting private field", () => {
      (filter as any).lastFlipTimestamp = 1234567890000;
      expect(filter.getLastFlipTimestamp()).toBe(1234567890000);
    });
  });

  // ─── getMA ────────────────────────────────────────────────────────────────

  describe("getMA", () => {
    test("returns null with insufficient data", () => {
      filter.recordPrice(50000);
      expect(filter.getMA(100)).toBeNull();
    });

    test("returns null when period exceeds data count", () => {
      for (let i = 0; i < 50; i++) (filter as any).dailyCloses.push(50000);
      expect(filter.getMA(100)).toBeNull();
    });

    test("returns correct SMA when data equals period", () => {
      for (let i = 0; i < 100; i++) (filter as any).dailyCloses.push(50000);
      expect(filter.getMA(100)).toBe(50000);
    });

    test("uses only last `period` entries in SMA calculation", () => {
      // 200 entries: first 100 at 40000, last 100 at 60000
      for (let i = 0; i < 100; i++) (filter as any).dailyCloses.push(40000);
      for (let i = 0; i < 100; i++) (filter as any).dailyCloses.push(60000);

      // MA(100) averages only last 100 entries → 60000
      expect(filter.getMA(100)).toBe(60000);
      // MA(200) averages all 200 entries → 50000
      expect(filter.getMA(200)).toBe(50000);
    });
  });

  // ─── recordPrice ─────────────────────────────────────────────────────────

  describe("recordPrice", () => {
    test("adds first data point and sets current price", () => {
      filter.recordPrice(50000);
      expect(filter.getDataPoints()).toBe(1);
      expect(filter.getCurrentPrice()).toBe(50000);
    });

    test("same-day call updates close without adding new entry", () => {
      // Both calls happen on the same calendar day (same Date.now())
      filter.recordPrice(50000);
      filter.recordPrice(51000);
      expect(filter.getDataPoints()).toBe(1);
      expect(filter.getCurrentPrice()).toBe(51000);
    });

    test("new day pushes new entry", () => {
      // Seed yesterday's data
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;
      (filter as any).dailyCloses.push(48000);

      filter.recordPrice(50000);

      expect(filter.getDataPoints()).toBe(2);
      expect(filter.getCurrentPrice()).toBe(50000);
    });

    test("caps dailyCloses at 400 entries when new day pushes over limit", () => {
      for (let i = 0; i < 400; i++) (filter as any).dailyCloses.push(50000 + i);
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;

      filter.recordPrice(99999);

      expect(filter.getDataPoints()).toBe(400);
      expect(filter.getCurrentPrice()).toBe(99999);
    });
  });

  // ─── isBullish ────────────────────────────────────────────────────────────

  describe("isBullish", () => {
    test("returns true (bull) when insufficient data — safe default", () => {
      expect(filter.isBullish()).toBe(true);
    });

    test("returns true when price is above MA", () => {
      seed100(filter, 50000, 55000);
      // MA ≈ 50045 (99 * 50000 + 55000) / 100, price 55000 → bull
      expect(filter.isBullish(100, 2)).toBe(true);
    });

    test("returns false when price is well below MA", () => {
      seed100(filter, 50000, 40000);
      // MA ≈ 49900, price 40000 → bear (> 2% below MA)
      expect(filter.isBullish(100, 2)).toBe(false);
    });

    test("respects buffer — price 1% below MA stays bull within 2% buffer", () => {
      seed100(filter, 50000, 49500);
      // MA ≈ 49995, price 49500 → within 2% buffer → still bull
      expect(filter.isBullish(100, 2)).toBe(true);
    });

    test("does NOT emit on first evaluation (lastBullish was null)", () => {
      const spy = spyOn(eventBus, "emit");
      seed100(filter, 50000, 55000);

      filter.isBullish(100, 2);

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test("does NOT emit when state stays the same (bull → bull)", () => {
      const spy = spyOn(eventBus, "emit");
      seed100(filter, 50000, 55000);

      filter.isBullish(100, 2); // establish bull
      filter.isBullish(100, 2); // still bull

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test("emits trend:changed on bull-to-bear flip", () => {
      const spy = spyOn(eventBus, "emit");
      seed100(filter, 50000, 55000);

      filter.isBullish(100, 2); // establish bull (no emit)
      expect(spy).not.toHaveBeenCalled();

      // Drop price into bear territory
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullish(100, 2); // flip → emit

      expect(spy).toHaveBeenCalledTimes(1);
      const [eventName, payload] = (spy.mock.calls[0] as [string, any]);
      expect(eventName).toBe("trend:changed");
      expect(payload.bullish).toBe(false);
      spy.mockRestore();
    });

    test("emits trend:changed on bear-to-bull flip", () => {
      const spy = spyOn(eventBus, "emit");
      seed100(filter, 50000, 40000);

      filter.isBullish(100, 2); // establish bear (no emit)
      expect(spy).not.toHaveBeenCalled();

      // Recover to bull
      (filter as any).dailyCloses[99] = 55000;
      filter.isBullish(100, 2); // flip → emit

      expect(spy).toHaveBeenCalledTimes(1);
      const [eventName, payload] = (spy.mock.calls[0] as [string, any]);
      expect(eventName).toBe("trend:changed");
      expect(payload.bullish).toBe(true);
      spy.mockRestore();
    });

    test("updates lastBullish on first call from null to true", () => {
      seed100(filter, 50000, 55000);
      filter.isBullish(100, 2);
      expect((filter as any).lastBullish).toBe(true);
    });

    test("updates lastBullish from true to false on flip", () => {
      seed100(filter, 50000, 55000);
      filter.isBullish(100, 2);
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullish(100, 2);
      expect((filter as any).lastBullish).toBe(false);
    });
  });

  // ─── isBullishReadOnly ────────────────────────────────────────────────────

  describe("isBullishReadOnly", () => {
    test("returns true when insufficient data (safe default)", () => {
      expect(filter.isBullishReadOnly()).toBe(true);
    });

    test("returns same result as isBullish for bull signal", () => {
      seed100(filter, 50000, 55000);
      expect(filter.isBullishReadOnly(100, 2)).toBe(filter.isBullish(100, 2));
    });

    test("returns same result as isBullish for bear signal", () => {
      seed100(filter, 50000, 40000);
      expect(filter.isBullishReadOnly(100, 2)).toBe(filter.isBullish(100, 2));
    });

    test("does NOT modify lastBullish state", () => {
      seed100(filter, 50000, 55000);
      expect((filter as any).lastBullish).toBeNull();
      filter.isBullishReadOnly(100, 2);
      expect((filter as any).lastBullish).toBeNull();
    });

    test("does NOT emit events even when price would flip state", () => {
      const spy = spyOn(eventBus, "emit");
      seed100(filter, 50000, 55000);

      // Establish bull via isBullish (sets lastBullish)
      filter.isBullish(100, 2);
      spy.mockReset();

      // Drop to bear — read-only should not emit
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullishReadOnly(100, 2);

      expect(spy).not.toHaveBeenCalled();
      // lastBullish still true (not mutated)
      expect((filter as any).lastBullish).toBe(true);
      spy.mockRestore();
    });
  });

  // ─── isBullishWithCooldown ────────────────────────────────────────────────

  describe("isBullishWithCooldown", () => {
    test("first call returns raw signal regardless of cooldown (bull)", () => {
      seed100(filter, 50000, 55000);
      expect(filter.isBullishWithCooldown(100, 2, 3)).toBe(true);
    });

    test("first call returns raw signal regardless of cooldown (bear)", () => {
      seed100(filter, 50000, 40000);
      expect(filter.isBullishWithCooldown(100, 2, 3)).toBe(false);
    });

    test("suppresses flip within cooldown period", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      // Simulate recent flip
      (filter as any).lastFlipTimestamp = Date.now();
      // Drop to bear
      (filter as any).dailyCloses[99] = 40000;

      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(true); // suppressed — still bull
      expect((filter as any).lastBullish).toBe(true); // reverted
    });

    test("allows flip after cooldown has elapsed", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      (filter as any).lastFlipTimestamp = fiveDaysAgo;
      (filter as any).dailyCloses[99] = 40000; // bear

      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(false); // flip allowed
      expect(filter.getLastFlipTimestamp()).toBeGreaterThan(fiveDaysAgo);
    });

    test("cooldown=0 skips cooldown check entirely (immediate flip allowed)", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 0); // establish bull

      (filter as any).lastFlipTimestamp = Date.now(); // would trigger cooldown if active
      (filter as any).dailyCloses[99] = 40000; // bear

      expect(filter.isBullishWithCooldown(100, 2, 0)).toBe(false);
    });

    test("no prior flip (lastFlipTimestamp=0) does not suppress even when cooldown>0", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull, lastFlipTimestamp stays 0

      (filter as any).dailyCloses[99] = 40000; // bear
      expect(filter.isBullishWithCooldown(100, 2, 3)).toBe(false);
    });

    test("multiple rapid crossovers within cooldown hold previous state", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      (filter as any).lastFlipTimestamp = Date.now(); // recent flip

      (filter as any).dailyCloses[99] = 40000;
      const r1 = filter.isBullishWithCooldown(100, 2, 3); // suppressed → bull
      (filter as any).dailyCloses[99] = 55000;
      const r2 = filter.isBullishWithCooldown(100, 2, 3); // same state → bull
      (filter as any).dailyCloses[99] = 40000;
      const r3 = filter.isBullishWithCooldown(100, 2, 3); // suppressed → bull

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
    });

    test("getLastFlipTimestamp updates after allowed flip", () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      (filter as any).lastFlipTimestamp = Date.now() - 10 * 86_400_000; // 10 days ago
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullishWithCooldown(100, 2, 3); // flip allowed

      expect(Date.now() - filter.getLastFlipTimestamp()).toBeLessThan(1000);
    });
  });

  // ─── DB-backed tests (real MongoDB) ───────────────────────────────────────
  // Each test clears the collection directly — more reliable than setupTestDB()
  // because mongoose.connection.collections is populated by this point.

  describe("loadFromDb", () => {
    it("loads candles and populates dailyCloses + lastRecordedDay", async () => {
      const baseTs = 1_700_000_000_000;

      await OhlcvCandleModel.insertMany([
        { exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs, open: 42000, high: 42000, low: 42000, close: 42000, volume: 0 },
        { exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs + 86_400_000, open: 43000, high: 43000, low: 43000, close: 43000, volume: 0 },
        { exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs + 2 * 86_400_000, open: 44000, high: 44000, low: 44000, close: 44000, volume: 0 },
      ]);

      await filter.loadFromDb();

      expect(filter.getDataPoints()).toBe(3);
      expect(filter.getCurrentPrice()).toBe(44000);
      expect((filter as any).lastRecordedDay).toBe(
        Math.floor((baseTs + 2 * 86_400_000) / 86_400_000)
      );
    });

    it("stays in fresh default state when DB is empty", async () => {
      await filter.loadFromDb();

      expect(filter.getDataPoints()).toBe(0);
      expect(filter.getCurrentPrice()).toBe(0);
    });

    it("loads lastFlipTimestamp from meta candle volume field", async () => {
      const baseTs = 1_700_000_000_000;
      const flipTs = 1_700_500_000_000;

      await OhlcvCandleModel.insertMany([
        { exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs, open: 42000, high: 42000, low: 42000, close: 42000, volume: 0 },
        // Meta candle: volume field stores lastFlipTimestamp
        { exchange: "trend-filter-meta", pair: "BTC/USDT", timeframe: "1d", timestamp: 0, open: 0, high: 0, low: 0, close: 0, volume: flipTs },
      ]);

      await filter.loadFromDb();

      expect(filter.getLastFlipTimestamp()).toBe(flipTs);
    });

    it("ignores meta candle when volume is 0 (no prior flip)", async () => {
      const baseTs = 1_700_000_000_000;

      await OhlcvCandleModel.insertMany([
        { exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs, open: 42000, high: 42000, low: 42000, close: 42000, volume: 0 },
        { exchange: "trend-filter-meta", pair: "BTC/USDT", timeframe: "1d", timestamp: 0, open: 0, high: 0, low: 0, close: 0, volume: 0 },
      ]);

      await filter.loadFromDb();

      expect(filter.getLastFlipTimestamp()).toBe(0);
    });

    it("ignores meta candle when findOne returns null (no meta record)", async () => {
      const baseTs = 1_700_000_000_000;

      // Only insert trend-filter candle, no meta candle
      await OhlcvCandleModel.create({
        exchange: "trend-filter", pair: "BTC/USDT", timeframe: "1d", timestamp: baseTs,
        open: 42000, high: 42000, low: 42000, close: 42000, volume: 0,
      });

      await filter.loadFromDb();

      expect(filter.getLastFlipTimestamp()).toBe(0);
    });
  });

  // ─── persistCurrentClose ─────────────────────────────────────────────────

  describe("persistCurrentClose", () => {
    it("saves current close to MongoDB", async () => {
      (filter as any).dailyCloses = [50000, 51000, 52000];
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      await filter.persistCurrentClose();

      const dayStartMs = (filter as any).lastRecordedDay * 86_400_000;
      const doc = await OhlcvCandleModel.findOne({
        exchange: "trend-filter",
        pair: "BTC/USDT",
        timeframe: "1d",
        timestamp: dayStartMs,
      }).lean();

      expect(doc).not.toBeNull();
      expect(doc!.close).toBe(52000);
    });

    it("no-op when dailyCloses is empty", async () => {
      await filter.persistCurrentClose(); // fresh filter, no data

      const count = await OhlcvCandleModel.countDocuments({ exchange: "trend-filter" });
      expect(count).toBe(0);
    });

    it("no-op when lastRecordedDay is 0", async () => {
      (filter as any).dailyCloses = [50000];
      (filter as any).lastRecordedDay = 0;

      await filter.persistCurrentClose();

      const count = await OhlcvCandleModel.countDocuments({ exchange: "trend-filter" });
      expect(count).toBe(0);
    });
  });

  // ─── isBullishWithCooldown — flip persists to MongoDB ─────────────────────

  describe("isBullishWithCooldown — flip timestamp persistence", () => {
    it("persists flip timestamp via meta candle after allowed flip", async () => {
      seed100(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      (filter as any).lastFlipTimestamp = fiveDaysAgo;
      (filter as any).dailyCloses[99] = 40000;

      filter.isBullishWithCooldown(100, 2, 3); // flip allowed

      // Allow fire-and-forget promise to settle
      await new Promise((r) => setTimeout(r, 50));

      const metaDoc = await OhlcvCandleModel.findOne({
        exchange: "trend-filter-meta",
        pair: "BTC/USDT",
        timeframe: "1d",
      }).lean();

      expect(metaDoc).not.toBeNull();
      expect(metaDoc!.volume).toBeGreaterThan(fiveDaysAgo);
    });
  });

  // ─── recordPrice — new day persists to MongoDB ────────────────────────────

  describe("recordPrice — new day DB persistence", () => {
    it("persists new day entry to MongoDB on day change", async () => {
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;
      (filter as any).dailyCloses.push(48000);

      filter.recordPrice(50000);

      // Allow fire-and-forget promise to settle
      await new Promise((r) => setTimeout(r, 50));

      const today = Math.floor(Date.now() / 86_400_000);
      const dayStartMs = today * 86_400_000;
      const doc = await OhlcvCandleModel.findOne({
        exchange: "trend-filter",
        pair: "BTC/USDT",
        timeframe: "1d",
        timestamp: dayStartMs,
      }).lean();

      expect(doc).not.toBeNull();
      expect(doc!.close).toBe(50000);
    });

    it("does NOT write to DB on same-day update", async () => {
      filter.recordPrice(50000); // first call today
      filter.recordPrice(51000); // same day update

      await new Promise((r) => setTimeout(r, 50));

      // Only 1 doc at most (from the first new-day push)
      const count = await OhlcvCandleModel.countDocuments({ exchange: "trend-filter" });
      expect(count).toBeLessThanOrEqual(1);
    });
  });
});
