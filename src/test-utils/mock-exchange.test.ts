import { beforeEach, describe, expect, it } from "bun:test";
import {
  createMockExchange,
  getMockBalance,
  getMockOrders,
  resetMockExchangeState,
  setMockBalance,
} from "./mock-exchange";

// ─── Tests for mock-exchange utility ─────────────────────────────────────────

describe("mock-exchange utility", () => {
  beforeEach(() => {
    resetMockExchangeState();
  });

  describe("createMockExchange", () => {
    it("returns exchange with correct default id", () => {
      const ex = createMockExchange();
      expect(ex.id).toBe("mock-binance");
      expect(ex.name).toBe("Mock Binance");
    });

    it("overrides id and name", () => {
      const ex = createMockExchange({ id: "custom-id", name: "Custom" });
      expect(ex.id).toBe("custom-id");
      expect(ex.name).toBe("Custom");
    });

    it("watchTicker returns expected fields", async () => {
      const ex = createMockExchange();
      const ticker = await ex.watchTicker("BTC/USDT");
      expect(ticker["last"]).toBe(50000);
      expect(ticker["bid"]).toBeDefined();
      expect(ticker["ask"]).toBeDefined();
      expect(ticker["baseVolume"]).toBeDefined();
      expect(ticker["symbol"]).toBe("BTC/USDT");
    });

    it("watchBalance returns default state", async () => {
      const ex = createMockExchange();
      const balance = await ex.watchBalance();
      expect(balance["total"]).toBeDefined();
      expect((balance["total"] as any)["BTC"]).toBe(1);
      expect((balance["total"] as any)["USDT"]).toBe(50000);
    });

    it("createOrder market sets status closed and fills amount", async () => {
      const ex = createMockExchange();
      const order = await ex.createOrder("BTC/USDT", "market", "buy", 0.5);
      expect(order["status"]).toBe("closed");
      expect(order["filled"]).toBe(0.5);
      expect(order["id"]).toBeDefined();
    });

    it("createOrder limit sets status open and filled=0", async () => {
      const ex = createMockExchange();
      const order = await ex.createOrder("BTC/USDT", "limit", "buy", 0.1, 50000);
      expect(order["status"]).toBe("open");
      expect(order["filled"]).toBe(0);
    });

    it("createOrder stores order so fetchOrder can retrieve it", async () => {
      const ex = createMockExchange();
      const created = await ex.createOrder("BTC/USDT", "market", "buy", 0.1);
      const id = String(created["id"]);
      const fetched = await ex.fetchOrder(id, "BTC/USDT");
      expect(fetched["id"]).toBe(id);
    });

    it("fetchOrder throws when order not found", async () => {
      const ex = createMockExchange();
      await expect(ex.fetchOrder("nonexistent", "BTC/USDT")).rejects.toThrow("not found");
    });

    it("cancelOrder marks order as cancelled", async () => {
      const ex = createMockExchange();
      const created = await ex.createOrder("BTC/USDT", "limit", "sell", 0.2, 55000);
      const cancelled = await ex.cancelOrder(String(created["id"]));
      expect(cancelled["status"]).toBe("cancelled");
      expect(cancelled["filled"]).toBe(0);
    });

    it("cancelOrder throws when order not found", async () => {
      const ex = createMockExchange();
      await expect(ex.cancelOrder("bad-id")).rejects.toThrow("not found");
    });

    it("cancelOrder can be called without pair argument", async () => {
      const ex = createMockExchange();
      const order = await ex.createOrder("BTC/USDT", "limit", "buy", 0.1, 50000);
      const cancelled = await ex.cancelOrder(String(order["id"]));
      expect(cancelled["status"]).toBe("cancelled");
    });

    it("fetchOHLCV returns correct number of candles", async () => {
      const ex = createMockExchange();
      const candles = await ex.fetchOHLCV("BTC/USDT", "1d", undefined, 10);
      expect(candles.length).toBe(10);
      expect(candles[0]).toHaveLength(6);
    });

    it("fetchOHLCV defaults to 30 candles when no limit given", async () => {
      const ex = createMockExchange();
      const candles = await ex.fetchOHLCV("BTC/USDT", "1d");
      expect(candles.length).toBe(30);
    });

    it("fetchOHLCV uses hourly interval for 1h timeframe", async () => {
      const ex = createMockExchange();
      const candles = await ex.fetchOHLCV("BTC/USDT", "1h", undefined, 5);
      expect(candles.length).toBe(5);
      // Timestamps should be spaced 1h apart
      if (candles.length >= 2) {
        const diff = candles[1][0]! - candles[0][0]!;
        expect(diff).toBe(3600000);
      }
    });

    it("fetchBalance returns total with expected assets", async () => {
      const ex = createMockExchange();
      const balance = await ex.fetchBalance();
      expect((balance["total"] as any)["BTC"]).toBe(1);
      expect((balance["total"] as any)["ETH"]).toBe(10);
      expect((balance["total"] as any)["USDT"]).toBe(50000);
    });

    it("fetchOpenOrders returns only open orders for the pair", async () => {
      const ex = createMockExchange();
      // Create a limit (open) order for BTC
      await ex.createOrder("BTC/USDT", "limit", "buy", 0.1, 50000);
      // Create a market (closed) order for BTC
      await ex.createOrder("BTC/USDT", "market", "buy", 0.2);
      // Create a limit order for ETH
      await ex.createOrder("ETH/USDT", "limit", "buy", 1.0, 3000);

      const btcOrders = await ex.fetchOpenOrders?.("BTC/USDT");
      expect(btcOrders).toBeDefined();
      // Only the limit BTC order should be open
      expect(btcOrders!.length).toBe(1);
    });

    it("loadMarkets returns market data", async () => {
      const ex = createMockExchange();
      const markets = await ex.loadMarkets();
      expect(markets["BTC/USDT"]).toBeDefined();
      expect(markets["ETH/USDT"]).toBeDefined();
    });

    it("close() resolves without error", async () => {
      const ex = createMockExchange();
      await expect(ex.close()).resolves.toBeUndefined();
    });

    it("overrides createOrder with custom implementation", async () => {
      const ex = createMockExchange({
        createOrder: async () => ({
          id: "override-001",
          status: "closed",
          filled: 0.5,
          cost: 25000,
          fee: { cost: 25, currency: "USDT" },
        }),
      });
      const order = await ex.createOrder("BTC/USDT", "market", "buy", 0.5);
      expect(order["id"]).toBe("override-001");
    });

    it("order cost is calculated correctly for limit order", async () => {
      const ex = createMockExchange();
      const order = await ex.createOrder("BTC/USDT", "limit", "buy", 0.1, 50000);
      expect(order["cost"]).toBe(0.1 * 50000);
    });

    it("fee is 0.1% of cost", async () => {
      const ex = createMockExchange();
      const order = await ex.createOrder("BTC/USDT", "market", "buy", 1.0, 50000);
      const fee = order["fee"] as any;
      // cost = amount(1.0) * price(50000) = 50000; fee = cost * 0.001 = 50
      expect(fee.cost).toBeCloseTo(50, 2);
      expect(fee.currency).toBe("USDT");
    });
  });

  describe("resetMockExchangeState", () => {
    it("clears all orders", async () => {
      const ex = createMockExchange();
      await ex.createOrder("BTC/USDT", "market", "buy", 0.1);
      resetMockExchangeState();

      const orders = getMockOrders();
      expect(Object.keys(orders).length).toBe(0);
    });

    it("resets balances to defaults", async () => {
      setMockBalance("BTC", 999, "total");
      resetMockExchangeState();

      const balances = getMockBalance();
      expect((balances["total"] as any)["BTC"]).toBe(1);
    });

    it("resets order ID counter (IDs start from 1000 again)", async () => {
      const ex = createMockExchange();
      await ex.createOrder("BTC/USDT", "market", "buy", 0.1);
      resetMockExchangeState();

      const ex2 = createMockExchange();
      const order = await ex2.createOrder("BTC/USDT", "market", "buy", 0.1);
      expect(String(order["id"])).toBe("mock-1000");
    });
  });

  describe("setMockBalance", () => {
    it("sets free balance", () => {
      setMockBalance("SOL", 100, "free");
      const bal = getMockBalance();
      expect((bal["free"] as any)["SOL"]).toBe(100);
    });

    it("sets total balance (default)", () => {
      setMockBalance("ADA", 500);
      const bal = getMockBalance();
      expect((bal["total"] as any)["ADA"]).toBe(500);
    });

    it("sets used balance", () => {
      setMockBalance("DOT", 10, "used");
      const bal = getMockBalance();
      expect((bal["used"] as any)["DOT"]).toBe(10);
    });

    it("creates balance type if not exists", () => {
      // Reset to ensure clean state
      resetMockExchangeState();
      setMockBalance("XRP", 200, "free");
      const bal = getMockBalance();
      expect((bal["free"] as any)["XRP"]).toBe(200);
    });
  });

  describe("getMockBalance", () => {
    it("returns a deep copy (not original reference)", () => {
      const bal1 = getMockBalance();
      const bal2 = getMockBalance();
      expect(bal1).not.toBe(bal2); // different references
      expect(JSON.stringify(bal1)).toBe(JSON.stringify(bal2));
    });
  });

  describe("getMockOrders", () => {
    it("returns empty object initially", () => {
      const orders = getMockOrders();
      expect(Object.keys(orders).length).toBe(0);
    });

    it("returns order after creation", async () => {
      const ex = createMockExchange();
      const created = await ex.createOrder("BTC/USDT", "market", "buy", 0.1);
      const id = String(created["id"]);

      const orders = getMockOrders();
      expect(orders[id]).toBeDefined();
      expect(orders[id]["symbol"]).toBe("BTC/USDT");
    });

    it("reflects cancelled status after cancel", async () => {
      const ex = createMockExchange();
      const created = await ex.createOrder("BTC/USDT", "limit", "buy", 0.1, 50000);
      const id = String(created["id"]);
      await ex.cancelOrder(id);

      const orders = getMockOrders();
      expect(orders[id]["status"]).toBe("cancelled");
    });
  });
});
