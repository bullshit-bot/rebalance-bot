import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SmartOrderModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { executionTracker } from "./execution-tracker";

describe("ExecutionTracker integration", () => {
  const testOrderId = "test-order-" + Date.now();

  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  test("register creates in-memory progress record", () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress).toBeDefined();
    expect(progress?.id).toBe(testOrderId);
    expect(progress?.type).toBe("twap");
    expect(progress?.totalAmount).toBe(100);
    expect(progress?.slicesTotal).toBe(5);
    expect(progress?.status).toBe("active");
    expect(progress?.filledAmount).toBe(0);
    expect(progress?.filledPct).toBe(0);
    expect(progress?.slicesCompleted).toBe(0);
  });

  test("register sets estimated completion time", () => {
    const now = Date.now();
    const durationMs = 3600000;

    executionTracker.register(testOrderId, "vwap", 50, 10, durationMs);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.estimatedCompletion).toBeGreaterThanOrEqual(now + durationMs);
    expect(progress?.estimatedCompletion).toBeLessThanOrEqual(now + durationMs + 100);
  });

  test("getProgress returns undefined for unknown orderId", () => {
    const progress = executionTracker.getProgress("unknown-order-id");
    expect(progress).toBeUndefined();
  });

  test("updateSlice increments filledAmount", async () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);

    executionTracker.updateSlice(testOrderId, 20, 50000);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.filledAmount).toBe(20);
    expect(progress?.slicesCompleted).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    executionTracker.updateSlice(testOrderId, 20, 51000);

    const updated = executionTracker.getProgress(testOrderId);
    expect(updated?.filledAmount).toBe(40);
    expect(updated?.slicesCompleted).toBe(2);
  });

  test("updateSlice calculates correct filledPct", async () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);

    executionTracker.updateSlice(testOrderId, 25, 50000);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.filledPct).toBe(25);

    await new Promise((resolve) => setTimeout(resolve, 50));
    executionTracker.updateSlice(testOrderId, 25, 50000);

    const updated = executionTracker.getProgress(testOrderId);
    expect(updated?.filledPct).toBe(50);
  });

  test("updateSlice calculates weighted average price", async () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);

    executionTracker.updateSlice(testOrderId, 50, 100);

    let progress = executionTracker.getProgress(testOrderId);
    expect(progress?.avgPrice).toBe(100);

    await new Promise((resolve) => setTimeout(resolve, 50));

    executionTracker.updateSlice(testOrderId, 50, 110);

    progress = executionTracker.getProgress(testOrderId);
    expect(progress?.avgPrice).toBe(105);
  });

  test("updateSlice handles zero total filled", () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);

    executionTracker.updateSlice(testOrderId, 0, 50000);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.filledAmount).toBe(0);
    expect(progress?.avgPrice).toBe(50000);
  });

  test("updateSlice logs warning for unknown orderId", () => {
    let consoleWarn = "";
    const originalWarn = console.warn;
    console.warn = (msg: string) => {
      consoleWarn = msg;
    };

    executionTracker.updateSlice("unknown-id", 10, 50000);

    expect(consoleWarn).toContain("Unknown orderId");

    console.warn = originalWarn;
  });

  test("updateSlice persists progress to database", async () => {
    const orderId = "db-test-" + Date.now();

    await SmartOrderModel.create({
      _id: orderId,
      type: "twap",
      exchange: "binance",
      pair: "BTC/USDT",
      side: "buy",
      totalAmount: 100,
      filledAmount: 0,
      slicesTotal: 5,
      slicesCompleted: 0,
      durationMs: 3600000,
      status: "active",
      config: {},
    });

    executionTracker.register(orderId, "twap", 100, 5, 3600000);
    executionTracker.updateSlice(orderId, 25, 50000);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const doc = await SmartOrderModel.findById(orderId).lean();
    expect(doc).toBeDefined();
    expect(doc!.filledAmount).toBe(25);
    expect(doc!.slicesCompleted).toBe(1);
    expect(Math.abs(doc!.avgPrice! - 50000) < 1).toBe(true);
  });

  test("complete marks order as completed", async () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);
    executionTracker.updateSlice(testOrderId, 100, 50000);

    executionTracker.complete(testOrderId);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.status).toBe("completed");
  });

  test("complete persists to database", async () => {
    const orderId = "complete-test-" + Date.now();

    await SmartOrderModel.create({
      _id: orderId,
      type: "vwap",
      exchange: "binance",
      pair: "ETH/USDT",
      side: "sell",
      totalAmount: 50,
      filledAmount: 0,
      slicesTotal: 10,
      slicesCompleted: 0,
      durationMs: 1800000,
      status: "active",
      config: {},
    });

    executionTracker.register(orderId, "vwap", 50, 10, 1800000);
    executionTracker.updateSlice(orderId, 50, 3000);

    await new Promise((resolve) => setTimeout(resolve, 50));

    executionTracker.complete(orderId);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const doc = await SmartOrderModel.findById(orderId).lean();
    expect(doc).toBeDefined();
    expect(doc!.status).toBe("completed");
  });

  test("cancel marks order as cancelled", () => {
    executionTracker.register(testOrderId, "twap", 100, 5, 3600000);
    executionTracker.updateSlice(testOrderId, 30, 50000);

    executionTracker.cancel(testOrderId);

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.status).toBe("cancelled");
  });

  test("cancel persists to database", async () => {
    const orderId = "cancel-test-" + Date.now();

    await SmartOrderModel.create({
      _id: orderId,
      type: "twap",
      exchange: "okx",
      pair: "SOL/USDT",
      side: "buy",
      totalAmount: 100,
      filledAmount: 0,
      slicesTotal: 8,
      slicesCompleted: 0,
      durationMs: 3600000,
      status: "active",
      config: {},
    });

    executionTracker.register(orderId, "twap", 100, 8, 3600000);
    executionTracker.updateSlice(orderId, 50, 150);

    await new Promise((resolve) => setTimeout(resolve, 50));

    executionTracker.cancel(orderId);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const doc = await SmartOrderModel.findById(orderId).lean();
    expect(doc).toBeDefined();
    expect(doc!.status).toBe("cancelled");
  });

  test("updateSlice with unknown orderId does not crash", () => {
    expect(() => {
      executionTracker.updateSlice("unknown-order", 10, 50000);
    }).not.toThrow();
  });

  test("complete with unknown orderId does not crash", () => {
    expect(() => {
      executionTracker.complete("unknown-order");
    }).not.toThrow();
  });

  test("cancel with unknown orderId does not crash", () => {
    expect(() => {
      executionTracker.cancel("unknown-order");
    }).not.toThrow();
  });

  test("multiple slices accumulate correctly", async () => {
    executionTracker.register(testOrderId, "twap", 1000, 10, 3600000);

    for (let i = 0; i < 10; i++) {
      executionTracker.updateSlice(testOrderId, 100, 50000 + i * 100);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const progress = executionTracker.getProgress(testOrderId);
    expect(progress?.filledAmount).toBe(1000);
    expect(progress?.filledPct).toBe(100);
    expect(progress?.slicesCompleted).toBe(10);
    expect(progress?.avgPrice).toBeCloseTo(50450, 0);
  });

  test("avgPrice calculation with different amounts", async () => {
    executionTracker.register(testOrderId, "twap", 100, 4, 3600000);

    executionTracker.updateSlice(testOrderId, 30, 100);
    let progress = executionTracker.getProgress(testOrderId);
    expect(progress?.avgPrice).toBe(100);

    await new Promise((resolve) => setTimeout(resolve, 10));

    executionTracker.updateSlice(testOrderId, 20, 200);
    progress = executionTracker.getProgress(testOrderId);
    expect(progress?.avgPrice).toBe(140);

    await new Promise((resolve) => setTimeout(resolve, 10));

    executionTracker.updateSlice(testOrderId, 50, 110);
    progress = executionTracker.getProgress(testOrderId);
    expect(progress?.avgPrice).toBe(125);
  });
});
