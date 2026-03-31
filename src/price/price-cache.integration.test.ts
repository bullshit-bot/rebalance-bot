import { beforeEach, describe, expect, test } from "bun:test";
import type { PriceData } from "@/types/index";
import { PriceCache } from "./price-cache";

describe("PriceCache integration", () => {
  let cache: PriceCache;

  beforeEach(() => {
    cache = new PriceCache();
  });

  describe("set and get", () => {
    test("set stores a price entry", () => {
      const data: PriceData = {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: Date.now(),
      };

      cache.set("BTC/USDT", data);
      const retrieved = cache.get("BTC/USDT");

      expect(retrieved).toBeDefined();
      expect(retrieved?.price).toBe(50000);
    });

    test("get returns undefined for missing pair", () => {
      const result = cache.get("MISSING/USDT");
      expect(result).toBeUndefined();
    });

    test("set overwrites existing entry with newer timestamp", () => {
      const oldData: PriceData = {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: 1000,
      };

      const newData: PriceData = {
        pair: "BTC/USDT",
        price: 51000,
        timestamp: 2000,
      };

      cache.set("BTC/USDT", oldData);
      cache.set("BTC/USDT", newData);

      const retrieved = cache.get("BTC/USDT");
      expect(retrieved?.price).toBe(51000);
    });

    test("set does not overwrite with older timestamp", () => {
      const newData: PriceData = {
        pair: "BTC/USDT",
        price: 51000,
        timestamp: 2000,
      };

      const oldData: PriceData = {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: 1000,
      };

      cache.set("BTC/USDT", newData);
      cache.set("BTC/USDT", oldData);

      const retrieved = cache.get("BTC/USDT");
      expect(retrieved?.price).toBe(51000); // Should keep newer price
    });

    test("set with equal timestamp overwrites", () => {
      const timestamp = Date.now();

      const data1: PriceData = {
        pair: "BTC/USDT",
        price: 50000,
        timestamp,
      };

      const data2: PriceData = {
        pair: "BTC/USDT",
        price: 51000,
        timestamp,
      };

      cache.set("BTC/USDT", data1);
      cache.set("BTC/USDT", data2);

      const retrieved = cache.get("BTC/USDT");
      expect(retrieved?.price).toBe(51000);
    });
  });

  describe("getBestPrice", () => {
    test("getBestPrice returns price value only", () => {
      const data: PriceData = {
        pair: "ETH/USDT",
        price: 3000,
        timestamp: Date.now(),
      };

      cache.set("ETH/USDT", data);
      const price = cache.getBestPrice("ETH/USDT");

      expect(price).toBe(3000);
    });

    test("getBestPrice returns undefined for missing pair", () => {
      const price = cache.getBestPrice("MISSING/USDT");
      expect(price).toBeUndefined();
    });

    test("getBestPrice uses most recent exchange update", () => {
      const oldData: PriceData = {
        pair: "SOL/USDT",
        price: 170,
        timestamp: 1000,
      };

      const newData: PriceData = {
        pair: "SOL/USDT",
        price: 180,
        timestamp: 2000,
      };

      cache.set("SOL/USDT", oldData);
      cache.set("SOL/USDT", newData);

      const price = cache.getBestPrice("SOL/USDT");
      expect(price).toBe(180);
    });
  });

  describe("getAll", () => {
    test("getAll returns empty object for empty cache", () => {
      const all = cache.getAll();
      expect(all).toEqual({});
    });

    test("getAll returns all cached entries", () => {
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: Date.now(),
      });
      cache.set("ETH/USDT", {
        pair: "ETH/USDT",
        price: 3000,
        timestamp: Date.now(),
      });
      cache.set("SOL/USDT", {
        pair: "SOL/USDT",
        price: 180,
        timestamp: Date.now(),
      });

      const all = cache.getAll();

      expect(Object.keys(all).length).toBe(3);
      expect(all["BTC/USDT"]).toBeDefined();
      expect(all["ETH/USDT"]).toBeDefined();
      expect(all["SOL/USDT"]).toBeDefined();
    });

    test("getAll returns snapshot (independent copies)", () => {
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: Date.now(),
      });

      const all1 = cache.getAll();
      const all2 = cache.getAll();

      // Two calls should return different objects (snapshots)
      expect(all1).not.toBe(all2);
      expect(all1["BTC/USDT"].price).toBe(all2["BTC/USDT"].price);
    });

    test("getAll includes all price data fields", () => {
      const timestamp = Date.now();
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp,
      });

      const all = cache.getAll();
      const btcData = all["BTC/USDT"];

      expect(btcData.pair).toBe("BTC/USDT");
      expect(btcData.price).toBe(50000);
      expect(btcData.timestamp).toBe(timestamp);
    });
  });

  describe("clearStale", () => {
    test("clearStale removes old entries", () => {
      const now = Date.now();
      const old = now - 70000; // Older than 60s threshold

      cache.set("OLD/USDT", {
        pair: "OLD/USDT",
        price: 100,
        timestamp: old,
      });
      cache.set("NEW/USDT", {
        pair: "NEW/USDT",
        price: 200,
        timestamp: now,
      });

      cache.clearStale();

      expect(cache.get("OLD/USDT")).toBeUndefined();
      expect(cache.get("NEW/USDT")).toBeDefined();
    });

    test("clearStale keeps entries within threshold", () => {
      const now = Date.now();
      const recent = now - 50000; // Within 60s threshold

      cache.set("RECENT/USDT", {
        pair: "RECENT/USDT",
        price: 100,
        timestamp: recent,
      });

      cache.clearStale();

      expect(cache.get("RECENT/USDT")).toBeDefined();
    });

    test("clearStale at exact boundary keeps entry", () => {
      const now = Date.now();
      const atBoundary = now - 60000; // Exactly at 60s threshold

      cache.set("BOUNDARY/USDT", {
        pair: "BOUNDARY/USDT",
        price: 100,
        timestamp: atBoundary,
      });

      cache.clearStale();

      // Entry at boundary should be kept (cutoff is exclusive)
      expect(cache.get("BOUNDARY/USDT")).toBeDefined();
    });

    test("clearStale preserves multiple entries", () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        cache.set(`PAIR${i}/USDT`, {
          pair: `PAIR${i}/USDT`,
          price: 100 + i,
          timestamp: now - 50000 + i * 1000,
        });
      }

      cache.clearStale();

      // All should be kept (all within threshold)
      for (let i = 0; i < 5; i++) {
        expect(cache.get(`PAIR${i}/USDT`)).toBeDefined();
      }
    });

    test("clearStale removes only old entries from mixed cache", () => {
      const now = Date.now();

      cache.set("OLD1/USDT", {
        pair: "OLD1/USDT",
        price: 100,
        timestamp: now - 100000,
      });
      cache.set("NEW1/USDT", {
        pair: "NEW1/USDT",
        price: 200,
        timestamp: now - 30000,
      });
      cache.set("OLD2/USDT", {
        pair: "OLD2/USDT",
        price: 300,
        timestamp: now - 80000,
      });
      cache.set("NEW2/USDT", {
        pair: "NEW2/USDT",
        price: 400,
        timestamp: now,
      });

      cache.clearStale();

      expect(cache.get("OLD1/USDT")).toBeUndefined();
      expect(cache.get("OLD2/USDT")).toBeUndefined();
      expect(cache.get("NEW1/USDT")).toBeDefined();
      expect(cache.get("NEW2/USDT")).toBeDefined();
    });
  });

  describe("multi-exchange scenarios", () => {
    test("best price wins from multiple exchanges", () => {
      // Binance update at time 1000
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: 1000,
      });

      // OKX update at time 2000 (later)
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50100,
        timestamp: 2000,
      });

      // OKX price should win (more recent)
      expect(cache.getBestPrice("BTC/USDT")).toBe(50100);
    });

    test("earlier exchange update ignored if later update exists", () => {
      // OKX first
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50100,
        timestamp: 2000,
      });

      // Binance tries to update with older price
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: 1000,
      });

      // OKX price should still win
      expect(cache.getBestPrice("BTC/USDT")).toBe(50100);
    });
  });

  describe("edge cases", () => {
    test("handles zero price", () => {
      cache.set("ZERO/USDT", {
        pair: "ZERO/USDT",
        price: 0,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("ZERO/USDT")).toBe(0);
    });

    test("handles very large price", () => {
      cache.set("LARGE/USDT", {
        pair: "LARGE/USDT",
        price: 999999999,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("LARGE/USDT")).toBe(999999999);
    });

    test("handles very small price", () => {
      cache.set("SMALL/USDT", {
        pair: "SMALL/USDT",
        price: 0.00001,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("SMALL/USDT")).toBe(0.00001);
    });

    test("handles negative price (edge case)", () => {
      cache.set("NEG/USDT", {
        pair: "NEG/USDT",
        price: -100,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("NEG/USDT")).toBe(-100);
    });

    test("case-sensitive pair matching", () => {
      cache.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("BTC/USDT")).toBe(50000);
      expect(cache.getBestPrice("btc/usdt")).toBeUndefined();
    });

    test("handles special characters in pair names", () => {
      cache.set("BTC/USDT:PERP", {
        pair: "BTC/USDT:PERP",
        price: 50000,
        timestamp: Date.now(),
      });

      expect(cache.getBestPrice("BTC/USDT:PERP")).toBe(50000);
    });
  });

  describe("concurrent operations", () => {
    test("multiple sets and gets work correctly", () => {
      const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT"];
      const prices = [50000, 3000, 180, 2.5];

      for (let i = 0; i < pairs.length; i++) {
        cache.set(pairs[i], {
          pair: pairs[i],
          price: prices[i],
          timestamp: Date.now(),
        });
      }

      for (let i = 0; i < pairs.length; i++) {
        expect(cache.getBestPrice(pairs[i])).toBe(prices[i]);
      }
    });

    test("getAll reflects all sets", () => {
      const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];

      for (const pair of pairs) {
        cache.set(pair, {
          pair,
          price: 100,
          timestamp: Date.now(),
        });
      }

      const all = cache.getAll();
      expect(Object.keys(all).length).toBe(3);
    });
  });

  describe("state isolation", () => {
    test("each cache instance maintains separate state", () => {
      const cache1 = new PriceCache();
      const cache2 = new PriceCache();

      cache1.set("BTC/USDT", {
        pair: "BTC/USDT",
        price: 50000,
        timestamp: Date.now(),
      });

      expect(cache1.getBestPrice("BTC/USDT")).toBe(50000);
      expect(cache2.getBestPrice("BTC/USDT")).toBeUndefined();
    });
  });
});
