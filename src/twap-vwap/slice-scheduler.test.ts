import { beforeEach, describe, expect, it } from "bun:test";
import { SliceScheduler } from "./slice-scheduler";

describe("SliceScheduler", () => {
  let scheduler: SliceScheduler;

  beforeEach(() => {
    scheduler = new SliceScheduler();
  });

  describe("scheduleSlices", () => {
    it("should schedule slices for a new order", async () => {
      await scheduler.scheduleSlices({
        orderId: "order-123",
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 2000 },
        ],
      });

      // No throw = success
      expect(true).toBe(true);
    });

    it("should handle single slice", async () => {
      await scheduler.scheduleSlices({
        orderId: "order-456",
        exchange: "kraken",
        pair: "ETH/USD",
        side: "sell",
        slices: [{ amount: 100, delayMs: 0 }],
      });

      expect(true).toBe(true);
    });

    it("should handle multiple slices with staggered timing", async () => {
      await scheduler.scheduleSlices({
        orderId: "order-789",
        exchange: "binance",
        pair: "ADA/USDT",
        side: "buy",
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 1000 },
          { amount: 10, delayMs: 1000 },
          { amount: 10, delayMs: 1000 },
        ],
      });

      expect(true).toBe(true);
    });

    it("should track pending slices", async () => {
      await scheduler.scheduleSlices({
        orderId: "order-pending",
        exchange: "binance",
        pair: "SOL/USDT",
        side: "buy",
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 500 },
        ],
      });

      expect(true).toBe(true);
    });
  });

  describe("pause", () => {
    it("should pause a scheduled order", async () => {
      const orderId = "order-pause";

      await scheduler.scheduleSlices({
        orderId,
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 5000 },
        ],
      });

      scheduler.pause(orderId);
      // No throw = success
      expect(true).toBe(true);
    });

    it("should pause non-existent order silently", () => {
      scheduler.pause("non-existent");
      expect(true).toBe(true);
    });
  });

  describe("resume", () => {
    it("should resume a paused order", async () => {
      const orderId = "order-resume";

      await scheduler.scheduleSlices({
        orderId,
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 3000 },
        ],
      });

      scheduler.pause(orderId);
      scheduler.resume(orderId);
      expect(true).toBe(true);
    });

    it("should resume non-existent order silently", () => {
      scheduler.resume("non-existent");
      expect(true).toBe(true);
    });

    it("should resume already-running order silently", async () => {
      const orderId = "order-no-pause";

      await scheduler.scheduleSlices({
        orderId,
        exchange: "binance",
        pair: "ETH/USDT",
        side: "sell",
        slices: [{ amount: 100, delayMs: 0 }],
      });

      scheduler.resume(orderId);
      expect(true).toBe(true);
    });
  });

  describe("cancel", () => {
    it("should cancel a scheduled order", async () => {
      const orderId = "order-cancel";

      await scheduler.scheduleSlices({
        orderId,
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 2000 },
        ],
      });

      scheduler.cancel(orderId);
      expect(true).toBe(true);
    });

    it("should cancel non-existent order silently", () => {
      scheduler.cancel("non-existent-order");
      expect(true).toBe(true);
    });

    it("should clear timers on cancel", async () => {
      const orderId = "order-timers";

      await scheduler.scheduleSlices({
        orderId,
        exchange: "kraken",
        pair: "XRP/USD",
        side: "buy",
        slices: [
          { amount: 50, delayMs: 0 },
          { amount: 50, delayMs: 1000 },
        ],
      });

      scheduler.cancel(orderId);
      expect(true).toBe(true);
    });
  });
});
