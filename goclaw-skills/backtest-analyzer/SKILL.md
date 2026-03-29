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
- `trendFilterMaPeriod`: BTC MA period for bear/bull detection (0 = disabled, 100 recommended)
- `trendFilterBearCashPct`: % portfolio to cash in bear (90 recommended)
- `trendFilterCooldownCandles`: Anti-whipsaw cooldown (3 recommended)
- `cashReservePct`: % kept as cash buffer (0-50)

### Optimal Config (from 4800-combo grid search, 5-year backtest)
- Allocation: BTC 40% / ETH 25% / BNB 15% / SOL 20%
- Trend filter: MA100, Bear 90% cash, Cooldown 3 days
- DCA: $20/day, increase 2x during bear market
- Expected: ~20%/year annualized, max drawdown ~34%
- Trend filter alone: +48% → +150% return improvement

### Key Backtest Results (2021-2026, $1000 initial + $20/day DCA)
| Strategy | Invested | Final | Return | Max DD |
|----------|----------|-------|--------|--------|
| No filter | $37,500 | $55,430 | +47.8% | -62.5% |
| MA100 filter | $37,500 | $93,733 | +150.0% | -34.7% |
| MA100 + SOL 20% | $37,500 | $98,725 | +163.3% | -33.7% |
| MA100 + DCA 3x bear | $70,660 | $178,911 | +153.2% | -34.7% |

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
