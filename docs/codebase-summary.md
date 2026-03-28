# Codebase Summary

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-26 (Docker + MongoDB migration)
**Version**: 1.0.0
**Repository**: https://github.com/dungngo97/rebalance-bot
**License**: MIT

## Overview

Self-hosted cryptocurrency portfolio rebalancing and trading automation bot. Multi-exchange support (Binance, OKX, Bybit) with advanced trading strategies, real-time monitoring, backtesting, and comprehensive analytics.

**Total Codebase**: ~24,500 LOC (10,800 backend + 13,500 frontend + 200 mcp-server)
**Core Files**: 65 backend + 96 frontend = 161 files

## Backend Architecture (~10,800 LOC)

### Core Service Modules (19 modules)

| Module | LOC | Responsibility |
|--------|-----|-----------------|
| api/ | 1,900 | REST API (11 routes + health) + WebSocket server |
| backtesting/ | 1,015 | Historical simulation, metrics calculation |
| rebalancer/ | 920 | Orchestration, drift detection, trend filter, bear triggers |
| analytics/ | 880 | Performance metrics, reporting |
| executor/ | 670 | Order execution (live & paper trading) |
| grid/ | 710 | Grid trading strategy implementation |
| twap-vwap/ | 620 | Smart order routing, slippage reduction |
| exchange/ | 350 | Multi-exchange CCXT Pro abstraction |
| portfolio/ | 385 | Real-time balance, allocation tracking |
| db/ | 420 | Mongoose models + MongoDB connection |
| price/ | 260 | Price aggregation, WebSocket feeds |
| copy-trading/ | 510 | Trade replication from sources |
| ai/ | 380 | ML suggestions (OpenClaw) |
| dca/ | 235 | Dollar-cost averaging |
| notifier/ | 210 | Telegram notifications |
| scheduler/ | 145 | Cron job execution |
| trailing-stop/ | 175 | Stop-loss management |
| config/ | 110 | Environment validation (Zod) |
| events/ | 110 | Typed event bus |

### Directory Structure

```
src/
├── index.ts                 # Application bootstrap
├── api/
│   ├── routes.ts           # REST endpoint definitions
│   ├── ws.ts               # WebSocket handlers
│   └── middleware.ts       # Auth, validation
├── db/
│   ├── models/             # 14 Mongoose schemas
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
│   ├── drift-detector.ts   # Allocation monitoring, bear trigger
│   ├── trend-filter.ts     # MA-based trend detection (BTC closes)
│   ├── rebalance-engine.ts # Trigger routing, cash override logic
│   ├── trade-planner.ts    # Trade optimization
│   └── strategies/         # Strategy implementations
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
**Purpose**: REST wrapper around backend API for Claude/Agent integration

**Tools Exposed**:
- Portfolio tools (get holdings, allocations)
- Trading tools (view trades, execute rebalance)
- Analytics tools (get metrics, backtest results)
- Configuration tools (update settings)
- Health tools (system status)

**Architecture**: Simple Node.js server → HTTP client → Backend Hono API
**Port**: Internal only (routed through Docker network)

## OpenClaw AI & ChromaDB

**Location**: `openclaw-skills/`
**Profile**: `full` (optional Docker profile)

**Components**:
1. **OpenClaw Agent** - LLM-powered assistant with skills
2. **ChromaDB** - Vector database for knowledge retrieval
3. **Skills** (5 total):
   - `allocation-advisor` - Allocation recommendations
   - `auto-rebalance` - Automated rebalancing
   - `crypto-news` - Market news analysis
   - `market-analysis` - Price & trend analysis
   - `portfolio-monitor` - Real-time monitoring

4. **Knowledge Base** (`knowledge/`):
   - API reference documentation
   - Portfolio strategies & guides
   - Risk management best practices

**Environment**:
- `BACKEND_API_URL=http://backend:3001`
- `CHROMADB_URL=http://chromadb:8000`

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
| ohlcv_candles | Historical price data |
| backtest_results | Strategy test results |
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
| Notifications | grammy 1.35+ |
| Frontend | React 18 + Vite |
| UI Library | shadcn/ui + Radix |
| State | React Query v5 |
| Forms | React Hook Form + Zod |
| Validation | Zod 3.24+ |
| Linting | Biome 1.9+ |
| Testing | Bun test runner |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose (6 services) |
| MCP Server | REST wrapper for Claude |
| AI Framework | OpenClaw + ChromaDB |

## Bootstrap Sequence

```
1. Environment validation (Zod)
2. Database connection & schema
3. Exchange connections (CCXT Pro)
4. Executor initialization (live/paper mode)
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

**REST** (11 routes):
- `GET /health` - System health
- `GET /api/portfolio` - Holdings & allocations
- `GET /api/trades` - Trade history
- `POST /api/rebalance` - Trigger rebalance
- `GET /api/allocations` - Target allocations
- `POST /api/allocations/:asset` - Update target
- `GET /api/backtest/:id/results` - Backtest results
- `GET /api/analytics` - Performance metrics
- `POST /api/config` - Update settings

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
**Coverage**: Unit + integration tests
**Files**: `tests/unit/` + `tests/integration/`
**Command**: `bun test` (also supports watch mode)

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

**Target**: Docker on VPS (8GB RAM, Linux)
**Process Manager**: systemd or Docker
**Reverse Proxy**: nginx
**Database**: SQLite (local) or Turso (cloud)
**Configuration**: Environment variables

## Key Files to Know

**Entry Points**:
- `src/index.ts` - Backend bootstrap
- `frontend/src/main.tsx` - React app entry
- `mcp-server/src/index.ts` - MCP server entry
- `openclaw-skills/` - OpenClaw knowledge base
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
| Total LOC | ~24,500 |
| Backend LOC | ~10,800 |
| Frontend LOC | ~13,500 |
| MCP Server LOC | 200 |
| Modules | 19 backend |
| Pages | 16 frontend |
| API Routes | 11 |
| Database Collections | 13 (MongoDB) |
| Mongoose Models | 14 |
| Test Files | 50+ |
| Type Coverage | ~95% |

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
