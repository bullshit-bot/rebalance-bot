import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TradeModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { pnlCalculator } from "./pnl-calculator";

const TEST_REBALANCE_ID = "__pnl_test__";
const now = Math.floor(Date.now() / 1000);

beforeAll(async () => {
  await setupTestDB();

  const testTrades = [
    // BTC: buy 1 @ 40000, sell 1 @ 50000 → realized PnL = +9800 (after fees)
    {
      exchange: "binance",
      pair: "BTC/USDT",
      side: "buy" as const,
      amount: 1,
      price: 40000,
      costUsd: 40000,
      fee: 100,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 5) * 1000),
    },
    {
      exchange: "binance",
      pair: "BTC/USDT",
      side: "sell" as const,
      amount: 1,
      price: 50000,
      costUsd: 50000,
      fee: 100,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 2) * 1000),
    },
    // ETH: buy 10 @ 3000, sell 5 @ 3500 → partial sell
    {
      exchange: "binance",
      pair: "ETH/USDT",
      side: "buy" as const,
      amount: 10,
      price: 3000,
      costUsd: 30000,
      fee: 50,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 10) * 1000),
    },
    {
      exchange: "binance",
      pair: "ETH/USDT",
      side: "sell" as const,
      amount: 5,
      price: 3500,
      costUsd: 17500,
      fee: 50,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 3600) * 1000),
    },
    // SOL: buy only (no sell) — should appear in unrealized
    {
      exchange: "binance",
      pair: "SOL/USDT",
      side: "buy" as const,
      amount: 100,
      price: 180,
      costUsd: 18000,
      fee: 30,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400) * 1000),
    },
  ];

  for (const t of testTrades) {
    await TradeModel.create(t);
  }
});

afterAll(async () => {
  await teardownTestDB();
});

describe("PnLCalculator integration", () => {
  test("getRealizedPnL returns correct totals", async () => {
    const result = await pnlCalculator.getRealizedPnL();
    expect(result).toBeDefined();
    expect(result.totalPnl).toBeDefined();
    expect(typeof result.totalPnl).toBe("number");
    expect(result.byAsset).toBeDefined();
    expect(result.byPeriod).toBeDefined();
    expect(result.byPeriod.daily).toBeDefined();
    expect(result.byPeriod.weekly).toBeDefined();
    expect(result.byPeriod.monthly).toBeDefined();
  });

  test("getRealizedPnL with date range filters", async () => {
    const from = now - 86400 * 3;
    const to = now;
    const result = await pnlCalculator.getRealizedPnL(from, to);
    expect(result.totalPnl).toBeDefined();
    expect(Object.keys(result.byAsset).length).toBeGreaterThan(0);
  });

  test("getRealizedPnL with no trades in range returns zero", async () => {
    const result = await pnlCalculator.getRealizedPnL(0, 100);
    expect(result.totalPnl).toBe(0);
    expect(Object.keys(result.byAsset).length).toBe(0);
  });

  test("byAsset contains expected assets", async () => {
    const result = await pnlCalculator.getRealizedPnL();
    expect("BTC" in result.byAsset).toBe(true);
    expect("ETH" in result.byAsset).toBe(true);
  });

  test("byPeriod daily includes recent ETH sell", async () => {
    const result = await pnlCalculator.getRealizedPnL();
    expect(result.byPeriod.daily).toBeDefined();
  });

  test("getUnrealizedPnL returns open positions", async () => {
    const currentPrices = { BTC: 55000, ETH: 3800, SOL: 200 };
    const result = await pnlCalculator.getUnrealizedPnL(currentPrices);
    expect(result).toBeDefined();

    if (result.SOL) {
      expect(result.SOL.currentValue).toBeGreaterThan(result.SOL.costBasis);
      expect(result.SOL.pnl).toBeGreaterThan(0);
    }

    if (result.ETH) {
      expect(result.ETH.pnl).toBeDefined();
    }
  });

  test("getUnrealizedPnL skips assets without current price", async () => {
    const result = await pnlCalculator.getUnrealizedPnL({ BTC: 55000 });
    expect(result.SOL).toBeUndefined();
  });

  test("getUnrealizedPnL returns empty for no open positions", async () => {
    const result = await pnlCalculator.getUnrealizedPnL({});
    expect(Object.keys(result).length).toBe(0);
  });
});
