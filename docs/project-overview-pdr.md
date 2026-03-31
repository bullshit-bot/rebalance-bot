# Project Overview & Product Development Requirements (PDR)

**Project Name**: Crypto Rebalance Bot
**Version**: 1.0.0
**Last Updated**: 2026-03-22
**Status**: Complete
**Repository**: Self-hosted

## Executive Summary

Self-hosted cryptocurrency portfolio rebalance bot with real-time multi-exchange support, advanced trading strategies, and comprehensive analytics. Enables passive income through automated portfolio management with customizable rebalancing strategies, DCA accumulation, trailing stops, and trend-aware bear protection. Single developer tool with Telegram alerts via GoClaw AI.

## Project Purpose

### Vision
Provide sophisticated portfolio management automation accessible to retail crypto investors without reliance on centralized services.

### Mission
Deliver a production-ready system that:
- Automatically rebalances portfolios across multiple exchanges
- Executes advanced trading strategies (DCA, trailing-stop, trend filter, 6 strategy types)
- Provides real-time monitoring via Telegram (GoClaw AI agent)
- Maintains transparent trade history and analytics
- Encrypts all exchange credentials

### Value Proposition
- **Hands-Off Management**: Set allocation targets, bot handles rebalancing
- **Multi-Exchange**: Trade across Binance, OKX, Bybit simultaneously
- **Advanced Strategies**: DCA, trailing stops, trend filter, 6 configurable strategy types
- **100% Private**: Self-hosted on user's VPS, no KYC required
- **Complete Transparency**: All trades logged, analytics calculated locally

## Target Users

### Primary User
Solo crypto investor managing multi-asset portfolio across multiple exchanges.

### User Profile
- 5-10+ holdings across major exchanges
- Wants passive rebalancing without manual intervention
- Comfortable with self-hosting and API credentials
- Seeks sophisticated trading beyond basic buy-and-hold
- Values privacy and self-custody

## Key Features (10 Total)

### Core Rebalancing (Phase 1-3)
1. **Auto Rebalance** - Drift-triggered portfolio rebalancing
2. **6 Strategy Types** - Threshold, equal-weight, momentum-tilt, vol-adjusted, mean-reversion, momentum-weighted
3. **Real-Time Prices** - REST polling via CCXT Pro (10s interval)
4. **Multi-Exchange** - Unified API across Binance, OKX, Bybit
5. **Telegram Alerts** - Real-time notifications via GoClaw AI agent

### Advanced Strategies (Phase 4+)
6. **Trailing-Stop** - Automatic position selling on price decline
7. **DCA** - Dollar-cost averaging with daily scheduled buy orders
8. **Trend Filter** - MA-based bull/bear detection with bear cash override

### Analytics & Intelligence
9. **Backtesting** - Historical performance validation with Sharpe ratio (5040+ combo optimizer)
10. **Analytics** - Return, volatility, drawdown, win rate metrics

## Supported Exchanges

| Exchange | Status | Features |
|----------|--------|----------|
| Binance | Active | Spot trading, unified API |
| OKX | Active | Spot trading, unified API |
| Bybit | Active | Spot trading, unified API |

## Technical Requirements

### Functional Requirements

**FR1: Portfolio Management**
- Fetch holdings from multiple exchanges simultaneously
- Calculate current allocations as % of total USD value
- Compare against target allocations
- Detect drift and trigger rebalancing

**FR2: Rebalancing Execution**
- Calculate optimal trade quantities to reach targets
- Place buy/sell orders simultaneously across exchanges
- Respect minimum trade sizes ($10 minimum per trade)
- Handle partial fills and cancellation
- Support both live and paper trading modes

**FR3: Strategy Implementation**
- Threshold-based: trigger when deviation > threshold
- Equal-weight: maintain equal allocation across assets
- Momentum-tilt: adjust weights based on price momentum
- Vol-adjusted: inverse volatility weighting
- Mean-reversion: Bollinger band-based rebalancing
- Momentum-weighted: momentum score allocation weighting
- DCA: schedule regular buy orders
- Trailing-stop: automatic sell on price decline
- Trend filter: MA-based bull/bear detection with configurable bear cash override

**FR4: Real-Time Monitoring**
- WebSocket price feeds for all trading pairs
- REST API endpoints for portfolio queries
- WebSocket API for real-time portfolio updates
- React frontend dashboard with charts

**FR5: Notifications**
- Telegram bot for trade alerts
- Rebalance start/completion messages
- Daily portfolio summaries
- Price threshold breaches
- System error notifications

**FR6: Data Persistence**
- SQLite database with encrypted credentials
- Trade history with full details (price, fee, timestamp)
- Portfolio snapshots (before/after rebalance)
- OHLCV candle data for backtesting
- Configuration and allocation targets

