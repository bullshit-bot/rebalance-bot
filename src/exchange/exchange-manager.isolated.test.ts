import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockExchange = {
  id: "binance",
  loadMarkets: async () => ({ "BTC/USDT": { id: "BTCUSDT" } }),
  close: async () => {},
};

mock.module("@exchange/exchange-factory", () => ({
  createExchange: () => mockExchange,
}));

mock.module("@config/app-config", () => ({
  env: {
    BINANCE_API_KEY: "test-binance-key",
    BINANCE_API_SECRET: "test-binance-secret",
    OKX_API_KEY: "",
    OKX_API_SECRET: "",
    OKX_PASSPHRASE: "",
    BYBIT_API_KEY: "",
    BYBIT_API_SECRET: "",
  },
}));

mock.module("@events/event-bus", () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
    off: () => {},
  },
}));

import { exchangeManager } from "@exchange/exchange-manager";

describe("ExchangeManager", () => {
  beforeEach(async () => {
    // Reset exchanges before each test
    await exchangeManager.shutdown();
  });

  it("should initialize with available exchanges", async () => {
    await exchangeManager.initialize();
    const enabled = exchangeManager.getEnabledExchanges();
    expect(enabled.size).toBeGreaterThan(0);
  });

  it("should return exchange by name", async () => {
    await exchangeManager.initialize();
    const exchange = exchangeManager.getExchange("binance");
    expect(exchange).toBeDefined();
    expect(exchange?.id).toBe("binance");
  });

  it("should return undefined for missing exchange", async () => {
    await exchangeManager.initialize();
    const exchange = exchangeManager.getExchange("nonexistent");
    expect(exchange).toBeUndefined();
  });

  it("should return connection status", async () => {
    await exchangeManager.initialize();
    const status = exchangeManager.getStatus();
    expect(status).toBeDefined();
    expect(typeof status).toBe("object");
    expect(status.binance === "connected" || status.binance === "disconnected").toBe(true);
  });

  it("should close all exchanges", async () => {
    await exchangeManager.initialize();
    const enabledBefore = exchangeManager.getEnabledExchanges();
    expect(enabledBefore.size).toBeGreaterThan(0);

    await exchangeManager.shutdown();
    const enabledAfter = exchangeManager.getEnabledExchanges();
    expect(enabledAfter.size).toBe(0);
  });
});
