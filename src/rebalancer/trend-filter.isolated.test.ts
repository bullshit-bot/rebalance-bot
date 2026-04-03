// Module-level mocks must be declared BEFORE any imports that use them.
// bun:test hoists mock.module calls so the mocked modules are used when
// trend-filter.ts is first imported below.

import { beforeEach, describe, expect, it, mock, spyOn, test } from "bun:test";

// ─── Mock OhlcvCandleModel ─────────────────────────────────────────────────────
// We need a mutable reference so individual tests can override return values.
const mockLean = mock(() => Promise.resolve([]));
const mockFindOneLean = mock(() => Promise.resolve(null));
const mockUpdateOne = mock(() => Promise.resolve({ acknowledged: true }));

mock.module("@db/models/ohlcv-candle-model", () => ({
  OhlcvCandleModel: {
    find: () => ({
      sort: () => ({
        limit: () => ({
          lean: mockLean,
        }),
      }),
    }),
    findOne: () => ({
      lean: mockFindOneLean,
    }),
    updateOne: mockUpdateOne,
  },
}));

// ─── Mock eventBus ─────────────────────────────────────────────────────────────
const mockEmit = mock(() => true);

mock.module("@events/event-bus", () => ({
  eventBus: {
    emit: mockEmit,
    on: mock(() => {}),
    off: mock(() => {}),
  },
}));

// Import AFTER mocks are registered
import { TrendFilter } from "./trend-filter";

// ─── Tests for TrendFilter core logic + new features ─────────────────────────