**FR7: Backtesting**
- Load historical OHLCV data
- Simulate trades using past prices
- Calculate performance metrics (Sharpe, drawdown, returns)
- Compare multiple strategy configurations

### Non-Functional Requirements

**NFR1: Performance**
- Portfolio fetch: <500ms per exchange
- Rebalance calculation: <100ms
- Order execution: <2s per exchange
- WebSocket latency: <100ms
- API response time: <200ms

**NFR2: Reliability**
- 99% uptime for WebSocket connections
- Automatic reconnection on failures
- Transaction support for trade recording
- Error recovery and retry logic
- Graceful degradation on exchange outages

**NFR3: Security**
- All credentials encrypted at rest
- Type-safe TypeScript (strict mode)
- Input validation via Zod schemas
- No secrets in logs or API responses
- Transaction support for data consistency

**NFR4: Scalability**
- Support 10+ concurrent users (separate instances)
- Handle 100+ trading pairs simultaneously
- Efficient database indexing
- Minimal memory footprint (~300-400MB)
- Modular service architecture

**NFR5: Usability**
- Simple configuration (environment variables)
- Clear API documentation
- Informative Telegram messages
- Dashboard with allocation visualization
- Helpful error messages

**NFR6: Maintainability**
- Modular service architecture
- TypeScript strict mode
- Comprehensive code comments
- Clear separation of concerns
- Automated linting (Biome)

## Success Metrics

### Functional Metrics
- ✅ Successfully rebalance across 3+ exchanges
- ✅ Maintain allocation targets within threshold
- ✅ Execute 100+ trades without errors
- ✅ Capture real-time price feeds
- ✅ Send alerts via Telegram reliably

### Performance Metrics
- Portfolio fetch time: <500ms
- Rebalance cycle time: <5s
- Order execution time: <2s per exchange
- WebSocket latency: <100ms
- Database query response: <100ms

### Reliability Metrics
- Uptime: 99.9% for critical services
- Trade success rate: >99%
- Database transaction success: 100%
- WebSocket reconnect success: >99%
- Alert delivery: 100%

### User Experience Metrics
- Time to setup: <30 minutes
- Time to first trade: <1 hour
- Dashboard load time: <500ms
- Alert response time: <5 seconds

## Technical Architecture

### Tech Stack
- **Runtime**: Bun 1.2+
- **Language**: TypeScript 5.7+ (strict)
- **API**: Hono v4
- **Database**: Drizzle ORM + libSQL (SQLite)
- **Exchange**: CCXT Pro 4.4.0
- **Telegram**: grammy 1.35+
- **Scheduler**: croner 9.0+
- **Validation**: Zod 3.24+
- **Linter**: Biome 1.9+
- **Frontend**: React + TypeScript + Vite

