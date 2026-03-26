# Crypto Rebalance Bot

Self-hosted cryptocurrency portfolio rebalancing and trading automation bot. Automates multi-exchange portfolio rebalancing (Binance, OKX, Bybit) with advanced strategies: DCA, trailing stops, grid trading, copy trading, AI suggestions. Paper trading, backtesting, and comprehensive analytics.

**Status**: Production-ready | **Language**: TypeScript | **Runtime**: Bun | **License**: MIT

## Key Features

### Core Rebalancing
- **Auto Rebalance** - Drift-triggered portfolio rebalancing across 3+ exchanges
- **Real-Time Monitoring** - WebSocket price feeds, REST API, React dashboard
- **Paper Trading** - Full simulation mode for strategy backtesting
- **Multi-Exchange** - Unified CCXT Pro API (Binance, OKX, Bybit)
- **Telegram Alerts** - Real-time trade notifications and portfolio updates

### Advanced Strategies
- **Trailing Stops** - Automatic position selling on price decline
- **DCA** - Dollar-cost averaging with scheduled buy orders
- **TWAP/VWAP** - Intelligent order splitting to minimize slippage
- **Grid Trading** - Automated buy/sell at price intervals
- **Copy Trading** - Mirror trades from other portfolio sources

### Analytics & Intelligence
- **Backtesting** - Historical performance validation (Sharpe ratio, drawdown)
- **Performance Metrics** - Return, volatility, win rate analytics
- **AI Suggestions** - ML-based allocation recommendations
- **Trade History** - Complete trade audit trail with fees

## Documentation

- **[Project Overview & PDR](./docs/project-overview-pdr.md)** - Vision, goals, requirements, and success metrics
- **[Code Standards](./docs/code-standards.md)** - TypeScript strict mode, naming conventions, testing patterns
- **[System Architecture](./docs/system-architecture.md)** - Service modules, database schema, data flow, API endpoints
- **[Codebase Summary](./docs/codebase-summary.md)** - Directory structure, module overview, LOC estimates
- **[Project Roadmap](./docs/project-roadmap.md)** - Current status, completed phases, future roadmap

## Quick Start

