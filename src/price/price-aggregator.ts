import type { ExchangeName, PriceData } from "@/types/index";
import { eventBus } from "@events/event-bus";
import { priceCache } from "@price/price-cache";
import type * as ccxt from "ccxt";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal interface we need from ExchangeManager to avoid a hard import cycle.
 * Uses ccxt.Exchange (the base class exposed in TS declarations) — CCXT Pro
 * instances satisfy this type at runtime.
 */
interface ExchangeManagerLike {
  getEnabledExchanges(): Map<ExchangeName, ccxt.Exchange>;
}

// ─── PriceAggregator ──────────────────────────────────────────────────────────

/**
 * Subscribes to real-time ticker streams for every enabled exchange × pair
 * combination via CCXT Pro's watchTicker.
 *
 * Architecture:
 *   - One async watch-loop per (exchangeName, pair) tuple.
 *   - Each loop writes to PriceCache and emits price:update on the event bus.
 *   - Errors inside a loop are logged and the loop continues (CCXT Pro
 *     handles WebSocket reconnection internally).
 *   - Calling stop() flips the running flag; loops exit on the next iteration.
 */
class PriceAggregator {
  private running = false;
  private watchLoops: Map<string, Promise<void>> = new Map();
  private exchangeManager: ExchangeManagerLike | null = null;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start watching tickers for the given pairs on all enabled exchanges.
   * Calling start() while already running is a no-op for existing loops;
   * new pairs/exchanges will be added.
   *
   * @param pairs  Trading pair symbols, e.g. ['BTC/USDT', 'ETH/USDT']
   * @param manager  ExchangeManager providing enabled exchange instances
   */
  async start(pairs: string[], manager: ExchangeManagerLike): Promise<void> {
    if (pairs.length === 0) {
      console.warn("[PriceAggregator] start() called with empty pairs list — nothing to watch");
      return;
    }

    this.exchangeManager = manager;
    this.running = true;

    const exchanges = manager.getEnabledExchanges();
    if (exchanges.size === 0) {
      console.warn("[PriceAggregator] No enabled exchanges found — price feeds will not start");
      return;
    }

    for (const [exchangeName, exchange] of exchanges) {
      for (const pair of pairs) {
        const loopKey = `${exchangeName}:${pair}`;

        // Skip if a loop for this key already exists
        if (this.watchLoops.has(loopKey)) continue;

        const loopPromise = this.pollTicker(exchange, exchangeName, pair);
        this.watchLoops.set(loopKey, loopPromise);
      }
    }

    console.log(
      `[PriceAggregator] Started ${this.watchLoops.size} watch loop(s) across ` +
        `${exchanges.size} exchange(s) for pairs: ${pairs.join(", ")}`
    );
  }

  /**
   * Stop all active watchers.
   * Sets running = false so every loop exits on its next iteration,
   * then closes WebSocket connections on all enabled exchanges.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    console.log("[PriceAggregator] Stopping — waiting for watch loops to exit…");

    // Wait for every loop to settle (they exit when running becomes false)
    await Promise.allSettled([...this.watchLoops.values()]);
    this.watchLoops.clear();

    // Close exchange WebSocket connections gracefully
    if (this.exchangeManager !== null) {
      const exchanges = this.exchangeManager.getEnabledExchanges();
      const closePromises: Promise<void>[] = [];
      for (const [exchangeName, exchange] of exchanges) {
        if (typeof exchange.close === "function") {
          closePromises.push(
            (exchange.close() as unknown as Promise<void>).catch((err: unknown) => {
              console.error(`[PriceAggregator] Error closing ${exchangeName}:`, err);
            })
          );
        }
      }
      await Promise.allSettled(closePromises);
    }

    console.log("[PriceAggregator] All watch loops stopped");
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * REST polling fallback — fetches ticker every 10s via fetchTicker.
   * Used because Bun runtime doesn't support CCXT Pro WebSocket upgrade.
   */
  private async pollTicker(
    exchange: ccxt.Exchange,
    exchangeName: ExchangeName,
    pair: string
  ): Promise<void> {
    console.log(`[PriceAggregator] Polling ${pair} on ${exchangeName} (REST, 10s interval)`);

    while (this.running) {
      try {
        const ticker = await exchange.fetchTicker(pair);

        const priceData: PriceData = {
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
          await this.sleep(10_000);
          continue;
        }

        priceCache.set(pair, priceData);
        eventBus.emit("price:update", priceData);
      } catch (err: unknown) {
        if (!this.running) break;
        console.error(
          `[PriceAggregator] Error polling ${pair} on ${exchangeName}:`,
          err instanceof Error ? err.message : err
        );
      }
      await this.sleep(10_000);
    }

    console.log(`[PriceAggregator] Poll loop exited: ${pair} on ${exchangeName}`);
  }

  // watchTicker removed — Bun doesn't support CCXT Pro WebSocket upgrade.
  // Using pollTicker (REST) instead. See pollTicker() above.

  /** Resolves after the given number of milliseconds. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const priceAggregator = new PriceAggregator();

export { PriceAggregator };
export type { ExchangeManagerLike };
