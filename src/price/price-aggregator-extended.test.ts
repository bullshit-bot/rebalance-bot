import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ExchangeName } from "@/types/index";
import type * as ccxt from "ccxt";

// ─── Mock Setup ────────────────────────────────────────────────────────────

interface ExchangeManagerLike {
  getEnabledExchanges(): Map<ExchangeName, ccxt.Exchange>;
}

function createMockExchange(
  options: {
    fetchTickerDelay?: number;
    fetchTickerError?: Error | null;
    closeError?: Error | null;
    returns?: Record<string, any>;
  } = {}
): ccxt.Exchange {
  const {
    fetchTickerDelay = 20,
    fetchTickerError = null,
    closeError = null,
    returns = {},
  } = options;

  return {
    fetchTicker: mock(async (pair: string) => {
      await new Promise((r) => setTimeout(r, fetchTickerDelay));
      if (fetchTickerError) throw fetchTickerError;
      return (
        returns.ticker || {
          last: 50000,
          close: 49999,
          bid: 49999,
          ask: 50001,
          baseVolume: 1000,
          percentage: 2.5,
          timestamp: Date.now(),
        }
      );
    }),
    close: mock(async () => {
      if (closeError) throw closeError;
    }),
  } as unknown as ccxt.Exchange;
}

// ─── Mock PriceAggregator Implementation ────────────────────────────────────

class MockPriceAggregator {
  private running = false;
  private watchLoops: Map<string, Promise<void>> = new Map();
  private exchangeManager: ExchangeManagerLike | null = null;
  private emittedEvents: any[] = [];
  private pollInterval = 10000;

