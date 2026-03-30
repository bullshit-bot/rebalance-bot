# Codebase Summary

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-30 (DCA budget cap, crypto-only allocations, REST price feed, API trigger)
**Version**: 1.0.1
**Repository**: https://github.com/dungngo97/rebalance-bot
**License**: MIT

## Overview

Self-hosted cryptocurrency portfolio rebalancing and trading automation bot. Multi-exchange support (Binance, OKX, Bybit) with advanced trading strategies, real-time monitoring, backtesting, and comprehensive analytics.

**Total Codebase**: ~24,500 LOC (10,800 backend + 13,500 frontend + 200 mcp-server)
**Core Files**: 65 backend + 96 frontend = 161 files

## Backend Architecture (~10,800 LOC)

### Core Service Modules (19 modules + advanced rebalancing)

| Module | LOC | Responsibility |
|--------|-----|-----------------|
| api/ | 1,950 | REST API (14 routes incl. strategy-config) + WebSocket |
| backtesting/ | 1,200 | Simulator, metrics calc, parameter-grid optimizer (4800+ combos) |
| rebalancer/ | 1,100 | Strategy mgr, drift detector, trend filter (MA + cooldown), DCA routing, cash-aware trades |
| analytics/ | 880 | Performance metrics, reporting |
| executor/ | 670 | Order execution via CCXT (real orders, testnet via BINANCE_SANDBOX) |
| grid/ | 710 | Grid trading strategy implementation |
| twap-vwap/ | 620 | Smart order routing, slippage reduction |
| exchange/ | 350 | Multi-exchange CCXT Pro abstraction |
| portfolio/ | 385 | Real-time balance, allocation tracking |
| db/ | 450 | Mongoose models (15 schemas) + MongoDB connection |
| price/ | 260 | Price aggregation, REST polling (10s interval via fetchTicker) |
| copy-trading/ | 510 | Trade replication from sources |
| ai/ | 380 | ML suggestions (GoClaw) |
| dca/ | 280 | Dollar-cost averaging + crypto-only allocation calculator |
| notifier/ | 210 | GoClaw HTTP client for Telegram notifications |
| ai/goclaw-client.ts | 85 | OpenAI-compatible /v1/chat/completions client |
| scheduler/ | 195 | Cron jobs (8 total: periodic rebalance, snapshots, DCA, daily/weekly reports, 12h AI insights) |
| trailing-stop/ | 175 | Stop-loss management |
| config/ | 110 | Environment validation (Zod) |
| events/ | 110 | Typed event bus |

**Advanced Strategies** (6 types implemented):
| Strategy | LOC | Type |
|----------|-----|------|
| threshold | 80 | Fixed deviation trigger |
| equal-weight | 90 | Equal allocation override |
| momentum-tilt | 110 | 50/50 momentum blend |
| vol-adjusted | 120 | Dynamic threshold based on volatility |
| mean-reversion | 140 | Bollinger bands (lookback, sigma, drift) |
| momentum-weighted | 130 | Momentum score allocation weighting |

### Directory Structure

