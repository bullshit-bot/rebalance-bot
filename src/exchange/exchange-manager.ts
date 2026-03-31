import type { ExchangeName } from "@/types/index";
import { env } from "@config/app-config";
import { eventBus } from "@events/event-bus";
import { createExchange } from "@exchange/exchange-factory";
import type * as ccxt from "ccxt";

// ─── Dependency injection types ───────────────────────────────────────────────

/** Factory function type — allows tests to inject a mock exchange factory. */
export type ExchangeFactoryFn = (
  name: ExchangeName,
  config: { apiKey: string; secret: string; password?: string }
) => ccxt.Exchange;

/** Credentials map type returned by the credentials provider. */
export type ExchangeCredentialsMap = Map<
  ExchangeName,
  { apiKey: string; secret: string; password?: string }
>;

export interface ExchangeManagerDeps {
  /** Injectable event bus — defaults to app-wide eventBus singleton. */
  eventBus: { emit(event: string, data?: unknown): void };
  /** Injectable exchange factory — defaults to createExchange(). */
  exchangeFactory: ExchangeFactoryFn;
  /**
   * Injectable credentials provider — reads API keys from env by default.
   * Tests can override to supply known credentials without touching process.env.
   */
  credentialsProvider: () => ExchangeCredentialsMap;
}

// ─── ExchangeManager ──────────────────────────────────────────────────────────

/**
 * Manages all configured exchange connections for the lifetime of the bot.
 *
 * Responsibilities:
 *  - Reads API credentials from environment variables at startup
 *  - Creates CCXT Pro instances via createExchange()
 *  - Emits exchange:connected / exchange:disconnected events
 *  - Provides a unified access point for all downstream services
 *
 * Accepts optional deps for dependency injection in tests.
 */
class ExchangeManager {
  private readonly exchanges: Map<ExchangeName, ccxt.Exchange> = new Map();
  private readonly deps: ExchangeManagerDeps;

  constructor(deps?: Partial<ExchangeManagerDeps>) {
    this.deps = {
      eventBus: deps?.eventBus ?? eventBus,
      exchangeFactory: deps?.exchangeFactory ?? createExchange,
      credentialsProvider: deps?.credentialsProvider ?? (() => this.buildExchangeConfigs()),
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialises CCXT Pro instances for every exchange that has API credentials
   * configured in environment variables. Exchanges without credentials are
   * silently skipped — the bot runs with however many are available.
   */
  async initialize(): Promise<void> {
    const configs = this.deps.credentialsProvider();

    for (const [name, config] of configs) {
      try {
        const exchange = this.deps.exchangeFactory(name, config);

        // Verify connectivity with a lightweight ping before marking as ready
        // 30s timeout prevents hanging forever if exchange is unreachable
        const LOAD_MARKETS_TIMEOUT = 30_000;
        await Promise.race([
          exchange.loadMarkets(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`loadMarkets timeout after ${LOAD_MARKETS_TIMEOUT}ms`)),
              LOAD_MARKETS_TIMEOUT
            )
          ),
        ]);

        this.exchanges.set(name, exchange);
        this.deps.eventBus.emit("exchange:connected", name);

        console.log(`[ExchangeManager] ${name} connected`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ExchangeManager] Failed to connect to ${name}: ${message}`);

        this.deps.eventBus.emit("exchange:error", { exchange: name, error: message });
        this.deps.eventBus.emit("exchange:disconnected", name);
      }
    }

    if (this.exchanges.size === 0) {
      console.warn("[ExchangeManager] No exchanges initialised — check your API key configuration");
    }
  }

  /**
   * Gracefully closes all open exchange connections (WebSocket streams, etc.).
   */
  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, exchange] of this.exchanges) {
      closePromises.push(
        exchange
          .close()
          .then(() => {
            this.deps.eventBus.emit("exchange:disconnected", name);
            console.log(`[ExchangeManager] ${name} disconnected`);
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[ExchangeManager] Error closing ${name}: ${message}`);
          })
      );
    }

    await Promise.allSettled(closePromises);
    this.exchanges.clear();
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  /** Returns the CCXT Pro instance for a specific exchange, or undefined if not connected. */
  getExchange(name: ExchangeName): ccxt.Exchange | undefined {
    return this.exchanges.get(name);
  }

  /** Returns all currently connected exchanges. */
  getEnabledExchanges(): Map<ExchangeName, ccxt.Exchange> {
    return new Map(this.exchanges);
  }

  /** Returns a connection status snapshot for all known exchanges. */
  getStatus(): Record<ExchangeName, "connected" | "disconnected"> {
    const allExchanges: ExchangeName[] = ["binance", "okx", "bybit"];

    return Object.fromEntries(
      allExchanges.map((name) => [name, this.exchanges.has(name) ? "connected" : "disconnected"])
    ) as Record<ExchangeName, "connected" | "disconnected">;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Builds the list of exchange credentials from environment variables.
   * Only includes exchanges that have both apiKey and secret defined.
   * password is only set when present to satisfy exactOptionalPropertyTypes.
   */
  private buildExchangeConfigs(): Map<
    ExchangeName,
    { apiKey: string; secret: string; password?: string; sandbox?: boolean }
  > {
    const configs = new Map<
      ExchangeName,
      { apiKey: string; secret: string; password?: string; sandbox?: boolean }
    >();

    if (env.BINANCE_API_KEY && env.BINANCE_API_SECRET) {
      configs.set("binance", {
        apiKey: env.BINANCE_API_KEY,
        secret: env.BINANCE_API_SECRET,
        sandbox: env.BINANCE_SANDBOX === "true",
      });
    }

    if (env.OKX_API_KEY && env.OKX_API_SECRET) {
      const okxConfig: { apiKey: string; secret: string; password?: string } = {
        apiKey: env.OKX_API_KEY,
        secret: env.OKX_API_SECRET,
      };
      // Only set password when it actually exists — exactOptionalPropertyTypes
      if (env.OKX_PASSPHRASE) {
        okxConfig.password = env.OKX_PASSPHRASE;
      }
      configs.set("okx", okxConfig);
    }

    if (env.BYBIT_API_KEY && env.BYBIT_API_SECRET) {
      configs.set("bybit", {
        apiKey: env.BYBIT_API_KEY,
        secret: env.BYBIT_API_SECRET,
      });
    }

    return configs;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide exchange manager singleton.
 * Call `await exchangeManager.initialize()` once at bot startup.
 *
 * @example
 * import { exchangeManager } from '@exchange/exchange-manager'
 * await exchangeManager.initialize()
 * const binance = exchangeManager.getExchange('binance')
 */
export { ExchangeManager };
export const exchangeManager = new ExchangeManager();
