---
title: "Phase 1: Core Engine"
description: "Rebalance, DCA, trailing stop-loss, paper trading, real-time WebSocket, Telegram alerts, REST API"
status: pending
priority: P1
effort: 40h
tags: [crypto, backend, core, phase-1]
created: 2026-03-22
---

# Phase 1: Core Engine

## Context

- [Infrastructure Research](../reports/research-260322-1802-crypto-rebalance-bot-infra.md)
- Master plan: [plan.md](./plan.md)

## Overview

- **Priority**: P1 (Critical - everything depends on this)
- **Status**: Pending
- **Effort**: 40h
- **Description**: Build core bot: project setup, exchange connections, portfolio tracking, auto rebalance, DCA, trailing stop-loss, paper trading, Telegram alerts, REST API

## Key Insights

- CCXT Pro provides unified WebSocket for all 3 exchanges
- Bun native WS = lowest latency, zero dependency
- libSQL = SQLite-compatible with 4x write throughput
- Paper trading = same code path, just skip order execution
- Trailing stop = event-driven, update on every price tick

## Requirements

### Functional
- F1: Connect to Binance, OKX, Bybit via CCXT Pro WebSocket
- F2: Real-time price streaming (ticker) for tracked assets
- F3: Real-time balance streaming from exchanges
- F4: Calculate portfolio allocation % in real-time
- F5: Auto rebalance when any asset drifts >5% (configurable threshold)
- F6: Periodic rebalance check every 4h (safety net)
- F7: Smart DCA: new deposits allocated to underweight assets
- F8: Trailing stop-loss per asset (configurable %)
- F9: Paper trading mode (simulated execution, real prices)
- F10: Telegram notifications (trades, alerts, errors, drift warnings)
- F11: REST API for React frontend
- F12: WebSocket push to React (prices, portfolio, trades, alerts)

### Non-Functional
- NF1: Latency < 60ms exchange → React
- NF2: Auto-reconnect on WebSocket disconnect
- NF3: Graceful shutdown (complete pending orders)
- NF4: Config via env vars (validated with Zod)
- NF5: Structured logging (JSON format)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Bun.serve()                     │
│         HTTP (Hono) + WebSocket (native)         │
└──────────┬───────────────────┬──────────────────┘
           │                   │
    ┌──────▼──────┐    ┌───────▼───────┐
    │  REST API   │    │  WS Handler   │
    │  (Hono)     │    │  (Bun native) │
    └──────┬──────┘    └───────┬───────┘
           │                   │
    ┌──────▼───────────────────▼──────────────────┐
    │              EVENT BUS                       │
    │  price:update | balance:update | trade:exec  │
    │  drift:warning | rebalance:trigger           │
    └──────────────────┬──────────────────────────┘
                       │
    ┌──────────────────▼──────────────────────────┐
    │            SERVICE LAYER                     │
    │                                              │
    │  ExchangeManager    PortfolioTracker         │
    │  RebalanceEngine    DriftDetector            │
    │  OrderExecutor      TrailingStopManager      │
    │  DCAService         PaperTradingEngine       │
    │  TelegramNotifier   CronScheduler            │
    └──────────────────┬──────────────────────────┘
                       │
    ┌──────────────────▼──────────────────────────┐
    │            DATA LAYER                        │
    │  libSQL (Drizzle) + CCXT Pro (exchanges)     │
    └─────────────────────────────────────────────┘
