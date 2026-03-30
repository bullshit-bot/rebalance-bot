---
name: backtest_analyzer
description: Run backtests, compare strategies, and analyze results using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 📊
    requires:
      bins:
        - mcporter
---

# Backtest Analyzer

Run and analyze backtesting results across different strategies and configurations.

## System Knowledge

### Available Strategies
- **threshold**: Fixed drift threshold (default 5%). Simplest approach.
- **equal-weight**: Equal allocation across all assets with threshold rebalancing.
- **momentum-tilt**: Adjusts allocation based on momentum window (14-day default).
- **vol-adjusted**: Dynamic threshold scaled by portfolio volatility.
- **mean-reversion**: Bollinger-band style drift tracking, rebalances at band extremes.
- **momentum-weighted**: RSI + MACD composite score adjusts asset weights.

### Backtest Config Fields
- `pairs`: Trading pairs (e.g., ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT"])
- `allocations`: Target allocation per asset (asset, targetPct, minTradeUsd)
- `startDate/endDate`: Unix ms timestamps
- `initialBalance`: Starting USD amount
- `threshold`: Drift % trigger (e.g., 5)
- `feePct`: Fee per trade (e.g., 0.001 = 0.1%)
- `timeframe`: "1d" or "1h"
- `exchange`: "binance", "okx", or "bybit"
- `dcaAmountUsd`: DCA injection per interval (0 = disabled)
- `dcaIntervalCandles`: How often to inject DCA (1 = every candle)
- `trendFilterMaPeriod`: BTC MA period for bear/bull detection (0 = disabled, 120 optimal from grid search)
- `trendFilterBuffer`: % buffer below MA still treated as bull (0 to 5%, optimal 0%)
- `trendFilterBearCashPct`: % portfolio to cash in bear (100 optimal from backtest)
- `trendFilterCooldownCandles`: Anti-whipsaw cooldown in days (1 optimal from grid search)
- `cashReservePct`: % kept as cash buffer (0-50)

### Optimal Config (from 5040-combo grid search, 5-year backtest, 2026-03-31)
- Allocation: BTC 40% / ETH 25% / SOL 20% / BNB 15%
- Trend filter: MA120, Buffer 0%, Bear 100% cash, Cooldown 1 day
- DCA: $20/day scheduled at 07:00 VN
- Expected: ~30.5%/year annualized (2021-2026 historical)
- Max drawdown: -34% (vs -85% without trend filter)
- Trend filter impact: +48% → +284% return improvement (5.9x)

### Key Backtest Results (2021-2026, $1000 initial + $20/day DCA = $37,500 invested)
| Strategy | Final Balance | Return | Sharpe | Max DD | Notes |
|----------|---------------|--------|--------|--------|-------|
| No filter, no DCA | $10,870 | +387% | 0.80 | -85% | Benchmark (buy & hold) |
| MA110/TH8/CD1/Bear100 | $24,280 | +242.8% | 2.23 | -39.4% | Previous optimal (v1.0.2, invalid) |
| **MA120/TH10/CD1/Bear100, Buf0** | **$28,400** | **+284.0%** | **2.29** | **-34.0%** | **Current optimal (v1.0.3)** |

**Note:** Previous 672-combo grid search results invalidated due to backtest engine fixes (double-division trade amount bug, DCA fees not deducted, trend buffer missing). Re-ran full 5040-combo optimization after fixes.

## Workflow

1. Run `mcporter call rebalance-bot.get_strategy_config` — check current strategy config.
2. Run `mcporter call rebalance-bot.run_backtest` with parameters:
   - strategy: current or requested strategy type
   - startDate/endDate: requested period
   - capital: initial balance
3. Parse results: total return, annualized return, Sharpe ratio, max drawdown, trade count, fees.
4. Compare against benchmarks:
   - Buy & hold (same allocation, no rebalancing)
   - S&P 500 (~13%/year historical average)
5. Present analysis:
   - Performance metrics table
   - Risk metrics (drawdown, volatility, Sharpe)
   - Comparison vs benchmarks
   - Recommendation: which strategy config is optimal
6. If user asks to optimize: suggest running grid search via CLI:
   `bun run scripts/run-backtest-optimizer.ts`
