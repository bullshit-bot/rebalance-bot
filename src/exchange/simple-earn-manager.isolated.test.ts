import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { EarnProduct, EarnPosition } from "./simple-earn-manager";

// ─── Mock Setup ────────────────────────────────────────────────────────────

interface MockBinanceExchange {
  id: string;
  fetchBalance: () => Promise<Record<string, unknown>>;
  sapiGetSimpleEarnFlexibleList: (params: Record<string, unknown>) => Promise<{
    data?: { rows?: EarnProduct[] };
    rows?: EarnProduct[];
  }>;
  sapiGetSimpleEarnFlexiblePosition: (params: Record<string, unknown>) => Promise<{
    data?: { rows?: EarnPosition[] };
    rows?: EarnPosition[];
  }>;
  sapiPostSimpleEarnFlexibleSubscribe: (params: Record<string, string>) => Promise<Record<string, unknown>>;
  sapiPostSimpleEarnFlexibleRedeem: (params: Record<string, string>) => Promise<Record<string, unknown>>;
}

let mockExchange: MockBinanceExchange;
let exchangeConnected = true;

// Mock exchange manager
mock.module("@exchange/exchange-manager", () => ({
  exchangeManager: {
    getExchange: (name: string) => {
      if (name === "binance" && exchangeConnected) return mockExchange;
      return null;
    },
  },
}));

// Mock event bus
const capturedEvents: Array<{ event: string; data: unknown }> = [];
mock.module("@events/event-bus", () => ({
  eventBus: {
    emit: (event: string, data: unknown) => {
      capturedEvents.push({ event, data });
    },
    on: () => {},
    off: () => {},
  },
}));

// Import after mocks are set up
import { SimpleEarnManager } from "./simple-earn-manager";

// ─── Test Setup Helpers ─────────────────────────────────────────────────────