```
src/
├── index.ts                 # Application bootstrap
├── api/
│   ├── routes.ts           # REST endpoint definitions
│   ├── ws.ts               # WebSocket handlers
│   └── middleware.ts       # Auth, validation
├── db/
│   ├── models/             # 15 Mongoose schemas
│   │   ├── allocation-model.ts
│   │   ├── trade-model.ts
│   │   ├── snapshot-model.ts
│   │   ├── rebalance-model.ts
│   │   ├── exchange-config-model.ts
│   │   ├── ohlcv-candle-model.ts
│   │   ├── backtest-result-model.ts
│   │   ├── smart-order-model.ts
│   │   ├── grid-bot-model.ts
│   │   ├── grid-order-model.ts
│   │   ├── ai-suggestion-model.ts
│   │   ├── copy-source-model.ts
│   │   ├── copy-sync-log-model.ts
│   │   └── index.ts
│   ├── connection.ts       # MongoDB connection (Mongoose)
│   ├── database.ts         # Database initialization
│   └── test-helpers.ts     # setupTestDB / teardownTestDB
├── exchange/
│   ├── ccxt-pro.ts         # CCXT integration
│   └── order-executor.ts   # Trade submission
├── portfolio/
│   ├── portfolio-tracker.ts # Balance management
│   └── allocation-calc.ts  # Target calculation
├── rebalancer/
│   ├── strategy-manager.ts         # Central strategy selector, hot-reload from DB config
│   ├── drift-detector.ts           # Allocation monitoring, hard-rebalance trigger, bear routing
│   ├── trend-filter.ts             # MA-based trend (BTC closes), 3-day cooldown, MongoDB persistence
│   ├── trend-filter-service.ts     # (optional) Standalone trend service wrapper
│   ├── rebalance-engine.ts         # Trigger routing, cash-override logic, DCA integration
│   ├── trade-calculator.ts         # Cash-aware trade optimization
│   ├── dca-target-resolver.ts      # Find most-underweight asset for DCA
│   ├── strategies/                 # 6 strategy implementations
│   │   ├── strategy-config-types.ts # Zod types for polymorphic params
│   │   ├── threshold-strategy.ts
│   │   ├── equal-weight-strategy.ts
│   │   ├── momentum-tilt-strategy.ts
│   │   ├── vol-adjusted-strategy.ts
│   │   ├── mean-reversion-strategy.ts
│   │   └── momentum-weighted-strategy.ts
├── executor/
│   ├── executor.ts         # Execution orchestration
│   └── trade-recorder.ts   # Database persistence
├── price/
│   ├── price-service.ts    # Market data processing
│   └── indicators.ts       # Technical indicators
├── strategies/
│   ├── threshold.ts        # Threshold-based
│   ├── momentum.ts         # Momentum-tilt
│   ├── vol-adjusted.ts     # Volatility weighting
│   ├── dca.ts              # Dollar-cost averaging
│   ├── trailing-stop.ts    # Stop-loss
│   ├── grid.ts             # Grid trading
│   ├── twap-vwap.ts        # Order splitting
│   └── copy-trading.ts     # Trade mirroring
├── analytics/
│   ├── metrics.ts          # Return, Sharpe, drawdown
│   └── reporter.ts         # Performance reports
├── backtesting/
│   ├── backtest-engine.ts  # Historical simulation
│   └── metrics-calc.ts     # Strategy validation
├── notifier/
│   └── telegram-bot.ts     # grammy integration
├── scheduler/
│   └── cron-tasks.ts       # croner tasks
├── events/
│   └── event-bus.ts        # TypedEventEmitter
├── ai/
│   └── suggestions.ts      # ML recommendations
└── config/
    └── env.ts              # Zod validation
```

## MCP Server (~200 LOC)

**Location**: `mcp-server/src/`
**Purpose**: SSE-based wrapper around backend API for Claude/Agent integration

**Tools Exposed**:
- Portfolio tools (get holdings, allocations)
- Trading tools (view trades, execute rebalance)
- Analytics tools (get metrics, backtest results)
- Configuration tools (update settings)
- Health tools (system status)

**Architecture**: Node.js server (SSE transport) → HTTP client → Backend Hono API
**Port**: 3100 (internal, accessed via Docker network)
**Transport**: Server-Sent Events (SSE) for long-lived connections

## GoClaw AI Framework

**Location**: `goclaw-skills/`
**Type**: Go-based AI agent with PostgreSQL + vector embeddings

**Components**:
1. **GoClaw Agent** (port 18790)
   - Go-based lightweight runtime
   - Supports skills via workspace directory
   - Vector embeddings via pgvector

2. **goclaw-postgres** - PostgreSQL 18 + pgvector extension
   - Replaces ChromaDB for vector storage
   - Native SQL-based knowledge retrieval
   - Scales better for large datasets

3. **goclaw-ui** (port 8081)
   - Web dashboard for agent management
   - Built-in UI for skill management

4. **Skills** (goclaw-skills/ directory):
   - Skills mounted as bind volume
   - Accessible to GoClaw at `/app/workspace/skills`
   - Examples: allocation-advisor, auto-rebalance, portfolio-monitor

