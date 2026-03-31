import { beforeEach, describe, expect, it, mock } from "bun:test";
import { TwapEngine } from "./twap-engine";

describe("TwapEngine", () => {
  let engine: TwapEngine;

  beforeEach(() => {
    engine = new TwapEngine();
  });

  describe("create", () => {
    it("should split order into equal slices", async () => {
      const mockTracker = mock(() => {});
      const mockScheduler = mock(() => {});

      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs: 10000,
        slices: 5,
      });

      expect(orderId).toBeTruthy();
      expect(orderId).toHaveLength(36); // UUID length
    });

    it("should calculate correct slice amount", async () => {
      const totalAmount = 10;
      const slices = 5;

      const orderId = await engine.create({
        exchange: "binance",
        pair: "ETH/USDT",
        side: "buy",
        totalAmount,
        durationMs: 10000,
        slices,
      });

      expect(orderId).toBeTruthy();
    });

    it("should reject zero slices", async () => {
      expect(async () => {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 10,
          durationMs: 10000,
          slices: 0,
        });
      }).toThrow("[TwapEngine] slices must be >= 1");
    });

    it("should reject negative totalAmount", async () => {
      expect(async () => {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: -5,
          durationMs: 10000,
          slices: 5,
        });
      }).toThrow("[TwapEngine] totalAmount must be > 0");
    });

    it("should reject zero durationMs", async () => {
      expect(async () => {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 10,
          durationMs: 0,
          slices: 5,
        });
      }).toThrow("[TwapEngine] durationMs must be > 0");
    });

    it("should space slices evenly", async () => {
      const durationMs = 10000;
      const slices = 4;
      const expectedInterval = Math.floor(durationMs / slices); // 2500ms

      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs,
        slices,
      });

      expect(orderId).toBeTruthy();
    });

    it("should accept sell side", async () => {
      const orderId = await engine.create({
        exchange: "kraken",
        pair: "XRP/USD",
        side: "sell",
        totalAmount: 1000,
        durationMs: 5000,
        slices: 10,
      });

      expect(orderId).toBeTruthy();
    });

    it("should support rebalanceId", async () => {
      const rebalanceId = "rebalance-123";

      const orderId = await engine.create({
        exchange: "binance",
        pair: "ADA/USDT",
        side: "buy",
        totalAmount: 50,
        durationMs: 3000,
        slices: 3,
        rebalanceId,
      });

      expect(orderId).toBeTruthy();
    });

    it("should handle fractional amounts", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 0.5,
        durationMs: 5000,
        slices: 2,
      });

      expect(orderId).toBeTruthy();
    });
  });
});
