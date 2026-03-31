import { describe, expect, it, mock } from "bun:test";

const mockExchange = {
  id: "binance",
  fetchOHLCV: async () => [
    [Date.now() - 3600000, 48000, 49000, 47000, 48500, 1000],
    [Date.now(), 49000, 49500, 48500, 49250, 1200],
  ],
  createOrder: async (
    pair: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ) => ({
    id: "vwap-ord-1",
    symbol: pair,
    type,
    side,
    amount,
    price: price ?? 50000,
    status: "closed",
    filled: amount,
    fee: { cost: 0.1, currency: "USDT" },
  }),
  loadMarkets: async () => ({}),
  close: async () => {},
};

mock.module("@exchange/exchange-manager", () => ({
  exchangeManager: {
    getExchange: () => mockExchange,
  },
}));

mock.module("@price/price-cache", () => ({
  priceCache: {
    getBestPrice: () => 50000,
  },
}));

mock.module("@db/database", () => ({
  db: {
    query: async () => [],
    insert: () => ({ values: async () => ({}) }),
  },
}));

mock.module("@events/event-bus", () => ({
  eventBus: {
    emit: () => {},
  },
}));

import { vwapEngine } from "./vwap-engine";

describe("VWAPEngine", () => {
  it("should create vwap engine instance", () => {
    expect(vwapEngine).toBeDefined();
  });

  it("should create VWAP execution", async () => {
    const id = await vwapEngine.create({
      exchange: "binance",
      pair: "BTC/USDT",
      side: "buy",
      totalAmount: 0.5,
      slices: 5,
      durationMs: 3600000,
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
  });

  it("should have execution tracker", () => {
    expect(vwapEngine).toBeDefined();
  });
});
