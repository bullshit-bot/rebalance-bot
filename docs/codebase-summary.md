# Codebase Summary

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-26
**Version**: 1.0.0
**Repository**: https://github.com/dungngo97/rebalance-bot
**License**: MIT

## Overview

Self-hosted cryptocurrency portfolio rebalancing and trading automation bot. Multi-exchange support (Binance, OKX, Bybit) with advanced trading strategies, real-time monitoring, backtesting, and comprehensive analytics.

**Total Codebase**: ~24,000 LOC (10,554 backend + 13,500 frontend)
**Core Files**: 65 backend + 96 frontend = 161 files

## Backend Architecture (~10,554 LOC)

### Core Service Modules (19 modules)

| Module | LOC | Responsibility |
|--------|-----|-----------------|
| api/ | 1,795 | REST API (11 routes) + WebSocket server |
| backtesting/ | 978 | Historical simulation, metrics calculation |
| rebalancer/ | 773 | Rebalance orchestration, strategy execution |
| analytics/ | 851 | Performance metrics, reporting |
| executor/ | 641 | Order execution (live & paper trading) |
| grid/ | 678 | Grid trading strategy implementation |
| twap-vwap/ | 592 | Smart order routing, slippage reduction |
| exchange/ | 339 | Multi-exchange CCXT Pro abstraction |
| portfolio/ | 370 | Real-time balance, allocation tracking |
| db/ | 372 | Database schema (Drizzle ORM) |
| price/ | 246 | Price aggregation, WebSocket feeds |
| copy-trading/ | 485 | Trade replication from sources |
| ai/ | 351 | ML suggestions (OpenClaw) |
| dca/ | 220 | Dollar-cost averaging |
| notifier/ | 196 | Telegram notifications |
| scheduler/ | 134 | Cron job execution |
| trailing-stop/ | 160 | Stop-loss management |
| config/ | 101 | Environment validation (Zod) |
| events/ | 100 | Typed event bus |

### Directory Structure

```
src/
├── index.ts                 # Application bootstrap
├── api/
│   ├── routes.ts           # REST endpoint definitions
│   ├── ws.ts               # WebSocket handlers
│   └── middleware.ts       # Auth, validation
├── db/
│   ├── schema.ts           # 8 tables (Drizzle ORM)
│   └── database.ts         # Connection initialization
├── exchange/
│   ├── ccxt-pro.ts         # CCXT integration
│   └── order-executor.ts   # Trade submission
├── portfolio/
│   ├── portfolio-tracker.ts # Balance management
│   └── allocation-calc.ts  # Target calculation
├── rebalancer/
│   ├── drift-detector.ts   # Allocation monitoring
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

**SQLite with Drizzle ORM**

| Table | Purpose |
|-------|---------|
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

**Indexes**: Exchange, timestamps, asset pairs for efficient querying
**Encryption**: API credentials encrypted at rest

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.2+ |
| Language | TypeScript 5.7+ (strict) |
| Backend API | Hono v4 |
| Database | Drizzle ORM + libSQL |
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
| Deployment | Docker + nginx + systemd |

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
- `src/index.ts` - Application bootstrap
- `frontend/src/main.tsx` - React app entry
- `docker-compose.yml` - Container orchestration

**Configuration**:
- `.env.example` - Template env vars
- `tsconfig.json` - TypeScript config
- `biome.json` - Linting/formatting

**Documentation**:
- `docs/project-overview-pdr.md` - PDR
- `docs/code-standards.md` - Development standards
- `docs/system-architecture.md` - Architecture details
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
| Total LOC | ~24,000 |
| Backend LOC | ~10,554 |
| Frontend LOC | ~13,500 |
| Modules | 19 backend |
| Pages | 16 frontend |
| API Routes | 11 |
| Database Tables | 13 |
| Test Files | 20+ |
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
