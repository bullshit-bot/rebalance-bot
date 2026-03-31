import { beforeEach, describe, expect, it } from "bun:test";
import {
  createMockExchange,
  getMockBalance,
  resetMockExchangeState,
  setMockBalance,
} from "@test-utils/mock-exchange";

describe("Mock Exchange", () => {
  beforeEach(() => {
    resetMockExchangeState();
  });

  it("should create mock exchange with defaults", async () => {
    const exchange = createMockExchange();
    expect(exchange).toBeDefined();
    expect(exchange.id).toBe("mock-binance");
  });

  it("should load markets", async () => {
    const exchange = createMockExchange();
    const markets = await exchange.loadMarkets();
    expect(markets).toBeDefined();
    expect(markets["BTC/USDT"]).toBeDefined();
  });

  it("should watch balance", async () => {
    const exchange = createMockExchange();
    const balance = await exchange.watchBalance();
    expect(balance).toBeDefined();
    expect(balance.total).toBeDefined();
  });

  it("should create market order", async () => {
    const exchange = createMockExchange();
    const order = await exchange.createOrder("BTC/USDT", "market", "buy", 0.5, 50000);
    expect(order).toBeDefined();
    expect(order["status"]).toBe("closed");
    expect(order["filled"]).toBe(0.5);
  });

  it("should create limit order", async () => {
    const exchange = createMockExchange();
    const order = await exchange.createOrder("BTC/USDT", "limit", "buy", 0.5, 49000);
    expect(order).toBeDefined();
    expect(order["status"]).toBe("open");
    expect(order["filled"]).toBe(0);
  });

  it("should fetch order", async () => {
    const exchange = createMockExchange();
    const order = await exchange.createOrder("BTC/USDT", "market", "buy", 0.5);
    const fetched = await exchange.fetchOrder(String(order["id"]), "BTC/USDT");
    expect(fetched).toBeDefined();
    expect(fetched["id"]).toBe(order["id"]);
  });

  it("should cancel order", async () => {
    const exchange = createMockExchange();
    const order = await exchange.createOrder("BTC/USDT", "limit", "buy", 0.5, 49000);
    const cancelled = await exchange.cancelOrder(String(order["id"]), "BTC/USDT");
    expect(cancelled["status"]).toBe("cancelled");
  });

  it("should fetch OHLCV data", async () => {
    const exchange = createMockExchange();
    const candles = await exchange.fetchOHLCV("BTC/USDT", "1h", undefined, 10);
    expect(candles).toBeDefined();
    expect(candles.length).toBe(10);
    expect(candles[0].length).toBe(6); // [timestamp, open, high, low, close, volume]
  });

  it("should set and get mock balance", () => {
    setMockBalance("BTC", 5, "total");
    const balances = getMockBalance();
    expect(balances.total["BTC"]).toBe(5);
  });

  it("should reset mock state", async () => {
    const exchange = createMockExchange();
    await exchange.createOrder("BTC/USDT", "market", "buy", 0.5);
    resetMockExchangeState();

    const newExchange = createMockExchange();
    const balance = await newExchange.watchBalance();
    expect(balance.total["BTC"]).toBe(1); // Reset to default
  });

  it("should override default behavior", async () => {
    const customBalance = { free: { BTC: 10 }, total: { BTC: 10 } };
    const exchange = createMockExchange({
      watchBalance: async () => customBalance,
    });
    const balance = await exchange.watchBalance();
    expect(balance.total["BTC"]).toBe(10);
  });
});
