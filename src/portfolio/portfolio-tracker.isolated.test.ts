import { afterEach, describe, expect, it, mock } from "bun:test";

// watchBalance must block (not resolve instantly) to prevent infinite loop
let resolveWatch: (() => void) | null = null;
const mockExchange = {
  id: "binance",
  watchBalance: () =>
    new Promise<Record<string, unknown>>((resolve) => {
      resolveWatch = () =>
        resolve({
          free: { BTC: 1, ETH: 10, USDT: 50000 },
          total: { BTC: 1, ETH: 10, USDT: 50000 },
        });
    }),
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
    getBestPrice: () => 50000,
    get: () => ({ price: 50000 }),
    set: () => {},
  },
}));

mock.module("@events/event-bus", () => ({
  eventBus: { emit: () => {}, on: () => {}, off: () => {} },
}));

import { portfolioTracker } from "@portfolio/portfolio-tracker";

describe("PortfolioTracker (isolated)", () => {
  afterEach(async () => {
    await portfolioTracker.stopWatching();
  });

  it("getPortfolio returns null initially", () => {
    expect(portfolioTracker.getPortfolio()).toBeNull();
  });

  it("getTargetAllocations reads from DB", async () => {
    const targets = await portfolioTracker.getTargetAllocations();
    expect(Array.isArray(targets)).toBe(true);
  });

  it("stopWatching is safe when not watching", async () => {
    await portfolioTracker.stopWatching();
    expect(true).toBe(true);
  });

  it(
    "startWatching then stopWatching",
    async () => {
      const exchanges = new Map([["binance", mockExchange as any]]);
      // startWatching fires and forgets — doesn't await the loop
      await portfolioTracker.startWatching(exchanges);
      // Give it a tick
      await new Promise((r) => setTimeout(r, 50));
      await portfolioTracker.stopWatching();
      expect(true).toBe(true);
    },
    { timeout: 5000 }
  );
});
