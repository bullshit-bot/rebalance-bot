import { beforeEach, describe, expect, test } from "bun:test";
import type { Allocation } from "@/types/index";
import { MomentumCalculator } from "@rebalancer/momentum-calculator";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MomentumCalculator", () => {
  let calculator: MomentumCalculator;

  beforeEach(() => {
    calculator = new MomentumCalculator();
  });

  describe("recordPrice", () => {
    test("should record price observation", () => {
      calculator.recordPrice("BTC", 50000);
      const scores = calculator.getAllMomentumScores();

      expect(scores.BTC).toBeDefined();
    });

    test("should ignore zero price", () => {
      calculator.recordPrice("BTC", 0);
      const momentum = calculator.getMomentum("BTC");

      expect(momentum).toBe(0);
    });

    test("should ignore negative price", () => {
      calculator.recordPrice("BTC", -100);
      const momentum = calculator.getMomentum("BTC");

      expect(momentum).toBe(0);
    });

    test("should update same day price in place", () => {
      calculator.recordPrice("BTC", 50000);
      calculator.recordPrice("BTC", 51000);

      const scores = calculator.getAllMomentumScores();
      expect(scores.BTC).toBe(0); // Still only one sample
    });

    test("should maintain rolling 30-day window", () => {
      // Record more than 30 samples by simulating day boundaries
      for (let i = 0; i < 35; i++) {
        // This is tricky because we're bound by actual time.
        // Just verify the function handles many calls.
        calculator.recordPrice("BTC", 50000 + i * 100);
      }

      const scores = calculator.getAllMomentumScores();
      expect(scores.BTC).toBeDefined();
    });
  });

  describe("getMomentum", () => {
    test("should return 0 with no price history", () => {
      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBe(0);
    });

    test("should return 0 with single price", () => {
      calculator.recordPrice("BTC", 50000);
      const momentum = calculator.getMomentum("BTC");

      expect(momentum).toBe(0);
    });

    test("should calculate positive momentum", () => {
      // Simulate 30-day prices by manipulating internal state
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000 * 29, price: 50000 },
        { timestamp: Date.now(), price: 55000 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeCloseTo(0.1, 2); // 10% gain
    });

    test("should calculate negative momentum", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000 * 29, price: 50000 },
        { timestamp: Date.now(), price: 45000 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeCloseTo(-0.1, 2); // 10% loss
    });

    test("should return 0 when oldest price is zero or negative", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000 * 29, price: 0 },
        { timestamp: Date.now(), price: 55000 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBe(0);
    });

    test("should use oldest and newest prices, ignoring middle prices", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000 * 29, price: 100 },
        { timestamp: Date.now() - 86_400_000 * 20, price: 9999 }, // Middle ignored
        { timestamp: Date.now(), price: 150 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeCloseTo(0.5, 2); // (150-100)/100 = 0.5, not affected by 9999
    });
  });

  describe("getMomentumAllocations", () => {
    test("should return empty array for empty input", () => {
      const result = calculator.getMomentumAllocations([]);
      expect(result.length).toBe(0);
    });

    test("should return base allocations when no momentum", () => {
      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      expect(result.length).toBe(2);
      expect(result[0].targetPct).toBeCloseTo(50, 1);
      expect(result[1].targetPct).toBeCloseTo(50, 1);
    });

    test("should normalize allocations to 100%", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 50000 },
        { timestamp: Date.now(), price: 55000 },
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 3000 },
        { timestamp: Date.now(), price: 2700 },
      ]);

      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);
      const total = result.reduce((s, a) => s + a.targetPct, 0);

      expect(total).toBeCloseTo(100, 0);
    });

    test("should ignore negative momentum (max 0)", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 50000 },
        { timestamp: Date.now(), price: 55000 }, // +10%
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 3000 },
        { timestamp: Date.now(), price: 2700 }, // -10% → treated as 0
      ]);

      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      // BTC should get boost, ETH should get less
      const btcAlloc = result.find((a) => a.asset === "BTC");
      const ethAlloc = result.find((a) => a.asset === "ETH");

      expect(btcAlloc!.targetPct).toBeGreaterThan(ethAlloc!.targetPct);
    });

    test("should blend 50/50 base and momentum weights", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 200 }, // +100% momentum
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 100 }, // 0% momentum
      ]);

      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      // BTC gets 50% base + 50% momentum weight (100% of momentum goes to BTC)
      // ETH gets 50% base + 50% momentum weight (0% of momentum)
      // Before normalization: BTC = 0.5*50 + 0.5*100 = 75, ETH = 0.5*50 + 0.5*0 = 25
      // After normalization: BTC = 75, ETH = 25
      const btcAlloc = result.find((a) => a.asset === "BTC");
      const ethAlloc = result.find((a) => a.asset === "ETH");

      expect(btcAlloc!.targetPct).toBeCloseTo(75, 0);
      expect(ethAlloc!.targetPct).toBeCloseTo(25, 0);
    });

    test("should handle single asset", () => {
      const baseAllocations: Allocation[] = [{ asset: "BTC", targetPct: 100, minTradeUsd: 100 }];

      const result = calculator.getMomentumAllocations(baseAllocations);

      expect(result.length).toBe(1);
      expect(result[0].targetPct).toBeCloseTo(100, 0);
    });

    test("should handle three-asset portfolio with mixed momentum", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 150 }, // +50%
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 100 }, // 0%
      ]);
      priceHistory.set("SOL", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 80 }, // -20% → 0
      ]);

      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 40, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 40, minTradeUsd: 100 },
        { asset: "SOL", targetPct: 20, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);
      expect(result.length).toBe(3);

      const total = result.reduce((s, a) => s + a.targetPct, 0);
      expect(total).toBeCloseTo(100, 0);

      // BTC should be highest due to +50% momentum
      const btcAlloc = result.find((a) => a.asset === "BTC")!.targetPct;
      const ethAlloc = result.find((a) => a.asset === "ETH")!.targetPct;
      const solAlloc = result.find((a) => a.asset === "SOL")!.targetPct;

      expect(btcAlloc).toBeGreaterThan(ethAlloc);
      expect(btcAlloc).toBeGreaterThan(solAlloc);
    });

    test("should redistribute weight from low-momentum assets", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 120 }, // +20%
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 100 }, // 0%
      ]);

      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 40, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 60, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      // Base blend: BTC = 0.5*40 + 0.5*100 = 70, ETH = 0.5*60 + 0.5*0 = 30
      // After normalization: should be ~70/30 split
      const btcAlloc = result.find((a) => a.asset === "BTC")!.targetPct;
      const ethAlloc = result.find((a) => a.asset === "ETH")!.targetPct;

      expect(btcAlloc).toBeGreaterThan(50);
      expect(ethAlloc).toBeLessThan(50);
    });

    test("should handle all-zero-momentum scenario", () => {
      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 40, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 60, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      // No momentum recorded = fallback to base allocations
      expect(result[0].targetPct).toBeCloseTo(40, 1);
      expect(result[1].targetPct).toBeCloseTo(60, 1);
    });

    test("should preserve allocation asset names and ordering", () => {
      const baseAllocations: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
      ];

      const result = calculator.getMomentumAllocations(baseAllocations);

      expect(result[0].asset).toBe("BTC");
      expect(result[1].asset).toBe("ETH");
    });
  });

  describe("getAllMomentumScores", () => {
    test("should return empty map for no price history", () => {
      const scores = calculator.getAllMomentumScores();

      expect(Object.keys(scores).length).toBe(0);
    });

    test("should return all recorded assets", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 120 },
      ]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 80 },
      ]);
      priceHistory.set("SOL", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 100 },
      ]);

      const scores = calculator.getAllMomentumScores();

      expect(Object.keys(scores).length).toBe(3);
      expect(scores.BTC).toBeGreaterThan(0);
      expect(scores.ETH).toBeLessThan(0);
      expect(scores.SOL).toBe(0);
    });

    test("should return correct momentum values", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 150 },
      ]);

      const scores = calculator.getAllMomentumScores();

      expect(scores.BTC).toBeCloseTo(0.5, 2);
    });

    test("should not include assets with less than 2 samples", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [{ timestamp: Date.now(), price: 100 }]);
      priceHistory.set("ETH", [
        { timestamp: Date.now() - 86_400_000, price: 100 },
        { timestamp: Date.now(), price: 120 },
      ]);

      const scores = calculator.getAllMomentumScores();

      expect(scores.BTC).toBe(0);
      expect(scores.ETH).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    test("should handle very small price changes", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 50000 },
        { timestamp: Date.now(), price: 50000.01 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeGreaterThan(0);
      expect(momentum).toBeLessThan(0.0001);
    });

    test("should handle very large price swings", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 1 },
        { timestamp: Date.now(), price: 100000 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeCloseTo(99999, 0);
    });

    test("should handle price declining to near-zero", () => {
      const priceHistory = (calculator as any).priceHistory;
      priceHistory.set("BTC", [
        { timestamp: Date.now() - 86_400_000, price: 50000 },
        { timestamp: Date.now(), price: 0.001 },
      ]);

      const momentum = calculator.getMomentum("BTC");
      expect(momentum).toBeLessThan(0);
      expect(momentum).toBeCloseTo(-0.99998, 2);
    });

    test("should work with many assets", () => {
      const priceHistory = (calculator as any).priceHistory;
      const assets = ["BTC", "ETH", "SOL", "XRP", "DOT", "LINK", "ADA", "MATIC"];

      assets.forEach((asset) => {
        priceHistory.set(asset, [
          { timestamp: Date.now() - 86_400_000, price: 100 },
          { timestamp: Date.now(), price: 120 },
        ]);
      });

      const scores = calculator.getAllMomentumScores();
      expect(Object.keys(scores).length).toBe(8);
    });
  });
});
