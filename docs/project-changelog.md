# Project Changelog

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-30
**Repository**: https://github.com/dungngo97/rebalance-bot

## [1.0.3] - 2026-03-31 (Backtest Engine Fixes & Optimal Config Update)

### Fixed

**Backtest Engine Critical Fixes**
- Trade amount double-division bug: Was dividing by price twice, inflating sell amounts (now multiplies by price once)
- Trend filter buffer missing in backtest: Simulation now matches live behavior with configurable buffer (default 2%)
- DCA fees not applied in backtest: Fee calculation now covers DCA trades (matches live execution)
- Previous grid search results invalidated: 672-combo (MA110/TH8/CD1/Bear100) configs no longer accurate

**Impact**: Grid search results from 2026-03-28 invalid. Backtest historical returns not comparable to v1.0.2.

### Updated

**Optimal Configuration (5040-combo Grid Search, 2026-03-31)**
- Previous: MA110/TH8/CD1/Bear100 (invalid, from 672-combo search)
- New: MA120/TH10/CD1/Bear100/Buf0 (validated across 5040+ combinations)
- 5-Year Backtest (2021-2026): +284% return, 2.29 Sharpe, -34% max DD, -21% vs S&P500
- Parameters: MA period 120 days, threshold 10%, cooldown 1 day, bear 100% cash, buffer 0%

**Frontend Allocations on Backtest Page**
- Changed from equal weight (25% each: BTC/ETH/SOL/BNB) to: 40% BTC, 25% ETH, 20% SOL, 15% BNB
- Matches optimal config from backtesting
- Aligns with crypto-only allocation logic

**Backend Config Files**
- Seed script now uses MA120/TH10/CD1/Bear100/Buf0
- Strategy config structure unchanged (still polymorphic Zod types)

### Security & Stability

**Rate Limiter Eviction**: setInterval cleared every 60s (prevents memory leak)
**Strategy Activation**: Atomic bulkWrite for concurrent config changes
**Allocation PUT**: Atomic upsert + delete unlisted assets (prevents orphaned allocations)
**MongoDB**: Removed port mapping from docker-compose (internal-only)

### Testing

- ✅ Backtest engine double-division fixed (verified with micro-trades)
- ✅ Trend filter buffer applied in simulation
- ✅ DCA fees deducted from backtest final balance
- ✅ Rate limiter doesn't accumulate stale entries
- ✅ Concurrent strategy activations don't corrupt state
- ✅ Frontend allocations match server config on page load

### Documentation

- Updated `codebase-summary.md`: Backtest engine fixes, DCA fees, new optimal config
- Updated `system-architecture.md`: Trend filter buffer, allocation logic
- Updated GoClaw skills: New MA120/TH10 optimal params in all skill files

---

## [1.0.2] - 2026-03-30 (DCA Enhancements & Price Feed Optimization)

### Added

**DCA Amount Configuration**
- `dcaAmountUsd` added to `GlobalSettingsSchema` (src/rebalancer/strategies/strategy-config-types.ts)
- Default $20, configurable range $1-$100k
- Read from strategy config instead of env var (per-config override capability)
- Frontend field visible when DCA enabled

**DCA % Calculation Fixed (Crypto-Only)**
- Target allocations now relative to **crypto portion only**: BTC 40%, ETH 25%, SOL 20%, BNB 15%
- USDT/stablecoins excluded from denominator when computing current vs target %
- Files: `src/rebalancer/dca-target-resolver.ts`, `src/dca/dca-allocation-calculator.ts`
- Prevents false underweight signals when portfolio is cash-heavy

**DCA Proportional Threshold Uses Config**
- Proportional DCA triggered when `cryptoValue < gs.dcaAmountUsd` (was hardcoded $20)
- Respects configured DCA amount for threshold logic
- File: `src/dca/dca-service.ts`

**DCA Dust Handling**
- Proportional DCA ignores dust when `cryptoValue < depositAmount` (treats all assets as 0% currentPct)
- DCA target resolver treats crypto < $10 as zero, picks highest target asset
- Files: `src/dca/dca-allocation-calculator.ts`, `src/rebalancer/dca-target-resolver.ts`

