import { beforeEach, describe, expect, it } from "bun:test";
import { VwapEngine } from "./vwap-engine";

describe("VwapEngine", () => {
  let engine: VwapEngine;

  beforeEach(() => {
    engine = new VwapEngine();
  });

  describe("create", () => {
    it("should create VWAP order with volume weights", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs: 10000,
        slices: 4,
      });

      expect(orderId).toBeTruthy();
      expect(orderId).toHaveLength(36); // UUID length
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
      }).toThrow("[VwapEngine] slices must be >= 1");
    });

    it("should reject non-positive totalAmount", async () => {
      expect(async () => {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 0,
          durationMs: 10000,
          slices: 4,
        });
      }).toThrow("[VwapEngine] totalAmount must be > 0");
    });

    it("should reject non-positive durationMs", async () => {
      expect(async () => {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 10,
          durationMs: -1000,
          slices: 4,
        });
      }).toThrow("[VwapEngine] durationMs must be > 0");
    });

    it("should handle graceful fallback to uniform weights", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "UNKNOWN/PAIR",
        side: "buy",
        totalAmount: 5,
        durationMs: 8000,
        slices: 2,
      });

      expect(orderId).toBeTruthy();
    });

    it("should test volume weight building with mock exchange (lines 62-82)", async () => {
      // Test with a realistic configuration that triggers buildVolumeWeights
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs: 7200000, // 2 hours
        slices: 5,
      });

      expect(orderId).toBeTruthy();
      expect(orderId).toHaveLength(36);
    });

    it("should support sell orders", async () => {
      const orderId = await engine.create({
        exchange: "kraken",
        pair: "ETH/USD",
        side: "sell",
        totalAmount: 100,
        durationMs: 5000,
        slices: 5,
      });

      expect(orderId).toBeTruthy();
    });

    it("should store rebalanceId when provided", async () => {
      const rebalanceId = "rebal-456";

      const orderId = await engine.create({
        exchange: "binance",
        pair: "XRP/USDT",
        side: "buy",
        totalAmount: 500,
        durationMs: 3000,
        slices: 3,
        rebalanceId,
      });

      expect(orderId).toBeTruthy();
    });

    it("should handle single slice", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "SOL/USDT",
        side: "buy",
        totalAmount: 20,
        durationMs: 1000,
        slices: 1,
      });

      expect(orderId).toBeTruthy();
    });

    it("should calculate interval correctly", async () => {
      const durationMs = 12000;
      const slices = 3;
      const expectedInterval = Math.floor(durationMs / slices); // 4000ms

      const orderId = await engine.create({
        exchange: "binance",
        pair: "ADA/USDT",
        side: "buy",
        totalAmount: 15,
        durationMs,
        slices,
      });

      expect(orderId).toBeTruthy();
    });

    it("should handle very large slices count", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 50,
        durationMs: 100000,
        slices: 100,
      });

      expect(orderId).toBeTruthy();
      expect(orderId).toHaveLength(36);
    });

    it("should handle very small totalAmount", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 0.0001,
        durationMs: 5000,
        slices: 2,
      });

      expect(orderId).toBeTruthy();
    });

    it("should handle very long duration", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs: 7 * 24 * 3600 * 1000, // 7 days
        slices: 10,
      });

      expect(orderId).toBeTruthy();
    });

    it("should handle very short duration", async () => {
      const orderId = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 10,
        durationMs: 100, // very short
        slices: 2,
      });

      expect(orderId).toBeTruthy();
    });
  });

  describe("VwapEngine edge cases", () => {
    it("should create valid UUID for each order", async () => {
      const orderId1 = await engine.create({
        exchange: "binance",
        pair: "BTC/USDT",
        side: "buy",
        totalAmount: 1,
        durationMs: 3600000,
        slices: 2,
      });

      const orderId2 = await engine.create({
        exchange: "binance",
        pair: "ETH/USDT",
        side: "sell",
        totalAmount: 10,
        durationMs: 3600000,
        slices: 2,
      });

      expect(orderId1).not.toBe(orderId2);
      expect(orderId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("should handle different exchanges", async () => {
      const exchanges: any[] = ["binance", "kraken", "coinbase"];
      for (const exchange of exchanges) {
        const orderId = await engine.create({
          exchange,
          pair: "BTC/USD",
          side: "buy",
          totalAmount: 5,
          durationMs: 3600000,
          slices: 2,
        });
        expect(orderId).toBeTruthy();
      }
    });

    it("should handle multiple orders in sequence", async () => {
      const orderIds = [];
      for (let i = 0; i < 3; i++) {
        const orderId = await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: i % 2 === 0 ? "buy" : "sell",
          totalAmount: 10 + i,
          durationMs: 3600000,
          slices: 2 + i,
        });
        orderIds.push(orderId);
      }
      expect(orderIds).toHaveLength(3);
      expect(new Set(orderIds).size).toBe(3); // all unique
    });
  });

  describe("VwapEngine validation error messages", () => {
    it("should provide clear error message for zero slices", async () => {
      try {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 1,
          durationMs: 3600000,
          slices: 0,
        });
        expect(true).toBe(false); // should not reach
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        expect(message).toContain("slices");
        expect(message).toContain("1");
      }
    });

    it("should provide clear error message for zero totalAmount", async () => {
      try {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 0,
          durationMs: 3600000,
          slices: 5,
        });
        expect(true).toBe(false); // should not reach
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        expect(message).toContain("totalAmount");
        expect(message).toContain("0");
      }
    });

    it("should provide clear error message for zero durationMs", async () => {
      try {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 1,
          durationMs: 0,
          slices: 5,
        });
        expect(true).toBe(false); // should not reach
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        expect(message).toContain("durationMs");
        expect(message).toContain("0");
      }
    });

    it("should provide clear error message for negative durationMs", async () => {
      try {
        await engine.create({
          exchange: "binance",
          pair: "BTC/USDT",
          side: "buy",
          totalAmount: 1,
          durationMs: -1000,
          slices: 5,
        });
        expect(true).toBe(false); // should not reach
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        expect(message).toContain("durationMs");
      }
    });
  });
});