### Prerequisites
- **Bun 1.2+** - [Install Bun](https://bun.sh)
- **Docker** - For containerized deployment
- **VPS** - 8GB RAM minimum (Linux recommended)
- **Exchange API Keys** - Binance, OKX, or Bybit
- **Telegram Bot Token** - Optional, for notifications

### Setup

```bash
git clone https://github.com/dungngo97/rebalance-bot.git && cd rebalance-bot
bun install
cp .env.example .env    # Edit with exchange keys
bun run src/db/migrate.ts
bun run src/index.ts    # Start bot
# Frontend: http://localhost:5173
# API: http://localhost:3000
```

Or deploy with Docker: `docker-compose up -d`

See [deployment guide](./docs/deployment-guide.md) for VPS setup.

## Project Structure

```
rebalance-bot/
├── src/
│   ├── index.ts           # Application entry point
│   ├── api/               # REST API + WebSocket server (Hono)
│   ├── db/                # Database schema & ORM (Drizzle)
│   ├── exchange/          # Multi-exchange CCXT Pro integration
│   ├── portfolio/         # Portfolio tracking & allocations
│   ├── rebalancer/        # Rebalancing strategy engine
│   ├── executor/          # Order execution
│   ├── price/             # Market data & indicators
│   ├── strategies/        # DCA, grid, trailing-stop, TWAP/VWAP
│   ├── analytics/         # Performance metrics
│   ├── backtesting/       # Historical testing
│   ├── notifier/          # Telegram notifications
│   ├── scheduler/         # Cron tasks
│   ├── events/            # Event bus
│   ├── ai/                # ML suggestions
│   ├── copy-trading/      # Trade replication
│   └── config/            # Configuration & validation
├── frontend/              # React dashboard (Vite)
├── tests/                 # Test suites
├── docs/                  # Documentation
├── docker-compose.yml     # Container config
├── .env.example          # Template environment vars
└── README.md             # This file
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Bun 1.2+ |
| **Language** | TypeScript 5.7+ (strict) |
| **Backend** | Hono v4 (HTTP + WebSocket) |
| **Database** | Drizzle ORM + libSQL (SQLite) |
| **Exchanges** | CCXT Pro 4.4.0 |
| **Scheduler** | Croner 9.0+ |
| **Notifications** | grammy 1.35+ (Telegram) |
| **Frontend** | React 18 + Vite + Tailwind |
| **UI Components** | shadcn/ui + Radix |
| **State Management** | React Query v5 |
| **Validation** | Zod 3.24+ |
| **Linting** | Biome 1.9+ |
| **Testing** | Bun test runner |
| **Deployment** | Docker + nginx + systemd |

## Architecture Overview

**Event-Driven Core**: Services communicate via TypedEventEmitter for loose coupling.

**Multi-Exchange Abstraction**: CCXT Pro provides unified API across Binance, OKX, Bybit.

**Real-Time Data**: WebSocket feeds from exchanges → Price Service → EventBus → Consumers.

**Execution Model**: Live and paper trading modes via executor pattern.

**Database-First**: Drizzle ORM with 8+ tables (trades, snapshots, allocations, OHLCV, etc.).

## Development Workflow

### Adding a New Strategy

1. **Create strategy module** in `src/strategies/your-strategy/`
2. **Emit events** via `eventBus` for Telegram/UI updates
3. **Write tests** in `tests/strategies/`
4. **Update README** with strategy description
5. **Add config option** to `.env.example`
6. **Commit** with `feat(strategy): add [name]`

### Configuration

Key environment variables: `BINANCE_API_KEY`, `OKX_API_KEY`, `BYBIT_API_KEY`, `REBALANCE_THRESHOLD=0.05`, `MIN_TRADE_USD=10`, `PAPER_TRADING=true`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`. See `.env.example`.

## API Reference

### REST Endpoints

**Portfolio**:
- `GET /api/health` - System health check
- `GET /api/portfolio` - Current holdings & allocations
- `GET /api/allocations` - Target allocations

**Trading**:
- `POST /api/rebalance` - Trigger manual rebalance
- `GET /api/trades` - Trade history
- `GET /api/orders` - Active orders

**Strategy**:
- `POST /api/backtest` - Run backtest
- `GET /api/backtest/:id/results` - Backtest results
- `GET /api/analytics` - Performance metrics

**Configuration**:
- `POST /api/config` - Update configuration
- `POST /api/allocations/:asset` - Set asset target

### WebSocket Events

Subscribe to `ws://localhost:3000/ws`:
- `portfolio:update` - Holdings changed
- `trade:executed` - Order filled
- `price:update` - Price changed
- `rebalance:status` - Rebalance progress

## Testing

Run tests with Bun:

```bash
# All tests
bun test

# Watch mode
bun test --watch

# Specific module
bun test src/portfolio/portfolio-service.test.ts

# Coverage
bun test --coverage
```

Test files use Bun's test runner. See `tests/` directory for examples.

## Debugging

Enable detailed logging:

```bash
DEBUG=* bun run src/index.ts
```

Key debug namespaces:
- `exchange:*` - Exchange API interactions
- `portfolio:*` - Portfolio updates
- `rebalancer:*` - Rebalancing logic
- `executor:*` - Order execution
- `api:*` - API requests

## Contributing

1. **Fork and clone** the repository
2. **Create feature branch**: `git checkout -b feat/your-feature`
3. **Follow code standards** in `./docs/code-standards.md`
4. **Write tests** for new features
5. **Run lint & tests**: `biome check --fix && bun test`
6. **Commit** with conventional commits: `feat(scope): description`
7. **Push** to fork and create PR

See [CLAUDE.md](./CLAUDE.md) for development rules.

## Common Tasks

### Check Portfolio Drift
```bash
curl http://localhost:3000/api/portfolio
# Shows holdings, allocations, drift percentage
```

### Trigger Manual Rebalance
```bash
curl -X POST http://localhost:3000/api/rebalance
# Validates drift, calculates trades, executes
```

### View Trade History
```bash
curl http://localhost:3000/api/trades?limit=20&exchange=binance
# Returns recent trades with prices, fees, timestamps
```

### Backtest Strategy
```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "momentum-tilt",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "capital": 10000
  }'
# Returns Sharpe ratio, returns, drawdown
```

## Production Deployment

See [deployment guide](./docs/deployment-guide.md) for:
- Docker image build
- Environment configuration
- Database setup
- nginx reverse proxy
- systemd service
- VPS security hardening
- Monitoring setup

## Troubleshooting

**Exchange connection**: Check API keys, IP whitelist, firewall.
**Order fails**: Verify balance, minimum order size ($10), pair is active.
**Database error**: Validate `DATABASE_URL`, file is writable, run migration.
**Disconnects**: Automatic reconnection every 5s; check internet & rate limits.

See `docker-compose logs` or set `DEBUG=*` for detailed logging.

## Performance

**Typical rebalance cycle**:
- Portfolio fetch: 200-500ms per exchange
- Calculation: 50-100ms
- Order execution: 500ms-2s
- Total: 1-5 seconds

**Memory usage**: ~300-400MB (Bun + 3 exchanges)

**Database**: SQLite handles 5+ years of trade history efficiently

## Security Notes

- All credentials encrypted at rest
- Never commit `.env` or database files
- Rotate API keys monthly
- Use IP whitelisting on exchange accounts
- Enable 2FA on exchange accounts
- Consider using sub-accounts with limited permissions

## License

MIT - See [LICENSE](LICENSE)

## Support

- GitHub Issues: Report bugs and request features
- Documentation: [./docs/](./docs/)
- Discord: Join our community for discussions
