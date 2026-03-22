import { sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Target portfolio allocations.
 * Each row defines what percentage of total portfolio value an asset should hold.
 * exchange = null means the allocation applies across any exchange.
 */
export const allocations = sqliteTable(
  "allocations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    asset: text("asset").notNull(),
    targetPct: real("target_pct").notNull(),
    exchange: text("exchange"),
    minTradeUsd: real("min_trade_usd").default(10),
    updatedAt: integer("updated_at").default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("allocations_asset_exchange_idx").on(t.asset, t.exchange)]
);

/**
 * Point-in-time portfolio snapshots.
 * Captured before/after rebalances and on scheduled intervals.
 * holdings and allocations are JSON-serialized objects.
 */
export const snapshots = sqliteTable(
  "snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    totalValueUsd: real("total_value_usd").notNull(),
    holdings: text("holdings").notNull(),
    allocations: text("allocations").notNull(),
    createdAt: integer("created_at").default(sql`(unixepoch())`),
  },
  (t) => [index("snapshots_created_at_idx").on(t.createdAt)]
);

/**
 * Individual trade records — both paper and live.
 * rebalanceId links back to a rebalances row.
 * isPaper = 1 means the order was simulated and not sent to the exchange.
 */
export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    exchange: text("exchange").notNull(),
    pair: text("pair").notNull(),
    side: text("side", { enum: ["buy", "sell"] }).notNull(),
    amount: real("amount").notNull(),
    price: real("price").notNull(),
    costUsd: real("cost_usd").notNull(),
    fee: real("fee"),
    feeCurrency: text("fee_currency"),
    orderId: text("order_id"),
    rebalanceId: text("rebalance_id"),
    isPaper: integer("is_paper").default(0),
    executedAt: integer("executed_at").default(sql`(unixepoch())`),
  },
  (t) => [index("trades_rebalance_id_idx").on(t.rebalanceId)]
);

/**
 * Rebalance run records.
 * Each rebalance cycle creates one row tracking the full lifecycle
 * from pending → executing → completed | failed.
 * beforeState and afterState hold JSON-serialized portfolio snapshots.
 */
export const rebalances = sqliteTable("rebalances", {
  id: text("id").primaryKey(),
  triggerType: text("trigger_type", { enum: ["threshold", "periodic", "manual"] }).notNull(),
  status: text("status", { enum: ["pending", "executing", "completed", "failed"] }).notNull(),
  beforeState: text("before_state").notNull(),
  afterState: text("after_state"),
  totalTrades: integer("total_trades").default(0),
  totalFeesUsd: real("total_fees_usd").default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at").default(sql`(unixepoch())`),
  completedAt: integer("completed_at"),
});

/**
 * Exchange API credentials stored encrypted.
 * apiKeyEnc, apiSecretEnc and passphraseEnc hold ciphertext produced by the
 * encryption service — never plain-text credentials.
 * passphraseEnc is only required for OKX.
 */
export const exchangeConfigs = sqliteTable("exchange_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name", { enum: ["binance", "okx", "bybit"] })
    .notNull()
    .unique(),
  enabled: integer("enabled").default(1),
  apiKeyEnc: text("api_key_enc").notNull(),
  apiSecretEnc: text("api_secret_enc").notNull(),
  passphraseEnc: text("passphrase_enc"),
  sandbox: integer("sandbox").default(0),
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type Allocation = InferSelectModel<typeof allocations>;
export type NewAllocation = InferInsertModel<typeof allocations>;

export type Snapshot = InferSelectModel<typeof snapshots>;
export type NewSnapshot = InferInsertModel<typeof snapshots>;

export type Trade = InferSelectModel<typeof trades>;
export type NewTrade = InferInsertModel<typeof trades>;

export type Rebalance = InferSelectModel<typeof rebalances>;
export type NewRebalance = InferInsertModel<typeof rebalances>;

export type ExchangeConfig = InferSelectModel<typeof exchangeConfigs>;
export type NewExchangeConfig = InferInsertModel<typeof exchangeConfigs>;

// ---------------------------------------------------------------------------
// Backtesting tables
// ---------------------------------------------------------------------------

/**
 * OHLCV candle cache.
 * Stores historical price data fetched from exchanges to avoid repeated API calls.
 * Unique constraint on (exchange, pair, timeframe, timestamp) prevents duplicates.
 */
export const ohlcvCandles = sqliteTable(
  "ohlcv_candles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    exchange: text("exchange").notNull(),
    pair: text("pair").notNull(),
    timeframe: text("timeframe").notNull(), // '1h', '1d'
    timestamp: integer("timestamp").notNull(), // unix ms
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: real("volume").notNull(),
  },
  (table) => [
    uniqueIndex("idx_ohlcv_unique").on(
      table.exchange,
      table.pair,
      table.timeframe,
      table.timestamp
    ),
  ]
);

/**
 * Backtest run results.
 * config, metrics, trades, and benchmark are JSON-serialized blobs.
 */
