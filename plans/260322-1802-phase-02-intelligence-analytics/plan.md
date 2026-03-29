---
title: "Phase 2: Intelligence & Analytics"
description: "Backtesting engine, portfolio analytics dashboard API, tax/PnL reports with CSV export"
status: completed
priority: P1
effort: 30h
tags: [crypto, analytics, backtesting, phase-2]
created: 2026-03-22
---

# Phase 2: Intelligence & Analytics

## Context

- Master plan: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-core-engine.md) (core engine must be running)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Implementation | ✅ Completed |

## Overview

- **Priority**: P1
- **Status**: Pending
- **Effort**: 30h
- **Description**: Backtesting engine, portfolio analytics dashboard API, tax/PnL reporting

## Key Insights

- Freqtrade's backtesting is gold standard: OHLCV data, Sharpe ratio, drawdown, equity curves
- Backtesting reuses same RebalanceEngine logic from Phase 1 (DRY)
- Historical OHLCV data available free from exchanges via CCXT `fetchOHLCV()`
- PnL calculation: FIFO/LIFO cost basis methods
- Analytics API powers React charts (frontend renders, backend computes)

## Requirements

### Functional
- F1: Download historical OHLCV data for tracked assets (1m/5m/1h/1d candles)
- F2: Run backtest simulation with configurable parameters (threshold, period, assets, date range)
- F3: Generate backtest metrics: total return, Sharpe ratio, max drawdown, win rate, trade count, fees
- F4: Compare strategy vs buy-and-hold benchmark
- F5: Portfolio analytics API: equity curve, PnL by day/week/month, asset performance, fee tracking
- F6: Drawdown chart data (peak-to-trough analysis)
- F7: Tax report: realized PnL per trade, export CSV, FIFO cost basis
- F8: Unrealized PnL tracking for open positions

### Non-Functional
- NF1: Backtest 2 years of 1h candles for 5 assets in < 30 seconds
- NF2: Historical data cached in libSQL (no re-download)
- NF3: CSV export for tax tools (Koinly/CoinTracking compatible)

## Architecture

```
┌─────────────────────────────────────────────┐
│              BACKTESTING ENGINE              │
│                                              │
│  HistoricalDataLoader                        │
│     ↓ (OHLCV from CCXT → cache in libSQL)   │
│  BacktestSimulator                           │
│     ↓ (reuse RebalanceEngine + TradeCalc)    │
│  MetricsCalculator                           │
│     ↓ (Sharpe, drawdown, returns)            │
│  BenchmarkComparator                         │
│     ↓ (vs buy-and-hold)                      │
│  BacktestReporter                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           ANALYTICS ENGINE                   │
│                                              │
│  EquityCurveBuilder (from snapshots table)   │
│  PnLCalculator (realized + unrealized)       │
│  FeeTracker (aggregate from trades)          │
│  DrawdownAnalyzer (peak-to-trough)           │
│  TaxReporter (FIFO cost basis, CSV export)   │
└─────────────────────────────────────────────┘
```

## Files to Create

```
src/
├── backtesting/
│   ├── historical-data-loader.ts    # Fetch + cache OHLCV data
│   ├── backtest-simulator.ts        # Run simulation using RebalanceEngine
│   ├── metrics-calculator.ts        # Sharpe, drawdown, returns, win rate
│   └── benchmark-comparator.ts      # Compare vs buy-and-hold
├── analytics/
│   ├── equity-curve-builder.ts      # Build equity curve from snapshots
│   ├── pnl-calculator.ts            # Realized + unrealized PnL
│   ├── fee-tracker.ts               # Aggregate fee analysis
│   ├── drawdown-analyzer.ts         # Peak-to-trough drawdown
│   └── tax-reporter.ts              # FIFO cost basis + CSV export
├── api/routes/
│   ├── backtest-routes.ts           # Backtest API endpoints
│   └── analytics-routes.ts         # Analytics + tax API endpoints
├── db/
│   └── schema.ts                    # ADD: ohlcv_candles table
```

## Database Schema (additions)

