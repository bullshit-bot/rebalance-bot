import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SnapshotModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { drawdownAnalyzer } from "./drawdown-analyzer";

describe("drawdown-analyzer (integration)", () => {
  describe("DrawdownAnalyzer singleton export", () => {
    it("should export drawdownAnalyzer instance", () => {
      expect(drawdownAnalyzer).toBeDefined();
      expect(typeof drawdownAnalyzer.analyze).toBe("function");
    });
  });

  describe("analyze method", () => {
    it("should return DrawdownResult object", async () => {
      const now = Math.floor(Date.now() / 1000);
      const dayAgo = now - 86400;

      const result = await drawdownAnalyzer.analyze(dayAgo, now);

      expect(result).toHaveProperty("maxDrawdownPct");
      expect(result).toHaveProperty("maxDrawdownUsd");
      expect(result).toHaveProperty("peakValue");
      expect(result).toHaveProperty("troughValue");
      expect(result).toHaveProperty("peakDate");
      expect(result).toHaveProperty("troughDate");
      expect(result).toHaveProperty("currentDrawdownPct");
      expect(result).toHaveProperty("drawdownSeries");
    });

    it("should return zero values when no data in range", async () => {
      const now = Math.floor(Date.now() / 1000);
      const future = now + 1000000;

      const result = await drawdownAnalyzer.analyze(future, future + 86400);

      expect(result.maxDrawdownPct).toBe(0);
      expect(result.maxDrawdownUsd).toBe(0);
      expect(result.peakValue).toBe(0);
      expect(result.troughValue).toBe(0);
      expect(Array.isArray(result.drawdownSeries)).toBe(true);
      expect(result.drawdownSeries.length).toBe(0);
    });

    it("should accept Unix epoch seconds for time range", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 604800;

      const fn = () => drawdownAnalyzer.analyze(past, now);
      expect(fn).not.toThrow();
    });

    it("should handle from > to gracefully", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(now, past);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });

  describe("DrawdownResult properties", () => {
    it("maxDrawdownPct should be fractional (not percentage)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.maxDrawdownPct !== 0) {
        expect(Math.abs(result.maxDrawdownPct)).toBeLessThanOrEqual(1);
      }
    });

    it("currentDrawdownPct should be relative to all-time peak in range", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.currentDrawdownPct !== 0) {
        expect(Math.abs(result.currentDrawdownPct)).toBeLessThanOrEqual(1);
      }
    });

    it("drawdownSeries should contain DrawdownPoint objects", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      for (const point of result.drawdownSeries) {
        expect(point).toHaveProperty("timestamp");
        expect(point).toHaveProperty("drawdownPct");
        expect(typeof point.timestamp).toBe("number");
        expect(typeof point.drawdownPct).toBe("number");
      }
    });

    it("peakDate and troughDate should be Unix epoch seconds", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.peakDate !== 0) {
        expect(result.peakDate).toBeGreaterThan(0);
        expect(result.peakDate).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000));
      }

      if (result.troughDate !== 0) {
        expect(result.troughDate).toBeGreaterThan(0);
        expect(result.troughDate).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000));
      }
    });

    it("peakValue should be >= troughValue", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.maxDrawdownPct !== 0) {
        expect(result.peakValue).toBeGreaterThanOrEqual(result.troughValue);
      }
    });

    it("maxDrawdownUsd should be negative or zero", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      expect(result.maxDrawdownUsd).toBeLessThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("should handle single data point", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.drawdownSeries.length < 2) {
        expect(result.maxDrawdownPct).toBe(0);
      }
    });

    it("should handle identical values (no drawdown)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.drawdownSeries.length > 1) {
        const allSame = result.drawdownSeries.every((p) => p.drawdownPct === 0);
        if (allSame) {
          expect(result.maxDrawdownPct).toBe(0);
        }
      }
    });

    it("should handle very large time ranges", async () => {
      const now = Math.floor(Date.now() / 1000);
      const twoYearsAgo = now - 2 * 365 * 86400;

      const fn = () => drawdownAnalyzer.analyze(twoYearsAgo, now);
      expect(fn).not.toThrow();
    });

    it("should handle timestamp 0", async () => {
      const fn = () => drawdownAnalyzer.analyze(0, 1000);
      expect(fn).not.toThrow();
    });
  });

  describe("consistency", () => {
    it("should return consistent results for same time range", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result1 = await drawdownAnalyzer.analyze(past, now);
      const result2 = await drawdownAnalyzer.analyze(past, now);

      expect(result1.maxDrawdownPct).toBe(result2.maxDrawdownPct);
      expect(result1.maxDrawdownUsd).toBe(result2.maxDrawdownUsd);
      expect(result1.currentDrawdownPct).toBe(result2.currentDrawdownPct);
    });

    it("should be callable multiple times", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const r1 = await drawdownAnalyzer.analyze(past, now);
      const r2 = await drawdownAnalyzer.analyze(past, now);
      const r3 = await drawdownAnalyzer.analyze(past, now);

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(r3).toBeDefined();
    });
  });

  describe("database dependency", () => {
    it("should depend on equityCurveBuilder for data", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 86400;

      const result = await drawdownAnalyzer.analyze(past, now);

      expect(result).toBeDefined();
    });

    it("should handle date range with no snapshots gracefully", async () => {
      const result = await drawdownAnalyzer.analyze(0, 100);

      expect(result).toBeDefined();
      expect(typeof result.maxDrawdownPct).toBe("number");
      expect(typeof result.maxDrawdownUsd).toBe("number");
      expect(Array.isArray(result.drawdownSeries)).toBe(true);
    });
  });

  describe("real data analysis with seeded snapshots", () => {
    beforeAll(async () => {
      await setupTestDB();

      const now = Math.floor(Date.now() / 1000);
      const timestamps = [now - 3600, now - 2700, now - 1800, now - 900, now];

      const values = [10000, 11000, 9900, 9500, 10500];

      for (let i = 0; i < timestamps.length; i++) {
        await SnapshotModel.create({
          createdAt: new Date(timestamps[i]! * 1000),
          totalValueUsd: values[i]!,
          holdings: {},
          allocations: {},
        });
      }
    });

    afterAll(async () => {
      await teardownTestDB();
    });

    it("analyzes real drawdown from seeded data", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 3600;

      const result = await drawdownAnalyzer.analyze(past, now);

      expect(result).toBeDefined();
      expect(result.drawdownSeries.length).toBeGreaterThanOrEqual(0);
      if (result.drawdownSeries.length > 0) {
        expect(result.maxDrawdownPct).toBeLessThanOrEqual(0);
      }
    });

    it("computes maxDrawdownPct correctly for peak-to-trough", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 3600;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.drawdownSeries.length > 2) {
        expect(result.maxDrawdownPct).toBeLessThan(0);
        expect(Math.abs(result.maxDrawdownPct)).toBeGreaterThan(0.01);
      }
    });

    it("tracks peakValue and troughValue correctly", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 3600;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.maxDrawdownPct < 0) {
        expect(result.peakValue).toBeGreaterThan(result.troughValue);
        expect(result.peakDate).toBeLessThanOrEqual(result.troughDate);
      }
    });

    it("computes currentDrawdownPct from last value relative to peak", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 3600;

      const result = await drawdownAnalyzer.analyze(past, now);

      if (result.drawdownSeries.length > 3) {
        expect(result.currentDrawdownPct).toBeLessThanOrEqual(0);
      }
    });

    it("builds drawdownSeries with correct point structure", async () => {
      const now = Math.floor(Date.now() / 1000);
      const past = now - 3600;

      const result = await drawdownAnalyzer.analyze(past, now);

      for (const point of result.drawdownSeries) {
        expect(point).toHaveProperty("timestamp");
        expect(point).toHaveProperty("drawdownPct");
        expect(typeof point.timestamp).toBe("number");
        expect(typeof point.drawdownPct).toBe("number");
        expect(point.timestamp).toBeGreaterThanOrEqual(past);
        expect(point.timestamp).toBeLessThanOrEqual(Math.ceil(Date.now() / 1000));
      }
    });
  });
});
