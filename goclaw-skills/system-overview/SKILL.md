---
name: system_overview
description: Comprehensive knowledge of the rebalance-bot system architecture, features, and optimal configurations. Use when user asks about the bot, how it works, or needs guidance.
metadata:
  goclaw:
    emoji: 🤖
    requires:
      mcp_tools:
        - rb_get_health
        - rb_get_portfolio
        - rb_get_strategy_config
        - rb_list_allocations
---

# Rebalance Bot — System Overview

Complete system knowledge for the crypto rebalance bot.

## What This Bot Does

Automated cryptocurrency portfolio rebalancing across Binance, OKX, and Bybit. Monitors portfolio drift, executes trades to maintain target allocations, and supports advanced strategies.

## Architecture

```
Price Feeds (REST polling, 10s) → PriceService → EventBus
                                                      ↓
DCA Deposits → DCAService → DCATargetResolver (crypto-only %, buy most underweight)
                                                      ↓
TrendFilter (BTC MA) → DriftDetector → StrategyManager → TradeCalculator (DCA budget cap) → Executor
                           ↓                                                                      ↓
                   RebalanceEngine ←──────────────────────────────────────────────────────────┘
                           ↓
                  GoClaw (Telegram) + Dashboard
```

**Key Change**: Price feeds now use REST polling (fetchTicker, 10s interval) instead of WebSocket (Bun runtime compatibility).

## Core Features

### 1. Rebalancing Engine
- 6 strategy types: threshold, equal-weight, momentum-tilt, vol-adjusted, mean-reversion, momentum-weighted
- Database-driven config with hot-reload (no restart needed)
- Paper trading mode for testing

### 2. Trend Filter (Most Important Feature)
- Uses BTC SMA (configurable, default MA100) to detect bull/bear markets
- Bear mode: sells to configured cash % (default 70%, optimal 100%), preserving capital
- Bull mode: normal rebalancing resumes
- Whipsaw cooldown: configurable days between state changes (default 1-3 days)
- **Backtest proven**: increases return from +48% to +242% over 5 years, reduces drawdown from -85% to -39%

### 3. DCA (Dollar-Cost Averaging)
- Daily deposits routed to most underweight asset (crypto-only allocations, excludes stablecoins from denominator)
- Configurable amount: dcaAmountUsd ($1-$100k, default $20)
- Cash reserve: keeps 0-50% in stablecoins as buffer
- DCA rebalance mode: caps rebalance trades to dcaAmountUsd budget, only full rebalance at high drift (15%+)
- Manual trigger: `POST /api/dca/trigger` endpoint for ad-hoc execution

### 4. Backtesting
- Historical OHLCV data from Binance (5+ years available)
- Grid search optimizer: tests 4800+ parameter combinations
- Metrics: return %, annualized %, Sharpe ratio, max drawdown, fees
- Benchmark: compares strategy vs buy-and-hold

## Optimal Configuration (4800-combo Grid Search, 2026-03-30) — PRODUCTION ACTIVE

Current active config on production: `optimal-backtest-validated` v4

| Parameter | Value | Reason |
|-----------|-------|--------|
| Allocation | BTC 40% / ETH 25% / SOL 20% / BNB 15% (crypto-only) | Blue-chip heavy, excludes stablecoins |
| Strategy | threshold (**8%**) | Less trades, let profit run |
| Trend filter | **MA110**, Bear **100%** cash | Smoother signal, full capital preservation |
| Cooldown | **1 day** | Fast trend response |
| Cash reserve | 0% | Trend filter handles protection |
| DCA rebalance | enabled | Caps rebalance trades to dcaAmountUsd |
| DCA amount | **$20/day** | Scheduled at 07:00 VN, manual trigger available |

### Backtest Results (2021-2026, $1000 initial + $20/day DCA)

| Config | Return | Annualized | Sharpe | Max DD |
|--------|--------|-----------|--------|--------|
| Old (MA100/TH5/CD3/Bear90) | +133.9% | +18.5% | 2.01 | -43.2% |
| **Active (MA110/TH8/CD1/Bear100, DCA budget cap)** | **+242.8%** | **+28.0%** | **2.23%** | **-39.4%** |
| No trend filter (no DCA) | +387% | - | 0.80 | -85% |

**Key insights:** Trend filter single-handedly provides 3x return improvement and cuts max drawdown from -85% to -39%. DCA budget cap prevents over-trading. Validated across 4800+ parameter combinations.

## MCP Tools Available (28 tools)

| Group | Tool | Description |
|-------|------|-------------|
| Health | get_health | System health check |
| Portfolio | get_portfolio | Current holdings, weights, total value |
| Portfolio | list_allocations | Target allocation percentages |
| Portfolio | set_allocations | Set all target allocations (full replace) |
| Portfolio | delete_allocation | Remove an asset allocation |
| Rebalance | trigger_rebalance | Execute rebalance |
| Rebalance | get_rebalance_history | Past rebalance events |
| Trading | list_trades | Recent executed trades |
| Strategy | get_strategy_config | Active strategy config + list |
| Strategy | list_strategy_presets | Built-in strategy presets |
| Strategy | activate_strategy | Switch active strategy |
| Strategy | update_strategy_config | Update strategy parameters |
| Backtest | run_backtest | Run backtest simulation |
| Backtest | list_backtests | Previous backtest results |
| AI | get_ai_suggestions | AI allocation recommendations |
| AI | approve_suggestion | Approve AI suggestion |
| AI | reject_suggestion | Reject AI suggestion |
| AI | update_ai_config | Set autoApprove flag and maxShiftPct |
| Copy Trading | list_copy_sources | Copy trading sources being tracked |
| Copy Trading | create_copy_source | Add new copy trading source |
| Copy Trading | delete_copy_source | Remove copy source by ID |
| Grid Trading | create_grid_bot | Create grid trading bot (normal/reverse) |
| Grid Trading | list_grid_bots | Active and stopped grid bots with PnL |
| Grid Trading | stop_grid_bot | Stop running grid bot |
| Smart Orders | create_smart_order | TWAP/VWAP order execution |
| Smart Orders | list_smart_orders | Active smart orders with progress |
| Smart Orders | cancel_smart_order | Cancel pending/running smart order |
| Config | get_config | System configuration |

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
- BTC above MA period = Bull → normal operations
- BTC below MA period = Bear → sell to configured cash % (default 70%, optimal 100%)
- Cooldown prevents rapid switching (default 1-3 days between flips)
- This single feature is responsible for 3x return improvement in backtests

### Understanding DCA Budget Cap
- When dcaRebalanceEnabled=true, rebalance trades cap to dcaAmountUsd ($20 default)
- Prevents large rebalances from exceeding DCA budget
- Trend filter bear/bull triggers still do full rebalance (hard boundary prioritized)
- Crypto-only allocations: target % computed excluding stablecoins from denominator

### Risk Management
- Max drawdown with trend filter: ~35% (vs ~63% without)
- Cash reserve provides liquidity for DCA opportunities
- Never invest more than you can afford to lose
- Paper trading recommended before live deployment
