import { beforeEach, describe, expect, test } from "bun:test";
import type { Allocation, Portfolio } from "@/types/index";
import { priceCache } from "@price/price-cache";
import { calculateTrades } from "./trade-calculator";

// Helper to seed priceCache with a synthetic price entry
function setPrice(pair: string, price: number): void {
  priceCache.set(pair, {
    exchange: "binance",
    pair,
    price,
    bid: price,
    ask: price,
    volume24h: 0,
    change24h: 0,
    timestamp: Date.now(),
  });
}

describe("trade-calculator", () => {
  let portfolio: Portfolio;

  beforeEach(() => {
    portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    };
    // Seed default prices used by most tests
    setPrice("BTC/USDT", 20000);
    setPrice("ETH/USDT", 2000);
    setPrice("XRP/USDT", 1);
  });

  test("returns empty array when portfolio has zero value", () => {
    portfolio.totalValueUsd = 0;
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);
    expect(trades).toEqual([]);
  });

  test("returns empty array when portfolio is balanced", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.25,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 50,
        driftPct: 0,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 10,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 50,
        driftPct: 0,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);
    expect(trades).toEqual([]);
  });

  test("generates buy orders for underweight assets", () => {
    // BTC price = 20000, ETH price = 2000 (set in beforeEach)
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 2000,
        currentPct: 20,
        targetPct: 50,
        driftPct: -30,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 20,
        valueUsd: 8000,
        currentPct: 80,
        targetPct: 50,
        driftPct: 30,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    // Should buy BTC (underweight) and sell ETH (overweight)
    expect(trades.length).toBe(2);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade).toBeDefined();
    expect(btcTrade?.side).toBe("buy");
    // $3000 delta / $20000 per BTC = 0.15 BTC
    expect(btcTrade?.amount).toBeCloseTo(3000 / 20000, 8);

    const ethTrade = trades.find((t) => t.pair === "ETH/USDT");
    expect(ethTrade).toBeDefined();
    expect(ethTrade?.side).toBe("sell");
    // $3000 delta / $2000 per ETH = 1.5 ETH
    expect(ethTrade?.amount).toBeCloseTo(3000 / 2000, 8);
  });

  test("generates sell orders for overweight assets", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 1,
        valueUsd: 9000,
        currentPct: 90,
        targetPct: 50,
        driftPct: 40,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 1,
        valueUsd: 1000,
        currentPct: 10,
        targetPct: 50,
        driftPct: -40,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    expect(trades.length).toBe(2);
    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.side).toBe("sell");
  });

  test("filters out trades below MIN_TRADE_USD", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 5050,
        currentPct: 50.5,
        targetPct: 50,
        driftPct: 0.5,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 1,
        valueUsd: 4950,
        currentPct: 49.5,
        targetPct: 50,
        driftPct: -0.5,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 100 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 100 },
    ];
    const trades = calculateTrades(portfolio, targets);

    // BTC delta: $5000 - $5050 = -$50 (need to sell) < 100 → filtered
    // ETH delta: $5000 - $4950 = $50 (need to buy) < 100 → filtered
    // No trades should be generated
    expect(trades.length).toBe(0);
  });

  test("respects allocation-level minTradeUsd over env default", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 5200,
        currentPct: 52,
        targetPct: 50,
        driftPct: 2,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 1,
        valueUsd: 4800,
        currentPct: 48,
        targetPct: 50,
        driftPct: -2,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 50 }, // Low threshold, should allow
      { asset: "ETH", targetPct: 50, minTradeUsd: 300 }, // High threshold, should block
    ];
    const trades = calculateTrades(portfolio, targets);

    // BTC delta: $5000 - $5200 = -$200 (need to sell) > 50 ✓
    // ETH delta: $5000 - $4800 = $200 (need to buy) < 300 ✗
    // Only BTC trade should be generated
    expect(trades.length).toBe(1);
    expect(trades[0].pair).toBe("BTC/USDT");
    expect(trades[0].side).toBe("sell");
  });

  test("includes assets in targets but not yet in portfolio (pure buys)", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.5,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    // Should sell BTC and buy ETH (which is not yet held)
    expect(trades.length).toBe(2);
    const ethTrade = trades.find((t) => t.pair === "ETH/USDT");
    expect(ethTrade).toBeDefined();
    expect(ethTrade?.side).toBe("buy");
    // $5000 / $2000 per ETH = 2.5 ETH base qty
    expect(ethTrade?.amount).toBeCloseTo(5000 / 2000, 8);
  });

  test("ignores stablecoins (USDT, USDC, BUSD)", () => {
    portfolio.assets = [
      {
        asset: "USDT",
        amount: 3000,
        valueUsd: 3000,
        currentPct: 30,
        targetPct: 0,
        driftPct: 30,
        exchange: "binance",
      },
      {
        asset: "BTC",
        amount: 0.35,
        valueUsd: 7000,
        currentPct: 70,
        targetPct: 100,
        driftPct: -30,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [{ asset: "BTC", targetPct: 100, minTradeUsd: 10 }];
    const trades = calculateTrades(portfolio, targets);

    // Should not generate a trade for USDT
    expect(trades.every((t) => !t.pair.includes("USDT") || t.pair === "BTC/USDT")).toBe(true);
  });

  test("sorts trades by largest absolute drift first", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 1000,
        currentPct: 10,
        targetPct: 50,
        driftPct: -40,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 10,
        valueUsd: 2000,
        currentPct: 20,
        targetPct: 50,
        driftPct: -30,
        exchange: "binance",
      },
      {
        asset: "XRP",
        amount: 7000,
        valueUsd: 7000,
        currentPct: 70,
        targetPct: 0,
        driftPct: 70,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    // First trade should be for the largest drift (XRP sell $7000 delta)
    expect(trades[0].pair).toBe("XRP/USDT");
    expect(trades[0].side).toBe("sell");
  });

  test("uses exchange from allocation config if provided", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10, exchange: "okx" },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10, exchange: "bybit" },
    ];
    const trades = calculateTrades(portfolio, targets);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.exchange).toBe("okx");

    const ethTrade = trades.find((t) => t.pair === "ETH/USDT");
    expect(ethTrade?.exchange).toBe("bybit");
  });

  test("uses asset exchange when allocation exchange not specified", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: "okx",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 50, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.exchange).toBe("okx");

    // ETH not in portfolio, should default to 'binance'
    const ethTrade = trades.find((t) => t.pair === "ETH/USDT");
    expect(ethTrade?.exchange).toBe("binance");
  });

  test("handles edge case: asset in targets but with zero target percentage", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 100,
        driftPct: 0,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [{ asset: "ETH", targetPct: 0, minTradeUsd: 10 }];
    const trades = calculateTrades(portfolio, targets);

    // ETH target is 0, so no buy order should be generated
    expect(trades.every((t) => !t.pair.includes("ETH"))).toBe(true);
  });

  test("complex rebalance scenario with multiple assets", () => {
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0.25,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 30,
        driftPct: 20,
        exchange: "binance",
      },
      {
        asset: "ETH",
        amount: 25,
        valueUsd: 3000,
        currentPct: 30,
        targetPct: 40,
        driftPct: -10,
        exchange: "binance",
      },
      {
        asset: "XRP",
        amount: 10000,
        valueUsd: 2000,
        currentPct: 20,
        targetPct: 30,
        driftPct: -10,
        exchange: "binance",
      },
    ];
    const targets: Allocation[] = [
      { asset: "BTC", targetPct: 30, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 40, minTradeUsd: 10 },
      { asset: "XRP", targetPct: 30, minTradeUsd: 10 },
    ];
    const trades = calculateTrades(portfolio, targets);

    expect(trades.length).toBeGreaterThan(0);
    // BTC is overweight, should sell
    const btcTrade = trades.find((t) => t.pair === "BTC/USDT");
    expect(btcTrade?.side).toBe("sell");
    // ETH and XRP are underweight, should buy
    const ethTrade = trades.find((t) => t.pair === "ETH/USDT");
    expect(ethTrade?.side).toBe("buy");
    const xrpTrade = trades.find((t) => t.pair === "XRP/USDT");
    expect(xrpTrade?.side).toBe("buy");
  });

  test("amount is base quantity (not USD)", () => {
    // BTC price = $20000, we want to buy $2000 worth = 0.1 BTC
    portfolio.assets = [
      {
        asset: "BTC",
        amount: 0,
        valueUsd: 0,
        currentPct: 0,
        targetPct: 20,
        driftPct: -20,
        exchange: "binance",
      },
    ];
    portfolio.totalValueUsd = 10000;
    const targets: Allocation[] = [{ asset: "BTC", targetPct: 20, minTradeUsd: 10 }];
    const trades = calculateTrades(portfolio, targets);

    expect(trades.length).toBe(1);
    const btcTrade = trades[0];
    // deltaUsd = $2000, price = $20000, baseQty = 0.1 BTC
    expect(btcTrade.amount).toBeCloseTo(2000 / 20000, 8);
    expect(btcTrade.side).toBe("buy");
  });
});
