# System Architecture

**Last Updated**: 2026-03-26
**Version**: 1.0.0
**Project**: Crypto Rebalance Bot
**Status**: Complete (4 phases + advanced strategies)

## Overview

Self-hosted cryptocurrency portfolio rebalance bot with real-time multi-exchange support, advanced trading strategies, and full paper trading capabilities. Event-driven architecture with WebSocket market data, REST API, Telegram notifications, and strategic execution engine.

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Compose Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend (nginx)      Backend (Bun)      MongoDB 7              │
│  ┌──────────────┐     ┌──────────────┐   ┌──────────────┐       │
│  │ React        │     │ Hono API     │   │ Collections  │       │
│  │ Dashboard    │────→│ + WebSocket  │←→ │ • trades     │       │
│  │ Port: 80     │     │ Port: 3001   │   │ • snapshots  │       │
│  └──────────────┘     └──────────────┘   │ • allocations│       │
│         ↑                    ↑             │ + indexes    │       │
│         └────────────┬───────┘             └──────────────┘       │
│                      │                            ↑               │
│                      ↓                            │               │
│  ┌──────────────────────────────────────────────┘               │
│  │              Services Layer                                   │
│  ├─────────────────────────────────────────────────────────────┤
│  │ Exchange Service │ Price Service │ Portfolio │ Rebalancer    │
│  │ (CCXT Pro)       │ (WebSocket)    │ (State)   │ (Strategy)    │
│  │                  │                │           │               │
│  │ Executor │ Analytics │ Notifier │ Scheduler │ Copy Trading   │
│  └─────────────────────────────────────────────────────────────┘
│         ↑
│         │ (Profiles: full)
│  ┌──────────────────────────────────────────────────────────────┐
│  │       Optional: OpenClaw AI + ChromaDB                        │
│  │  ┌────────────┐    ┌──────────────┐   ┌──────────────┐       │
│  │  │ OpenClaw   │    │ MCP Server   │   │ ChromaDB     │       │
│  │  │ AI Agent   │←──→│ (REST wrap)  │   │ (Knowledge)  │       │
│  │  └────────────┘    └──────────────┘   └──────────────┘       │
│  └─────────────────────────────────────────────────────────────┘
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
- **Telegram**: grammy 1.35+ (Bot API wrapper)
- **Scheduler**: croner 9.0+ (Cron jobs)
- **Validation**: Zod 3.24+ (Type-safe schemas)
- **Linter**: Biome 1.9+ (Fast linting)
- **MCP Server**: REST wrapper for Claude/Agent integration
- **AI Framework**: OpenClaw with ChromaDB knowledge base

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
**Responsibility**: Calculate portfolio rebalancing
**Strategy Modes**:
- **Threshold**: Trigger when deviation > threshold (e.g., 5%)
- **Equal-Weight**: Maintain equal allocation across all assets
- **Momentum-Tilt**: Adjust weights based on momentum indicators
- **Vol-Adjusted**: Dynamic weights inversely proportional to volatility

**Key Functions**:
- Monitor allocation drift continuously
- Calculate optimal trade quantities
- Generate rebalance plans
- Estimate total fees
- Trigger executor on approval

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
**Channels**: Telegram via grammy
**Key Notifications**:
- Rebalance alerts
- Trade execution confirmations
- Price threshold breaches
- Daily portfolio summaries
- Error/exception alerts

### 8. Scheduler Service
**Location**: `src/scheduler/`
**Responsibility**: Scheduled task execution
**Key Tasks**:
- DCA order scheduling
- Portfolio snapshot capturing
- OHLCV data collection
- Backtesting runs
- Analytics report generation

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
| `ohlcv_candles` | Historical OHLCV data for backtesting |
| `backtest_results` | Strategy performance test results |
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
- `GET /api/portfolio` - Current holdings and allocations
- `POST /api/rebalance` - Trigger manual rebalance
- `GET /api/trades` - Historical trade records
- `GET /api/allocations` - Target allocations
- `POST /api/allocations/:asset` - Update target
- `GET /api/analytics` - Performance metrics
- `GET /api/backtest/:strategyId/results` - Backtest performance
- `GET /api/status` - System health status

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
| `trade:executed` | Executor | Portfolio, Database, Notifier |
| `strategy:signal` | Strategy Services | Executor, Notifier |
| `alert:threshold` | Price Service | Notifier |

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
- `TELEGRAM_BOT_TOKEN` - Grammy bot token
- `REBALANCE_THRESHOLD` - Drift threshold (e.g., 0.05 = 5%)
- `MIN_TRADE_USD` - Minimum trade value for execution
- `PAPER_TRADING` - Boolean flag for simulation mode
- `VITE_API_URL` - Frontend API URL (set to /api in Docker)

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

**6-Service Stack**:
1. **frontend** (nginx) - React dashboard, port 80
2. **backend** (Bun) - Hono API, port 3001
3. **mongodb** - Data persistence, port 27017
4. **mcp-server** - MCP wrapper for Claude integration (internal)
5. **openclaw** - OpenClaw AI agent (profile: full)
6. **chromadb** - Vector knowledge base (profile: full)

**Startup**: `docker compose up -d` (basic) or `docker compose --profile full up -d` (with AI)

**Memory Allocation**:
- frontend: 128M
- backend: 512M (limit), 128M (reservation)
- mongodb: 512M (limit)
- mcp-server: 256M
- openclaw: 256M (with profile)
- chromadb: 512M (with profile)
- **Total**: ~1.7GB basic, ~2.5GB with AI

**Volumes**:
- `mongodb_data:/data/db` - MongoDB persistence
- `chromadb_data:/chroma/chroma` - Vector DB persistence

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
