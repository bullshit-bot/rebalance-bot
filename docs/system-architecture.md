# System Architecture

**Last Updated**: 2026-03-29
**Version**: 1.0.1
**Project**: Crypto Rebalance Bot
**Status**: Complete (4 phases + advanced strategies)

## Overview

Self-hosted cryptocurrency portfolio rebalance bot with real-time multi-exchange support, advanced trading strategies, and full paper trading capabilities. Event-driven architecture with WebSocket market data, REST API, Telegram notifications, and strategic execution engine.

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       Docker Compose Stack                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Frontend (nginx)   Backend (Bun)   MongoDB 7    MCP Server      │
│  ┌──────────────┐  ┌──────────────┐ ┌──────────┐ ┌────────────┐ │
│  │ React        │  │ Hono API     │ │Collections│ │ MCP (SSE)  │ │
│  │ Dashboard    │→ │ + WebSocket  │←│ • trades │ │ Port: 3100 │ │
│  │ Port: 3000   │  │ Port: 3001   │ │ • trades │ └────────────┘ │
│  └──────────────┘  └──────────────┘ └──────────┘        ↑        │
│         ↑                  ↑                             │        │
│         └────────────┬─────┘                            │        │
│                      │                                  │        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Services Layer                              │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Exchange │ Price Service │ Portfolio │ Rebalancer         │  │
│  │ (CCXT)   │ (WebSocket)    │ (State)   │ (Strategy)         │  │
│  │          │                │           │                    │  │
│  │ Executor │ Analytics │ Notifier │ Scheduler │ Copy Trading │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ↑
│         │
│  ┌──────────────────────────────────────────────────────────────┐
│  │    GoClaw AI + PostgreSQL + Vector Store                    │
│  │  ┌────────────────────┐  ┌──────────────────┐               │
│  │  │ GoClaw Agent       │  │ goclaw-postgres  │               │
│  │  │ (Go-based)         │  │ (PostgreSQL +    │               │
│  │  │ Port: 18790        │←→│  pgvector)       │               │
│  │  │ Skills: /skills/   │  │                  │               │
│  │  └────────────────────┘  └──────────────────┘               │
│  │                                                               │
│  │  ┌─────────────────────────────────────────────────────┐   │
│  │  │ GoClaw UI Dashboard (goclaw-web)                    │   │
│  │  │ Port: 8081                                           │   │
│  │  └─────────────────────────────────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────┘
│
│  + autoheal (container auto-restart on failure)
│
│  Exchange WS Feed (Binance/OKX/Bybit)
│         ↓
│  Price Service processes OHLCV
│         ↓
│  EventBus broadcasts price:update
│         ↓
│  Rebalancer analyzes + triggers executor
│         ↓
│  Trades persisted to MongoDB
│         ↓
│  WebSocket notifies frontend / Telegram alerts
└─────────────────────────────────────────────────────────────────┘
```

## Core Tech Stack

- **Runtime**: Bun 1.2+ (JavaScript runtime)
- **Language**: TypeScript 5.7+ (strict mode)
- **API**: Hono v4 (lightweight, type-safe HTTP)
- **Database**: Mongoose ODM + MongoDB 7 (NoSQL, encrypted credentials)
- **Exchange**: CCXT Pro 4.4.0 (100+ exchange support)
- **Notifications**: GoClaw HTTP client (Telegram via GoClaw AI agent)
- **Scheduler**: croner 9.0+ (Cron jobs)
- **Validation**: Zod 3.24+ (Type-safe schemas)
- **Linter**: Biome 1.9+ (Fast linting)
- **MCP Server**: SSE-based wrapper for Claude/Agent integration (port 3100)
- **AI Framework**: GoClaw (Go) + PostgreSQL with pgvector

## Service Modules

### 1. Exchange Service
**Location**: `src/exchange/`
**Responsibility**: Multi-exchange connectivity layer
**Key Functions**:
- Real-time WebSocket connections (CCXT Pro)
- Unified order API (buy/sell/cancel) across Binance, OKX, Bybit
- Market data aggregation
- Automatic reconnection and rate limiting
- Paper trading simulation

**Dependencies**: CCXT Pro, EventEmitter2

### 2. Price Service
**Location**: `src/price/`
**Responsibility**: Real-time market data processing
**Key Functions**:
- Maintain orderbook snapshots
- Calculate technical indicators (VWAP, TWAP, momentum, volatility)
- Broadcast price updates to EventBus
- Handle WebSocket feed reconnections
- Support for multiple data streams

### 3. Portfolio Service
**Location**: `src/portfolio/`
**Responsibility**: Portfolio state management
**Key Functions**:
- Fetch current holdings from exchanges
- Calculate total USD value
- Track asset allocations (actual vs target)
- Generate snapshots before/after rebalances
- Detect allocation drift

### 4. Rebalancer Service
**Location**: `src/rebalancer/`
**Responsibility**: Calculate portfolio rebalancing with strategy orchestration
**Strategy Modes** (6 types via StrategyManager):
- **Threshold**: Trigger when deviation > threshold (e.g., 5%)
- **Equal-Weight**: Maintain equal allocation across all assets
- **Momentum-Tilt**: Adjust weights based on momentum indicators (50/50 blend with base)
- **Vol-Adjusted**: Dynamic thresholds inversely proportional to volatility
- **Mean-Reversion**: Bollinger band-based rebalancing (lookback days, band width, drift trigger)
- **Momentum-Weighted**: Momentum scores weighted into allocations with threshold drift check

**Key Sub-modules**:
- **StrategyManager** (`src/rebalancer/strategy-manager.ts`): Central strategy selector with hot-reload from DB config (strategy:config-changed event), loads active config on startup
- **DriftDetector** (`src/rebalancer/drift-detector.ts`): Allocation monitoring, hard-rebalance threshold support, bear trigger routing
- **TrendFilter** (`src/rebalancer/trend-filter.ts`): MA-based trend detection (BTC daily closes, default MA100), mongo persistence for restart resilience, 3-day cooldown to prevent whipsaw
- **TradeCalculator** (`src/rebalancer/trade-calculator.ts`): Cash-aware trade optimization (skips cash if reserve is active), handles DCA routing
- **DCATargetResolver** (`src/rebalancer/dca-target-resolver.ts`): Finds most-underweight asset for DCA concentration

**Trading Flow**:
1. Price update → Portfolio recalculation
2. Drift detector checks allocation deviation + trend status
3. If drift > threshold: Strategy manager calculates effective target allocations
4. Trade calculator applies cash-aware logic + DCA routing
5. Executor submits orders
6. Database persists trades + snapshots

**Trend Filter Behavior**:
- Tracks BTC daily closes in rolling 400-day window
- Emits `trend:changed` event on bull↔bear flip (with 3-day cooldown)
- If bearish: auto-override allocations to configured cash % (default: 70%, configurable via `bearCashPct`)
- Provides read-only query API (`isBullishReadOnly()`) for healthchecks

**Cash-Aware DCA** (Scheduled Daily):
- Reserve 0-100% cash during normal/bear markets (configurable via strategy config, optimal: 100%)
- New capital directed to most underweight asset (via DCATargetResolver)
- Daily scheduled DCA: $20 at 07:00 VN into most underweight asset
- Hard rebalance threshold for traditional drift-based trades (default not set)

### 5. Executor Service
**Location**: `src/executor/`
**Responsibility**: Execute approved trades
**Key Functions**:
- Send orders to exchanges
- Track order status (pending/filled/failed)
- Handle partial fills and cancellations
- Collect fees and execution prices
- Log trades to database
- Support paper trading mode

### 6. Advanced Strategies (Phase 4+)

**Trailing-Stop** (`src/trailing-stop/`):
- Monitor positions for stop-loss triggers
- Automatic sell when price drops by %

**DCA** (`src/dca/`):
- Schedule regular buy orders at fixed intervals
- Accumulate positions over time

**TWAP/VWAP** (`src/twap-vwap/`):
- Break large orders into smaller chunks
- Execute over time to minimize slippage

**Grid Trading** (`src/grid/`):
- Place buy/sell orders at regular price intervals
- Capture micro-movements in range-bound markets

**Copy Trading** (`src/copy-trading/`):
- Mirror trades from other portfolios
- Track copied strategy performance

**Backtesting** (`src/backtesting/`):
- Historical performance validation
- Compare strategies with Sharpe ratio, max drawdown

**Analytics** (`src/analytics/`):
- Portfolio performance metrics
- Return, volatility, Sharpe ratio, win rate

**AI Suggestions** (`src/ai/`):
- ML-based rebalance timing predictions
- Anomaly detection for price movements

### 7. Notifier Service
**Location**: `src/notifier/`
**Responsibility**: User notifications
**Channels**: Telegram via GoClaw HTTP client
**Key Notifications**:
- Rebalance alerts
- Trade execution confirmations
- Trailing stop triggers
- Daily portfolio summaries (01:00 UTC / 08:00 VN)
- Weekly performance reports (Sunday 01:00 UTC / 08:00 VN)
- AI insights (every 12h at 07:00 + 19:00 UTC / 14:00 + 02:00 VN)
- Error/exception alerts
- Trend changes (bull/bear transitions)

**GoClaw Integration**:
- Backend sends event context as prompts to GoClaw `/v1/chat/completions`
- GoClaw formats messages in Vietnamese and sends via its Telegram integration
- 30-minute throttle per event type to prevent spam
- Supports MCP tools for enriched context (portfolio analysis, trade lookup)

### 8. Scheduler Service
**Location**: `src/scheduler/`
**Responsibility**: Scheduled task execution via cron jobs
**Key Tasks**:
- Every 4h: Emit periodic rebalance trigger
- Every 5m: Persist portfolio snapshot to database
- Every 60s: Clear stale price cache entries
- Every 4h: Sync copy trading sources
- Daily 01:00 UTC (08:00 VN): Send daily portfolio digest via GoClaw
- Sunday 01:00 UTC (08:00 VN): Send weekly performance report via GoClaw
- Daily 00:00 UTC (07:00 VN): Execute scheduled DCA buy into most underweight asset
- Every 12h (07:00 + 19:00 UTC): GoClaw AI market insights analysis and Telegram delivery

**Technology**: croner (cron scheduler)

## Database Schema

**Location**: `src/db/models/` (Mongoose ODM + MongoDB 7)
**Connection**: `src/db/connection.ts` (managed via Docker Compose)
**Env Var**: `MONGODB_URI=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/rebalance?authSource=admin`

| Collection | Purpose |
|-----------|---------|
| `allocations` | Target portfolio allocations per asset |
| `snapshots` | Point-in-time portfolio states (before/after rebalance) |
| `trades` | Individual trade records with fees and prices |
| `rebalances` | Rebalance lifecycle (pending → executing → completed) |
| `exchange_configs` | Encrypted exchange API credentials |
| `ohlcv_candles` | Historical OHLCV data for backtesting + trend filter persistence |
| `backtest_results` | Strategy performance test results |
| `strategy_configs` | Strategy configuration (polymorphic params, active/inactive, hot-reload) |
| `smart_orders` | TWAP/VWAP order splitting records |
| `grid_bots` | Grid trading bot configurations |
| `grid_orders` | Individual grid orders |
| `ai_suggestions` | ML model recommendations |
| `copy_sources` | Source portfolios for copy trading |
| `copy_sync_log` | Copy trading synchronization history |

**Key Files**:
- `src/db/connection.ts` - MongoDB connection with Mongoose
- `src/db/models/` - 14 Mongoose schema definitions
- `src/db/test-helpers.ts` - setupTestDB/teardownTestDB utilities

## API Endpoints

### REST API (Hono)
**Portfolio & Trading**:
- `GET /api/portfolio` - Current holdings and allocations
- `POST /api/rebalance` - Trigger manual rebalance
- `GET /api/trades` - Historical trade records
- `GET /api/allocations` - Target allocations
- `POST /api/allocations/:asset` - Update target

**Strategy Configuration** (new):
- `GET /api/strategy-config/active` - Current active strategy config
- `POST /api/strategy-config` - Create new strategy config
- `PUT /api/strategy-config/:id` - Update existing config
- `DELETE /api/strategy-config/:id` - Delete config
- `PUT /api/strategy-config/:id/activate` - Set as active (triggers hot-reload)

**Analytics & Backtesting**:
- `GET /api/analytics` - Performance metrics
- `GET /api/backtest/:strategyId/results` - Backtest performance
- `POST /api/backtest/optimizer` - Run grid-search optimizer (4800+ combinations)

**System**:
- `GET /api/health` - System health (uptime, memory, version, trend status, last price update)

### WebSocket API
**URL**: `ws://localhost:3000/ws`
**Messages**:
- Portfolio value updates
- Trade execution notifications
- Price updates for monitored pairs
- Rebalance progress events