### Service Modules
1. **exchange/** - Multi-exchange connectivity (CCXT Pro)
2. **price/** - Market data processing and indicators
3. **portfolio/** - Holdings and allocation management
4. **rebalancer/** - Strategy execution and planning (6 types + trend filter)
5. **executor/** - Trade execution and order management
6. **db/** - Database schema and migrations
7. **api/** - REST and WebSocket API (Hono)
8. **notifier/** - Telegram notifications (GoClaw HTTP client)
9. **scheduler/** - Cron task execution (croner)
10. **config/** - Configuration management
11. **events/** - Event bus for loose coupling
12. **trailing-stop/** - Stop-loss execution
13. **dca/** - Dollar-cost averaging
14. **backtesting/** - Historical performance simulation
15. **analytics/** - Metrics calculation
16. **ai/** - GoClaw AI client for insights and notifications

## Use Cases

### UC1: Set Up and Start
**Actor**: User
**Goal**: Get bot running and making trades
**Flow**:
1. Deploy Docker container on VPS
2. Configure exchange API keys (encrypted)
3. Set portfolio allocation targets
4. Choose rebalancing strategy
5. Enable Telegram notifications
6. Start bot → auto-rebalance on next drift

### UC2: Monitor in Real-Time
**Actor**: User
**Goal**: Track portfolio and trades
**Flow**:
1. Open React dashboard
2. View current holdings and allocations
3. See real-time price updates
4. View trade history
5. Receive Telegram alerts on events

### UC3: Backtest Strategy
**Actor**: User
**Goal**: Validate strategy before live trading
**Flow**:
1. Select historical date range
2. Choose strategy configuration
3. Load OHLCV data
4. Simulate trades using past prices
5. Review performance metrics (Sharpe, drawdown)
6. Approve strategy for live trading

### UC4: Manual Override
**Actor**: User
**Goal**: Trigger rebalance manually
**Flow**:
1. Access API or dashboard
2. Click "Rebalance Now"
3. Review proposed trades
4. Confirm execution
5. Monitor order status
6. Receive completion notification

## Constraints & Limitations

### Technical Constraints
- Bun runtime required (not Node.js)
- SQLite for single-instance setup
- CCXT Pro API rate limits (exchange-dependent)
- Token limits in context windows (for AI features)
- Telegram bot token required for notifications

### Operational Constraints
- Requires self-hosted VPS (8GB RAM minimum)
- Internet connection for API connectivity
- Exchange API credentials with API key permissions
- Telegram bot token from BotFather
- Database persistence (no in-memory option)

### Design Constraints
- Spot trading only (no futures/margin)
- Single base currency (USD)
- SQLite database (not distributed)
- Single-instance architecture (no clustering)
- Synchronous order execution

## Dependencies

### Runtime Dependencies
- `bun` >= 1.2.0
- `ccxt` >= 4.4.0
- `hono` >= 4.7.0
- `drizzle-orm` >= 0.38.0
- `@libsql/client` >= 0.14.0
- `grammy` >= 1.35.0
- `croner` >= 9.0.0
- `zod` >= 3.24.0

### Dev Dependencies
- `typescript` >= 5.7.0
- `@biomejs/biome` >= 1.9.0
- `drizzle-kit` >= 0.30.0

### External Services
- Exchange APIs (Binance, OKX, Bybit)
- Telegram Bot API

## Compliance & Standards

### Coding Standards
- TypeScript strict mode (no `any` types)
- Kebab-case for files, camelCase for variables
- Biome linting enforcement
- Zod validation for all inputs
- Try-catch error handling

### Data Standards
- All trades recorded with full details
- Timestamps in Unix seconds (unixepoch)
- Prices in USD decimals
- Allocations as percentages (0-100)

### Security Standards
- Credentials encrypted at rest
- No secrets in logs
- No exposed API keys in responses
- Input validation via Zod
- SQL injection prevention via ORM

## Roadmap

### Phase 1 (Complete): Core Rebalancing
- Multi-exchange connectivity
- Portfolio fetch and allocation calculation
- Threshold-based rebalancing
- Paper trading mode

### Phase 2 (Complete): Real-Time Monitoring
- WebSocket price feeds
- REST API endpoints
- React dashboard
- Telegram notifications

### Phase 3 (Complete): Strategy Variants
- Equal-weight rebalancing
- Momentum-tilt strategy
- Volatility-adjusted weighting
- Backtesting framework

### Phase 4 (Complete): Advanced Strategies
- Trailing-stop loss automation
- DCA (Dollar-cost averaging)
- Trend filter (MA-based bull/bear detection)
- Bear market protection (cash override)
- Analytics metrics
- GoClaw AI insights

### Future Possibilities
- Margin trading support
- Options trading
- Multi-currency portfolios
- Risk management limits
- Tax reporting integration
- Mobile app (Telegram mini-app)

## Risks & Mitigation

### Risk 1: Exchange API Failures
**Impact**: High
**Likelihood**: Medium
**Mitigation**: Retry logic, exponential backoff, fallback data sources

### Risk 2: Incorrect Rebalancing Calculation
**Impact**: Critical
**Likelihood**: Low
**Mitigation**: Unit tests, backtesting validation, manual review option

### Risk 3: Credential Exposure
**Impact**: Critical
**Likelihood**: Low
**Mitigation**: Encryption at rest, no logging, type safety

### Risk 4: Database Corruption
**Impact**: High
**Likelihood**: Low
**Mitigation**: Transaction support, regular backups, recovery procedures

### Risk 5: WebSocket Disconnects
**Impact**: Medium
**Likelihood**: Medium
**Mitigation**: Automatic reconnection, fallback to REST API, alerts

## Glossary

| Term | Definition |
|------|-----------|
| Rebalance | Adjust portfolio back to target allocations |
| Allocation | Percentage of portfolio value held in each asset |
| Drift | Deviation between current and target allocations |
| Slippage | Difference between expected and actual execution price |
| DCA | Dollar-cost averaging (regular small buys) |
| Trend Filter | MA-based bull/bear market detection |
| Bear Cash Override | Auto-sell to cash % when trend turns bearish |
| Paper Trading | Simulated trades for backtesting |
| Drawdown | Largest peak-to-trough portfolio decline |

## Appendix

### Related Documentation
- [System Architecture](./system-architecture.md)
- [Code Standards](./code-standards.md)
- [Codebase Summary](./codebase-summary.md)

### Support & Community
- GitHub: https://github.com/dungngo97/rebalance-bot
- Issues: Report bugs and feature requests