function createMockExchange(): MockBinanceExchange {
  return {
    id: "binance",

    fetchBalance: async () => ({
      BTC: { free: 0.5, used: 0, total: 0.5 },
      ETH: { free: 10, used: 0, total: 10 },
      USDT: { free: 50000, used: 0, total: 50000 },
      free: { BTC: 0.5, ETH: 10, USDT: 50000 },
      used: {},
      total: { BTC: 0.5, ETH: 10, USDT: 50000 },
    }),

    sapiGetSimpleEarnFlexibleList: async () => ({
      data: {
        rows: [
          {
            productId: "BTCFLEX001",
            asset: "BTC",
            latestAnnualPercentageRate: 0.02,
          },
          {
            productId: "ETHFLEX001",
            asset: "ETH",
            latestAnnualPercentageRate: 0.03,
          },
          {
            productId: "USDTFLEX001",
            asset: "USDT",
            latestAnnualPercentageRate: 0.05,
          },
        ],
      },
    }),

    sapiGetSimpleEarnFlexiblePosition: async () => ({
      data: {
        rows: [
          {
            asset: "BTC",
            amount: 0.1,
            productId: "BTCFLEX001",
            latestAnnualPercentageRate: 0.02,
          },
          {
            asset: "ETH",
            amount: 2,
            productId: "ETHFLEX001",
            latestAnnualPercentageRate: 0.03,
          },
        ],
      },
    }),

    sapiPostSimpleEarnFlexibleSubscribe: async (params: Record<string, string>) => {
      return {
        productId: params.productId,
        amount: params.amount,
        success: true,
      };
    },

    sapiPostSimpleEarnFlexibleRedeem: async (params: Record<string, string>) => {
      return {
        productId: params.productId,
        amount: params.amount,
        destAccount: params.destAccount,
        success: true,
      };
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("SimpleEarnManager", () => {
  let manager: SimpleEarnManager;

  beforeEach(() => {
    mockExchange = createMockExchange();
    exchangeConnected = true;
    capturedEvents.length = 0; // Reset events
    manager = new SimpleEarnManager();
  });

  afterEach(() => {
    // Clean up between tests
    capturedEvents.length = 0;
  });

  // ─── getFlexibleProducts() Tests ─────────────────────────────────────────

  describe("getFlexibleProducts()", () => {
    it("should fetch and cache products for 1 hour", async () => {
      const call1 = await manager.getFlexibleProducts();
      expect(call1.length).toBe(3);
      expect(call1[0].asset).toBe("BTC");

      // Mock now returns empty to prove it came from cache
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: { rows: [] },
      });

      const call2 = await manager.getFlexibleProducts();
      expect(call2.length).toBe(3); // Still has cached data
    });

    it("should return empty array when exchange not connected", async () => {
      exchangeConnected = false;
      const products = await manager.getFlexibleProducts();
      expect(products).toEqual([]);
    });

    it("should handle both nested (data.rows) and flat (rows) response shapes", async () => {
      // Test nested shape (already tested above)
      let products = await manager.getFlexibleProducts();
      expect(products.length).toBe(3);

      // Test flat shape by creating new manager
      const manager2 = new SimpleEarnManager();
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        rows: [
          {
            productId: "BTCFLEX001",
            asset: "BTC",
            latestAnnualPercentageRate: 0.02,
          },
        ],
      });
      products = await manager2.getFlexibleProducts();
      expect(products.length).toBe(1);
    });

    it("should return empty array on API error", async () => {
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => {
        throw new Error("API Error");
      };
      const products = await manager.getFlexibleProducts();
      expect(products).toEqual([]);
    });

    it("should filter out products with missing productId or asset from cache", async () => {
      const manager2 = new SimpleEarnManager();
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: {
          rows: [
            { productId: "BTCFLEX001", asset: "BTC", latestAnnualPercentageRate: 0.02 },
            { productId: "", asset: "ETH", latestAnnualPercentageRate: 0.03 }, // Missing productId
            { productId: "USDTFLEX001", asset: "", latestAnnualPercentageRate: 0.05 }, // Missing asset
          ],
        },
      });
      await manager2.getFlexibleProducts();
      // Filtering affects the cache, not the return value
      const productId = await manager2.getProductId("ETH");
      expect(productId).toBeNull(); // ETH was filtered out from cache due to missing productId
    });
  });

  // ─── getProductId() Tests ──────────────────────────────────────────────

  describe("getProductId()", () => {
    it("should lookup product by asset from cache", async () => {
      const productId = await manager.getProductId("BTC");
      expect(productId).toBe("BTCFLEX001");
    });

    it("should return null for asset with no product", async () => {
      const productId = await manager.getProductId("DOGE");
      expect(productId).toBeNull();
    });

    it("should trigger product fetch if cache empty", async () => {
      const manager2 = new SimpleEarnManager();
      const productId = await manager2.getProductId("ETH");
      expect(productId).toBe("ETHFLEX001");
    });
  });

  // ─── getFlexiblePositions() Tests ──────────────────────────────────────

  describe("getFlexiblePositions()", () => {
    it("should fetch and cache positions for 30 seconds", async () => {
      const call1 = await manager.getFlexiblePositions();
      expect(call1.length).toBe(2);
      expect(call1[0].asset).toBe("BTC");
      expect(call1[0].amount).toBe(0.1);

      // Mock now returns empty to prove it came from cache
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: { rows: [] },
      });

      const call2 = await manager.getFlexiblePositions();
      expect(call2.length).toBe(2); // Still has cached data
    });

    it("should return empty array when exchange not connected", async () => {
      exchangeConnected = false;
      const positions = await manager.getFlexiblePositions();
      expect(positions).toEqual([]);
    });

    it("should handle both nested and flat response shapes", async () => {
      const manager2 = new SimpleEarnManager();
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        rows: [
          {
            asset: "BTC",
            amount: 0.5,
            productId: "BTCFLEX001",
            latestAnnualPercentageRate: 0.02,
          },
        ],
      });
      const positions = await manager2.getFlexiblePositions();
      expect(positions.length).toBe(1);
    });

    it("should return empty array on API error", async () => {
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => {
        throw new Error("API Error");
      };
      const positions = await manager.getFlexiblePositions();
      expect(positions).toEqual([]);
    });
  });

  // ─── getEarnBalanceMap() Tests ────────────────────────────────────────

  describe("getEarnBalanceMap()", () => {
    it("should aggregate earn positions into asset → balance map", async () => {
      const map = await manager.getEarnBalanceMap();
      expect(map.get("BTC")).toBe(0.1);
      expect(map.get("ETH")).toBe(2);
    });

    it("should return empty map when no positions", async () => {
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: { rows: [] },
      });
      const map = await manager.getEarnBalanceMap();
      expect(map.size).toBe(0);
    });

    it("should aggregate multiple positions for same asset", async () => {
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: {
          rows: [
            { asset: "BTC", amount: 0.5, productId: "BTCFLEX001" },
            { asset: "BTC", amount: 0.3, productId: "BTCFLEX002" },
          ],
        },
      });
      const map = await manager.getEarnBalanceMap();
      expect(map.get("BTC")).toBe(0.8);
    });

    it("should skip positions with amount <= 0", async () => {
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: {
          rows: [
            { asset: "BTC", amount: 0.1, productId: "BTCFLEX001" },
            { asset: "ETH", amount: 0, productId: "ETHFLEX001" },
            { asset: "USDT", amount: -1, productId: "USDTFLEX001" },
          ],
        },
      });
      const map = await manager.getEarnBalanceMap();
      expect(map.has("BTC")).toBe(true);
      expect(map.has("ETH")).toBe(false);
      expect(map.has("USDT")).toBe(false);
    });

    it("should force fresh fetch by invalidating cache", async () => {
      // First fetch
      await manager.getFlexiblePositions();

      // Change mock response
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: {
          rows: [
            { asset: "BTC", amount: 0.5, productId: "BTCFLEX001" },
          ],
        },
      });

      // getEarnBalanceMap should get fresh data
      const map = await manager.getEarnBalanceMap();
      expect(map.get("BTC")).toBe(0.5); // Not the cached 0.1
    });
  });

  // ─── subscribe() Tests ───────────────────────────────────────────────

  describe("subscribe()", () => {
    it("should subscribe asset and emit event on success", async () => {
      const result = await manager.subscribe("BTC", 0.1);
      expect(result).toBe(true);
      expect(capturedEvents.some((e) => e.event === "earn:subscribed")).toBe(true);
    });

    it("should return false for amount below MIN_SUBSCRIBE_AMOUNT", async () => {
      const result = await manager.subscribe("BTC", 0.000001);
      expect(result).toBe(false);
    });

    it("should return false if asset has no product", async () => {
      const result = await manager.subscribe("DOGE", 1);
      expect(result).toBe(false);
    });

    it("should return false when exchange not connected", async () => {
      exchangeConnected = false;
      const result = await manager.subscribe("BTC", 0.1);
      expect(result).toBe(false);
    });

    it("should return false on API error", async () => {
      mockExchange.sapiPostSimpleEarnFlexibleSubscribe = async () => {
        throw new Error("Subscribe failed");
      };
      const result = await manager.subscribe("BTC", 0.1);
      expect(result).toBe(false);
    });

    it("should invalidate position cache after successful subscribe", async () => {
      // Populate cache
      await manager.getFlexiblePositions();

      // Change mock response
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: {
          rows: [
            { asset: "BTC", amount: 0.2, productId: "BTCFLEX001" },
          ],
        },
      });

      // Subscribe should invalidate cache
      await manager.subscribe("BTC", 0.1);

      // Next fetch should get fresh data
      const positions = await manager.getFlexiblePositions();
      expect(positions[0].amount).toBe(0.2);
    });

    it("should emit earn:subscribed event with correct payload", async () => {
      await manager.subscribe("BTC", 0.25);
      const event = capturedEvents.find((e) => e.event === "earn:subscribed");
      expect(event?.data).toEqual({ asset: "BTC", amount: 0.25 });
    });
  });

  // ─── redeem() Tests ───────────────────────────────────────────────────

  describe("redeem()", () => {
    it("should redeem asset and emit event on success", async () => {
      const result = await manager.redeem("BTC", 0.05);
      expect(result).toBe(true);
      expect(capturedEvents.some((e) => e.event === "earn:redeemed")).toBe(true);
    });

    it("should return false for amount <= 0", async () => {
      const result = await manager.redeem("BTC", 0);
      expect(result).toBe(false);
    });

    it("should return false if asset has no product", async () => {
      const result = await manager.redeem("DOGE", 1);
      expect(result).toBe(false);
    });

    it("should return false when exchange not connected", async () => {
      exchangeConnected = false;
      const result = await manager.redeem("BTC", 0.05);
      expect(result).toBe(false);
    });

    it("should return false on API error", async () => {
      mockExchange.sapiPostSimpleEarnFlexibleRedeem = async () => {
        throw new Error("Redeem failed");
      };
      const result = await manager.redeem("BTC", 0.05);
      expect(result).toBe(false);
    });

    it("should invalidate position cache after successful redeem", async () => {
      // Populate cache
      await manager.getFlexiblePositions();

      // Change mock response
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: {
          rows: [
            { asset: "BTC", amount: 0.05, productId: "BTCFLEX001" },
          ],
        },
      });

      // Redeem should invalidate cache
      await manager.redeem("BTC", 0.05);

      // Next fetch should get fresh data
      const positions = await manager.getFlexiblePositions();
      expect(positions[0].amount).toBe(0.05);
    });

    it("should emit earn:redeemed event with correct payload", async () => {
      await manager.redeem("BTC", 0.15);
      const event = capturedEvents.find((e) => e.event === "earn:redeemed");
      expect(event?.data).toEqual({ asset: "BTC", amount: 0.15 });
    });

    it("should pass destAccount SPOT to API", async () => {
      let capturedParams: Record<string, string> = {};
      mockExchange.sapiPostSimpleEarnFlexibleRedeem = async (params: Record<string, string>) => {
        capturedParams = params;
        return { success: true };
      };

      await manager.redeem("BTC", 0.05);
      expect(capturedParams.destAccount).toBe("SPOT");
    });
  });

  // ─── subscribeAll() Tests ─────────────────────────────────────────────

  describe("subscribeAll()", () => {
    it("should subscribe all assets with free balance above minimum", async () => {
      await manager.subscribeAll(["BTC", "ETH", "USDT"]);
      const events = capturedEvents.filter((e) => e.event === "earn:subscribed");
      expect(events.length).toBe(3);
    });

    it("should skip assets with zero balance", async () => {
      mockExchange.fetchBalance = async () => ({
        BTC: { free: 0, used: 0, total: 0 },
        ETH: { free: 10, used: 0, total: 10 },
        free: { BTC: 0, ETH: 10 },
        used: {},
        total: { BTC: 0, ETH: 10 },
      });

      await manager.subscribeAll(["BTC", "ETH"]);
      const events = capturedEvents.filter((e) => e.event === "earn:subscribed");
      expect(events.length).toBe(1);
      expect((events[0].data as any).asset).toBe("ETH");
    });

    it("should handle missing assets in balance", async () => {
      const result = await manager.subscribeAll(["MISSING", "BTC"]);
      expect(result).toBeUndefined(); // Non-throwing
    });

    it("should return early if exchange not connected", async () => {
      exchangeConnected = false;
      const result = await manager.subscribeAll(["BTC", "ETH"]);
      expect(result).toBeUndefined();
    });

    it("should return early if fetchBalance fails", async () => {
      mockExchange.fetchBalance = async () => {
        throw new Error("fetchBalance failed");
      };
      const result = await manager.subscribeAll(["BTC", "ETH"]);
      expect(result).toBeUndefined();
    });

    it("should not throw on individual subscribe failures", async () => {
      let callCount = 0;
      mockExchange.sapiPostSimpleEarnFlexibleSubscribe = async () => {
        callCount++;
        if (callCount === 1) throw new Error("First subscribe failed");
        return { success: true };
      };

      // Should not throw even though first asset fails
      await manager.subscribeAll(["BTC", "ETH", "USDT"]);
      const events = capturedEvents.filter((e) => e.event === "earn:subscribed");
      expect(events.length).toBe(2); // Only successful ones
    });
  });

  // ─── redeemForRebalance() Tests ────────────────────────────────────────

  describe("redeemForRebalance()", () => {
    it("should redeem only sell-side assets", async () => {
      await manager.redeemForRebalance([
        { pair: "BTC/USDT", amount: 0.05 },
        { pair: "ETH/USDT", amount: 1 },
      ]);

      const events = capturedEvents.filter((e) => e.event === "earn:redeemed");
      expect(events.length).toBe(2);
    });

    it("should skip assets with no earn balance", async () => {
      await manager.redeemForRebalance([
        { pair: "DOGE/USDT", amount: 100 },
        { pair: "BTC/USDT", amount: 0.05 },
      ]);

      const events = capturedEvents.filter((e) => e.event === "earn:redeemed");
      expect(events.length).toBe(1);
      expect((events[0].data as any).asset).toBe("BTC");
    });

    it("should redeem only what is needed", async () => {
      // Earn balance is 0.1 BTC but only need 0.05
      let redeemedAmount = 0;
      mockExchange.sapiPostSimpleEarnFlexibleRedeem = async (params: Record<string, string>) => {
        redeemedAmount = parseFloat(params.amount);
        return { success: true };
      };

      await manager.redeemForRebalance([{ pair: "BTC/USDT", amount: 0.05 }]);
      expect(redeemedAmount).toBe(0.05); // Not the full 0.1
    });

    it("should redeem full earn balance if order amount is larger", async () => {
      let redeemedAmount = 0;
      mockExchange.sapiPostSimpleEarnFlexibleRedeem = async (params: Record<string, string>) => {
        redeemedAmount = parseFloat(params.amount);
        return { success: true };
      };

      await manager.redeemForRebalance([{ pair: "BTC/USDT", amount: 1 }]);
      expect(redeemedAmount).toBe(0.1); // Full earn balance
    });

    it("should skip pairs with invalid format", async () => {
      const result = await manager.redeemForRebalance([
        { pair: "INVALID", amount: 1 }, // No /
        { pair: "BTC/USDT", amount: 0.05 },
      ]);
      expect(result).toBeUndefined();

      const events = capturedEvents.filter((e) => e.event === "earn:redeemed");
      expect(events.length).toBe(1);
    });

    it("should skip amounts below MIN_SUBSCRIBE_AMOUNT", async () => {
      await manager.redeemForRebalance([
        { pair: "ETH/USDT", amount: 0.000001 }, // Below minimum
        { pair: "BTC/USDT", amount: 0.05 },
      ]);

      const events = capturedEvents.filter((e) => e.event === "earn:redeemed");
      expect(events.length).toBe(1);
      expect((events[0].data as any).asset).toBe("BTC");
    });
  });

  // ─── waitForSettlement() Tests ────────────────────────────────────────

  describe("waitForSettlement()", () => {
    it("should return immediately when all amounts settled", async () => {
      const expected = new Map([["BTC", 0.1]]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 30000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should be instant
    });

    it("should return when balances exceed expected with 5% tolerance", async () => {
      const expected = new Map([["BTC", 0.5]]);
      mockExchange.fetchBalance = async () => ({
        BTC: { free: 0.475, used: 0, total: 0.475 }, // 95% of 0.5
        free: { BTC: 0.475 },
        used: {},
        total: { BTC: 0.475 },
      });

      const start = Date.now();
      await manager.waitForSettlement(expected, 30000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it("should timeout after specified duration", async () => {
      const expected = new Map([["BTC", 100]]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 500);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });

    it("should handle fetchBalance errors gracefully", async () => {
      let pollCount = 0;
      mockExchange.fetchBalance = async () => {
        pollCount++;
        if (pollCount === 1) throw new Error("Network error");
        return {
          BTC: { free: 0.1, used: 0, total: 0.1 },
          free: { BTC: 0.1 },
          used: {},
          total: { BTC: 0.1 },
        };
      };

      const expected = new Map([["BTC", 0.1]]);
      await manager.waitForSettlement(expected, 10000);
      expect(pollCount).toBeGreaterThan(1); // Retried after error
    });

    it("should return early if exchange not connected", async () => {
      exchangeConnected = false;
      const expected = new Map([["BTC", 0.1]]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 30000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("should return early if expected map is empty", async () => {
      const expected = new Map<string, number>();
      const start = Date.now();
      await manager.waitForSettlement(expected, 30000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("should check all assets in expected map", async () => {
      let pollCount = 0;
      mockExchange.fetchBalance = async () => {
        pollCount++;
        return {
          BTC: { free: 0.1, used: 0, total: 0.1 },
          ETH: { free: 2, used: 0, total: 2 },
          free: { BTC: 0.1, ETH: 2 },
          used: {},
          total: { BTC: 0.1, ETH: 2 },
        };
      };

      const expected = new Map([
        ["BTC", 0.1],
        ["ETH", 2],
      ]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 10000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500); // Should settle quickly
    });

    it("should fail if any asset lacks sufficient balance", async () => {
      mockExchange.fetchBalance = async () => ({
        BTC: { free: 0.1, used: 0, total: 0.1 },
        ETH: { free: 1, used: 0, total: 1 }, // Only 1, need 2
        free: { BTC: 0.1, ETH: 1 },
        used: {},
        total: { BTC: 0.1, ETH: 1 },
      });

      const expected = new Map([
        ["BTC", 0.1],
        ["ETH", 2],
      ]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 500);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500); // Should timeout
    });

    it("should handle missing asset in balance as zero", async () => {
      mockExchange.fetchBalance = async () => ({
        BTC: { free: 0.1, used: 0, total: 0.1 },
        free: { BTC: 0.1 },
        used: {},
        total: { BTC: 0.1 },
      });

      const expected = new Map([["MISSING", 1]]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 500);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500); // Should timeout
    });

    it("should handle non-object balance entries", async () => {
      mockExchange.fetchBalance = async () => ({
        BTC: null, // Invalid balance entry
        ETH: { free: 2, used: 0, total: 2 },
        free: { BTC: 0, ETH: 2 },
        used: {},
        total: { BTC: 0, ETH: 2 },
      });

      const expected = new Map([
        ["BTC", 0.1],
        ["ETH", 2],
      ]);
      const start = Date.now();
      await manager.waitForSettlement(expected, 500);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500); // Should timeout due to BTC
    });
  });

  // ─── getApyMap() Tests ─────────────────────────────────────────────────

  describe("getApyMap()", () => {
    it("should return per-asset APY rates as percentages", async () => {
      const apyMap = await manager.getApyMap();
      expect(apyMap["BTC/USDT"]).toBe(2); // 0.02 * 100
      expect(apyMap["ETH/USDT"]).toBe(3); // 0.03 * 100
      expect(apyMap["USDT/USDT"]).toBe(5); // 0.05 * 100
    });

    it("should return empty map when no products", async () => {
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: { rows: [] },
      });
      const manager2 = new SimpleEarnManager();
      const apyMap = await manager2.getApyMap();
      expect(Object.keys(apyMap).length).toBe(0);
    });

    it("should skip products without APY data", async () => {
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: {
          rows: [
            { productId: "BTCFLEX001", asset: "BTC", latestAnnualPercentageRate: 0.02 },
            { productId: "ETHFLEX001", asset: "ETH" }, // No APY
          ],
        },
      });
      const manager2 = new SimpleEarnManager();
      const apyMap = await manager2.getApyMap();
      expect(apyMap["BTC/USDT"]).toBe(2);
      expect(apyMap["ETH/USDT"]).toBeUndefined();
    });

    it("should use cached products", async () => {
      await manager.getFlexibleProducts();
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: { rows: [] },
      });
      const apyMap = await manager.getApyMap();
      expect(apyMap["BTC/USDT"]).toBe(2); // From cache
    });

    it("should format keys as ASSET/USDT", async () => {
      const apyMap = await manager.getApyMap();
      const keys = Object.keys(apyMap);
      expect(keys.every((k) => k.endsWith("/USDT"))).toBe(true);
    });
  });

  // ─── Error Resilience Tests ────────────────────────────────────────────

  describe("Error Resilience (non-throwing)", () => {
    it("should not throw on any error condition", async () => {
      exchangeConnected = false;
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => {
        throw new Error("API Error");
      };
      mockExchange.sapiPostSimpleEarnFlexibleSubscribe = async () => {
        throw new Error("Subscribe Error");
      };

      // All of these should not throw
      await manager.getFlexibleProducts();
      await manager.getFlexiblePositions();
      await manager.getProductId("BTC");
      await manager.subscribe("BTC", 0.1);
      await manager.redeem("BTC", 0.05);
      await manager.subscribeAll(["BTC"]);
      await manager.redeemForRebalance([{ pair: "BTC/USDT", amount: 0.1 }]);
      await manager.getEarnBalanceMap();
      await manager.getApyMap();
      await manager.waitForSettlement(new Map([["BTC", 0.1]]), 100);
    });
  });

  // ─── Cache Behavior Tests ──────────────────────────────────────────────

  describe("Cache Behavior", () => {
    it("should respect product cache TTL of 1 hour", async () => {
      // This is a logical test — actual TTL testing would require mocking Date.now
      const products = await manager.getFlexibleProducts();
      expect(products.length).toBe(3);

      // Simulate cache hit by changing mock
      mockExchange.sapiGetSimpleEarnFlexibleList = async () => ({
        data: { rows: [] },
      });

      const products2 = await manager.getFlexibleProducts();
      expect(products2.length).toBe(3); // Cache still valid
    });

    it("should respect position cache TTL of 30 seconds", async () => {
      const positions = await manager.getFlexiblePositions();
      expect(positions.length).toBe(2);

      // Simulate cache hit by changing mock
      mockExchange.sapiGetSimpleEarnFlexiblePosition = async () => ({
        data: { rows: [] },
      });

      const positions2 = await manager.getFlexiblePositions();
      expect(positions2.length).toBe(2); // Cache still valid
    });
  });
});
