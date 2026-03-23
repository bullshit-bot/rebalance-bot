/**
 * Seed script: creates tables and inserts demo data for local development.
 * Run: bun run scripts/seed-dev-data.ts
 */
import { createClient } from '@libsql/client'

const DB_URL = process.env.DATABASE_URL ?? 'file:data/bot.db'
const client = createClient({ url: DB_URL })

// ── Create tables ─────────────────────────────────────────────────────────────
const DDL = `
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset TEXT NOT NULL,
  target_pct REAL NOT NULL,
  exchange TEXT,
  min_trade_usd REAL DEFAULT 10,
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS allocations_asset_exchange_idx ON allocations(asset, exchange);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_value_usd REAL NOT NULL,
  holdings TEXT NOT NULL,
  allocations TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS snapshots_created_at_idx ON snapshots(created_at);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  amount REAL NOT NULL,
  price REAL NOT NULL,
  cost_usd REAL NOT NULL,
  fee REAL,
  fee_currency TEXT,
  order_id TEXT,
  rebalance_id TEXT,
  is_paper INTEGER DEFAULT 0,
  executed_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS trades_rebalance_id_idx ON trades(rebalance_id);

CREATE TABLE IF NOT EXISTS rebalances (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  before_state TEXT NOT NULL,
  after_state TEXT,
  total_trades INTEGER DEFAULT 0,
  total_fees_usd REAL DEFAULT 0,
  error_message TEXT,
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS exchange_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 1,
  api_key_enc TEXT NOT NULL,
  api_secret_enc TEXT NOT NULL,
  passphrase_enc TEXT,
  sandbox INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ohlcv_candles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ohlcv_unique ON ohlcv_candles(exchange, pair, timeframe, timestamp);

CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  metrics TEXT NOT NULL,
  trades TEXT NOT NULL,
  benchmark TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS smart_orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  total_amount REAL NOT NULL,
  filled_amount REAL DEFAULT 0,
  avg_price REAL,
  slices_total INTEGER NOT NULL,
  slices_completed INTEGER DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  config TEXT NOT NULL,
  rebalance_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS grid_bots (
  id TEXT PRIMARY KEY,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  grid_type TEXT NOT NULL,
  price_lower REAL NOT NULL,
  price_upper REAL NOT NULL,
  grid_levels INTEGER NOT NULL,
  investment REAL NOT NULL,
  status TEXT NOT NULL,
  total_profit REAL DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  config TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  stopped_at INTEGER
);

CREATE TABLE IF NOT EXISTS grid_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grid_bot_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL,
  exchange_order_id TEXT,
  filled_at INTEGER
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'openclaw',
  suggested_allocations TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  sentiment_data TEXT,
  status TEXT NOT NULL,
  approved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS copy_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  allocations TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  sync_interval TEXT DEFAULT '4h',
  enabled INTEGER DEFAULT 1,
  last_synced_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS copy_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  before_allocations TEXT NOT NULL,
  after_allocations TEXT NOT NULL,
  changes_applied INTEGER DEFAULT 0,
  synced_at INTEGER DEFAULT (unixepoch())
);
`