## Event Bus

**Location**: `src/events/`
**Technology**: EventEmitter2 (async event handling)

| Event | Emitter | Listeners |
|-------|---------|-----------|
| `price:update` | Price Service | Rebalancer, UI, Backtesting |
| `portfolio:snapshot` | Portfolio Service | Database, Analytics |
| `rebalance:triggered` | Rebalancer | Executor, Notifier |
| `rebalance:trigger` | Drift Detector | Rebalancer (for `trend-filter-bear` routing) |
| `trade:executed` | Executor | Portfolio, Database, Notifier |
| `strategy:signal` | Strategy Services | Executor, Notifier |
| `strategy:config-changed` | API (config POST) | Strategy Manager (hot-reload) |
| `alert:threshold` | Price Service | Notifier |
| `trend:changed` | Trend Filter | Notifier (Telegram alerts), DriftDetector |
| `trend-filter-bear` | Drift Detector | Rebalancer (special bear-protection routing) |

## Data Flow

```
1. WebSocket Feed (CCXT Pro)
   ↓
2. Price Service processes OHLCV
   ↓
3. EventBus broadcasts price:update
   ↓
4. Rebalancer analyzes portfolio
   ↓
5. If drift detected → rebalance:triggered event
   ↓
6. Executor places orders
   ↓
7. trade:executed event
   ↓
8. Database persists trade
   ↓
9. Portfolio Service recalculates
   ↓
10. WebSocket notifies frontend
    Telegram notifies user
```

