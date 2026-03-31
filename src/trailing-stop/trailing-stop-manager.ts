import { eventBus } from "@/events/event-bus";
import type { ExchangeName, PriceData, TrailingStopConfig, TrailingStopState } from "@/types/index";

// ─── TrailingStopManager ──────────────────────────────────────────────────────

/**
 * Manages trailing stop orders for assets across exchanges.
 *
 * Listens to `price:update` events and emits `trailing-stop:triggered`
 * when price drops below the computed stop price.
 *
 * Key format: `${asset}:${exchange}`
 *
 * Stop price formula: highestPrice * (1 - trailPct / 100)
 */
class TrailingStopManager {
  private stops: Map<string, TrailingStopState> = new Map();
  private listening = false;

  // Bound handler stored so we can remove it in stop()
  private readonly boundOnPriceUpdate = (priceData: PriceData): void =>
    this.onPriceUpdate(priceData);

  // ─── Key helpers ────────────────────────────────────────────────────────────

  private makeKey(asset: string, exchange: ExchangeName): string {
    return `${asset}:${exchange}`;
  }

  /**
   * Extracts the base asset from a trading pair symbol.
   * e.g. "BTC/USDT" → "BTC", "ETH/BTC" → "ETH"
   */
  private assetFromPair(pair: string): string {
    return pair.split("/")[0] ?? pair;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Add or replace a trailing stop for the given config.
   * Uses config.trailPct to compute the initial stop price
   * from the current highest price (starts at 0 until first price tick).
   */
  addStop(config: TrailingStopConfig): void {
    const key = this.makeKey(config.asset, config.exchange);

    // Preserve highestPrice if stop already tracked, otherwise start at 0
    // (will be set on first matching price:update)
    const existing = this.stops.get(key);
    const highestPrice = existing?.highestPrice ?? 0;
    const stopPrice = highestPrice > 0 ? highestPrice * (1 - config.trailPct / 100) : 0;

    const state: TrailingStopState = {
      config,
      highestPrice,
      stopPrice,
      activated: false,
    };

    this.stops.set(key, state);
  }

  /** Remove the trailing stop for the given asset/exchange pair. */
  removeStop(asset: string, exchange: ExchangeName): void {
    this.stops.delete(this.makeKey(asset, exchange));
  }

  /** Returns a snapshot array of all currently tracked stops. */
  getStops(): TrailingStopState[] {
    return Array.from(this.stops.values());
  }

  /** Returns the stop state for a specific asset, or undefined if not tracked. */
  getStop(asset: string, exchange: ExchangeName): TrailingStopState | undefined {
    return this.stops.get(this.makeKey(asset, exchange));
  }

  /** Subscribe to `price:update` events. Safe to call multiple times. */
  start(): void {
    if (this.listening) return;
    eventBus.on("price:update", this.boundOnPriceUpdate);
    this.listening = true;
  }

  /** Unsubscribe from `price:update` events. */
  stop(): void {
    if (!this.listening) return;
    eventBus.off("price:update", this.boundOnPriceUpdate);
    this.listening = false;
  }

  // ─── Internal price handler ─────────────────────────────────────────────────

  private onPriceUpdate(priceData: PriceData): void {
    const asset = this.assetFromPair(priceData.pair);
    const key = this.makeKey(asset, priceData.exchange);
    const state = this.stops.get(key);

    // No stop configured for this asset/exchange — ignore
    if (!state) return;

    // Stop has already been triggered — do not re-evaluate
    if (state.activated) return;

    // Stop is disabled by config — do not process
    if (!state.config.enabled) return;

    const { price } = priceData;

    // Update highest watermark and recalculate stop price on new highs
    if (price > state.highestPrice) {
      state.highestPrice = price;
      state.stopPrice = price * (1 - state.config.trailPct / 100);
    }

    // Check if price has breached the stop level
    if (price <= state.stopPrice && state.stopPrice > 0) {
      // Disable to prevent repeated triggers
      state.activated = true;
      state.config.enabled = false;

      console.warn(
        `[TrailingStop] TRIGGERED — asset=${asset} exchange=${priceData.exchange} ` +
          `price=${price} stopPrice=${state.stopPrice.toFixed(8)} ` +
          `highestPrice=${state.highestPrice.toFixed(8)} trailPct=${state.config.trailPct}%`
      );

      eventBus.emit("trailing-stop:triggered", {
        asset,
        exchange: priceData.exchange,
        price,
        stopPrice: state.stopPrice,
      });
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide trailing stop manager singleton.
 *
 * @example
 * import { trailingStopManager } from '@/trailing-stop/trailing-stop-manager'
 *
 * trailingStopManager.addStop({ asset: 'BTC', exchange: 'binance', trailPct: 5, enabled: true })
 * trailingStopManager.start()
 */
export const trailingStopManager = new TrailingStopManager();

export { TrailingStopManager };
