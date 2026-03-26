# API Reference — Rebalance Bot Endpoints

Base URL: `http://backend:3001/api` (internal Docker network)

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health — exchange connectivity, bot state |

## Portfolio

| Method | Path | Description |
|--------|------|-------------|
| GET | `/portfolio` | Current holdings, weights, total value, unrealised P&L |
| GET | `/allocations` | Target allocation percentages per asset |
| POST | `/allocations/:asset` | Set target allocation for a specific asset |

## Rebalance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rebalance` | Trigger a manual rebalance toward target allocations |
| GET | `/rebalance/history` | Past rebalance operations with status and timestamps |

## Trades

| Method | Path | Description |
|--------|------|-------------|
| GET | `/trades` | Trade history — query params: `limit`, `exchange` |
| GET | `/orders` | Active open orders |

## Configuration

| Method | Path | Description |
|--------|------|-------------|
| POST | `/config` | Update bot configuration (thresholds, exchanges, etc.) |

## Backtest

| Method | Path | Description |
|--------|------|-------------|
| POST | `/backtest` | Run a backtest with given strategy params and date range |
| GET | `/backtest/:id/results` | Retrieve backtest results by ID |

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Performance metrics — Sharpe ratio, drawdown, returns |

## Grid Trading

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grid/list` | List all grid bots with P&L |
| POST | `/grid` | Create a new grid bot |
| GET | `/grid/:id` | Get specific grid bot status and P&L |
| PUT | `/grid/:id/stop` | Stop a running grid bot |

## Smart Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/smart-order` | Create a smart order (DCA, TWAP, trailing stop) |
| GET | `/smart-order/active` | List active smart orders with execution progress |
| GET | `/smart-order/:id` | Get smart order details and progress |
| PUT | `/smart-order/:id/pause` | Pause a smart order |
| PUT | `/smart-order/:id/resume` | Resume a paused smart order |
| PUT | `/smart-order/:id/cancel` | Cancel a smart order |

## AI Suggestions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/suggestion` | Submit an AI-generated allocation suggestion |
| GET | `/ai/suggestions` | List suggestions — query param: `pending=true` to filter |
| PUT | `/ai/suggestion/:id/approve` | Approve a pending suggestion |
| PUT | `/ai/suggestion/:id/reject` | Reject a pending suggestion |
| PUT | `/ai/config` | Update AI module configuration |
| GET | `/ai/summary` | Get AI suggestion summary and stats |

## Copy Trading

| Method | Path | Description |
|--------|------|-------------|
| POST | `/copy/source` | Register a copy trading source |
| GET | `/copy/sources` | List all registered copy sources |
| PUT | `/copy/source/:id` | Update a copy source configuration |
| DELETE | `/copy/source/:id` | Remove a copy source |
| POST | `/copy/sync` | Trigger a manual sync from copy sources |
| GET | `/copy/history` | Copy trading sync history |