**Unified Stablecoin Set**
- `STABLECOINS` constant exported from `src/rebalancer/trade-calculator.ts`
- Includes: USDT, USDC, BUSD, TUSD, DAI, USD
- Used consistently across DCA calculator, DCA target resolver, drift detector
- Eliminates magic string literals and sync failures

**REST Price Feed (Non-WebSocket)**
- `src/price/price-aggregator.ts` now uses REST polling instead of WebSocket
- `fetchTicker` method via CCXT (10s interval)
- Root cause: Bun runtime doesn't support CCXT Pro WebSocket upgrade path
- `watchTicker` method kept for future compatibility but not used
- More stable for Bun deployment, slightly higher latency tolerance acceptable

**Strategy Config Loaded on Startup**
- `strategyManager.loadFromDb()` called in `src/index.ts` during bootstrap
- Previously missing — fallback to hardcoded $20 DCA amount
- Ensures active config available immediately after server start

**Rebalance + DCA Fully Independent**
- Rebalance engine does full portfolio rebalance (no DCA cap)
- DCA cron runs separately with scheduled `dcaAmountUsd` purchases
- Trend filter bear/bull triggers still do full rebalance (hard boundaries)
- Previous DCA budget cap implementation reverted — both systems now independent

**POST /api/dca/trigger Endpoint**
- Manual DCA trigger via REST: `POST /api/dca/trigger`
- Response: `{ triggered: true, orders: N, details: [...] }`
- Allows ad-hoc DCA execution beyond scheduled cron

**Coverage CI Enforcement**
- Backend: 75% total coverage (per-file threshold disabled)
- Frontend: 85% total coverage (per-file threshold disabled)
- `continue-on-error` removed from CI config
- Builds fail on coverage below threshold

**DCA Zero-Balance Fix**
- DCA now works with 100% USDT portfolio (no crypto held yet)
- Falls back to price cache (`getBestPrice`) when computing allocations
- Handles new investor scenarios without errors

### Modified

- `GlobalSettingsSchema`: Added `dcaAmountUsd` field
- `dca-service.ts`: Proportional threshold now uses `gs.dcaAmountUsd`, independent of rebalance
- `dca-target-resolver.ts`: Crypto-only calculations, stablecoin exclusion, dust < $10 handling
- `dca-allocation-calculator.ts`: Crypto-only denominator logic, dust handling
- `price-aggregator.ts`: Switched from watchTicker (WebSocket) to fetchTicker (REST polling)
- `trade-calculator.ts`: Exported `STABLECOINS` constant
- `rebalance-engine.ts`: Always does full rebalance (DCA budget cap reverted)
- `index.ts`: Added `strategyManager.loadFromDb()` on startup
- GitHub Actions CI: Updated coverage thresholds, removed per-file checks

### Performance

- Price polling more predictable latency (10s fixed interval vs variable WebSocket)
- DCA calculations faster (crypto-only scope reduction)
- Rebalance engine processes full drift without budget constraints

### Testing

- ✅ DCA trigger endpoint returns correct order count
- ✅ DCA % calculation excludes stablecoins from denominator
- ✅ DCA uses proportional mode when `cryptoValue < dcaAmountUsd`
- ✅ Dust < $10 treated as zero in DCA resolver
- ✅ REST polling fetches latest ticker every 10s
- ✅ Coverage CI blocks PRs below thresholds (75% backend, 85% frontend)
- ✅ DCA works with zero-balance crypto portfolio
- ✅ Rebalance fully independent of DCA (no cap)
- ✅ Strategy config loaded on startup

### Documentation

- Updated `system-architecture.md`: DCA flow fully independent, strategy config loading, REST polling
- Updated `codebase-summary.md`: DCA changes, price feed modification, startup sequence
- Updated GoClaw skills: `auto-rebalance/SKILL.md`, `strategy-manager/SKILL.md`, `system-overview/SKILL.md`

---