```sql
-- Historical OHLCV data cache
CREATE TABLE ohlcv_candles (
  id INTEGER PRIMARY KEY,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT NOT NULL,       -- '1m', '5m', '1h', '1d'
  timestamp INTEGER NOT NULL,    -- Unix ms
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  UNIQUE(exchange, pair, timeframe, timestamp)
);
CREATE INDEX idx_ohlcv_lookup ON ohlcv_candles(exchange, pair, timeframe, timestamp);

-- Backtest results
CREATE TABLE backtest_results (
  id TEXT PRIMARY KEY,
  config JSON NOT NULL,          -- {threshold, period, assets, dateRange}
  metrics JSON NOT NULL,         -- {return, sharpe, drawdown, winRate, ...}
  trades JSON NOT NULL,          -- simulated trade list
  benchmark JSON NOT NULL,       -- buy-and-hold comparison
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints (additions)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/backtest` | Run backtest with params |
| GET | `/api/backtest/:id` | Get backtest result |
| GET | `/api/backtest/list` | List past backtests |
| GET | `/api/analytics/equity-curve` | Equity curve data (with date range) |
| GET | `/api/analytics/pnl` | PnL breakdown (daily/weekly/monthly) |
| GET | `/api/analytics/drawdown` | Drawdown analysis |
| GET | `/api/analytics/fees` | Fee summary |
| GET | `/api/analytics/assets` | Per-asset performance |
| GET | `/api/tax/report` | Tax report (date range) |
| GET | `/api/tax/export` | CSV export (Koinly-compatible) |

## Implementation Steps

### Step 1: Historical Data Loader (4h)
1. Create `src/backtesting/historical-data-loader.ts`
2. Fetch OHLCV via CCXT `fetchOHLCV()` with pagination
3. Cache to libSQL ohlcv_candles table
4. Incremental sync: only fetch new candles since last cached
5. Support timeframes: 1h (primary), 1d (overview)

### Step 2: Backtest Simulator (8h)
1. Create `src/backtesting/backtest-simulator.ts`
2. Reuse `RebalanceEngine` + `TradeCalculator` from Phase 1
3. Simulate portfolio over time with configurable:
   - Start/end date
   - Initial balance
   - Target allocations
   - Threshold % (1-10%)
   - Rebalance period (if periodic)
   - Fee % per trade
4. Track: portfolio value at each candle, simulated trades, fees paid

### Step 3: Metrics Calculator (4h)
1. Create `src/backtesting/metrics-calculator.ts`
2. Calculate from simulation results:
   - Total return %
   - Annualized return
   - Sharpe ratio (risk-adjusted return)
   - Max drawdown % (largest peak-to-trough)
   - Win rate (% of profitable rebalances)
   - Total trades count
   - Total fees paid
   - Average trade size
3. Create `src/backtesting/benchmark-comparator.ts`
4. Compare vs simple buy-and-hold (same initial allocation, no rebalancing)

### Step 4: Analytics Engine (6h)
1. Create `src/analytics/equity-curve-builder.ts` — query snapshots, build time series
2. Create `src/analytics/pnl-calculator.ts` — realized PnL from trades, unrealized from current prices
3. Create `src/analytics/fee-tracker.ts` — aggregate fees by period, exchange, asset
4. Create `src/analytics/drawdown-analyzer.ts` — peak-to-trough analysis from equity curve

### Step 5: Tax Reporter (4h)
1. Create `src/analytics/tax-reporter.ts`
2. FIFO cost basis calculation per asset
3. Realized gains/losses per trade
4. Aggregate by tax year
5. CSV export compatible with Koinly format:
   - Date, Sent Amount, Sent Currency, Received Amount, Received Currency, Fee, Fee Currency, Net Worth Amount, Net Worth Currency, Label, Description, TxHash

### Step 6: API Routes (4h)
1. Create `src/api/routes/backtest-routes.ts` — POST to run, GET results
2. Create `src/api/routes/analytics-routes.ts` — equity, PnL, fees, drawdown, tax
3. Add WebSocket events for backtest progress (long-running)

## Todo List

- [x] Step 1: Historical OHLCV data loader + caching
- [x] Step 2: Backtest simulator (reuse Phase 1 engine)
- [x] Step 3: Metrics calculator (Sharpe, drawdown, returns) + benchmark
- [x] Step 4: Analytics engine (equity curve, PnL, fees, drawdown)
- [x] Step 5: Tax reporter (FIFO cost basis + CSV export)
- [x] Step 6: API routes for backtest + analytics + tax

## Success Criteria

- [x] Backtest 2 years of 5 assets completes in < 30 seconds
- [x] Metrics match manual calculation (spot-check)
- [x] Equity curve data renders correctly in React chart
- [x] CSV export imports successfully into Koinly
- [x] Benchmark comparison shows rebalance vs hold difference
- [x] Historical data cached, no re-download on re-run

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Exchange rate limit on OHLCV fetch | Medium | Batch requests, cache aggressively, sleep between pages |
| Backtest too slow for large datasets | Medium | In-memory simulation, indexed DB queries |
| FIFO calculation errors | High | Unit test with known scenarios, cross-check with Koinly |
| Survivorship bias in backtest | Low | Document limitation, note delisted assets excluded |
