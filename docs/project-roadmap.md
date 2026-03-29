# Project Roadmap

**Project**: Crypto Rebalance Bot
**Last Updated**: 2026-03-28
**Current Version**: 1.0.1
**Status**: Production (Stable) + Production Readiness Complete
**Repository**: https://github.com/dungngo97/rebalance-bot

## Current Status

All four major phases complete. System is production-ready with 14 features implemented. Actively maintained, stable API, comprehensive test coverage.

## Completed Phases

### Phase 1: Core Rebalancing (Complete)
**Status**: ✅ Complete
**Features**:
- Multi-exchange connectivity (Binance, OKX, Bybit)
- Portfolio fetch and allocation calculation
- Threshold-based rebalancing (configurable drift %)
- Paper trading mode (safe default)
- Real-time balance tracking

**Metrics**: 3,400 LOC, 100+ test cases

### Phase 2: Real-Time Monitoring (Complete)
**Status**: ✅ Complete
**Features**:
- WebSocket price feeds (CCXT Pro)
- REST API (11 endpoints)
- React dashboard with charts
- Telegram notifications
- WebSocket API for frontend updates

**Metrics**: 4,200 LOC, 16 pages, 59 components

### Phase 3: Strategy Variants (Complete)
**Status**: ✅ Complete
**Features**:
- Equal-weight rebalancing
- Momentum-tilt strategy (price momentum weighting)
- Volatility-adjusted weighting (inverse vol)
- Backtesting framework with Sharpe ratio
- OHLCV candle data storage

**Metrics**: 1,800 LOC, 50+ backtest scenarios tested

### Phase 4: Advanced Strategies (Complete)
**Status**: ✅ Complete
**Features**:
- Trailing-stop loss automation
- DCA (Dollar-cost averaging) with scheduling
- TWAP/VWAP order splitting
- Grid trading with customizable intervals
- Copy trading (mirror from sources)
- Analytics dashboard (returns, volatility, drawdown, win rate)
- AI suggestions (ML-based recommendations)

**Metrics**: 3,500 LOC, all strategies tested in production

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
| GoClaw AI + ChromaDB | ✅ | 5 | 150 |
| Trend Filter (MA-based) | ✅ | 6 | 280 |
| Bear Market Protection | ✅ | 6 | - |
| Health Endpoint (enhanced) | ✅ | 6 | 50 |
| Docker Autoheal | ✅ | 6 | - |

## Recent Updates (2026)

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
- ✅ Docker Compose migration (6-service stack)
- ✅ SQLite → MongoDB 7 with Mongoose
- ✅ Drizzle ORM → Mongoose models (14 schemas)
- ✅ MCP server REST wrapper (Claude integration)
- ✅ GoClaw AI agent + ChromaDB knowledge base
- ✅ GitHub Actions CI/CD + Docker auto-deploy
- ✅ Semantic-release integration
- Database migration tooling complete

**January 2026**:
- AI suggestions module (GoClaw integration)
- Copy trading enhancements
- Analytics dashboard improvements

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
