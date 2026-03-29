# Project Roadmap

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-28
**Current Version**: 1.0.1
**Status**: Production (Stable) + Production Readiness Complete
**Repository**: https://github.com/dungngo97/rebalance-bot

## Current Status

All eight major phases complete. System is production-deployed with 50+ features, 4 major infrastructure upgrades (Docker, MongoDB, MCP, GoClaw), 6 advanced strategies, cash-aware DCA, trend filter, and comprehensive test coverage (80+ test files). Actively maintained, stable API, production-ready.

## Completed Phases

### Phase 1: Core Rebalancing (✅ Complete)
**Status**: Production-stable
**Features**: Multi-exchange (Binance, OKX, Bybit), portfolio fetch, threshold-based rebalancing, paper trading, real-time balance tracking
**Metrics**: 3,400 LOC, 100+ test cases

### Phase 2: Real-Time Monitoring (✅ Complete)
**Status**: Production-stable
**Features**: WebSocket price feeds (CCXT Pro), REST API (11 endpoints), React dashboard, Telegram alerts, WebSocket API
**Metrics**: 4,200 LOC, 16 pages, 59 components

### Phase 3: Strategy Variants (✅ Complete)
**Status**: Production-stable
**Features**: Equal-weight, momentum-tilt, vol-adjusted weighting, backtesting with Sharpe ratio, OHLCV candles
**Metrics**: 1,800 LOC, 50+ backtest scenarios

### Phase 4: Advanced Strategies (✅ Complete)
**Status**: Production-stable
**Features**: Trailing stops, DCA scheduling, TWAP/VWAP, grid trading, copy trading, analytics, AI suggestions
**Metrics**: 3,500 LOC, all strategies tested in production

### Phase 5: Production Infrastructure (✅ Complete)
**Status**: Production-ready
**Features**: Docker Compose (8 services), MongoDB 7, MCP server (SSE), GoClaw + PostgreSQL + pgvector, autoheal
**Metrics**: 420 LOC (DB), 200 LOC (MCP), CI/CD automation

### Phase 6: Production Readiness (✅ Complete)
**Status**: Production-deployed
**Features**: Trend filter MA-based detection, bear market protection (70% cash override), cooldown whipsaw protection, health endpoint enhancements, autoheal recovery
**Metrics**: 280 LOC (trend filter), 50 LOC (health), 100% uptime in staging

### Phase 7: Advanced Strategy System (✅ Complete)
**Status**: Production-ready
**Features**: 6 strategy types (threshold, equal-weight, momentum-tilt, vol-adjusted, mean-reversion, momentum-weighted), database-driven config with hot-reload (strategy:config-changed event), polymorphic Zod types, StrategyManager hot-reload
**Metrics**: 670 LOC (strategies), 150 LOC (config system), strategy config API (5 endpoints), 62 strategy tests

### Phase 8: Cash-Aware DCA + Backtest Optimizer (✅ Complete)
**Status**: Production-ready
**Features**: Cash reserve (0-50%), DCA routing to underweight assets, hard rebalance threshold, backtest optimizer (4800+ grid combinations), backtest cash/DCA simulation, trend filter cooldown (3-day), comprehensive tests (80+ new tests)
**Metrics**: 450 LOC (cash+DCA), 250 LOC (optimizer), 200 LOC (backtest integration), 70+ test files

## Feature Matrix

| Feature | Status | Phase | LOC |
|---------|--------|-------|-----|
| Multi-Exchange API | ✅ | 1 | 350 |
| Auto Rebalance | ✅ | 1 | 800 |
| Real-Time Prices | ✅ | 2 | 260 |
| REST API | ✅ | 2 | 1,850 |
| React Dashboard | ✅ | 2 | 13,500 |
| Telegram Alerts | ✅ | 2 | 210 |
| Backtesting | ✅ | 3 | 1,015 |
| Trailing Stops | ✅ | 4 | 175 |
| DCA Strategy | ✅ | 4 | 235 |
| Grid Trading | ✅ | 4 | 710 |
| TWAP/VWAP | ✅ | 4 | 620 |
| Copy Trading | ✅ | 4 | 510 |
| Analytics | ✅ | 4 | 880 |
| AI Suggestions | ✅ | 4 | 380 |
| Docker Compose | ✅ | 5 | - |
| MongoDB Migration | ✅ | 5 | 420 |
| MCP Server | ✅ | 5 | 200 |
| GoClaw AI + PostgreSQL | ✅ | 5 | 150 |
| Trend Filter (MA-based) | ✅ | 6 | 280 |
| Bear Market Protection | ✅ | 6 | - |
| Health Endpoint (enhanced) | ✅ | 6 | 50 |
| Docker Autoheal | ✅ | 6 | - |
| Advanced Strategy System (6 types) | ✅ | 7 | 670 |
| Database-Driven Config + Hot-Reload | ✅ | 7 | 150 |
| Mean-Reversion Strategy | ✅ | 7 | 140 |
| Volatility-Adjusted Strategy | ✅ | 7 | 120 |
| Momentum-Weighted Strategy | ✅ | 7 | 130 |
| Strategy Config API Endpoints | ✅ | 7 | 200 |
| Strategy Frontend Integration | ✅ | 7 | 300 |
| Cash-Aware Rebalancing | ✅ | 8 | 180 |
| DCA Routing (to underweight assets) | ✅ | 8 | 120 |
| Hard Rebalance Threshold | ✅ | 8 | 80 |
| Cash Reserve Configuration | ✅ | 8 | 70 |
| Backtest Optimizer (grid search) | ✅ | 8 | 250 |
| Backtest Cash Reserve + DCA | ✅ | 8 | 200 |
| Trend Filter Cooldown (whipsaw protection) | ✅ | 8 | 40 |
| Comprehensive Test Suite | ✅ | 8 | 1,200 |

