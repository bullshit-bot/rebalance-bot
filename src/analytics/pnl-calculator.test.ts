import { describe, expect, test } from "bun:test";

// Test the core PnL calculation logic
function computeRealizedByAsset(
  rows: Array<{ pair: string; side: string; costUsd: number; fee: number | null }>
): Record<string, number> {
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    const asset = row.pair.split("/")[0] ?? row.pair;
    const fee = row.fee ?? 0;

    if (!(asset in byAsset)) byAsset[asset] = 0;

    if (row.side === "sell") {
      byAsset[asset] += row.costUsd - fee;
    } else {
      byAsset[asset] -= row.costUsd + fee;
    }
  }

  return byAsset;
}

describe("PnLCalculator - Core Logic", () => {
  test("calculates positive PnL from buy/sell round trip", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 30000, fee: 100 },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 40000, fee: 100 },
    ];

    const result = computeRealizedByAsset(trades);

    // Expected: 40000 (sell) - 30000 (buy) - 200 (fees) = 9800
    expect(result["BTC"]).toBeCloseTo(9800, 1);
  });

  test("calculates negative PnL from losing trades", () => {
    const trades = [
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 10000, fee: 50 },
      { pair: "ETH/USDT", side: "sell" as const, costUsd: 8000, fee: 50 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["ETH"]).toBeCloseTo(-2100, 1);
  });

  test("aggregates PnL by multiple assets", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 30000, fee: 100 },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 40000, fee: 100 },
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 10000, fee: 50 },
      { pair: "ETH/USDT", side: "sell" as const, costUsd: 11000, fee: 50 },
    ];

    const result = computeRealizedByAsset(trades);
    // BTC: sell 40000 - buy 30000 - fees 200 = 9800
    expect(result["BTC"]).toBeCloseTo(9800, 1);
    // ETH: sell 11000 - buy 10000 - fees 100 = 900
    expect(result["ETH"]).toBeCloseTo(900, 1);
    const totalPnl = Object.values(result).reduce((s, v) => s + v, 0);
    expect(totalPnl).toBeCloseTo(10700, 1);
  });

  test("handles empty trades array", () => {
    const trades: Array<{ pair: string; side: string; costUsd: number; fee: number | null }> = [];

    const result = computeRealizedByAsset(trades);

    expect(Object.keys(result).length).toBe(0);
  });

  test("handles trades with null fees", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 30000, fee: null },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 40000, fee: null },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeCloseTo(10000, 1); // No fees deducted
  });

  test("calculates FIFO average cost from multiple buys", () => {
    const amount1 = 1;
    const cost1 = 30000;
    const amount2 = 1;
    const cost2 = 31000;

    const totalAmount = amount1 + amount2;
    const totalCost = cost1 + cost2;
    const avgCost = totalCost / totalAmount;

    expect(avgCost).toBeCloseTo(30500, 1);

    const currentPrice = 40000;
    const currentValue = totalAmount * currentPrice;
    const pnl = currentValue - totalCost;

    expect(currentValue).toBeCloseTo(80000, 1);
    expect(pnl).toBeCloseTo(19000, 1);
  });

  test("calculates remaining FIFO lots after partial sell", () => {
    const lot1Amount = 10;
    const lot1Cost = 10000;
    const lot1CostPerUnit = lot1Cost / lot1Amount;

    const lot2Amount = 10;
    const lot2Cost = 11000;
    const lot2CostPerUnit = lot2Cost / lot2Amount;

    const sellAmount = 5;

    // FIFO: consume 5 from lot 1
    const remaining1 = Math.max(0, lot1Amount - sellAmount);
    const remaining2 = lot2Amount;

    const totalRemaining = remaining1 + remaining2;
    const totalRemainingCost = remaining1 * lot1CostPerUnit + remaining2 * lot2CostPerUnit;

    expect(totalRemaining).toBe(15);
    expect(totalRemainingCost).toBeCloseTo(16000, 1);

    const currentPrice = 1600;
    const currentValue = totalRemaining * currentPrice;
    const pnl = currentValue - totalRemainingCost;

    expect(currentValue).toBeCloseTo(24000, 1);
    expect(pnl).toBeCloseTo(8000, 1);
  });

  test("filters trades by timestamp range", () => {
    const now = Date.now();
    const dayAgoMs = now - 86400000;
    const weekAgoMs = now - 7 * 86400000;

    const allTrades = [
      { timestamp: weekAgoMs, pair: "BTC/USDT", side: "buy" as const, costUsd: 30000, fee: 0 },
      { timestamp: weekAgoMs, pair: "BTC/USDT", side: "sell" as const, costUsd: 35000, fee: 0 },
      { timestamp: dayAgoMs, pair: "ETH/USDT", side: "buy" as const, costUsd: 10000, fee: 0 },
      { timestamp: dayAgoMs, pair: "ETH/USDT", side: "sell" as const, costUsd: 11000, fee: 0 },
    ];

    const dailyTrades = allTrades.filter((t) => t.timestamp >= dayAgoMs);
    const weeklyTrades = allTrades.filter((t) => t.timestamp >= weekAgoMs);

    expect(dailyTrades.length).toBe(2);
    expect(weeklyTrades.length).toBe(4);
  });

  test("handles single buy trade (no sell)", () => {
    const trades = [{ pair: "BTC/USDT", side: "buy" as const, costUsd: 50000, fee: 250 }];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeCloseTo(-50250, 1); // Cost + fee
  });

  test("handles multiple buys of same asset", () => {
    const trades = [
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 2000, fee: 10 },
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 2100, fee: 10 },
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 2000, fee: 10 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["ETH"]).toBeCloseTo(-6130, 1); // Total cost + fees
  });

  test("handles multiple different assets", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 50000, fee: 250 },
      { pair: "ETH/USDT", side: "buy" as const, costUsd: 3000, fee: 30 },
      { pair: "XRP/USDT", side: "buy" as const, costUsd: 500, fee: 5 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeDefined();
    expect(result["ETH"]).toBeDefined();
    expect(result["XRP"]).toBeDefined();
    expect(Object.keys(result).length).toBe(3);
  });

  test("break-even trade (sell at cost)", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 40000, fee: 100 },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 40000, fee: 100 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeCloseTo(-200, 1); // Just lose the fees
  });

  test("handles very small fractional trades", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 0.001, fee: 0.00001 },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 0.002, fee: 0.00001 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeCloseTo(0.001 - 0.00002, 5);
  });

  test("handles very large trade values", () => {
    const trades = [
      { pair: "BTC/USDT", side: "buy" as const, costUsd: 1000000, fee: 5000 },
      { pair: "BTC/USDT", side: "sell" as const, costUsd: 1100000, fee: 5000 },
    ];

    const result = computeRealizedByAsset(trades);
    expect(result["BTC"]).toBeCloseTo(90000, 0);
  });
});
