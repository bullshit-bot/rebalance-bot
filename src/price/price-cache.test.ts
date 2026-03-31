import { beforeEach, describe, expect, test } from "bun:test";
import type { PriceData } from "@/types/index";
import { PriceCache } from "./price-cache";

describe("PriceCache", () => {
  let cache: PriceCache;
  let basePriceData: PriceData;

  beforeEach(() => {
    // Use the singleton pattern but test with new instances
    cache = new PriceCache();
    const now = Date.now();
    basePriceData = {
      exchange: "binance",
      pair: "BTC/USDT",
      price: 45000,
      bid: 44999,
      ask: 45001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: now,
    };
  });

  test("set and get single price entry", () => {
    cache.set("BTC/USDT", basePriceData);
    const retrieved = cache.get("BTC/USDT");
    expect(retrieved).toBeDefined();
    expect(retrieved?.price).toBe(45000);
    expect(retrieved?.pair).toBe("BTC/USDT");
  });

  test("get returns undefined for non-existent pair", () => {
    const result = cache.get("ETH/USDT");
    expect(result).toBeUndefined();
  });

  test("set overwrites existing entry when timestamp is newer", () => {
    const oldData: PriceData = {
      ...basePriceData,
      price: 44000,
      timestamp: Date.now() - 5000,
    };
    const newData: PriceData = {
      ...basePriceData,
      price: 46000,
      timestamp: Date.now(),
    };

    cache.set("BTC/USDT", oldData);
    cache.set("BTC/USDT", newData);

    const retrieved = cache.get("BTC/USDT");
    expect(retrieved?.price).toBe(46000);
  });

  test("set keeps existing entry when new timestamp is older", () => {
    const oldData: PriceData = {
      ...basePriceData,
      price: 44000,
      timestamp: Date.now(),
    };
    const newerData: PriceData = {
      ...basePriceData,
      price: 46000,
      timestamp: Date.now() - 5000,
    };

    cache.set("BTC/USDT", oldData);
    cache.set("BTC/USDT", newerData);

    const retrieved = cache.get("BTC/USDT");
    expect(retrieved?.price).toBe(44000);
  });

  test("getAll returns all cached entries", () => {
    const btcData: PriceData = {
      ...basePriceData,
      pair: "BTC/USDT",
      price: 45000,
    };
    const ethData: PriceData = {
      ...basePriceData,
      pair: "ETH/USDT",
      price: 3000,
    };
    const xrpData: PriceData = {
      ...basePriceData,
      pair: "XRP/USDT",
      price: 2.5,
    };

    cache.set("BTC/USDT", btcData);
    cache.set("ETH/USDT", ethData);
    cache.set("XRP/USDT", xrpData);

    const all = cache.getAll();
    expect(Object.keys(all).length).toBe(3);
    expect(all["BTC/USDT"].price).toBe(45000);
    expect(all["ETH/USDT"].price).toBe(3000);
    expect(all["XRP/USDT"].price).toBe(2.5);
  });

  test("getAll returns empty object when cache is empty", () => {
    const all = cache.getAll();
    expect(all).toEqual({});
  });

  test("getBestPrice returns the price for a pair", () => {
    cache.set("BTC/USDT", basePriceData);
    const price = cache.getBestPrice("BTC/USDT");
    expect(price).toBe(45000);
  });

  test("getBestPrice returns undefined for non-existent pair", () => {
    const price = cache.getBestPrice("XYZ/USDT");
    expect(price).toBeUndefined();
  });

  test("getBestPrice returns most recently updated price", () => {
    const price1: PriceData = {
      ...basePriceData,
      price: 45000,
      timestamp: Date.now() - 1000,
    };
    const price2: PriceData = {
      ...basePriceData,
      price: 45500,
      timestamp: Date.now(),
    };

    cache.set("BTC/USDT", price1);
    cache.set("BTC/USDT", price2);

    const bestPrice = cache.getBestPrice("BTC/USDT");
    expect(bestPrice).toBe(45500);
  });

  test("clearStale removes entries older than 60 seconds", () => {
    const now = Date.now();
    const staleData: PriceData = {
      ...basePriceData,
      pair: "BTC/USDT",
      timestamp: now - 65000, // 65 seconds old
    };
    const freshData: PriceData = {
      ...basePriceData,
      pair: "ETH/USDT",
      timestamp: now - 30000, // 30 seconds old
    };

    cache.set("BTC/USDT", staleData);
    cache.set("ETH/USDT", freshData);

    cache.clearStale();

    expect(cache.get("BTC/USDT")).toBeUndefined();
    expect(cache.get("ETH/USDT")).toBeDefined();
  });

  test("clearStale keeps entries exactly at 60 second threshold", () => {
    const now = Date.now();
    const boundaryData: PriceData = {
      ...basePriceData,
      pair: "BTC/USDT",
      timestamp: now - 60000, // exactly 60 seconds old
    };

    cache.set("BTC/USDT", boundaryData);
    cache.clearStale();

    // Should keep entries at the exact threshold
    expect(cache.get("BTC/USDT")).toBeDefined();
  });

  test("clearStale does nothing when cache is empty", () => {
    // Should not throw
    cache.clearStale();
    const all = cache.getAll();
    expect(all).toEqual({});
  });

  test("multiple exchanges for same pair stores most recent", () => {
    const btcBinance: PriceData = {
      ...basePriceData,
      exchange: "binance",
      price: 45000,
      timestamp: Date.now() - 1000,
    };
    const btcOkx: PriceData = {
      ...basePriceData,
      exchange: "okx",
      price: 45100,
      timestamp: Date.now(),
    };

    cache.set("BTC/USDT", btcBinance);
    cache.set("BTC/USDT", btcOkx);

    // Cache stores only the most recent, which is from OKX
    const cached = cache.get("BTC/USDT");
    expect(cached?.price).toBe(45100);
    expect(cached?.exchange).toBe("okx");
  });

  test("handles rapid price updates for same pair", () => {
    for (let i = 0; i < 100; i++) {
      const data: PriceData = {
        ...basePriceData,
        price: 45000 + i,
        timestamp: Date.now() + i,
      };
      cache.set("BTC/USDT", data);
    }

    const final = cache.get("BTC/USDT");
    expect(final?.price).toBe(45000 + 99);
  });

  test("handles many different pairs", () => {
    const pairs = ["BTC/USDT", "ETH/USDT", "XRP/USDT", "ADA/USDT", "SOL/USDT"];
    for (let i = 0; i < pairs.length; i++) {
      const data: PriceData = {
        ...basePriceData,
        pair: pairs[i],
        price: 1000 * (i + 1),
      };
      cache.set(pairs[i], data);
    }

    const all = cache.getAll();
    expect(Object.keys(all).length).toBe(5);
    expect(all["BTC/USDT"].price).toBe(1000);
    expect(all["SOL/USDT"].price).toBe(5000);
  });

  test("getAll returns object with all entries", () => {
    cache.set("BTC/USDT", basePriceData);
    const all = cache.getAll();

    // Returned object should have the entry
    expect(all["BTC/USDT"]).toBeDefined();
    expect(all["BTC/USDT"].price).toBe(45000);

    // Adding to returned object doesn't affect cache
    all["NEW/USDT"] = { ...basePriceData, pair: "NEW/USDT" };
    expect(cache.get("NEW/USDT")).toBeUndefined();
  });

  test("set with same timestamp replaces entry", () => {
    const ts = Date.now();
    const data1: PriceData = {
      ...basePriceData,
      price: 45000,
      timestamp: ts,
    };
    const data2: PriceData = {
      ...basePriceData,
      price: 46000,
      timestamp: ts,
    };

    cache.set("BTC/USDT", data1);
    cache.set("BTC/USDT", data2);

    // Should be replaced because timestamp is >= existing
    const retrieved = cache.get("BTC/USDT");
    expect(retrieved?.price).toBe(46000);
  });

  test("clearStale handles partial stale cache", () => {
    const now = Date.now();
    const pairs = [
      { pair: "BTC/USDT", age: 70000 }, // stale
      { pair: "ETH/USDT", age: 50000 }, // fresh
      { pair: "XRP/USDT", age: 75000 }, // stale
      { pair: "ADA/USDT", age: 30000 }, // fresh
    ];

    for (const { pair, age } of pairs) {
      const data: PriceData = {
        ...basePriceData,
        pair,
        timestamp: now - age,
      };
      cache.set(pair, data);
    }

    cache.clearStale();

    expect(cache.get("BTC/USDT")).toBeUndefined();
    expect(cache.get("ETH/USDT")).toBeDefined();
    expect(cache.get("XRP/USDT")).toBeUndefined();
    expect(cache.get("ADA/USDT")).toBeDefined();
  });
});