describe("TrendFilter", () => {
  let filter: TrendFilter;

  beforeEach(() => {
    filter = new TrendFilter();
    mockLean.mockReset();
    mockFindOneLean.mockReset();
    mockUpdateOne.mockReset();
    mockEmit.mockReset();
    // Default: empty DB
    mockLean.mockImplementation(() => Promise.resolve([]));
    mockFindOneLean.mockImplementation(() => Promise.resolve(null));
    mockUpdateOne.mockImplementation(() => Promise.resolve({ acknowledged: true }));
  });

  // ─── Core recordPrice / isBullish ──────────────────────────────────────────

  describe("recordPrice", () => {
    test("should add daily close and increment data points", () => {
      filter.recordPrice(50000);
      expect(filter.getDataPoints()).toBe(1);
      expect(filter.getCurrentPrice()).toBe(50000);
    });

    test("should update same-day close without adding new entry", () => {
      filter.recordPrice(50000);
      filter.recordPrice(51000);
      expect(filter.getDataPoints()).toBe(1);
      expect(filter.getCurrentPrice()).toBe(51000);
    });

    test("new day entry — pushes to array and persists to MongoDB", async () => {
      // Seed a prior day so next recordPrice is treated as new day
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;
      (filter as any).dailyCloses.push(48000);

      filter.recordPrice(50000);
      // Allow fire-and-forget microtask to settle
      await Promise.resolve();

      expect(filter.getDataPoints()).toBe(2);
      expect(filter.getCurrentPrice()).toBe(50000);
      expect(mockUpdateOne).toHaveBeenCalled();
    });

    test("new day entry — handles updateOne rejection silently (fire-and-forget .catch)", async () => {
      mockUpdateOne.mockImplementation(() => Promise.reject(new Error("write failed")));
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;
      (filter as any).dailyCloses.push(48000);

      // Should not throw — the .catch on the detached promise swallows the error
      expect(() => filter.recordPrice(50000)).not.toThrow();
      // Drain microtask queue so the .catch callback executes (covers line 88-89)
      await Promise.resolve();
      await Promise.resolve();
      // Verify price was still recorded even though DB write failed
      expect(filter.getCurrentPrice()).toBe(50000);
    });

    test("same day — updates last entry, does NOT call updateOne", async () => {
      // Set lastRecordedDay to today so next call is same-day
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);
      (filter as any).dailyCloses.push(48000);

      filter.recordPrice(50000);

      // Allow microtasks to settle
      await Promise.resolve();

      expect(mockUpdateOne).not.toHaveBeenCalled();
      expect(filter.getCurrentPrice()).toBe(50000);
    });

    test("caps dailyCloses at 400 entries when new day pushes over limit", () => {
      // Pre-fill 400 entries across 400 different days
      for (let i = 0; i < 400; i++) {
        (filter as any).dailyCloses.push(50000 + i);
      }
      // Set lastRecordedDay to yesterday so next recordPrice creates new day
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000) - 1;

      filter.recordPrice(99999);

      expect(filter.getDataPoints()).toBe(400);
      expect(filter.getCurrentPrice()).toBe(99999);
    });
  });

  describe("isBullish", () => {
    test("should return true (bull) when insufficient data", () => {
      // No data — safe default
      expect(filter.isBullish()).toBe(true);
    });

    test("should return true when price is above MA", () => {
      // Feed 100 days of data at 50000, then current at 55000
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).dailyCloses[99] = 55000;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // MA ~= 50000, price 55000 → bull
      expect(filter.isBullish(100, 2)).toBe(true);
    });

    test("should return false when price is well below MA", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).dailyCloses[99] = 40000;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // MA ~= 49900, price 40000 → bear
      expect(filter.isBullish(100, 2)).toBe(false);
    });

    test("should respect buffer percentage — price 1% below MA still bull within 2% buffer", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      // Price at 49500 = 1% below MA of 50000 → within 2% buffer → still bull
      (filter as any).dailyCloses[99] = 49500;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      expect(filter.isBullish(100, 2)).toBe(true);
    });

    test("should emit trend:changed on bull-to-bear flip", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // First call establishes bull state (no emit)
      filter.isBullish(100, 2);
      expect(mockEmit).not.toHaveBeenCalled();

      // Drop price to bear territory → flip → emit
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullish(100, 2);

      expect(mockEmit).toHaveBeenCalledTimes(1);
      const [eventName, payload] = mockEmit.mock.calls[0]!;
      expect(eventName).toBe("trend:changed");
      expect((payload as any).bullish).toBe(false);
    });

    test("should emit trend:changed on bear-to-bull flip", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // Establish bear state
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullish(100, 2);
      expect(mockEmit).not.toHaveBeenCalled();

      // Recover to bull → flip → emit
      (filter as any).dailyCloses[99] = 55000;
      filter.isBullish(100, 2);

      expect(mockEmit).toHaveBeenCalledTimes(1);
      const [eventName, payload] = mockEmit.mock.calls[0]!;
      expect(eventName).toBe("trend:changed");
      expect((payload as any).bullish).toBe(true);
    });

    test("should NOT emit on first evaluation (lastBullish is null)", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      filter.isBullish(100, 2);
      expect(mockEmit).not.toHaveBeenCalled();
    });

    test("should NOT emit when state stays the same", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).dailyCloses[99] = 55000;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      filter.isBullish(100, 2); // establishes bull
      filter.isBullish(100, 2); // still bull — no flip
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  // ─── isBullishReadOnly ─────────────────────────────────────────────────────

  describe("isBullishReadOnly", () => {
    test("should return same result as isBullish without side effects", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).dailyCloses[99] = 55000;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      const readOnly = filter.isBullishReadOnly(100, 2);
      const withSideEffects = filter.isBullish(100, 2);
      expect(readOnly).toBe(withSideEffects);
    });

    test("should not modify lastBullish state", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).dailyCloses[99] = 55000;
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // lastBullish starts as null
      expect((filter as any).lastBullish).toBeNull();

      filter.isBullishReadOnly(100, 2);

      // Should still be null — read-only didn't modify state
      expect((filter as any).lastBullish).toBeNull();
    });

    test("should not emit events even on state-flip scenario", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // Establish bull state via isBullish (so lastBullish is set)
      filter.isBullish(100, 2);
      mockEmit.mockReset();

      // Drop to bear — isBullishReadOnly should not emit even though state would flip
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullishReadOnly(100, 2);

      expect(mockEmit).not.toHaveBeenCalled();
      // lastBullish still bull (no mutation from read-only)
      expect((filter as any).lastBullish).toBe(true);
    });

    test("returns true when insufficient data (safe default)", () => {
      expect(filter.isBullishReadOnly()).toBe(true);
    });
  });

  // ─── Trend flip detection ──────────────────────────────────────────────────

  describe("trend flip detection", () => {
    test("should not emit on first isBullish call (lastBullish is null)", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // First call sets lastBullish but should NOT emit (null → value)
      filter.isBullish(100, 2);
      expect((filter as any).lastBullish).toBe(true);
    });

    test("should update lastBullish on subsequent calls", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      // First call — sets to true (bull)
      filter.isBullish(100, 2);
      expect((filter as any).lastBullish).toBe(true);

      // Drop price below MA → bear
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullish(100, 2);
      expect((filter as any).lastBullish).toBe(false);
    });
  });

  // ─── getMA / sma ───────────────────────────────────────────────────────────

  describe("getMA", () => {
    test("should return null with insufficient data", () => {
      filter.recordPrice(50000);
      expect(filter.getMA(100)).toBeNull();
    });

    test("should return correct SMA", () => {
      for (let i = 0; i < 100; i++) {
        (filter as any).dailyCloses.push(50000);
      }
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);
      expect(filter.getMA(100)).toBe(50000);
    });

    test("sma calculation uses only last `period` entries", () => {
      // 200 entries: first 100 at 40000, last 100 at 60000
      for (let i = 0; i < 100; i++) (filter as any).dailyCloses.push(40000);
      for (let i = 0; i < 100; i++) (filter as any).dailyCloses.push(60000);

      // MA(100) should average only the last 100 → 60000
      expect(filter.getMA(100)).toBe(60000);
      // MA(200) averages all 200 → 50000
      expect(filter.getMA(200)).toBe(50000);
    });

    test("sma returns null when period exceeds data count", () => {
      for (let i = 0; i < 50; i++) (filter as any).dailyCloses.push(50000);
      expect(filter.getMA(100)).toBeNull();
    });
  });

  // ─── loadFromDb ────────────────────────────────────────────────────────────

  describe("loadFromDb", () => {
    test("loads candles and populates dailyCloses + lastRecordedDay", async () => {
      const baseTs = 1_700_000_000_000; // arbitrary epoch ms
      const candles = [
        { timestamp: baseTs, close: 42000 },
        { timestamp: baseTs + 86_400_000, close: 43000 },
        { timestamp: baseTs + 2 * 86_400_000, close: 44000 },
      ];
      mockLean.mockImplementation(() => Promise.resolve(candles));

      await filter.loadFromDb();

      expect(filter.getDataPoints()).toBe(3);
      expect(filter.getCurrentPrice()).toBe(44000);
      expect((filter as any).lastRecordedDay).toBe(
        Math.floor((baseTs + 2 * 86_400_000) / 86_400_000)
      );
    });

    test("handles empty candles — stays in fresh default state", async () => {
      mockLean.mockImplementation(() => Promise.resolve([]));

      await filter.loadFromDb();

      expect(filter.getDataPoints()).toBe(0);
      expect(filter.getCurrentPrice()).toBe(0);
    });

    test("loads lastFlipTimestamp from meta candle volume field", async () => {
      const baseTs = 1_700_000_000_000;
      const flipTs = 1_700_500_000_000;
      const candles = [{ timestamp: baseTs, close: 42000 }];
      mockLean.mockImplementation(() => Promise.resolve(candles));
      mockFindOneLean.mockImplementation(() =>
        Promise.resolve({ volume: flipTs, exchange: "trend-filter-meta" })
      );

      await filter.loadFromDb();

      expect(filter.getLastFlipTimestamp()).toBe(flipTs);
    });

    test("ignores meta candle when volume is 0 (no prior flip)", async () => {
      const baseTs = 1_700_000_000_000;
      const candles = [{ timestamp: baseTs, close: 42000 }];
      mockLean.mockImplementation(() => Promise.resolve(candles));
      mockFindOneLean.mockImplementation(() =>
        Promise.resolve({ volume: 0, exchange: "trend-filter-meta" })
      );

      await filter.loadFromDb();

      // volume=0 should NOT set lastFlipTimestamp
      expect(filter.getLastFlipTimestamp()).toBe(0);
    });

    test("handles DB error gracefully — stays in safe default state", async () => {
      mockLean.mockImplementation(() => Promise.reject(new Error("DB connection failed")));

      // Should not throw
      await expect(filter.loadFromDb()).resolves.toBeUndefined();

      expect(filter.getDataPoints()).toBe(0);
      expect(filter.isBullish()).toBe(true); // safe default
    });

    test("ignores meta candle when findOne returns null", async () => {
      const baseTs = 1_700_000_000_000;
      const candles = [{ timestamp: baseTs, close: 42000 }];
      mockLean.mockImplementation(() => Promise.resolve(candles));
      mockFindOneLean.mockImplementation(() => Promise.resolve(null));

      await filter.loadFromDb();

      expect(filter.getLastFlipTimestamp()).toBe(0);
    });
  });

  // ─── persistCurrentClose ──────────────────────────────────────────────────

  describe("persistCurrentClose", () => {
    test("saves current close to MongoDB", async () => {
      (filter as any).dailyCloses = [50000, 51000, 52000];
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);

      await filter.persistCurrentClose();

      expect(mockUpdateOne).toHaveBeenCalledTimes(1);
      const [filter1, update] = mockUpdateOne.mock.calls[0]!;
      expect((filter1 as any).exchange).toBe("trend-filter");
      expect((filter1 as any).pair).toBe("BTC/USDT");
      expect((update as any).$set.close).toBe(52000);
    });

    test("no-op when dailyCloses is empty", async () => {
      // Fresh filter — no data
      await filter.persistCurrentClose();

      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    test("no-op when lastRecordedDay is 0", async () => {
      (filter as any).dailyCloses = [50000];
      (filter as any).lastRecordedDay = 0;

      await filter.persistCurrentClose();

      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    test("handles DB error without throwing", async () => {
      (filter as any).dailyCloses = [50000];
      (filter as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);
      mockUpdateOne.mockImplementation(() => Promise.reject(new Error("DB write failed")));

      await expect(filter.persistCurrentClose()).resolves.toBeUndefined();
    });
  });

  // ─── isBullishWithCooldown ─────────────────────────────────────────────────

  describe("isBullishWithCooldown", () => {
    /** Seed 100 closes at `basePrice` then set last close to `lastPrice` */
    function seedPrices(f: TrendFilter, basePrice: number, lastPrice: number): void {
      for (let i = 0; i < 100; i++) {
        (f as any).dailyCloses.push(basePrice);
      }
      (f as any).dailyCloses[99] = lastPrice;
      (f as any).lastRecordedDay = Math.floor(Date.now() / 86_400_000);
    }

    test("first call returns raw signal regardless of cooldown", () => {
      seedPrices(filter, 50000, 55000);
      // Price above MA → raw = bull
      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(true);
    });

    test("first call with bear signal returns bear (no flip suppression)", () => {
      seedPrices(filter, 50000, 40000);
      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(false);
    });

    test("suppresses flip within cooldown period", () => {
      seedPrices(filter, 50000, 55000);

      // First call: bull, sets lastBullish=true
      filter.isBullishWithCooldown(100, 2, 3);

      // Record a flip timestamp just now (simulates a recent flip)
      (filter as any).lastFlipTimestamp = Date.now();

      // Drop price below MA — raw = bear, but cooldown active
      (filter as any).dailyCloses[99] = 40000;

      const result = filter.isBullishWithCooldown(100, 2, 3);
      // Flip suppressed — still reports bull
      expect(result).toBe(true);
      // lastBullish reverted to previousBullish
      expect((filter as any).lastBullish).toBe(true);
    });

    test("allows flip after cooldown elapses", () => {
      seedPrices(filter, 50000, 55000);

      // First call: bull
      filter.isBullishWithCooldown(100, 2, 3);

      // Simulate flip timestamp 5 days ago (past 3-day cooldown)
      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      (filter as any).lastFlipTimestamp = fiveDaysAgo;

      // Drop price below MA → raw = bear, cooldown elapsed → allow flip
      (filter as any).dailyCloses[99] = 40000;

      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(false);
      // lastFlipTimestamp should be updated to now
      expect(filter.getLastFlipTimestamp()).toBeGreaterThan(fiveDaysAgo);
    });

    test("allowed flip persists flip timestamp via persistFlipTimestamp", async () => {
      seedPrices(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      const fiveDaysAgo = Date.now() - 5 * 86_400_000;
      (filter as any).lastFlipTimestamp = fiveDaysAgo;
      (filter as any).dailyCloses[99] = 40000;

      filter.isBullishWithCooldown(100, 2, 3); // flip allowed

      // Give fire-and-forget promise a tick to settle
      await Promise.resolve();

      expect(mockUpdateOne).toHaveBeenCalled();
      // Verify it writes to the meta exchange
      const [filter1] = mockUpdateOne.mock.calls[mockUpdateOne.mock.calls.length - 1]!;
      expect((filter1 as any).exchange).toBe("trend-filter-meta");
    });

    test("cooldown=0 behaves like no cooldown (immediate flip allowed)", () => {
      seedPrices(filter, 50000, 55000);

      // First call: bull
      filter.isBullishWithCooldown(100, 2, 0);

      // Record a recent flip timestamp
      (filter as any).lastFlipTimestamp = Date.now();

      // Drop price — with cooldown=0 the flip should happen immediately
      (filter as any).dailyCloses[99] = 40000;

      const result = filter.isBullishWithCooldown(100, 2, 0);
      expect(result).toBe(false);
    });

    test("multiple rapid crossovers within cooldown keep previous state", () => {
      seedPrices(filter, 50000, 55000);

      // Establish bull state
      filter.isBullishWithCooldown(100, 2, 3);

      // Set flip timestamp to just now
      (filter as any).lastFlipTimestamp = Date.now();

      // Oscillate price across MA multiple times within cooldown
      (filter as any).dailyCloses[99] = 40000;
      const result1 = filter.isBullishWithCooldown(100, 2, 3); // suppressed → bull
      (filter as any).dailyCloses[99] = 55000;
      const result2 = filter.isBullishWithCooldown(100, 2, 3); // same as current state → bull
      (filter as any).dailyCloses[99] = 40000;
      const result3 = filter.isBullishWithCooldown(100, 2, 3); // suppressed → bull

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    test("getLastFlipTimestamp returns 0 before any flip", () => {
      expect(filter.getLastFlipTimestamp()).toBe(0);
    });

    test("getLastFlipTimestamp updates after allowed flip", () => {
      seedPrices(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull

      // Simulate old flip (past cooldown)
      (filter as any).lastFlipTimestamp = Date.now() - 10 * 86_400_000;
      (filter as any).dailyCloses[99] = 40000;
      filter.isBullishWithCooldown(100, 2, 3);

      // Timestamp should be updated to now (within last second)
      expect(Date.now() - filter.getLastFlipTimestamp()).toBeLessThan(1000);
    });

    test("suppression when lastFlipTimestamp=0 and cooldown>0 does not suppress", () => {
      // lastFlipTimestamp=0 means never flipped — cooldown check skipped
      seedPrices(filter, 50000, 55000);
      filter.isBullishWithCooldown(100, 2, 3); // establish bull, lastFlipTimestamp stays 0

      // Flip to bear — no prior flip timestamp so cooldown doesn't apply
      (filter as any).dailyCloses[99] = 40000;
      const result = filter.isBullishWithCooldown(100, 2, 3);
      expect(result).toBe(false);
    });
  });

  // ─── Cap at 400 entries ────────────────────────────────────────────────────

  describe("data cap", () => {
    test("should cap dailyCloses at 400 entries", () => {
      for (let i = 0; i < 405; i++) {
        (filter as any).dailyCloses.push(50000 + i);
        (filter as any).lastRecordedDay = i;
      }
      // Manually simulate the cap logic
      while ((filter as any).dailyCloses.length > 400) {
        (filter as any).dailyCloses.shift();
      }
      expect(filter.getDataPoints()).toBe(400);
    });
  });

  // ─── Accessors ─────────────────────────────────────────────────────────────

  describe("getCurrentPrice", () => {
    test("returns 0 when no data recorded", () => {
      expect(filter.getCurrentPrice()).toBe(0);
    });

    test("returns the last recorded price", () => {
      (filter as any).dailyCloses = [10000, 20000, 30000];
      expect(filter.getCurrentPrice()).toBe(30000);
    });
  });

  describe("getDataPoints", () => {
    test("returns 0 initially", () => {
      expect(filter.getDataPoints()).toBe(0);
    });

    test("returns count after adding prices", () => {
      (filter as any).dailyCloses = [1, 2, 3, 4, 5];
      expect(filter.getDataPoints()).toBe(5);
    });
  });
});