**Environment**:
- `GOCLAW_GATEWAY_TOKEN` - Authentication token
- `GOCLAW_ENCRYPTION_KEY` - Data encryption (32 chars)
- `GOCLAW_POSTGRES_DSN=postgres://goclaw:${GOCLAW_DB_PASSWORD}@goclaw-postgres:5432/goclaw`
- `ANTHROPIC_API_KEY` - Optional Claude API
- `XAI_API_KEY` - xAI Grok model support
- `BACKEND_API_URL=http://backend:3001` - Access to rebalance-bot API

**Advantages over ChromaDB**:
- Lighter memory footprint
- Better security (Go-based, encrypted)
- Native pgvector for embeddings
- Single unified database (PostgreSQL)

## Frontend Architecture (~13,500 LOC)

### Technologies
- **React 18** + TypeScript + Vite
- **TanStack Query v5** - State management
- **React Router v6** - Navigation
- **Tailwind CSS** + shadcn/ui - UI components
- **Recharts** - Data visualization
- **React Hook Form** + Zod - Forms

### Pages (16 total)

| Page | Purpose |
|------|---------|
| Overview | Dashboard, portfolio summary |
| Portfolio | Holdings, allocations, performance |
| RebalancePlan | Strategy details, trade preview |
| Orders | Active orders, order status |
| Allocations | Target allocation management |
| Exchanges | Connected exchange accounts |
| StrategyConfig | Strategy parameter tuning |
| Logs | Trade history, debug logs |
| Alerts | Notification settings |
| Settings | Bot configuration |
| Backtesting | Strategy testing interface |
| Analytics | Performance metrics, charts |
| Tax | Tax reporting integration |
| GridTrading | Grid bot management |
| SmartOrders | TWAP/VWAP order management |
| CopyTrading | Source portfolio tracking |
| AISuggestions | ML recommendations |
| Login | API key authentication |

### Component Organization

**Custom Components**: 6 (StatCard, DriftBadge, ActionBadge, etc.)
**shadcn/ui Components**: 59 (Button, Card, Dialog, Form, etc.)
**Design System**: ui-brutal.tsx (custom styled components)

### API Integration

**API Client**: `lib/api.ts` with 14 React Query hooks:
- `usePortfolio()` - Current holdings
- `useTrades()` - Trade history
- `useAllocations()` - Target allocations
- `useRebalance()` - Trigger rebalance
- `useBacktest()` - Run backtest
- `useAnalytics()` - Performance metrics
- Plus 8 more for specific strategies

**Authentication**: X-API-Key header, validated via `/health`
**Auto-refresh**: 30s polling interval

## Database Schema

**MongoDB 7 with Mongoose ODM**

| Collection | Purpose |
|----------|---------|
| allocations | Target portfolio allocations |
| snapshots | Point-in-time portfolio states |
| trades | Individual trade records |
| rebalances | Rebalance execution logs |
| exchange_configs | Encrypted API credentials |
| ohlcv_candles | Historical price data + trend filter persistence |
| backtest_results | Strategy test results |
| strategy_configs | Strategy config (polymorphic params, active/inactive, hot-reload) |
| smart_orders | TWAP/VWAP split tracking |
| grid_bots | Grid trading configurations |
| grid_orders | Individual grid orders |
| ai_suggestions | ML model recommendations |
| copy_sources | Source portfolios |
| copy_sync_log | Copy trading history |

**Models Location**: `src/db/models/` (14 schema files)
**Connection**: `src/db/connection.ts` (Mongoose connection with Docker Compose)
**Environment**: `MONGODB_URI=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/rebalance?authSource=admin`
**Indexes**: Exchange, timestamps, asset pairs for efficient querying
**Encryption**: API credentials encrypted via `src/exchange/api-key-crypto.ts`

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2+ |
| Language | TypeScript 5.7+ (strict) |
| Backend API | Hono v4 |
| Database | Mongoose ODM + MongoDB 7 |
| Exchange API | CCXT Pro 4.4.0 |
| Scheduler | Croner 9.0+ |
| Notifications | GoClaw HTTP client (via /v1/chat/completions) |
| Frontend | React 18 + Vite |
| UI Library | shadcn/ui + Radix |
| State | React Query v5 |
| Forms | React Hook Form + Zod |
| Validation | Zod 3.24+ |
| Linting | Biome 1.9+ |
| Testing | Bun test runner |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose (8 services) |
| MCP Server | SSE-based wrapper for Claude (port 3100) |
| AI Framework | GoClaw (Go) + PostgreSQL with pgvector |

