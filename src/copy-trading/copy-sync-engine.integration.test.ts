import { describe, expect, it } from "bun:test";
import { copySyncEngine } from "./copy-sync-engine";
import type { SourceAllocation } from "./portfolio-source-fetcher";

describe("copy-sync-engine", () => {
  describe("mergeAllocations", () => {
    it("should merge single source allocations", () => {
      const sources = [
        {
          allocations: [
            { asset: "BTC", targetPct: 60 },
            { asset: "ETH", targetPct: 40 },
          ],
          weight: 1,
        },
      ];

      const result = copySyncEngine.mergeAllocations(sources);

      expect(result.length).toBe(2);
      expect(result.find((a) => a.asset === "BTC")?.targetPct).toBe(60);
      expect(result.find((a) => a.asset === "ETH")?.targetPct).toBe(40);
    });

    it("should merge multiple sources with equal weight", () => {
      const sources = [
        {
          allocations: [{ asset: "BTC", targetPct: 80 }],
          weight: 1,
        },
        {
          allocations: [{ asset: "BTC", targetPct: 60 }],
          weight: 1,
        },
      ];

      const result = copySyncEngine.mergeAllocations(sources);

      expect(result.length).toBe(1);
      expect(result[0]?.targetPct).toBeCloseTo(100, 0);
    });

    it("should merge multiple sources with different weights", () => {
      const sources = [
        {
          allocations: [{ asset: "BTC", targetPct: 100 }],
          weight: 2,
        },
        {
          allocations: [{ asset: "BTC", targetPct: 0 }],
          weight: 1,
        },
      ];

      const result = copySyncEngine.mergeAllocations(sources);

      expect(result.length).toBe(1);
      // Normalization occurs, result should be near 100
      expect(result[0]?.targetPct).toBeCloseTo(100, 0);
    });

    it("should handle multiple assets from multiple sources", () => {
      const sources = [
        {
          allocations: [
            { asset: "BTC", targetPct: 70 },
            { asset: "ETH", targetPct: 30 },
          ],
          weight: 1,
        },
        {
          allocations: [
            { asset: "BTC", targetPct: 50 },
            { asset: "SOL", targetPct: 50 },
          ],
          weight: 1,
        },
      ];

      const result = copySyncEngine.mergeAllocations(sources);

      expect(result.length).toBe(3);
    });

    it("should normalize results to sum 100%", () => {
      const sources = [
        {
          allocations: [
            { asset: "BTC", targetPct: 45 },
            { asset: "ETH", targetPct: 45 },
          ],
          weight: 1,
        },
      ];

      const result = copySyncEngine.mergeAllocations(sources);

      const sum = result.reduce((s, a) => s + a.targetPct, 0);
      expect(sum).toBeCloseTo(100, 0);
    });

    it("should throw when total weight is zero", () => {
      const sources = [
        {
          allocations: [{ asset: "BTC", targetPct: 100 }],
          weight: 0,
        },
      ];

      try {
        copySyncEngine.mergeAllocations(sources);
        expect(true).toBe(false);
      } catch (err) {
        expect(err instanceof Error).toBe(true);
      }
    });

    it("should handle empty sources array", () => {
      const result = copySyncEngine.mergeAllocations([]);
      expect(result.length).toBe(0);
    });

    it("should handle sources with many assets", () => {
      const allocations: SourceAllocation[] = Array.from({ length: 50 }, (_, i) => ({
        asset: `COIN${i}`,
        targetPct: 2,
      }));

      const sources = [{ allocations, weight: 1 }];

      const result = copySyncEngine.mergeAllocations(sources);

      expect(result.length).toBe(50);
      const sum = result.reduce((s, a) => s + a.targetPct, 0);
      expect(sum).toBeCloseTo(100, 0);
    });
  });
});