```

## Files to Create

```
src/
├── index.ts                          # Entry point, bootstrap all services
├── config/
│   └── app-config.ts                 # Zod-validated env config
├── types/
│   └── index.ts                      # Shared types (Trade, Allocation, WSMessage, etc.)
├── events/
│   └── event-bus.ts                  # Typed EventEmitter
├── db/
│   ├── database.ts                   # libSQL connection
│   ├── schema.ts                     # Drizzle schema (all tables)
│   └── migrations/                   # SQL migration files
├── exchange/
│   ├── exchange-manager.ts           # CCXT Pro lifecycle, multi-exchange
│   ├── exchange-factory.ts           # Create typed exchange instances
│   └── api-key-crypto.ts            # AES-256-GCM encrypt/decrypt
├── price/
│   ├── price-aggregator.ts          # Subscribe to tickers, emit price:update
│   └── price-cache.ts               # In-memory Map<string, PriceData>
├── portfolio/
│   ├── portfolio-tracker.ts         # Balance streams, allocation calc
│   └── snapshot-service.ts          # Periodic DB snapshots
├── rebalancer/
│   ├── rebalance-engine.ts          # Core logic: calculate needed trades
│   ├── drift-detector.ts            # Monitor drift vs target
│   └── trade-calculator.ts          # Optimal trade sequence
├── executor/
│   ├── order-executor.ts            # Real order execution via CCXT Pro
│   ├── paper-trading-engine.ts      # Simulated execution (same interface)
│   └── execution-guard.ts          # Max size, daily loss, circuit breaker
├── trailing-stop/
│   └── trailing-stop-manager.ts     # Per-asset trailing stop tracking
├── dca/
│   └── dca-service.ts              # Smart DCA allocation logic
├── notifier/
│   └── telegram-notifier.ts        # grammy bot, throttled alerts
├── scheduler/
│   └── cron-scheduler.ts           # croner periodic jobs
├── api/
│   ├── server.ts                    # Hono app + Bun.serve setup
│   ├── routes/
│   │   ├── portfolio-routes.ts
│   │   ├── rebalance-routes.ts
│   │   ├── trade-routes.ts
│   │   ├── config-routes.ts
│   │   └── health-routes.ts
│   ├── middleware/
│   │   └── auth-middleware.ts       # API key validation
│   └── ws/
│       └── ws-handler.ts           # WebSocket upgrade + message routing
```

Root files:
```
package.json
tsconfig.json
biome.json
Dockerfile
docker-compose.yml
.env.example
.gitignore
drizzle.config.ts
```

## Implementation Steps

### Step 1: Project Setup (2h)
1. Init Bun project: `bun init`
2. Install deps: ccxt, hono, drizzle-orm, @libsql/client, grammy, croner, zod, @t3-oss/env-core
3. Install devDeps: @types/bun, drizzle-kit, @biomejs/biome, typescript
4. Configure tsconfig.json (strict, paths)
5. Configure biome.json (formatter + linter)
6. Create .env.example with all required vars
7. Create .gitignore (data/, node_modules/, .env, dist/)
8. Create Dockerfile + docker-compose.yml

### Step 2: Config & Types (2h)
1. Create `src/config/app-config.ts` — Zod schema for all env vars
2. Create `src/types/index.ts` — all shared types
3. Create `src/events/event-bus.ts` — typed EventEmitter

### Step 3: Database Layer (3h)
1. Create `src/db/database.ts` — libSQL client connection
2. Create `src/db/schema.ts` — Drizzle schema for all tables:
   - allocations, snapshots, trades, rebalances, exchange_configs
3. Create `drizzle.config.ts`
4. Generate + run initial migration
5. Test: insert/query works

### Step 4: Exchange Manager (5h)
1. Create `src/exchange/api-key-crypto.ts` — AES-256-GCM encrypt/decrypt
2. Create `src/exchange/exchange-factory.ts` — create CCXT Pro instances
3. Create `src/exchange/exchange-manager.ts`:
   - Initialize connections to Binance/OKX/Bybit
   - WebSocket connect with auto-reconnect
   - Health monitoring (emit exchange:status events)
   - Graceful shutdown
4. Test: connect to exchange sandbox, verify ticker stream

### Step 5: Price Aggregator (3h)
1. Create `src/price/price-cache.ts` — Map<string, PriceData>
2. Create `src/price/price-aggregator.ts`:
   - Subscribe to CCXT Pro `watchTicker()` for each asset
   - Update price cache on every tick
   - Emit `price:update` on EventBus
   - Calculate best price across exchanges
3. Test: verify real-time price updates

### Step 6: Portfolio Tracker (4h)
1. Create `src/portfolio/portfolio-tracker.ts`:
   - Subscribe to CCXT Pro `watchBalance()` for each exchange
   - Calculate current allocation % per asset
   - Compare vs target allocations
   - Emit `portfolio:update` and `drift:warning` events
2. Create `src/portfolio/snapshot-service.ts`:
   - Periodic snapshot to DB (every 5 min)
   - Store total value + holdings JSON
3. Test: verify balance updates and drift detection

### Step 7: Rebalance Engine (5h)
1. Create `src/rebalancer/drift-detector.ts`:
   - Listen to portfolio:update events
   - Check if any asset drift > threshold
   - Respect cooldown period (min 1h between rebalances)
2. Create `src/rebalancer/trade-calculator.ts`:
   - Calculate trades needed to reach target allocation
   - Minimize number of trades
   - Apply min trade filter ($10)
   - Sort by priority (largest drift first)
3. Create `src/rebalancer/rebalance-engine.ts`:
   - Orchestrate: detect drift → calculate trades → execute → log
   - Support triggers: threshold, periodic, manual
   - Dry-run preview mode
4. Test: verify correct trade calculation

### Step 8: Order Executor + Paper Trading (4h)
1. Create `src/executor/execution-guard.ts`:
   - Max trade size per order
   - Daily loss circuit breaker
   - Slippage protection (max 0.5%)
2. Create `src/executor/order-executor.ts`:
   - Execute via CCXT Pro createOrder()
   - Limit order → 30s timeout → fallback market
   - Retry with exponential backoff (max 3)
   - Log trade to DB
3. Create `src/executor/paper-trading-engine.ts`:
   - Same interface as OrderExecutor
   - Simulated fills at current market price + slippage simulation
   - Track paper balance in memory
   - Log paper trades to DB (flagged as paper)
4. Test: paper trade execution, verify DB logging

### Step 9: Trailing Stop-Loss (3h)
1. Create `src/trailing-stop/trailing-stop-manager.ts`:
   - Per-asset trailing stop configuration
   - Listen to price:update events
   - Track highest price since activation
   - Trigger sell when price drops X% from peak
   - Emit trailing-stop:triggered event
2. Test: simulate price rise then drop, verify trigger

### Step 10: DCA Service (2h)
1. Create `src/dca/dca-service.ts`:
   - Detect new deposit (balance increase without trade)
   - Calculate optimal allocation of new funds
   - Prioritize underweight assets
   - Generate buy orders
2. Test: simulate deposit, verify allocation

### Step 11: Telegram Notifier (2h)
1. Create `src/notifier/telegram-notifier.ts`:
   - grammy bot setup
   - Event handlers: trade executed, rebalance done, drift warning, error, connection status
   - Throttle: max 1 msg per event type per 5 min
   - Rich formatting with emoji + trade details
2. Test: send test notification

### Step 12: REST API + WebSocket (4h)
1. Create `src/api/middleware/auth-middleware.ts` — X-API-Key validation
2. Create `src/api/routes/*.ts` — all REST endpoints
3. Create `src/api/ws/ws-handler.ts`:
   - WebSocket upgrade handler
   - Subscribe to EventBus, push to clients
   - Message types: prices, portfolio, trades, alerts, exchange:status
4. Create `src/api/server.ts` — Hono app + Bun.serve (HTTP + WS)
5. Create `src/index.ts` — bootstrap all services
6. Test: curl API endpoints, wscat WebSocket

### Step 13: Scheduler + Integration (1h)
1. Create `src/scheduler/cron-scheduler.ts`:
   - Every 4h: periodic rebalance check
   - Every 5min: portfolio snapshot
2. Wire everything in `src/index.ts`
3. Full integration test: start bot, verify all systems

## Todo List

- [ ] Step 1: Project setup (Bun, deps, config files)
- [ ] Step 2: Config validation + shared types + event bus
- [ ] Step 3: Database layer (libSQL + Drizzle schema + migrations)
- [ ] Step 4: Exchange manager (CCXT Pro + multi-exchange + auto-reconnect)
- [ ] Step 5: Price aggregator (real-time tickers + cache)
- [ ] Step 6: Portfolio tracker (balance streams + drift detection + snapshots)
- [ ] Step 7: Rebalance engine (drift detector + trade calculator + orchestrator)
- [ ] Step 8: Order executor + paper trading engine
- [ ] Step 9: Trailing stop-loss manager
- [ ] Step 10: Smart DCA service
- [ ] Step 11: Telegram notifier (grammy)
- [ ] Step 12: REST API (Hono) + WebSocket (Bun native)
- [ ] Step 13: Scheduler + full integration wiring

## Success Criteria

- [ ] Bot connects to Binance + OKX + Bybit via WebSocket
- [ ] Real-time prices stream to React via Bun WebSocket
- [ ] Portfolio allocation calculated in real-time
- [ ] Auto rebalance triggers when drift > threshold
- [ ] Paper trading mode works with simulated fills
- [ ] Trailing stop-loss triggers correctly
- [ ] DCA allocates new deposits to underweight assets
- [ ] Telegram sends trade notifications
- [ ] All REST endpoints return correct data
- [ ] Bot auto-reconnects on exchange disconnect
- [ ] Circuit breaker stops trading on daily loss limit

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| CCXT Pro incompatible with Bun | High | Test early in Step 4, fallback to Node.js if needed |
| Exchange rate limiting | Medium | CCXT built-in rate limiter, respect exchange limits |
| WebSocket disconnect during trade | High | Execution guard: check connection before order |
| Slippage on large orders | Medium | Max trade size limit, limit orders with timeout |
| API key leak | Critical | AES-256-GCM encryption, .env gitignored, no withdrawal permission |

## Security Considerations

- API keys encrypted at rest (AES-256-GCM)
- Exchange API keys: trade-only, NO withdrawal
- IP whitelist on exchange API keys
- API key auth on all REST endpoints
- CORS restricted to frontend origin
- Rate limiting via Hono middleware
- Max trade size + daily loss circuit breaker
- Graceful shutdown: complete pending orders before exit