## Bootstrap Sequence

```
1. Environment validation (Zod)
2. Database connection & schema
3. Exchange connections (CCXT Pro)
4. Executor initialization (OrderExecutor — testnet if BINANCE_SANDBOX=true)
5. Price WebSocket subscription
6. Portfolio service startup
7. Drift detector activation
8. Rebalancer engine ready
9. Strategy modules loaded
10. Scheduler jobs registered
11. HTTP server (Hono) startup
12. WebSocket server ready
13. Telegram notifier connected
```

## Execution Flow

```
Exchange WS (CCXT Pro)
    ↓
Price Service (market data)
    ↓
EventBus (publish price:update)
    ↓
Portfolio Service (recalculate allocations)
    ↓
Drift Detector (check thresholds)
    ↓ [if drift > threshold]
Rebalancer (calculate optimal trades)
    ↓ [if approved]
Executor (submit orders)
    ↓
Database (persist trades)
    ↓
EventBus (publish trade:executed)
    ↓
Telegram Notifier (alert user)
WebSocket API (update frontend)
```

## API Endpoints

**REST** (15 routes + config):
- `GET /health` - System health
- `GET /api/portfolio` - Holdings & allocations
- `GET /api/trades` - Trade history
- `POST /api/rebalance` - Trigger rebalance
- `GET /api/allocations` - Target allocations
- `POST /api/allocations/:asset` - Update target
- `POST /api/dca/trigger` - Manual DCA trigger (returns orders)
- `GET /api/backtest/:id/results` - Backtest results
- `GET /api/analytics` - Performance metrics
- `POST /api/config` - Update settings
- `GET /api/strategy-config/active` - Current active strategy
- `POST /api/strategy-config` - Create new config
- `PUT /api/strategy-config/:id` - Update config
- `DELETE /api/strategy-config/:id` - Delete config
- `PUT /api/strategy-config/:id/activate` - Activate config (hot-reload)

**WebSocket** (`/ws`):
- `portfolio:update` - Holdings changed
- `trade:executed` - Order filled
- `price:update` - Price tick
- `rebalance:status` - Progress update

## Event System

**TypedEventEmitter** for loose coupling:

| Event | Emitter | Listeners |
|-------|---------|-----------|
| `price:update` | Price Service | Rebalancer, UI, Backtesting |
| `portfolio:snapshot` | Portfolio | Analytics, Database |
| `rebalance:triggered` | Rebalancer | Executor, Notifier |
| `trade:executed` | Executor | Portfolio, Database, Notifier |
| `strategy:signal` | Strategies | Executor, Notifier |

## Testing

**Test Framework**: Bun test runner
**Coverage**: Unit + integration + isolated tests (80%+ target)
**Test Types**:
- Unit tests: `.test.ts` (strategy logic, calculators, helpers)
- Integration tests: `.integration.test.ts` (with DB, event bus)
- Isolated tests: `.isolated.test.ts` (no external dependencies)

**Recent Additions** (Phase 1 + Recent):
- 62 strategy tests (all 6 strategy types)
- 10 trend filter tests (bull/bear detection, cooldown, persistence)
- 8 DCA resolver tests
- Configuration API integration tests
- GoClaw HTTP client (goclaw-client.ts) for Telegram delivery
- Portfolio tracker filter: non-target assets (DAI/USD) now excluded
- Scheduled DCA: Configurable amount (`dcaAmountUsd`, default $20, range $1-$100k) at 07:00 VN into most underweight asset
- DCA crypto-only: Target allocations (BTC 40%, ETH 25%, SOL 20%, BNB 15%) exclude stablecoins from denominator
- Manual DCA trigger: `POST /api/dca/trigger` endpoint for on-demand execution
- DCA budget cap: Rebalance engine caps trades to `dcaAmountUsd` when `dcaRebalanceEnabled=true`
- Price feed: REST polling (10s interval via fetchTicker) replaces WebSocket (Bun runtime limitation)
- Unified stablecoin set: USDT, USDC, BUSD, TUSD, DAI, USD exported from trade-calculator.ts
- Backend seed script with optimal config (threshold 8%, MA 110, bear cash 100%, cooldown 1d)