## Recent Updates (2026)

**March 29, 2026 — Complete System Implementation**:
- ✅ Advanced Strategy System: 6 strategy types (threshold, equal-weight, momentum-tilt, vol-adjusted, mean-reversion, momentum-weighted)
- ✅ Database-Driven Config: StrategyConfigModel with polymorphic Zod types, hot-reload via strategy:config-changed event
- ✅ Cash-Aware Rebalancing: 0-50% cash reserve, DCA routing to most-underweight asset
- ✅ Hard Rebalance Threshold: Separate high-drift trigger for traditional rebalancing
- ✅ Trend Filter Cooldown: 3-day whipsaw protection on bull/bear flips
- ✅ Backtest Optimizer: Grid search across 4800+ parameter combinations
- ✅ Backtest DCA + Cash Integration: Full simulation of cash reserve and DCA routing
- ✅ Comprehensive Test Coverage: 62 strategy tests + 10 trend filter tests + 8 DCA tests
- ✅ Strategy Config API: 5 endpoints for CRUD + activation with hot-reload
- ✅ Complete Documentation: System architecture, codebase summary, roadmap updated

**March 28, 2026 — Production Readiness**:
- ✅ TrendFilter persistence to MongoDB (restart resilience)
- ✅ Bear market protection (`trend-filter-bear` trigger)
- ✅ Enhanced health endpoint (memory, version, trend status)
- ✅ Docker autoheal sidecar (auto-recovery within 60s)
- ✅ Trend-safe read-only API (no spurious events)
- ✅ 30s timeout on ExchangeManager.loadMarkets()
- ✅ Telegram startup + trend-change notifications
- ✅ Mainnet configuration guide

**March 22, 2026 — v1.0.0 Production Release**:
- ✅ Docker Compose migration (8-service stack: frontend, backend, mongodb, mcp-server, goclaw, goclaw-ui, goclaw-postgres, autoheal)
- ✅ SQLite → MongoDB 7 with Mongoose (15 schemas)
- ✅ MCP server REST wrapper (Claude integration via SSE)
- ✅ GoClaw AI agent + PostgreSQL + pgvector (replaces ChromaDB)
- ✅ GitHub Actions CI/CD + Docker auto-deploy
- ✅ Semantic-release integration
- ✅ Database migration tooling complete

## Future Roadmap

### Near-term (Q2-Q3 2026)

#### Mobile Access
- Telegram Mini-App integration
- Push notifications via Telegram
- Mobile-optimized dashboard

**Effort**: 2-3 weeks

#### Advanced Risk Management
- Portfolio leverage limits
- Position sizing based on volatility
- Daily/weekly loss limits (configurable)
- Correlation analysis between holdings

**Effort**: 2 weeks

#### Expanded Exchanges
- Support Kraken, Coinbase Pro
- DEX integration (Uniswap v3)
- Cross-exchange arbitrage detection

**Effort**: 3 weeks per exchange

### Mid-term (Q4 2026)

#### Tax Reporting
- Automatic tax lot tracking
- Integration with tax software APIs
- Cost basis calculations
- Report generation (US, EU templates)

**Effort**: 3-4 weeks

#### Multi-Currency Portfolios
- USD, EUR, GBP base currencies
- FX conversion in allocations
- Cross-currency rebalancing

**Effort**: 2 weeks

#### Margin & Futures Support
- Margin trading on Binance/OKX
- Perpetual futures strategies
- Leverage-adjusted risk management
- Liquidation protection

**Effort**: 4-5 weeks

### Long-term (2027+)

