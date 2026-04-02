import { describe, expect, test } from "bun:test";
import type { Allocation, Portfolio } from "@/types/index";
import { DEFAULT_BEAR_CASH_PCT } from "./drift-detector";
import { calculateTrades } from "./trade-calculator";

// ─── Bear rebalance flow: trade-calculator with cashReservePct override ──────

describe("Bear rebalance flow", () => {
  // Portfolio with BTC and ETH balanced within the crypto pool
  // Crypto pool = 5120 (total 10000 - USDT 4880)
  // With targets: BTC 50% -> 2560, ETH 30% -> 1536
  const portfolio: Portfolio = {
    totalValueUsd: 10000,
    assets: [
      {
        asset: "BTC",
        amount: 0.0512,
        valueUsd: 2560,
        currentPct: 25.6,
        targetPct: 50,
        driftPct: 0,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 1.024,
        valueUsd: 1536,
        currentPct: 15.36,
        targetPct: 30,
        driftPct: 0,
        exchange: "binance",
      },
      {
        asset: "USDT",
        amount: 4880,
        valueUsd: 4880,
        currentPct: 48.8,
        targetPct: 20,
        driftPct: 0,
        exchange: "binance",
      },
    ],
    updatedAt: Date.now(),
  };

  const targets: Allocation[] = [
    { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
    { asset: "ETH", targetPct: 30, minTradeUsd: 10 },
    { asset: "USDT", targetPct: 20, minTradeUsd: 10 },
  ];

  // Provide price overrides so tests don't depend on PriceCache
  const prices: Record<string, number> = {
    "BTC/USDT": 50000,
    "ETH/USDT": 1500,
  };

  test("DEFAULT_BEAR_CASH_PCT should be 70", () => {
    expect(DEFAULT_BEAR_CASH_PCT).toBe(70);
  });

  test("normal rebalance (no cashReservePct) rebalances crypto only, ignores USDT", () => {
    const orders = calculateTrades(portfolio, targets, prices);
    // Crypto pool = BTC $2560 + ETH $1536 = $4096 (USDT excluded)
    // BTC 50% of $4096 = $2048, has $2560 → sell
    // ETH 30% of $4096 = $1228.8, has $1536 → sell
    // Both overweight vs crypto-only pool → may generate sells
    // Key: USDT is NOT used to buy crypto (stays as DCA reserve)
    const buyOrders = orders.filter((o) => o.side === "buy");
    expect(buyOrders.length).toBe(0); // no buys from USDT
  });

  test("bear rebalance with 70% cash should generate sell orders", () => {
    const orders = calculateTrades(portfolio, targets, prices, 70);

    // With 70% cash target on $10k portfolio:
    // - Target cash: $7000 (currently $2000 USDT)
    // - Crypto pool: $3000 (currently $8000 in BTC+ETH)
    // - Should produce SELL orders to reduce crypto exposure
    const sellOrders = orders.filter((o) => o.side === "sell");
    expect(sellOrders.length).toBeGreaterThan(0);

    // Total sell value should move toward filling the $5000 cash deficit
    const totalSellUsd = sellOrders.reduce((sum, o) => {
      const price = prices[o.pair] ?? 0;
      return sum + o.amount * price;
    }, 0);
    expect(totalSellUsd).toBeGreaterThan(0);
  });

  test("bear rebalance with 100% cash should sell all crypto", () => {
    const orders = calculateTrades(portfolio, targets, prices, 100);

    // 100% cash = all crypto must be sold
    const sellOrders = orders.filter((o) => o.side === "sell");
    expect(sellOrders.length).toBeGreaterThan(0);

    // No buy orders
    const buyOrders = orders.filter((o) => o.side === "buy");
    expect(buyOrders.length).toBe(0);
  });

  test("bear rebalance with 0% cash should behave like normal rebalance", () => {
    const ordersNormal = calculateTrades(portfolio, targets, prices);
    const ordersBear0 = calculateTrades(portfolio, targets, prices, 0);

    expect(ordersNormal.length).toBe(ordersBear0.length);
  });

  test("already at bear cash target should not generate sell orders", () => {
    const cashHeavyPortfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.03,
          valueUsd: 1500,
          currentPct: 15,
          targetPct: 50,
          driftPct: -35,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 1,
          valueUsd: 1500,
          currentPct: 15,
          targetPct: 30,
          driftPct: -15,
          exchange: "binance",
        },
        {
          asset: "USDT",
          amount: 7000,
          valueUsd: 7000,
          currentPct: 70,
          targetPct: 20,
          driftPct: 50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const orders = calculateTrades(cashHeavyPortfolio, targets, prices, 70);
    // Already at 70% cash — crypto pool is $3000
    // Trade calculator rebalances WITHIN crypto pool (BTC/ETH ratio at 50/30)
    // No additional cash deficit sells needed — only internal crypto rebalance
    const totalTradeUsd = orders.reduce((sum, o) => sum + o.amount * (prices[o.pair] ?? 0), 0);
    // Total trade volume should be small relative to portfolio (internal rebalance only)
    expect(totalTradeUsd).toBeLessThan(2000);
  });
});