**Command**: `bun test` (also supports watch mode)
**Coverage Report**: `bun test --coverage`

## Development Standards

**Language**: TypeScript strict mode (no `any`)
**Naming**: kebab-case files, camelCase vars, PascalCase types
**Formatting**: 2-space indents (Biome enforced)
**Comments**: Explain WHY, not WHAT
**Testing**: >80% code coverage target
**Commits**: Conventional commits (feat, fix, refactor, test, docs)

## Performance Characteristics

**Rebalance Execution**:
- Portfolio fetch: 100-500ms per exchange
- Calculation: 50-100ms
- Order placement: 500ms-2s per exchange
- Total cycle: 1-5 seconds

**Memory**: ~300-400MB (Bun + 3 exchanges)
**Database**: SQLite handles 5+ years of data efficiently

## Security Model

**Credentials**: Encrypted at rest, decrypted only for API calls
**Input Validation**: Zod schemas on all API inputs
**Type Safety**: TypeScript strict mode, no `any` types
**SQL Injection**: Drizzle ORM prevents via parameterized queries
**Logging**: No secrets in logs, masked API keys

## Deployment

**Target**: Docker on VPS (8GB+ RAM, Linux)
**Container Orchestration**: Docker Compose (8 services)
**Reverse Proxy**: nginx (optional, for TLS)
**Databases**: MongoDB (trades) + PostgreSQL (GoClaw)
**Configuration**: Environment variables (.env)
**Auto-healing**: autoheal service monitors and restarts unhealthy containers

## Key Files to Know

**Entry Points**:
- `src/index.ts` - Backend bootstrap
- `frontend/src/main.tsx` - React app entry
- `mcp-server/src/index.ts` - MCP server entry
- `goclaw-skills/` - GoClaw knowledge base
- `docker-compose.yml` - 6-service orchestration

**Configuration**:
- `.env.example` - Template env vars
- `tsconfig.json` - TypeScript config
- `biome.json` - Linting/formatting
- `docker-compose.yml` - Service definitions

**Documentation**:
- `docs/project-overview-pdr.md` - PDR & requirements
- `docs/code-standards.md` - Development standards
- `docs/system-architecture.md` - Architecture details
- `docs/deployment-guide.md` - Docker deployment
- `docs/codebase-summary.md` - This file
- `CLAUDE.md` - Development instructions

## Dependencies Overview

**Production** (15):
- bun, ccxt, hono, drizzle-orm, @libsql/client
- grammy, croner, zod, react, react-router-dom
- @tanstack/react-query, recharts, react-hook-form
- tailwindcss, @radix-ui/*, shadcn/ui

**Dev** (5):
- typescript, @biomejs/biome, drizzle-kit, bun

## Codebase Metrics

| Metric | Value |
|--------|-------|
| Total LOC | ~26,000 |
| Backend LOC | ~11,500 |
| Frontend LOC | ~13,500 |
| MCP Server LOC | 200 |
| Modules | 19 backend + 6 strategies |
| Pages | 16 frontend |
| API Routes | 14 (incl. strategy config) |
| Database Collections | 15 (MongoDB) |
| Mongoose Models | 15 |
| Test Files | 70+ (62 strategy tests + 10 trend filter) |
| Type Coverage | ~95% |
| Docker Services | 8 (frontend, backend, mongodb, mcp-server, goclaw, goclaw-ui, goclaw-postgres, autoheal) |
| Backtest Combinations | 4800+ (grid search optimizer) |

## Project Status

**Phase**: Production (4 phases complete)
**Stability**: Stable
**Maintenance**: Active
**Breaking Changes**: None (v1.0 stable)

Phases completed:
1. Core rebalancing
2. Real-time monitoring
3. Strategy variants
4. Advanced strategies + analytics

## Unresolved Questions

1. Support high-frequency trading (sub-second execution)?
2. Cross-exchange arbitrage automation?
3. Multi-currency portfolio support?
4. Tax reporting integration?
5. Mobile app via Telegram Mini-App?