#### Advanced Analytics
- Factor analysis (momentum, volatility, correlation)
- Performance attribution
- Risk decomposition
- Scenario analysis

**Effort**: 4 weeks

#### Machine Learning Enhancements
- Portfolio optimization via modern portfolio theory
- Market regime detection
- Dynamic allocation adjustments
- Predictive rebalancing timing

**Effort**: 6-8 weeks

#### Community Features
- Strategy marketplace
- Shared allocations/configs
- Public strategy rankings
- Community backtests

**Effort**: 5-6 weeks

#### Multi-User Support
- User accounts and API keys
- Sub-accounts per user
- Shared portfolio management
- Activity logging per user

**Effort**: 4-5 weeks

## Known Limitations

### Technical
- Single-instance only (no horizontal scaling)
- SQLite for single-user (Turso for cloud)
- No futures/margin support yet
- Synchronous order execution only
- Token context limits for AI features

### Operational
- Requires self-hosting (no SaaS yet)
- Manual configuration required
- No built-in failover/HA
- Single timezone (UTC)

### Strategic
- No options trading
- No derivatives
- No cross-exchange arbitrage automation
- No tax optimization

## Testing Status

| Category | Coverage | Status |
|----------|----------|--------|
| Unit Tests | ~85% | ✅ Passing |
| Integration Tests | ~70% | ✅ Passing |
| E2E Tests | Manual | ✅ Verified |
| Load Tests | Basic | ⚠️ Incomplete |
| Security Audit | Partial | ⚠️ Pending |

## Performance Targets

**Current** (Achieved):
- Rebalance cycle: 1-5 seconds
- API response: <200ms
- WebSocket latency: <100ms
- Memory: 300-400MB
- Uptime: >99% (in production)

**Future Targets**:
- Sub-second order execution
- <50ms API response
- Sub-10ms WebSocket latency
- Horizontal scaling support
- 99.9% uptime SLA

## Deprecation Schedule

No deprecations planned for v1.x. Backward compatibility maintained.

**v2.0 (2027, tentative)**:
- Drop Node.js support (Bun only)
- Require TypeScript 6+
- Restructure API for REST v2

## Documentation Roadmap

**Current**:
- ✅ Project overview & PDR
- ✅ Code standards
- ✅ System architecture
- ✅ Codebase summary
- ✅ API documentation

**Planned**:
- Deployment guide (VPS, Docker, K8s)
- Strategy development guide
- ML model training guide (for AI module)
- Architecture decision records (ADRs)
- Performance tuning guide

## Dependencies & Maintenance

**Runtime Dependencies** (15):
- Bun 1.2+ (long-term support)
- CCXT Pro 4.4+ (active community)
- Hono v4+ (stable API)
- Drizzle ORM (active development)
- React 18+ (stable LTS)

**Dev Dependencies**:
- TypeScript 5.7+ (stable)
- Biome 1.9+ (active development)
- Bun test (built-in, no external deps)

**Update Frequency**:
- Critical security: ASAP
- Minor/patch: Monthly
- Major versions: After thorough testing

## Metrics & Success Criteria

### System Health
- Test pass rate: 100%
- Type coverage: >95%
- Lint errors: 0
- Security vulnerabilities: 0

### Performance
- Rebalance cycle: <5s (target: <1s)
- API latency: <200ms (target: <50ms)
- Uptime: >99% (target: >99.9%)

### Code Quality
- Unit test coverage: 80%+
- TypeScript strict mode: Enforced
- Conventional commits: 100%

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.0.0 | 2026-03-22 | Production release, all 4 phases complete |
| 0.9.0 | 2026-02-15 | Phase 4 complete, AI suggestions |
| 0.8.0 | 2025-12-01 | Copy trading, advanced strategies |
| 0.7.0 | 2025-10-15 | Backtesting, analytics dashboard |
| 0.6.0 | 2025-08-30 | Strategy variants (momentum, vol-adj) |
| 0.5.0 | 2025-07-10 | Real-time monitoring, Telegram alerts |
| 0.1.0 | 2025-05-01 | Core rebalancing, multi-exchange |

## License & Attribution

**License**: MIT
**Author**: Duy Nguyen
**Repository**: https://github.com/dungngo97/rebalance-bot

## Next Steps

1. **Community Launch** (Q2 2026): Open Discord, get feedback
2. **Mobile Access** (Q2-Q3 2026): Telegram Mini-App
3. **Risk Management** (Q3 2026): Advanced limits
4. **Tax Reporting** (Q4 2026): Automated tax tracking
5. **Multi-Currency** (Q4 2026): Global portfolio support

See [System Architecture](./system-architecture.md) for technical depth.
See [Project Overview](./project-overview-pdr.md) for feature requirements.
