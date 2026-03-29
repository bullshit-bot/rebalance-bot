---
name: system_overview
description: Comprehensive knowledge of the rebalance-bot system architecture, features, and optimal configurations. Use when user asks about the bot, how it works, or needs guidance.
metadata:
  goclaw:
    emoji: 🤖
    requires:
      bins:
        - mcporter
---

# Rebalance Bot — System Overview

Complete system knowledge for the crypto rebalance bot.

## What This Bot Does

Automated cryptocurrency portfolio rebalancing across Binance, OKX, and Bybit. Monitors portfolio drift, executes trades to maintain target allocations, and supports advanced strategies.

## Architecture

```
Price Feeds (WebSocket) → PriceService → EventBus
                                            ↓
DCA Deposits → DCAService → DCATargetResolver (buy most underweight)
                                            ↓
TrendFilter (BTC MA100) → DriftDetector → StrategyManager → TradeCalculator → Executor
                              ↓                                                    ↓
                        RebalanceEngine ←──────────────────────────────────────────┘
                              ↓
                     Telegram Alerts + Dashboard
```

## Core Features

### 1. Rebalancing Engine
- 6 strategy types: threshold, equal-weight, momentum-tilt, vol-adjusted, mean-reversion, momentum-weighted
- Database-driven config with hot-reload (no restart needed)
- Paper trading mode for testing

### 2. Trend Filter (Most Important Feature)
- Uses BTC SMA (default MA100) to detect bull/bear markets
- Bear mode: sells 90% of portfolio to USDT, preserving capital
- Bull mode: normal rebalancing resumes
- Whipsaw cooldown: 3-day minimum between state changes
- **Backtest proven**: increases return from +48% to +150% over 5 years, reduces drawdown from -62% to -35%

### 3. DCA (Dollar-Cost Averaging)
- Daily deposits routed to most underweight asset
- Cash reserve: keeps 0-50% in USDT as buffer
- DCA rebalance mode: only full rebalance at high drift (15%+)

### 4. Backtesting
- Historical OHLCV data from Binance (5+ years available)
- Grid search optimizer: tests 4800+ parameter combinations
- Metrics: return %, annualized %, Sharpe ratio, max drawdown, fees
- Benchmark: compares strategy vs buy-and-hold

## Optimal Configuration (Backtest Validated)

| Parameter | Value | Reason |
|-----------|-------|--------|
| Allocation | BTC 40% / ETH 25% / BNB 15% / SOL 20% | Blue-chip heavy, SOL for upside |
| Strategy | threshold (5%) | Simple, effective |
| Trend filter | MA100, Bear 90% cash | 3x return improvement |
| Cooldown | 3 days | Prevents whipsaw |
| Cash reserve | 10% | Buffer for opportunities |
| DCA rebalance | enabled | Reduces trading fees |
| DCA amount | $20/day | Steady accumulation |

### Backtest Results (2021-2026, $1000 + $20/day DCA)

| Config | Invested | Final | Profit | Return | Max DD |
|--------|----------|-------|--------|--------|--------|
| No filter | $37,500 | $55,430 | +$17,930 | +48% | -62.5% |
| MA100 filter | $37,500 | $93,733 | +$56,233 | +150% | -34.7% |
| MA100 + SOL 20% | $37,500 | $98,725 | +$61,225 | +163% | -33.7% |
| 6Y MA100 filter | $42,120 | $356,660 | +$314,540 | +747% | -32.7% |

## MCP Tools Available

| Tool | Description |
|------|-------------|
| get_health | System health check |
| get_portfolio | Current holdings, weights, total value |
| get_allocations | Target allocation percentages |
| set_allocations | Set all target allocations (full replace) |
| delete_allocation | Remove an asset allocation |
| trigger_rebalance | Execute rebalance |
| get_rebalance_history | Past rebalance events |
| list_trades | Recent executed trades |
| get_strategy_config | Active strategy config + list |
| list_strategy_presets | Built-in strategy presets |
| activate_strategy | Switch active strategy |
| update_strategy_config | Update strategy parameters |
| run_backtest | Run backtest simulation |
| list_backtests | Previous backtest results |
| get_ai_suggestions | AI allocation recommendations |
| approve_suggestion | Approve AI suggestion |
| reject_suggestion | Reject AI suggestion |

## Available GoClaw Skills

| Skill | Description |
|-------|-------------|
| portfolio_monitor | Monitor drift, trend state, cash reserve |
| auto_rebalance | Full rebalance cycle with safety checks |
| allocation_advisor | Analyze and suggest allocation changes |
| market_analysis | Trade history and concentration analysis |
| crypto_news | AI suggestions with portfolio context |
| backtest_analyzer | Run backtests, compare strategies |
| strategy_manager | View/switch strategy configurations |
| system_overview | This skill — system knowledge |

## Key Concepts for Users

### When to Rebalance
- Drift > 5%: standard rebalance
- Drift > 15%: forced rebalance (even in DCA mode)
- Bear market: DON'T rebalance, sell to cash instead

### Understanding Trend Filter
- BTC above MA100 = Bull → normal operations
- BTC below MA100 = Bear → sell to 90% cash
- Cooldown prevents rapid switching (minimum 3 days between flips)
- This single feature is responsible for 3x return improvement in backtests

### Risk Management
- Max drawdown with trend filter: ~35% (vs ~63% without)
- Cash reserve provides liquidity for DCA opportunities
- Never invest more than you can afford to lose
- Paper trading recommended before live deployment