export const backtestResults = sqliteTable("backtest_results", {
  id: text("id").primaryKey(),
  config: text("config").notNull(), // JSON
  metrics: text("metrics").notNull(), // JSON
  trades: text("trades").notNull(), // JSON
  benchmark: text("benchmark").notNull(), // JSON
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

export type OhlcvCandle = InferSelectModel<typeof ohlcvCandles>;
export type NewOhlcvCandle = InferInsertModel<typeof ohlcvCandles>;

export type BacktestResult = InferSelectModel<typeof backtestResults>;
export type NewBacktestResult = InferInsertModel<typeof backtestResults>;

// ---------------------------------------------------------------------------
// TWAP / VWAP smart order tables
// ---------------------------------------------------------------------------

/**
 * Smart order records for TWAP and VWAP executions.
 * Tracks sliced order progress and supports restart recovery.
 * config holds JSON-serialised engine-specific parameters.
 */
export const smartOrders = sqliteTable("smart_orders", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'twap' | 'vwap'
  exchange: text("exchange").notNull(),
  pair: text("pair").notNull(),
  side: text("side").notNull(), // 'buy' | 'sell'
  totalAmount: real("total_amount").notNull(),
  filledAmount: real("filled_amount").default(0),
  avgPrice: real("avg_price"),
  slicesTotal: integer("slices_total").notNull(),
  slicesCompleted: integer("slices_completed").default(0),
  durationMs: integer("duration_ms").notNull(),
  status: text("status").notNull(), // 'active'|'paused'|'completed'|'cancelled'
  config: text("config").notNull(), // JSON
  rebalanceId: text("rebalance_id"),
  createdAt: integer("created_at").default(sql`(unixepoch())`),
  completedAt: integer("completed_at"),
});

export type SmartOrder = InferSelectModel<typeof smartOrders>;
export type NewSmartOrder = InferInsertModel<typeof smartOrders>;

// ---------------------------------------------------------------------------
// Grid bot tables
// ---------------------------------------------------------------------------

/**
 * Grid bot configurations.
 * Each row represents a running or stopped grid trading bot.
 * config holds JSON-serialized extra parameters.
 */
export const gridBots = sqliteTable("grid_bots", {
  id: text("id").primaryKey(),
  exchange: text("exchange").notNull(),
  pair: text("pair").notNull(),
  gridType: text("grid_type").notNull(), // 'normal' | 'reverse'
  priceLower: real("price_lower").notNull(),
  priceUpper: real("price_upper").notNull(),
  gridLevels: integer("grid_levels").notNull(),
  investment: real("investment").notNull(),
  status: text("status").notNull(), // 'active' | 'stopped'
  totalProfit: real("total_profit").default(0),
  totalTrades: integer("total_trades").default(0),
  config: text("config").notNull(), // JSON
  createdAt: integer("created_at").default(sql`(unixepoch())`),
  stoppedAt: integer("stopped_at"),
});

/**
 * Individual grid level orders tied to a grid bot.
 * Tracks each limit order placed at a grid price level.
 */
export const gridOrders = sqliteTable("grid_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gridBotId: text("grid_bot_id").notNull(),
  level: integer("level").notNull(),
  price: real("price").notNull(),
  amount: real("amount").notNull(),
  side: text("side").notNull(),
  status: text("status").notNull(), // 'open' | 'filled' | 'cancelled'
  exchangeOrderId: text("exchange_order_id"),
  filledAt: integer("filled_at"),
});

export type GridBot = InferSelectModel<typeof gridBots>;
export type NewGridBot = InferInsertModel<typeof gridBots>;

export type GridOrder = InferSelectModel<typeof gridOrders>;
export type NewGridOrder = InferInsertModel<typeof gridOrders>;

// ---------------------------------------------------------------------------
// AI suggestion tables
// ---------------------------------------------------------------------------

/**
 * AI-generated portfolio allocation suggestions from OpenClaw or other sources.
 * suggestedAllocations and sentimentData are JSON-serialized blobs.
 * status flows: pending → approved | rejected | auto-applied
 */
export const aiSuggestions = sqliteTable("ai_suggestions", {
  id: text("id").primaryKey(),
  source: text("source").notNull().default("openclaw"),
  suggestedAllocations: text("suggested_allocations").notNull(), // JSON
  reasoning: text("reasoning").notNull(),
  sentimentData: text("sentiment_data"), // JSON, nullable
  status: text("status").notNull(), // 'pending'|'approved'|'rejected'|'auto-applied'
  approvedAt: integer("approved_at"),
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

export type AISuggestion = InferSelectModel<typeof aiSuggestions>;
export type NewAISuggestion = InferInsertModel<typeof aiSuggestions>;

// ---------------------------------------------------------------------------
// Copy trading tables
// ---------------------------------------------------------------------------

/**
 * Copy trading source configurations.
 * Each row represents a portfolio source to follow (URL or manual).
 * allocations is a JSON-serialized array of { asset, targetPct }.
 */
export const copySources = sqliteTable("copy_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(), // 'url' | 'manual'
  sourceUrl: text("source_url"),
  allocations: text("allocations").notNull(), // JSON: { asset, targetPct }[]
  weight: real("weight").default(1.0),
  syncInterval: text("sync_interval").default("4h"),
  enabled: integer("enabled").default(1),
  lastSyncedAt: integer("last_synced_at"),
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

/**
 * Copy trading sync history.
 * Records every sync event — what changed and how many allocations were updated.
 */
export const copySyncLog = sqliteTable("copy_sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: text("source_id").notNull(),
  beforeAllocations: text("before_allocations").notNull(), // JSON
  afterAllocations: text("after_allocations").notNull(), // JSON
  changesApplied: integer("changes_applied").default(0),
  syncedAt: integer("synced_at").default(sql`(unixepoch())`),
});

export type CopySource = InferSelectModel<typeof copySources>;
export type NewCopySource = InferInsertModel<typeof copySources>;

export type CopySyncLog = InferSelectModel<typeof copySyncLog>;
export type NewCopySyncLog = InferInsertModel<typeof copySyncLog>;