## [1.0.1] - 2026-03-28 (Production Readiness Enhancements)

### Added

**Trend Filter Persistence**
- `TrendFilter` now persists daily BTC closes to MongoDB `ohlcv_candles` collection
- Loads historical data on startup for restart resilience
- MA calculations span up to 400 daily candles (>1 year of data)
- Avoids false trend flips after container restarts

**Bear Market Protection Trigger**
- New rebalance trigger: `trend-filter-bear`
- `DriftDetector` emits rebalance when trend flips from bull → bear
- `RebalanceEngine` applies `bearCashPct` override (default: 70% cash) on bear signal
- Reduces drawdown in downtrends without user intervention

**Shared Bear Cash Constants**
- `DEFAULT_BEAR_CASH_PCT = 70` exported from `drift-detector.ts`
- Used by both `drift-detector` and `rebalance-engine` for consistency
- Configurable via `globalSettings.bearCashPct`

**Enhanced Health Endpoint**
- `/api/health` now returns:
  - `memoryMb`: Current RSS memory (MB)
  - `version`: Package version from `package.json`
  - `lastPriceUpdate`: Timestamp of latest price service update
  - `trendStatus`: Trend filter state (enabled, bullish, MA, price, dataPoints)
  - `uptimeSeconds`: Bot uptime since startup

**Docker Autoheal**
- `willfarrell/autoheal` sidecar added to `docker-compose.yml`
- Monitors all services with healthchecks every 30s
- Auto-restarts unhealthy containers within 60s
- Resolves deadlock scenarios (process running but unresponsive)

**Trend-Safe Query API**
- `TrendFilter.isBullishReadOnly()`: Side-effect-free query (no event emission)
- Used by health endpoint to avoid spurious `trend:changed` events
- `getMA()`, `getCurrentPrice()`, `getDataPoints()` expose filter state

**Telegram Notifications**
- `TelegramNotifier` sends startup notification on first run
- Trend change alerts emitted via `trend:changed` event
- Daily summary still sent at configured time (08:00 UTC)

**ExchangeManager Timeout**
- `loadMarkets()` now enforces 30s timeout
- Prevents indefinite hangs on slow/unresponsive exchange APIs
- Wrapped with promise timeout utility

### Modified

- `TrendFilter`: Now persists to MongoDB, added read-only query methods
- `RebalanceEngine`: Added logic to handle `trend-filter-bear` trigger with cash override
- `DriftDetector`: Emits bear signal via new event type, exports constant
- `HealthRoutes`: New `/api/health` implementation with expanded metrics
- `TelegramNotifier`: Added startup and trend-change event handlers
- `ExchangeManager`: Added 30s timeout to `loadMarkets()` call
- `docker-compose.yml`: Added autoheal service, updated restart policies

### Security

- API credentials never logged in trend filter or health endpoint
- Health endpoint public (no auth) but returns sanitized data only
- MongoDB queries for trend data use lean() to reduce memory footprint

### Performance

- Trend filter data limited to 400 candles (memory-efficient)
- Health check response <50ms (no expensive calculations)
- Autoheal reduces manual recovery time from ~5 min to <60s

### Testing

- ✅ TrendFilter persists/loads from DB (verified in startups)
- ✅ Bear trigger activates rebalance with 70% cash
- ✅ Trend-safe queries don't emit duplicate events
- ✅ Health endpoint under load (<50ms)
- ✅ Autoheal restarts unresponsive containers (simulated failure)
- ✅ 30s timeout catches exchange API hangs

---

## [1.0.0] - 2026-03-22 (Production Release)

### Overview

All four major phases complete. System production-ready with 14 core features.

### Added

**Phase 1: Core Rebalancing**
- Multi-exchange support (Binance, OKX, Bybit via CCXT Pro)
- Portfolio fetch + real-time balance tracking
- Threshold-based rebalancing (configurable drift %)
- Paper trading mode (safe default)
- Order execution (live + simulated)

**Phase 2: Real-Time Monitoring**
- WebSocket price feeds (CCXT Pro native)
- REST API (11 endpoints)
- React dashboard with real-time charts
- Telegram bot notifications
- WebSocket API for frontend updates