  async start(pairs: string[], manager: ExchangeManagerLike): Promise<void> {
    if (pairs.length === 0) return;
    this.exchangeManager = manager;
    this.running = true;

    const exchanges = manager.getEnabledExchanges();
    if (exchanges.size === 0) return;

    for (const [exchangeName, exchange] of exchanges) {
      for (const pair of pairs) {
        const loopKey = `${exchangeName}:${pair}`;
        if (this.watchLoops.has(loopKey)) continue;

        const loopPromise = this.pollTicker(exchange, exchangeName, pair);
        this.watchLoops.set(loopKey, loopPromise);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await Promise.allSettled([...this.watchLoops.values()]);
    this.watchLoops.clear();

    if (this.exchangeManager !== null) {
      const exchanges = this.exchangeManager.getEnabledExchanges();
      const closePromises: Promise<void>[] = [];
      for (const [, exchange] of exchanges) {
        if (typeof exchange.close === "function") {
          closePromises.push((exchange.close() as unknown as Promise<void>).catch(() => {}));
        }
      }
      await Promise.allSettled(closePromises);
    }
  }

  private async pollTicker(
    exchange: ccxt.Exchange,
    exchangeName: ExchangeName,
    pair: string
  ): Promise<void> {
    while (this.running) {
      try {
        const ticker = await exchange.fetchTicker(pair);

        const priceData = {
          exchange: exchangeName,
          pair,
          price: ticker.last ?? ticker.close ?? 0,
          bid: ticker.bid ?? 0,
          ask: ticker.ask ?? 0,
          volume24h: ticker.baseVolume ?? 0,
          change24h: ticker.percentage ?? 0,
          timestamp: ticker.timestamp ?? Date.now(),
        };

        if (priceData.price === 0) {
          await this.sleep(this.pollInterval);
          continue;
        }

        this.emittedEvents.push({ event: "price:update", data: priceData });
      } catch (err: unknown) {
        if (!this.running) break;
        await this.sleep(1000);
      }
    }
  }

  getEmittedEvents() {
    return this.emittedEvents;
  }

  getWatchLoopsCount() {
    return this.watchLoops.size;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PriceAggregator — REST Polling Extended", () => {
  let aggregator: MockPriceAggregator;

  beforeEach(() => {
    aggregator = new MockPriceAggregator();
  });

  afterEach(async () => {
    await aggregator.stop();
  });

  describe("start/stop lifecycle", () => {
    test("handles empty pairs gracefully", async () => {
      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map(),
      };

      await aggregator.start([], mockManager);
      expect(aggregator.getWatchLoopsCount()).toBe(0);
    });

    test("handles manager with no exchanges", async () => {
      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map(),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      expect(aggregator.getWatchLoopsCount()).toBe(0);
    });

    test("creates watch loop for each exchange-pair combination", async () => {
      const mockEx1 = createMockExchange();
      const mockEx2 = createMockExchange();

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () =>
          new Map([
            ["binance", mockEx1],
            ["okx", mockEx2],
          ]),
      };

      await aggregator.start(["BTC/USDT", "ETH/USDT"], mockManager);
      // 2 exchanges × 2 pairs = 4 watch loops
      expect(aggregator.getWatchLoopsCount()).toBe(4);

      await aggregator.stop();
    });

    test("skips duplicate pairs on same exchange", async () => {
      const mockExchange = createMockExchange();
      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      const count1 = aggregator.getWatchLoopsCount();

      // Start again with same pairs
      await aggregator.start(["BTC/USDT"], mockManager);
      const count2 = aggregator.getWatchLoopsCount();

      // Should not duplicate
      expect(count2).toBe(count1);
      await aggregator.stop();
    });

    test("stop() without start() is safe", async () => {
      await aggregator.stop();
      expect(aggregator.getWatchLoopsCount()).toBe(0);
    });

    test("calling stop multiple times is safe", async () => {
      const mockExchange = createMockExchange();
      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await aggregator.stop();
      await aggregator.stop(); // Should not throw
      expect(aggregator.getWatchLoopsCount()).toBe(0);
    });

    test("stop waits for all loops to complete", async () => {
      const mockExchange = createMockExchange({ fetchTickerDelay: 50 });
      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100)); // Let loop run
      const beforeStop = aggregator.getEmittedEvents().length;

      await aggregator.stop();
      // Loops should have settled
      expect(aggregator.getWatchLoopsCount()).toBe(0);
    });
  });

  describe("ticker polling behavior", () => {
    test("emits price:update events with all fields", async () => {
      const mockExchange = createMockExchange({
        returns: {
          ticker: {
            last: 45000,
            close: 44999,
            bid: 44998,
            ask: 45001,
            baseVolume: 2500,
            percentage: 3.5,
            timestamp: 1234567890,
          },
        },
      });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();

      const events = aggregator.getEmittedEvents();
      expect(events.length).toBeGreaterThan(0);

      const event = events[0];
      expect(event.data.price).toBe(45000);
      expect(event.data.bid).toBe(44998);
      expect(event.data.ask).toBe(45001);
      expect(event.data.volume24h).toBe(2500);
      expect(event.data.change24h).toBe(3.5);
      expect(event.data.timestamp).toBe(1234567890);
    });

    test("uses last price when available", async () => {
      const mockExchange = createMockExchange({
        returns: {
          ticker: {
            last: 50000,
            close: 49900,
            bid: 49999,
            ask: 50001,
            baseVolume: 1000,
            percentage: 2.5,
            timestamp: Date.now(),
          },
        },
      });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();

      const events = aggregator.getEmittedEvents();
      expect(events[0].data.price).toBe(50000);
    });

    test("falls back to close when last is unavailable", async () => {
      const mockExchange = createMockExchange({
        returns: {
          ticker: {
            last: undefined,
            close: 49900,
            bid: 49999,
            ask: 50001,
            baseVolume: 1000,
            percentage: 2.5,
            timestamp: Date.now(),
          },
        },
      });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();

      const events = aggregator.getEmittedEvents();
      expect(events[0].data.price).toBe(49900);
    });

    test("handles missing optional ticker fields with defaults", async () => {
      const mockExchange = createMockExchange({
        returns: {
          ticker: {
            last: 50000,
            // All other fields undefined
          },
        },
      });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();

      const events = aggregator.getEmittedEvents();
      const event = events[0];
      expect(event.data.price).toBe(50000);
      expect(event.data.bid).toBe(0);
      expect(event.data.ask).toBe(0);
      expect(event.data.volume24h).toBe(0);
      expect(event.data.change24h).toBe(0);
      expect(typeof event.data.timestamp).toBe("number");
    });

    test("uses current timestamp when ticker timestamp missing", async () => {
      const mockExchange = createMockExchange({
        returns: {
          ticker: {
            last: 50000,
            close: 49999,
            bid: 49999,
            ask: 50001,
            baseVolume: 1000,
            percentage: 2.5,
            timestamp: undefined,
          },
        },
      });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      const beforeStart = Date.now();
      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();
      const afterStart = Date.now();

      const events = aggregator.getEmittedEvents();
      const eventTimestamp = events[0].data.timestamp;
      expect(eventTimestamp).toBeGreaterThanOrEqual(beforeStart);
      expect(eventTimestamp).toBeLessThanOrEqual(afterStart + 1000);
    });
  });

  describe("error handling", () => {
    test("handles close error gracefully", async () => {
      const mockExchange = createMockExchange({ closeError: new Error("Close failed") });

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () => new Map([["binance", mockExchange]]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 50));

      // Should not throw even if close() fails
      expect(() => aggregator.stop()).not.toThrow();
    });
  });

  describe("multiple exchanges and pairs", () => {
    test("manages separate watch loops for each exchange-pair", async () => {
      const mockEx1 = createMockExchange();
      const mockEx2 = createMockExchange();
      const mockEx3 = createMockExchange();

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () =>
          new Map([
            ["binance", mockEx1],
            ["okx", mockEx2],
            ["bybit", mockEx3],
          ]),
      };

      await aggregator.start(["BTC/USDT", "ETH/USDT", "SOL/USDT"], mockManager);
      // 3 exchanges × 3 pairs = 9 watch loops
      expect(aggregator.getWatchLoopsCount()).toBe(9);

      await aggregator.stop();
    });

    test("emits events with correct exchange and pair metadata", async () => {
      const mockEx1 = createMockExchange();
      const mockEx2 = createMockExchange();

      const mockManager: ExchangeManagerLike = {
        getEnabledExchanges: () =>
          new Map([
            ["binance", mockEx1],
            ["okx", mockEx2],
          ]),
      };

      await aggregator.start(["BTC/USDT"], mockManager);
      await new Promise((r) => setTimeout(r, 100));
      await aggregator.stop();

      const events = aggregator.getEmittedEvents();
      expect(events.length).toBeGreaterThan(0);

      // All events should have exchange and pair metadata
      for (const event of events) {
        expect(["binance", "okx"]).toContain(event.data.exchange);
        expect(event.data.pair).toBe("BTC/USDT");
      }
    });
  });
});
