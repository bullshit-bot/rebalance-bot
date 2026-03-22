# Research Report: Crypto Rebalance Bot Infrastructure (Bleeding Edge)

> Date: 2026-03-22 | Scope: Personal non-commercial project
> Frontend: React (existing) | Exchanges: Binance, OKX, Bybit
> Requirements: Real-time, lowest latency, latest tech | VPS: 8GB RAM, 80GB SSD

## Executive Summary

**Bun** runtime + **Hono** framework + **CCXT Pro** (WebSocket) + **Drizzle ORM** + **libSQL** (Turso's SQLite fork) + **Bun native WebSocket** for React frontend. Deploy via **Docker** on existing VPS.

Why this stack: Bun handles **2.8x more WebSocket messages** than Node.js with **30% less RAM**. Hono is Web Standards-based, ultra-fast on Bun. libSQL adds encryption-at-rest + 4x write throughput over vanilla SQLite. Drizzle is **3-5x faster** than Prisma with 7.4kb bundle.

---

## Final Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  REACT FRONTEND (existing)                │
│             Native WebSocket client + REST                │
└────────────┬──────────────────────┬──────────────────────┘
             │ WebSocket (native)   │ REST (HTTP)
┌────────────▼──────────────────────▼──────────────────────┐
│                BACKEND (Bun + TypeScript)                 │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    Hono      │  │ Bun.serve   │  │   Scheduler     │  │
│  │  REST API    │  │  WebSocket  │  │   (cron)        │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬─────────┘  │
│         │                 │                  │            │
│  ┌──────▼─────────────────▼──────────────────▼─────────┐  │
│  │          TYPED EVENT BUS (EventEmitter)              │  │
│  │  price:update | balance:update | rebalance:trigger   │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │                SERVICE LAYER                         │  │
│  │                                                      │  │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐  │  │
│  │  │ Exchange   │ │ Portfolio  │ │  Rebalancer     │  │  │
│  │  │ Manager    │ │ Tracker    │ │  Engine         │  │  │
│  │  └─────┬──────┘ └─────┬──────┘ └────────┬────────┘  │  │
│  │        │              │                  │           │  │
│  │  ┌─────▼──────┐ ┌─────▼──────┐ ┌────────▼────────┐  │  │
│  │  │ Order      │ │ Price      │ │  Notifier       │  │  │
│  │  │ Executor   │ │ Aggregator │ │  (Telegram)     │  │  │
│  │  └────────────┘ └────────────┘ └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │              DATA LAYER                              │  │
│  │  libSQL (Drizzle ORM)  |  CCXT Pro (WebSocket)      │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
          │                    │                    │
   ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
   │   Binance   │     │    OKX      │     │   Bybit     │
   │  WebSocket  │     │  WebSocket  │     │  WebSocket  │
   └─────────────┘     └─────────────┘     └─────────────┘
```

## Tech Stack (Bleeding Edge 2026)

| Layer | Choice | Why |
|-------|--------|-----|
| **Runtime** | **Bun 1.2+** | 2.8x more WS messages than Node, 30% less RAM, 4-10x faster startup, built-in test runner |
| **API Framework** | **Hono v4** | Web Standards (Fetch API), ultra-lightweight, type-safe middleware, works on Bun natively |
| **Real-time** | **Bun native WebSocket** | Built into `Bun.serve()`, zero dependency, lowest possible latency |
| **Exchange** | **CCXT Pro** | Unified WebSocket for Binance/OKX/Bybit, auto-reconnect, Node-compat on Bun |
| **Database** | **libSQL** (Turso fork) | 4x write throughput vs SQLite, encryption-at-rest, WAL improvements |
| **ORM** | **Drizzle ORM** | 3-5x faster than Prisma, 7.4kb bundle, SQL-like control, libSQL driver native |
| **Validation** | **Zod** | Runtime type validation, integrates with Hono validator |
| **Scheduler** | **croner** | Modern cron for Bun/Node, lightweight |
| **Notifications** | **grammy** | Modern Telegram Bot framework, Bun-compatible |
| **Config** | **@t3-oss/env-core** | Type-safe env vars with Zod validation |
| **Deploy** | **Docker (Bun image)** | `oven/bun:1` official image, tiny |
| **Monorepo** | **Bun workspaces** | Native, zero-config |

### Why Each Choice Over Alternatives

| Decision | Chosen | Over | Reason |
|----------|--------|------|--------|
| Bun | Bun 1.2 | Node.js 22 | 2.8x WS throughput, native WS server, built-in bundler/test |
| Hono | Hono v4 | Elysia / Fastify | Web Standards portable, not locked to Bun, huge middleware ecosystem |
| libSQL | libSQL | SQLite / PostgreSQL | SQLite compat + encryption + better write concurrency, no server needed |
| Drizzle | Drizzle | Prisma 7 | Smaller, faster, SQL-first, perfect libSQL integration |
| Native WS | Bun.serve WS | Socket.IO | Zero dependency, lowest latency, Bun-optimized |
| grammy | grammy | node-telegram-bot-api | Modern, Bun-native, plugin system |

## Real-time Data Flow

```
Exchange WebSocket (Binance/OKX/Bybit)
        │
        ▼
    CCXT Pro (persistent WS connections, auto-reconnect)
        │
        ▼
    EventEmitter ──────────────────────────────────┐
        │                                          │
        ▼                                          ▼
    Price Aggregator                    Portfolio Tracker
    (in-memory Map)                     (balance streams)
        │                                          │
        ▼                                          ▼
    Bun WebSocket ──push──▶ React       Drift Detector
    (real-time prices)                     │
                                           ▼
                                    drift > 5%?
                                    ┌──yes──┐
                                    ▼       │
                              Rebalance     │ no → wait
                              Engine        │
                                    │       │
                                    ▼       │
                              Order Executor
                              (CCXT Pro)
                                    │
                              ┌─────┴──────┐
                              ▼            ▼
                           libSQL      Telegram
                          (log trade)  (notify)
                              │
                              ▼
                      Bun WebSocket ──push──▶ React
                      (trade result, new allocations)
```

### WebSocket Message Protocol (Backend → React)

```typescript
// Type-safe message protocol
type WSMessage =
  | { type: 'prices'; data: Record<string, { price: number; change24h: number }> }
  | { type: 'portfolio'; data: { totalUsd: number; allocations: Allocation[] } }
  | { type: 'rebalance:started'; data: { id: string; trigger: string } }
  | { type: 'rebalance:completed'; data: { id: string; trades: Trade[] } }
  | { type: 'trade:executed'; data: Trade }
  | { type: 'alert'; data: { level: 'info' | 'warn' | 'error'; message: string } }
  | { type: 'exchange:status'; data: Record<string, 'connected' | 'disconnected'> }
```

## Core Modules

### 1. Exchange Manager (`src/exchange/`)
- CCXT Pro instances for Binance, OKX, Bybit
- Persistent WebSocket connections with auto-reconnect
- Unified price stream: best bid/ask across 3 exchanges
- API key encryption at rest (AES-256-GCM via `node:crypto`)
- Connection health monitoring + auto-recovery

### 2. Price Aggregator (`src/price/`)
- Subscribes to CCXT Pro `watchTicker()` streams
- In-memory Map for O(1) price lookups (~0.001ms)
- Emits `price:update` on EventBus
- VWAP calculation across exchanges
- Pushes to React via Bun WebSocket

### 3. Portfolio Tracker (`src/portfolio/`)
- Subscribes to CCXT Pro `watchBalance()` streams
- Real-time allocation % calculation
- Drift detection vs target allocations
- Emits `portfolio:update` + `drift:warning`
- Periodic snapshots to libSQL (every 5 min)

### 4. Rebalance Engine (`src/rebalancer/`)
- **Threshold-based** (primary): trigger when any asset drifts >5%
- **Periodic** (safety net): croner job every 4h
- **Manual**: API endpoint from React
- **DCA-aware**: new deposits → buy underweight assets first
- Dry-run preview mode
- Optimal trade sequence calculation (minimize trades + fees)
- Min trade filter: skip < $10

### 5. Order Executor (`src/executor/`)
- Executes via CCXT Pro `createOrder()`
- Limit order → 30s timeout → fallback market
- Slippage guard (max 0.5%)
- Retry with exponential backoff (max 3)
- Circuit breaker: stop if daily loss > configurable %

### 6. API Layer (`src/api/`)

**REST Endpoints (Hono)**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio` | Current holdings + allocations |
| GET | `/api/portfolio/history` | Value snapshots (charts) |
| GET | `/api/prices` | Latest prices from cache |
| POST | `/api/rebalance` | Trigger manual rebalance |
| GET | `/api/rebalance/preview` | Dry-run preview |
| GET | `/api/rebalance/history` | Past rebalance events |
| PUT | `/api/config/allocations` | Update target allocations |
| GET | `/api/trades` | Trade history |
| GET | `/api/exchanges/status` | WS connection health |
| GET | `/api/health` | Healthcheck |

**WebSocket**: `ws://host:3001/ws` — single connection, multiplexed channels via message `type`.

**Auth**: API key header (`X-API-Key`) — single user, simple.

### 7. Notifier (`src/notifier/`)
- Telegram bot via grammy
- Events: rebalance done, drift warning, connection lost, errors
- Throttle: max 1 msg per event type per 5 min

## Database Schema (libSQL)

```sql
-- Target portfolio allocation
CREATE TABLE allocations (
  id INTEGER PRIMARY KEY,
  asset TEXT NOT NULL,
  target_pct REAL NOT NULL,      -- 0.40 = 40%
  exchange TEXT,                  -- NULL = any exchange
  min_trade_usd REAL DEFAULT 10,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(asset, exchange)
);

-- Portfolio value snapshots (charts)
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY,
  total_value_usd REAL NOT NULL,
  holdings TEXT NOT NULL,         -- JSON: {"BTC": {"amount": 0.5, "usd": 35000}, ...}
  allocations TEXT NOT NULL,      -- JSON: {"BTC": 0.42, "ETH": 0.28, ...}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_snapshots_created ON snapshots(created_at);

-- Executed trades
CREATE TABLE trades (
  id INTEGER PRIMARY KEY,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
  amount REAL NOT NULL,
  price REAL NOT NULL,
  cost_usd REAL NOT NULL,
  fee REAL,
  fee_currency TEXT,
  order_id TEXT,
  rebalance_id TEXT,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trades_rebalance ON trades(rebalance_id);

-- Rebalance events
CREATE TABLE rebalances (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('threshold', 'periodic', 'manual')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'executing', 'completed', 'failed')),
  before_state TEXT NOT NULL,    -- JSON
  after_state TEXT,              -- JSON
  total_trades INTEGER DEFAULT 0,
  total_fees_usd REAL DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Exchange configs (encrypted keys)
CREATE TABLE exchange_configs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 1,
  api_key_enc TEXT NOT NULL,
  api_secret_enc TEXT NOT NULL,
  passphrase_enc TEXT,           -- OKX needs this
  sandbox INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Project Structure

```
rebalance-bot/
├── src/
│   ├── api/
│   │   ├── server.ts              # Hono app + Bun.serve (HTTP + WS)
│   │   ├── routes/
│   │   │   ├── portfolio-routes.ts
│   │   │   ├── rebalance-routes.ts
│   │   │   ├── trade-routes.ts
│   │   │   ├── config-routes.ts
│   │   │   └── health-routes.ts
│   │   ├── middleware/
│   │   │   └── auth-middleware.ts  # API key validation
│   │   └── ws/
│   │       └── ws-handler.ts      # WebSocket upgrade + message routing
│   ├── exchange/
│   │   ├── exchange-manager.ts    # CCXT Pro lifecycle
│   │   ├── exchange-factory.ts    # Create exchange instances
│   │   └── api-key-crypto.ts      # AES-256-GCM encrypt/decrypt
│   ├── price/
│   │   ├── price-aggregator.ts    # Real-time price streams
│   │   └── price-cache.ts         # In-memory price Map
│   ├── portfolio/
│   │   ├── portfolio-tracker.ts   # Balance tracking + drift
│   │   └── snapshot-service.ts    # Periodic DB snapshots
│   ├── rebalancer/
│   │   ├── rebalance-engine.ts    # Core rebalancing logic
│   │   ├── trade-calculator.ts    # Optimal trade computation
│   │   └── drift-detector.ts      # Threshold monitoring
│   ├── executor/
│   │   ├── order-executor.ts      # Trade execution via CCXT Pro
│   │   └── execution-guard.ts     # Safety limits + circuit breaker
│   ├── notifier/
│   │   └── telegram-notifier.ts   # Telegram alerts via grammy
│   ├── scheduler/
│   │   └── cron-scheduler.ts      # Periodic jobs via croner
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema definitions
│   │   ├── migrations/            # SQL migrations
│   │   └── database.ts            # libSQL connection
│   ├── events/
│   │   └── event-bus.ts           # Typed EventEmitter
│   ├── config/
│   │   └── app-config.ts          # t3-env validated config
│   ├── types/
│   │   └── index.ts               # Shared type definitions
│   └── index.ts                   # Entry point
├── data/                          # libSQL DB file (gitignored)
├── docker-compose.yml
├── Dockerfile
├── biome.json                     # Biome (linter + formatter, replaces ESLint + Prettier)
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Docker Deployment

```yaml
# docker-compose.yml
services:
  bot:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    env_file: .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
```

```dockerfile
# Dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["bun", "run", "dist/index.js"]
```

## Latency Budget

| Component | Latency | Notes |
|-----------|---------|-------|
| Exchange WS → Bun | ~10-50ms | Network dependent, VPS location matters |
| CCXT Pro processing | ~1-2ms | Parse + normalize |
| EventEmitter dispatch | ~0.01ms | In-process |
| Price cache lookup | ~0.001ms | Map.get() |
| libSQL read | ~0.005ms | In-process, WAL mode |
| libSQL write | ~0.1ms | WAL + 4x throughput |
| Bun WS → React | ~1-5ms | Binary frames |
| **Total: Exchange → React** | **~15-60ms** | Dominated by network |

## Tooling (All Bleeding Edge)

| Tool | Replaces | Why |
|------|----------|-----|
| **Biome** | ESLint + Prettier | 100x faster, single tool, Rust-based |
| **Bun test** | Vitest / Jest | Built-in, zero config, fast |
| **Bun build** | esbuild / tsup | Built-in bundler, native |
| **oxlint** (optional) | ESLint | Rust-based, 50-100x faster |

## Security

- [ ] API keys encrypted at rest (AES-256-GCM)
- [ ] `.env` gitignored
- [ ] API key auth on all endpoints
- [ ] libSQL encryption-at-rest enabled
- [ ] Max trade size limit per order
- [ ] Daily loss circuit breaker
- [ ] IP whitelist on exchange API keys
- [ ] Exchange keys: trade-only, NO withdrawal
- [ ] CORS restricted to frontend origin
- [ ] Rate limiting via Hono middleware

## VPS Resource Usage (8GB RAM / 80GB SSD)

| Component | RAM | Disk |
|-----------|-----|------|
| Bun process | ~80-150MB | - |
| CCXT Pro (3 exchanges) | ~50MB | - |
| libSQL (1yr data) | ~30MB cache | ~500MB |
| Docker overhead | ~50MB | ~200MB |
| OS | ~500MB | ~5GB |
| **Total** | **~700MB** | **~6GB** |
| **Available** | **~7.3GB** | **~74GB** |

Bun uses **30% less RAM** than Node.js → even more headroom.

## Rebalancing Strategy

**Hybrid: Real-time threshold + periodic safety net**

1. Real-time drift monitoring via WS balance/price streams
2. Threshold trigger: any asset drifts >5% from target
3. Cooldown: min 1h between rebalances
4. Periodic safety: croner every 4h
5. DCA mode: new deposits → buy underweight first
6. Min trade: skip < $10
7. Execution: limit order → 30s timeout → market fallback

## package.json Dependencies

```json
{
  "dependencies": {
    "ccxt": "^4.x",
    "hono": "^4.x",
    "drizzle-orm": "^0.38.x",
    "@libsql/client": "^0.14.x",
    "grammy": "^1.x",
    "croner": "^8.x",
    "zod": "^3.x",
    "@t3-oss/env-core": "^0.11.x"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.30.x",
    "@biomejs/biome": "^1.x",
    "typescript": "^5.x"
  }
}
```

## Sources

- [Bun vs Node.js 2026 - DEV Community](https://dev.to/alexcloudstar/bun-vs-nodejs-is-it-time-to-switch-in-2026-5821)
- [Bun vs Node.js Performance Benchmarks 2026](https://www.askantech.com/bun-vs-nodejs-vs-deno-performance-benchmarks-2026/)
- [Best TypeScript Backend Frameworks 2026](https://encore.dev/articles/best-typescript-backend-frameworks)
- [Hono vs Fastify Comparison](https://www.oreateai.com/blog/hono-vs-fastify-choosing-the-right-framework-for-your-typescript-backend/)
- [Distributed SQLite: libSQL and Turso 2026](https://dev.to/dataformathub/distributed-sqlite-why-libsql-and-turso-are-the-new-standard-in-2026-58fk)
- [The SQLite Renaissance 2026](https://dev.to/pockit_tools/the-sqlite-renaissance-why-the-worlds-most-deployed-database-is-taking-over-production-in-2026-3jcc)
- [Drizzle vs Prisma 2026](https://dev.to/theawesomeblog/prisma-vs-drizzle-2026-which-typescript-orm-wins-the-performance-battle-1oln)
- [Drizzle vs Prisma Honest Comparison](https://dev.to/pockit_tools/drizzle-orm-vs-prisma-in-2026-the-honest-comparison-nobody-is-making-3n6g)
- [CCXT - GitHub](https://github.com/ccxt/ccxt)
- [Hono Benchmarks](https://hono.dev/docs/concepts/benchmarks)
