import { beforeAll, describe, expect, test } from "bun:test";
import type { Allocation, Portfolio } from "@/types/index";
import { priceCache } from "@price/price-cache";
import { calculateTrades } from "./trade-calculator";

beforeAll(() => {
  // Seed price cache with test prices
  priceCache.set("BTC/USDT", { pair: "BTC/USDT", price: 50000, timestamp: Date.now() });
  priceCache.set("ETH/USDT", { pair: "ETH/USDT", price: 3000, timestamp: Date.now() });
  priceCache.set("SOL/USDT", { pair: "SOL/USDT", price: 180, timestamp: Date.now() });
  priceCache.set("XRP/USDT", { pair: "XRP/USDT", price: 2.5, timestamp: Date.now() });
});

describe("TradeCalculator integration", () => {
  test("calculateTrades returns empty array for zero portfolio value", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 0,
      assets: [],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
    ];

    const trades = calculateTrades(portfolio, targets);
    expect(trades.length).toBe(0);
  });

  test("calculateTrades generates buy orders for underweight assets", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 20,
          driftPct: 80,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 30, minTradeUsd: 100 },
      { asset: "USDT", targetPct: 20, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    expect(trades.length).toBeGreaterThan(0);
    expect(trades.some((t) => t.pair === "BTC/USDT" && t.side === "buy")).toBe(true);
    expect(trades.some((t) => t.pair === "ETH/USDT" && t.side === "buy")).toBe(true);
  });

  test("calculateTrades generates sell orders for overweight assets", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
    ];

    const trades = calculateTrades(portfolio, targets);

    expect(trades.some((t) => t.pair === "BTC/USDT" && t.side === "sell")).toBe(true);
  });

  test("calculateTrades filters trades below MIN_TRADE_USD", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.199,
          valueUsd: 9950,
          currentPct: 99.5,
          targetPct: 99,
          driftPct: 0.5, // Only 50 USD drift — below minimum
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 0.167,
          valueUsd: 50,
          currentPct: 0.5,
          targetPct: 1,
          driftPct: -0.5,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 99, minTradeUsd: 100 }, // 50 USD drift is filtered
      { asset: "ETH", targetPct: 1, minTradeUsd: 100 }, // 50 USD drift is filtered
    ];

    const trades = calculateTrades(portfolio, targets);

    // Should filter out trades below minTradeUsd
    expect(trades.length).toBe(0);
  });

  test("calculateTrades uses allocation-level minTradeUsd", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 1000 }, // Custom high min
      { asset: "USDT", targetPct: 50, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    // BTC target is 5000 USD (50% of 10000), which exceeds 1000 min
    expect(trades.some((t) => t.pair === "BTC/USDT" && t.side === "buy")).toBe(true);
  });

  test("calculateTrades skips assets with no price data", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 25, minTradeUsd: 100 },
      { asset: "UNKNOWN_COIN", targetPct: 25, minTradeUsd: 100 }, // No price
      { asset: "USDT", targetPct: 50, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    expect(trades.some((t) => t.pair === "UNKNOWN_COIN/USDT")).toBe(false);
  });

  test("calculateTrades ignores stablecoins (USDT, USDC, BUSD)", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 3000,
          valueUsd: 3000,
          currentPct: 30,
          targetPct: 50,
          driftPct: -20,
          exchange: "binance",
        },
        {
          asset: "USDC",
          amount: 3000,
          valueUsd: 3000,
          currentPct: 30,
          targetPct: 50,
          driftPct: -20,
          exchange: "binance",
        },
        {
          asset: "BUSD",
          amount: 4000,
          valueUsd: 4000,
          currentPct: 40,
          targetPct: 0,
          driftPct: 40,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "USDT", targetPct: 50, minTradeUsd: 100 },
      { asset: "USDC", targetPct: 50, minTradeUsd: 100 },
      { asset: "BUSD", targetPct: 0, minTradeUsd: 100 },
    ];

    const trades = calculateTrades(portfolio, targets);

    // Should not generate trades for stablecoins
    expect(trades.some((t) => t.pair.includes("USDT"))).toBe(false);
    expect(trades.some((t) => t.pair.includes("USDC"))).toBe(false);
    expect(trades.some((t) => t.pair.includes("BUSD"))).toBe(false);
  });

  test("calculateTrades respects exchange allocation", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, exchange: "okx", minTradeUsd: 100 },
      { asset: "USDT", targetPct: 50, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.exchange).toBe("okx");
  });

  test("calculateTrades sorts by largest absolute drift first", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 60,
          driftPct: 40,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 20, minTradeUsd: 100 }, // 2000 USD target
      { asset: "ETH", targetPct: 20, minTradeUsd: 100 }, // 2000 USD target
      { asset: "SOL", targetPct: 0, minTradeUsd: 100 },
      { asset: "USDT", targetPct: 60, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    // All orders should be present
    expect(trades.length).toBeGreaterThanOrEqual(2);
  });

  test("calculateTrades computes correct base quantities", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "USDT", targetPct: 50, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    if (btcTrade) {
      // Target is 5000 USD at 50000/BTC = 0.1 BTC
      const expectedAmount = 5000 / 50000;
      expect(Math.abs(btcTrade.amount - expectedAmount)).toBeLessThan(0.0001);
    }
  });

  test("calculateTrades handles mixed buy and sell scenario", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
    ];

    const trades = calculateTrades(portfolio, targets);

    expect(trades.some((t) => t.side === "sell" && t.pair === "BTC/USDT")).toBe(true);
    expect(trades.some((t) => t.side === "buy" && t.pair === "ETH/USDT")).toBe(true);
  });

  test("calculateTrades handles new asset allocation (not yet held)", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 0,
          driftPct: 100,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 }, // New asset
      { asset: "ETH", targetPct: 50, minTradeUsd: 100 }, // New asset
    ];

    const trades = calculateTrades(portfolio, targets);

    expect(trades.length).toBeGreaterThanOrEqual(2);
    expect(trades.some((t) => t.pair === "BTC/USDT" && t.side === "buy")).toBe(true);
    expect(trades.some((t) => t.pair === "ETH/USDT" && t.side === "buy")).toBe(true);
  });

  test("calculateTrades uses fallback exchange when not specified", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 }, // No exchange specified
      { asset: "USDT", targetPct: 50, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.exchange).toBe("binance"); // Default fallback
  });

  test("calculateTrades with realistic multi-asset portfolio", () => {
    const portfolio: Portfolio = {
      totalValueUsd: 100000,
      assets: [
        {
          asset: "BTC",
          amount: 1,
          valueUsd: 50000,
          currentPct: 50,
          targetPct: 40,
          driftPct: 10,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 10,
          valueUsd: 30000,
          currentPct: 30,
          targetPct: 35,
          driftPct: -5,
          exchange: "binance",
        },
        {
          asset: "SOL",
          amount: 500,
          valueUsd: 10000,
          currentPct: 10,
          targetPct: 15,
          driftPct: -5,
          exchange: "okx",
        },
        {
          asset: "USDT",
          amount: 10000,
          valueUsd: 10000,
          currentPct: 10,
          targetPct: 10,
          driftPct: 0,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 40, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 35, minTradeUsd: 100 },
      { asset: "SOL", targetPct: 15, minTradeUsd: 100 },
      { asset: "USDT", targetPct: 10, minTradeUsd: 10 },
    ];

    const trades = calculateTrades(portfolio, targets);

    // BTC is overweight — should sell
    expect(trades.some((t) => t.pair === "BTC/USDT" && t.side === "sell")).toBe(true);
    // ETH and SOL are underweight — should buy
    expect(trades.some((t) => t.pair === "ETH/USDT" && t.side === "buy")).toBe(true);
    expect(trades.some((t) => t.pair === "SOL/USDT" && t.side === "buy")).toBe(true);
  });
});
