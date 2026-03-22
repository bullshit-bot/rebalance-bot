---
title: "Phase 2: Analytics & Backtesting Tests"
description: "Tests for analytics, backtesting, tax reporter modules"
status: pending
priority: P1
effort: 5h
tags: [testing, analytics, backtesting]
created: 2026-03-22
---

# Phase 2: Analytics & Backtesting Tests

## Files to Test (9 files)

### Analytics (5 new tests)
- `src/analytics/equity-curve-builder.test.ts` — builds curve from snapshots, handles empty range
- `src/analytics/pnl-calculator.test.ts` — realized PnL from trades, FIFO cost basis, unrealized PnL
- `src/analytics/fee-tracker.test.ts` — aggregates fees by exchange/asset/period
- `src/analytics/drawdown-analyzer.test.ts` — max drawdown calculation, peak/trough dates
- `src/analytics/tax-reporter.test.ts` — FIFO tax lots, CSV export format, year filtering

### Backtesting (4 new tests)
- `src/backtesting/historical-data-loader.test.ts` — fetches OHLCV, caches to DB, incremental sync
- `src/backtesting/backtest-simulator.test.ts` — runs simulation, rebalances at threshold, applies fees
- `src/backtesting/metrics-calculator.test.ts` — Sharpe ratio, drawdown, win rate, annualized return
- `src/backtesting/benchmark-comparator.test.ts` — buy-and-hold comparison, outperformance calc

## Testing Strategy
- Use in-memory DB with seed data for analytics tests
- Mock CCXT fetchOHLCV for historical data loader
- Use known price series for deterministic backtest results
- Verify metrics against hand-calculated values

## Todo List
- [ ] equity-curve-builder.test.ts
- [ ] pnl-calculator.test.ts
- [ ] fee-tracker.test.ts
- [ ] drawdown-analyzer.test.ts
- [ ] tax-reporter.test.ts
- [ ] historical-data-loader.test.ts
- [ ] backtest-simulator.test.ts
- [ ] metrics-calculator.test.ts
- [ ] benchmark-comparator.test.ts
