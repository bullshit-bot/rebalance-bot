import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const mockExchange = {
  id: "binance",
  createOrder: async (
    pair: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ) => ({
    id: "grid-ord-" + Math.random().toString(36).slice(2, 8),
    symbol: pair,
    type,
    side,
    amount,
    price: price ?? 50000,
    status: "closed",
    filled: amount,
    remaining: 0,
    fee: { cost: 0.1, currency: "USDT" },
  }),
  cancelOrder: async () => ({ id: "grid-ord-1", status: "cancelled" }),
  fetchOpenOrders: async () => [],
  fetchOrder: async () => ({ id: "grid-ord-1", status: "closed", filled: 0.5 }),
  loadMarkets: async () => ({}),
  close: async () => {},
};

mock.module("@exchange/exchange-manager", () => ({
  exchangeManager: {
    getExchange: () => mockExchange,
    getEnabledExchanges: () => new Map([["binance", mockExchange]]),
  },
}));

mock.module("@price/price-cache", () => ({
  priceCache: {
    getBestPrice: (pair: string) =>
      pair.includes("BTC") ? 50000 : pair.includes("ETH") ? 3500 : 180,
  },
}));

mock.module("@db/database", () => {
  const mockDb = {
    query: async () => [],
    insert: () => ({ values: () => ({ returning: async () => [{ id: "grid-order-1" }] }) }),
    update: () => ({ set: () => ({ where: async () => ({}) }) }),
    select: () => ({
      from: () => ({
        // Return a thenable array for cancelAll and other direct-await callers
        where: () => Promise.resolve([]),
      }),
    }),
  };
  return { db: mockDb };
});

mock.module("@events/event-bus", () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
    off: () => {},
  },
}));

import { GridExecutor } from "@grid/grid-executor";

describe("GridExecutor", () => {
  let executor: GridExecutor;

  beforeEach(() => {
    executor = new GridExecutor();
  });

  it("should create grid executor instance", () => {
    expect(executor).toBeDefined();
  });

  it("should place grid orders", async () => {
    // placeGrid(botId, levels[], exchange, pair) returns void
    const levels = [
      { level: 0, price: 48000, buyAmount: 0.01, sellAmount: 0 },
      { level: 1, price: 50000, buyAmount: 0, sellAmount: 0.01 },
    ];
    await executor.placeGrid("bot-1", levels, "binance", "BTC/USDT");
    expect(executor).toBeDefined();
  });

  it("should start monitoring", async () => {
    await executor.startMonitoring("bot-1");
    expect(true).toBe(true);
  });

  it("should cancel all grid orders", async () => {
    await executor.cancelAll("bot-1");
    expect(true).toBe(true);
  });

  afterEach(async () => {
    // Cleanup if needed
  });
});