async function run() {
  console.log('Creating tables...')
  for (const stmt of DDL.split(';').map(s => s.trim()).filter(Boolean)) {
    await client.execute(stmt)
  }
  console.log('Tables created.')

  // ── Seed allocations ────────────────────────────────────────────────────────
  console.log('Seeding allocations...')
  const allocs = [
    { asset: 'BTC', pct: 35, exchange: 'binance' },
    { asset: 'ETH', pct: 25, exchange: 'binance' },
    { asset: 'SOL', pct: 15, exchange: 'binance' },
    { asset: 'USDT', pct: 10, exchange: 'binance' },
    { asset: 'AVAX', pct: 8, exchange: 'binance' },
    { asset: 'LINK', pct: 7, exchange: 'binance' },
  ]
  for (const a of allocs) {
    await client.execute({
      sql: 'INSERT OR REPLACE INTO allocations (asset, target_pct, exchange, min_trade_usd) VALUES (?, ?, ?, 10)',
      args: [a.asset, a.pct, a.exchange],
    })
  }

  // ── Seed portfolio snapshots (7 days) ───────────────────────────────────────
  console.log('Seeding snapshots...')
  const now = Math.floor(Date.now() / 1000)
  const values = [141200, 143800, 142100, 145600, 144300, 146100, 145491, 147832]
  for (let i = 0; i < values.length; i++) {
    const ts = now - (7 - i) * 86400
    const holdings = JSON.stringify({
      BTC: { amount: 0.842, valueUsd: values[i] * 0.389 },
      ETH: { amount: 8.15, valueUsd: values[i] * 0.212 },
      SOL: { amount: 142, valueUsd: values[i] * 0.18 },
      USDT: { amount: 12450, valueUsd: values[i] * 0.084 },
      AVAX: { amount: 285, valueUsd: values[i] * 0.074 },
      LINK: { amount: 520, valueUsd: values[i] * 0.06 },
    })
    const allocsJson = JSON.stringify(allocs.map(a => ({ asset: a.asset, targetPct: a.pct })))
    await client.execute({
      sql: 'INSERT INTO snapshots (total_value_usd, holdings, allocations, created_at) VALUES (?, ?, ?, ?)',
      args: [values[i], holdings, allocsJson, ts],
    })
  }

  // ── Seed trades (last 7 days) ───────────────────────────────────────────────
  console.log('Seeding trades...')
  const seedTrades = [
    { pair: 'BTC/USDT', side: 'sell', amount: 0.034, price: 68420, fee: 2.33, days: 0 },
    { pair: 'ETH/USDT', side: 'buy', amount: 0.82, price: 3842, fee: 3.15, days: 0 },
    { pair: 'SOL/USDT', side: 'sell', amount: 12.5, price: 187.5, fee: 2.34, days: 0 },
    { pair: 'AVAX/USDT', side: 'buy', amount: 14.2, price: 38.75, fee: 0.55, days: 1 },
    { pair: 'LINK/USDT', side: 'buy', amount: 45, price: 17.12, fee: 0.77, days: 1 },
    { pair: 'ETH/USDT', side: 'buy', amount: 0.5, price: 3810, fee: 1.91, days: 1 },
    { pair: 'BTC/USDT', side: 'sell', amount: 0.012, price: 67890, fee: 0.81, days: 2 },
    { pair: 'SOL/USDT', side: 'sell', amount: 8, price: 185.2, fee: 1.48, days: 2 },
    { pair: 'BTC/USDT', side: 'buy', amount: 0.05, price: 66800, fee: 3.34, days: 3 },
    { pair: 'ETH/USDT', side: 'sell', amount: 1.2, price: 3720, fee: 4.46, days: 4 },
    { pair: 'SOL/USDT', side: 'buy', amount: 20, price: 180, fee: 3.6, days: 5 },
    { pair: 'BTC/USDT', side: 'sell', amount: 0.03, price: 65200, fee: 1.96, days: 6 },
  ]
  for (const t of seedTrades) {
    const ts = now - t.days * 86400 - Math.floor(Math.random() * 3600)
    await client.execute({
      sql: 'INSERT INTO trades (exchange, pair, side, amount, price, cost_usd, fee, fee_currency, is_paper, rebalance_id, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      args: ['binance', t.pair, t.side, t.amount, t.price, t.amount * t.price, t.fee, 'USDT', t.days <= 1 ? 'rb-001' : null, ts],
    })
  }

  // ── Seed rebalance record ───────────────────────────────────────────────────
  console.log('Seeding rebalance record...')
  await client.execute({
    sql: 'INSERT INTO rebalances (id, trigger_type, status, before_state, after_state, total_trades, total_fees_usd, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: ['rb-001', 'manual', 'completed', '{}', '{}', 3, 7.82, now - 3600, now - 3590],
  })

  // ── Seed AI suggestions ────────────────────────────────────────────────────
  console.log('Seeding AI suggestions...')
  const suggestions = [
    { id: 'ai-01', allocs: [{ asset: 'BTC', targetPct: 33 }, { asset: 'ETH', targetPct: 27 }], reasoning: 'BTC momentum turning bearish on 4h. ETH showing accumulation pattern. Shift 2% from BTC to ETH.', status: 'pending', ago: 3600 },
    { id: 'ai-02', allocs: [{ asset: 'SOL', targetPct: 13 }, { asset: 'USDT', targetPct: 12 }], reasoning: 'SOL RSI at 78, overbought. Reduce SOL exposure by 2%.', status: 'pending', ago: 7200 },
    { id: 'ai-03', allocs: [{ asset: 'BTC', targetPct: 37 }, { asset: 'AVAX', targetPct: 6 }], reasoning: 'Strong BTC dominance signal. Rotating alts to BTC.', status: 'approved', ago: 86400 },
  ]
  for (const s of suggestions) {
    await client.execute({
      sql: 'INSERT INTO ai_suggestions (id, suggested_allocations, reasoning, status, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [s.id, JSON.stringify(s.allocs), s.reasoning, s.status, now - s.ago],
    })
  }

  console.log('Seed complete!')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
