import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TradeModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { feeTracker } from "./fee-tracker";

const TEST_REBALANCE_ID = "__fee_tracker_integration__";
const now = Math.floor(Date.now() / 1000);

beforeAll(async () => {
  await setupTestDB();

  await TradeModel.create([
    // Binance trades
    {
      exchange: "binance",
      pair: "BTC/USDT",
      side: "buy",
      amount: 1,
      price: 50000,
      costUsd: 50000,
      fee: 100,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 2) * 1000),
    },
    {
      exchange: "binance",
      pair: "ETH/USDT",
      side: "buy",
      amount: 10,
      price: 3000,
      costUsd: 30000,
      fee: 50,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 3600) * 1000),
    },
    // OKX trades
    {
      exchange: "okx",
      pair: "SOL/USDT",
      side: "sell",
      amount: 50,
      price: 180,
      costUsd: 9000,
      fee: 20,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 7) * 1000),
    },
    // Bybit trades
    {
      exchange: "bybit",
      pair: "XRP/USDT",
      side: "buy",
      amount: 1000,
      price: 2.5,
      costUsd: 2500,
      fee: 5,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 29) * 1000),
    },
    // Trade with null fee
    {
      exchange: "binance",
      pair: "ADA/USDT",
      side: "buy",
      amount: 500,
      price: 1.2,
      costUsd: 600,
      fee: null,
      feeCurrency: "USDT",
      rebalanceId: TEST_REBALANCE_ID,
      executedAt: new Date((now - 86400 * 5) * 1000),
    },
  ]);
});

afterAll(async () => {
  await teardownTestDB();
});

describe("FeeTracker integration", () => {
  test("getFees returns correct total fees", async () => {
    const result = await feeTracker.getFees();
    expect(result).toBeDefined();
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(175);
  });

  test("getFees groups fees by exchange", async () => {
    const result = await feeTracker.getFees();
    expect(result.byExchange).toBeDefined();
    expect(result.byExchange["binance"]).toBeGreaterThanOrEqual(150);
    expect(result.byExchange["okx"]).toBeGreaterThanOrEqual(20);
    expect(result.byExchange["bybit"]).toBeGreaterThanOrEqual(5);
  });

  test("getFees groups fees by asset", async () => {
    const result = await feeTracker.getFees();
    expect(result.byAsset).toBeDefined();
    expect(result.byAsset["BTC"]).toBeGreaterThanOrEqual(100);
    expect(result.byAsset["ETH"]).toBeGreaterThanOrEqual(50);
    expect(result.byAsset["SOL"]).toBeGreaterThanOrEqual(20);
    expect(result.byAsset["XRP"]).toBeGreaterThanOrEqual(5);
  });

  test("getFees with date range filters correctly", async () => {
    const from = now - 86400 * 10;
    const to = now;
    const result = await feeTracker.getFees(from, to);

    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(170);
    expect(result.byAsset["BTC"]).toBeGreaterThanOrEqual(100);
    expect(result.byAsset["ETH"]).toBeGreaterThanOrEqual(50);
  });

  test("getFees with narrow date range", async () => {
    const from = now - 7200;
    const to = now;
    const result = await feeTracker.getFees(from, to);

    expect(result.byAsset["ETH"]).toBeGreaterThanOrEqual(50);
  });

  test("getFees with no matching trades returns zero", async () => {
    const from = 100;
    const to = 200;
    const result = await feeTracker.getFees(from, to);

    expect(result.totalFeesUsd).toBe(0);
    expect(Object.keys(result.byExchange).length).toBe(0);
    expect(Object.keys(result.byAsset).length).toBe(0);
  });

  test("getFees computes rolling period totals (daily)", async () => {
    const result = await feeTracker.getFees();
    expect(result.byPeriod.daily).toBeGreaterThan(0);
  });

  test("getFees computes rolling period totals (weekly)", async () => {
    const result = await feeTracker.getFees();
    expect(result.byPeriod.weekly).toBeGreaterThan(0);
  });

  test("getFees computes rolling period totals (monthly)", async () => {
    const result = await feeTracker.getFees();
    expect(result.byPeriod.monthly).toBeGreaterThanOrEqual(175);
  });

  test("getFees with only from parameter", async () => {
    const from = now - 86400 * 3;
    const result = await feeTracker.getFees(from);

    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(150);
  });

  test("getFees with only to parameter", async () => {
    const to = now + 86400;
    const result = await feeTracker.getFees(undefined, to);

    expect(result).toBeDefined();
    expect(typeof result.totalFeesUsd).toBe("number");
    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(0);
  });
});