## Configuration

**Location**: `src/config/`
**Environment Variables**:
- `MONGODB_URI` - MongoDB connection (set by Docker Compose)
- `MONGO_PASSWORD` - MongoDB root password
- `GOCLAW_URL` - GoClaw HTTP endpoint (default: http://goclaw:18790)
- `GOCLAW_GATEWAY_TOKEN` - GoClaw authentication token
- `REBALANCE_THRESHOLD` - Drift threshold (e.g., 0.05 = 5%)
- `MIN_TRADE_USD` - Minimum trade value for execution
- `PAPER_TRADING` - Boolean flag for simulation mode
- `VITE_API_URL` - Frontend API URL (set to /api in Docker)

**Strategy Configuration** (via database-driven config, hot-reload):
- Strategy type: `threshold`, `equal-weight`, `momentum-tilt`, `vol-adjusted`, `mean-reversion`, `momentum-weighted`
- Strategy-specific params: thresholdPct, bandWidthSigma, lookbackDays, etc. (type-safe via Zod)
- `cashReservePct` - Hold 0-100% cash for DCA, deposits to most-underweight asset (default: 0%, optimal: 100%)
- `dcaRebalanceEnabled` - Route rebalance sells through DCA instead of immediate execution (default: false)
- `hardRebalanceThreshold` - High-drift hard rebalance trigger (e.g., 20%, default: not set)
- `trendFilterEnabled` - Enable MA-based trend filter (bool)
- `trendFilterMA` - MA period for bull/bear detection (default: 110 days, optimal from grid search)
- `trendFilterBuffer` - % buffer below MA still treated as bull (default: 2%)
- `trendFilterCooldown` - Days between bear/bull flips to prevent whipsaw (default: 1 day, optimal from search)
- `bearCashPct` - Cash override % when trend turns bearish (default: 70%, optimal: 100%)

## Security Model

**Credential Storage**:
- All exchange API keys encrypted at rest
- Encrypted values stored in MongoDB `exchange_configs` collection
- Decryption only on order execution
- Never logged or exposed in API responses

**Input Validation**:
- Zod schemas for all API inputs
- Type checking enforced by TypeScript (strict mode)
- Sanitized outputs for JSON responses

**Database**:
- MongoDB 7 with Mongoose ODM for type safety
- No SQL injection (uses query builders, not concatenation)
- Transaction support via MongoDB sessions
- Indexes on frequently queried fields

## Deployment

**Target Environment**: Docker Compose on VPS (8GB RAM)

**8-Service Stack**:
1. **frontend** (nginx) - React dashboard, port 3000
2. **backend** (Bun) - Hono API, port 3001 (internal)
3. **mongodb** - Data persistence, port 27017 (internal)
4. **mcp-server** - MCP wrapper (SSE mode), port 3100 (internal)
5. **goclaw** - GoClaw AI agent (Go-based), port 18790
6. **goclaw-ui** - GoClaw dashboard, port 8081
7. **goclaw-postgres** - PostgreSQL + pgvector, port 5432 (internal)
8. **autoheal** - Auto-restart unhealthy containers

**Startup**: `docker compose up -d` (includes all services by default)

**Memory Allocation**:
- frontend: 128M
- backend: 512M (limit), 128M (reservation)
- mongodb: 512M (limit)
- mcp-server: 256M
- goclaw: 1G (limit)
- goclaw-ui: 128M (limit)
- goclaw-postgres: 256M (limit)
- autoheal: 32M (limit)
- **Total**: ~3.7GB

**Volumes**:
- `mongodb_data:/data/db` - MongoDB persistence
- `goclaw_data:/app/data` - GoClaw workspace data
- `goclaw_postgres_data:/var/lib/postgresql` - PostgreSQL persistence
- `./goclaw-skills:/app/workspace/skills` - Bind mount for skills

## Performance Characteristics

**Rebalance Execution Time**:
- Portfolio fetch: 100-500ms per exchange
- Calculation: 50-100ms
- Order placement: 500ms-2s per exchange
- Total: 1-5s for typical 3-exchange rebalance

**Trade Latency**:
- Price update: <100ms (WebSocket)
- Signal generation: <50ms
- Order execution: 500ms-2s

**Data Retention**:
- Trades: 5+ years (performance analysis)
- Snapshots: 1+ year (historical comparison)
- OHLCV candles: 3+ years (backtesting)

## Module Dependencies

```
frontend/
  ↓ (HTTP/WebSocket)
api/
  ↓
exchange/ ← events/ ← price/
  ↓           ↑
portfolio/    ↓
  ↓      rebalancer/ ← [strategies]
db/           ↓
  ↓       executor/
database.ts   ↓
         notifier/
         scheduler/
```

## Unresolved Questions

1. **High-frequency trading**: Support sub-second execution latency?
2. **Cross-exchange arbitrage**: Implement automatic spread capturing?
3. **Multi-currency portfolios**: Support non-USD base currencies?
4. **Risk management**: Add position sizing limits or portfolio leverage caps?
5. **Tax reporting**: Integrate with tax software APIs?
