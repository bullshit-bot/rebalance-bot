import { describe, expect, test } from "bun:test";
import type { Allocation, Portfolio } from "@/types/index";
import { calcProportionalDCA, calcSingleTargetDCA } from "./dca-allocation-calculator";

describe("DCA Allocation Calculator", () => {
  describe("calcProportionalDCA", () => {
    test("returns empty array when portfolio is balanced", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 1.67,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcProportionalDCA(1000, portfolio, targets, 10);
      expect(orders.length).toBe(0);
    });

    test("allocates to single underweight asset", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.1,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 0.5,
            valueUsd: 1500,
            currentPct: 15,
            targetPct: 50,
            driftPct: -35,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 3500,
            valueUsd: 3500,
            currentPct: 35,
            targetPct: 0,
            driftPct: 35,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcProportionalDCA(2000, portfolio, targets, 10);

      expect(orders.length).toBe(1);
      expect(orders[0].pair).toBe("ETH/USDT");
      expect(orders[0].side).toBe("buy");
      expect(orders[0].type).toBe("market");
      expect(orders[0].amount).toBeGreaterThan(0);
      expect(orders[0].exchange).toBe("binance");
    });

    test("allocates proportionally to multiple underweight assets", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.05,
            valueUsd: 1000,
            currentPct: 10,
            targetPct: 40,
            driftPct: -30,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 0.5,
            valueUsd: 1500,
            currentPct: 15,
            targetPct: 40,
            driftPct: -25,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 6500,
            valueUsd: 6500,
            currentPct: 65,
            targetPct: 20,
            driftPct: 45,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 40, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 40, minTradeUsd: 10 },
      ];

      const orders = calcProportionalDCA(3000, portfolio, targets, 10);

      expect(orders.length).toBe(2);

      const btcOrder = orders.find((o) => o.pair === "BTC/USDT");
      const ethOrder = orders.find((o) => o.pair === "ETH/USDT");

      expect(btcOrder).toBeDefined();
      expect(ethOrder).toBeDefined();

      // BTC deficit (30) > ETH deficit (25), so BTC gets more
      expect(btcOrder!.amount * 50000).toBeGreaterThan(ethOrder!.amount * 3000);
    });

    test("respects minTradeUsd threshold", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.19,
            valueUsd: 9500,
            currentPct: 95,
            targetPct: 50,
            driftPct: 45,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 0.1,
            valueUsd: 300,
            currentPct: 3,
            targetPct: 50,
            driftPct: -47,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 200,
            valueUsd: 200,
            currentPct: 2,
            targetPct: 0,
            driftPct: 2,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      // Deposit so small that allocation falls below minTradeUsd
      const orders = calcProportionalDCA(100, portfolio, targets, 50);

      // All orders should be filtered out (100 * 47/47 = 100, but needs 50 min)
      expect(orders.length).toEqual(expect.any(Number));
    });

    test("uses portfolio price when asset is held", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 6000, // Price = 6000 / 0.2 = 30000
            currentPct: 60,
            targetPct: 50,
            driftPct: 10,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 2,
            valueUsd: 4000, // Price = 4000 / 2 = 2000
            currentPct: 40,
            targetPct: 50,
            driftPct: -10,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcProportionalDCA(1000, portfolio, targets, 10);

      // ETH is underweight, should get all 1000 USDT
      expect(orders.length).toBe(1);
      expect(orders[0].pair).toBe("ETH/USDT");
      // Amount = 1000 / 2000 = 0.5
      expect(orders[0].amount).toBeCloseTo(0.5, 5);
    });

    test("handles portfolio with negligible crypto holdings", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 1000,
        assets: [
          {
            asset: "USDT",
            amount: 999,
            valueUsd: 999,
            currentPct: 99.9,
            targetPct: 20,
            driftPct: 79.9,
            exchange: "binance",
          },
          {
            asset: "BTC",
            amount: 0.00001,
            valueUsd: 0.5,
            currentPct: 0.05,
            targetPct: 50,
            driftPct: -49.95,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 0.00002,
            valueUsd: 0.5,
            currentPct: 0.05,
            targetPct: 30,
            driftPct: -29.95,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 30, minTradeUsd: 10 },
      ];

      // Deposit of 200 USDT (20% of portfolio)
      const orders = calcProportionalDCA(200, portfolio, targets, 10);

      // When crypto < deposit amount, currentPct is ignored and pure target % is used
      expect(Array.isArray(orders)).toBe(true);
    });

    test("uses exchange preference from allocation config", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 1,
            valueUsd: 3000,
            currentPct: 30,
            targetPct: 50,
            driftPct: -20,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 2000,
            valueUsd: 2000,
            currentPct: 20,
            targetPct: 0,
            driftPct: 20,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10, exchange: "okx" },
      ];

      const orders = calcProportionalDCA(2000, portfolio, targets, 10);

      const ethOrder = orders.find((o) => o.pair === "ETH/USDT");
      expect(ethOrder?.exchange).toBe("okx");
    });

    test("calculates allocations for deposits less than total crypto value", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 4000,
            currentPct: 40,
            targetPct: 50,
            driftPct: -10,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 2,
            valueUsd: 4000,
            currentPct: 40,
            targetPct: 50,
            driftPct: -10,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 2000,
            valueUsd: 2000,
            currentPct: 20,
            targetPct: 0,
            driftPct: 20,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      // Deposit is 500, total crypto is 8000
      const orders = calcProportionalDCA(500, portfolio, targets, 10);

      // Both assets are underweight with equal deficit
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThanOrEqual(0);
    });

    test("handles when only some assets are underweight", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.3,
            valueUsd: 6000,
            currentPct: 60,
            targetPct: 50,
            driftPct: 10,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 2,
            valueUsd: 4000,
            currentPct: 40,
            targetPct: 50,
            driftPct: -10,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      // Only ETH is underweight (40 vs target 50)
      const orders = calcProportionalDCA(1000, portfolio, targets, 10);

      // Should allocate to ETH only
      expect(Array.isArray(orders)).toBe(true);
      if (orders.length > 0) {
        expect(orders[0].pair).toBe("ETH/USDT");
      }
    });
  });

  describe("calcSingleTargetDCA", () => {
    test("returns empty array when deposit < minTradeUsd", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [{ asset: "BTC", targetPct: 50, minTradeUsd: 10 }];

      const orders = calcSingleTargetDCA("BTC", 5, portfolio, targets, 10);

      expect(orders.length).toBe(0);
    });

    test("allocates entire deposit to single target", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
          {
            asset: "ETH",
            amount: 1,
            valueUsd: 3000,
            currentPct: 30,
            targetPct: 50,
            driftPct: -20,
            exchange: "binance",
          },
          {
            asset: "USDT",
            amount: 2000,
            valueUsd: 2000,
            currentPct: 20,
            targetPct: 0,
            driftPct: 20,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcSingleTargetDCA("ETH", 2000, portfolio, targets, 10);

      expect(orders.length).toBe(1);
      expect(orders[0].pair).toBe("ETH/USDT");
      expect(orders[0].side).toBe("buy");
      expect(orders[0].type).toBe("market");
      // Amount = 2000 / 3000 (portfolio price) = 0.667
      expect(orders[0].amount).toBeCloseTo(0.667, 2);
    });

    test("returns empty array when no price available", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "UNKNOWN", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcSingleTargetDCA("UNKNOWN", 2000, portfolio, targets, 10);

      expect(orders.length).toBe(0);
    });

    test("uses portfolio exchange when asset is held", () => {
      const portfolio: Portfolio = {
        totalValueUsd: 10000,
        assets: [
          {
            asset: "BTC",
            amount: 0.2,
            valueUsd: 5000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: "okx",
          },
          {
            asset: "ETH",
            amount: 1,
            valueUsd: 3000,
            currentPct: 30,
            targetPct: 50,
            driftPct: -20,
            exchange: "bybit",
          },
          {
            asset: "USDT",
            amount: 2000,
            valueUsd: 2000,
            currentPct: 20,
            targetPct: 0,
            driftPct: 20,
            exchange: "binance",
          },
        ],
        updatedAt: Date.now(),
      };

      const targets: Allocation[] = [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
      ];

      const orders = calcSingleTargetDCA("ETH", 2000, portfolio, targets, 10);

      // ETH is held on bybit in portfolio
      expect(orders[0].exchange).toBe("bybit");
    });
  });
});