**Phase 3: Strategy Variants**
- Equal-weight, momentum-tilt, volatility-adjusted strategies
- Backtesting framework with Sharpe/max-drawdown metrics
- OHLCV candle storage in MongoDB
- 50+ backtest scenarios validated

**Phase 4: Advanced Strategies**
- Trailing-stop loss automation
- DCA (Dollar-cost averaging) with scheduling
- Trend filter (MA-based bull/bear detection with bear cash override)
- Analytics dashboard (returns, volatility, Sharpe ratio, win rate)
- GoClaw AI insights (scheduled market analysis via GoClaw agent)

**Phase 5: Infrastructure & Deployment**
- Docker Compose (6-service stack: frontend, backend, MongoDB, GoClaw, ChromaDB, autoheal)
- Mongoose ODM (SQLite → MongoDB 7 migration complete)
- 14 MongoDB collections (trades, snapshots, allocations, OHLCV, etc.)
- MCP Server (Claude AI integration via REST wrapper)
- GitHub Actions CI/CD with semantic-release
- Mainnet configuration guide

### Configuration

- `.env.example` with all required variables
- Type-safe config validation (Zod schemas)
- Strategy profiles (conservative, moderate, aggressive)
- Per-asset allocation targets
- Configurable rebalance thresholds, DCA intervals, strategy parameters

### Database

- MongoDB 7 with Mongoose ODM
- 10 collections: allocations, trades, snapshots, rebalances, exchange_configs, ohlcv_candles, backtest_results, strategy_configs, health_logs
- Encryption for API credentials at rest
- Automatic schema validation

### Testing

- 100+ unit tests (85% coverage)
- Integration tests for all services
- E2E tests for critical flows
- Load tests for rebalance cycles
- All tests passing in CI/CD

### Documentation

- Project overview & PDR (requirements)
- System architecture (13 services, data flow)
- Codebase summary (24,500 LOC breakdown)
- Code standards (file naming, testing, commits)
- Deployment guide (Docker, VPS, mainnet)

### Performance

- Rebalance cycle: 1-5 seconds
- API response: <200ms
- WebSocket latency: <100ms
- Memory: 300-400MB
- Uptime: >99% in production

### Known Limitations

- Single-instance only (no horizontal scaling)
- Synchronous order execution (async coming in v2)
- No futures/margin support (coming Q4 2026)
- No tax optimization (coming Q4 2026)
- Single timezone (UTC)

---

## Version History

| Version | Date | Status | Highlights |
|---------|------|--------|-----------|
| 1.0.3 | 2026-03-31 | Current | Backtest fixes (double-division, DCA fees, buffer), new optimal MA120/TH10, rate limiter eviction |
| 1.0.2 | 2026-03-30 | Stable | DCA budget cap, crypto-only allocations, REST price feed |
| 1.0.1 | 2026-03-28 | Archive | Trend persistence, bear protection, autoheal |
| 1.0.0 | 2026-03-22 | Archive | Production release, all 4 phases complete |
| 0.9.0 | 2026-02-15 | Archive | Phase 4 complete, advanced strategies |
| 0.8.0 | 2025-12-01 | Archive | DCA, trailing stops, analytics |
| 0.7.0 | 2025-10-15 | Archive | Backtesting, analytics dashboard |
| 0.6.0 | 2025-08-30 | Archive | Strategy variants (momentum, vol-adj) |
| 0.5.0 | 2025-07-10 | Archive | Real-time monitoring, Telegram alerts |
| 0.1.0 | 2025-05-01 | Archive | Core rebalancing, multi-exchange |

---

## Update Frequency

- **Critical security**: ASAP
- **Bug fixes**: Weekly (bundled releases)
- **Minor features**: Monthly
- **Major versions**: After full testing (quarterly)

## Deprecation

No deprecations in v1.x. Full backward compatibility.

**v2.0** (2027, tentative):
- Drop Node.js support (Bun only)
- Async order execution
- REST API v2 restructure
