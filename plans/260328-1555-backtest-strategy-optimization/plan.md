---
title: "Strategy-Aware Backtest + 5-Year Optimization"
description: "Make backtest engine strategy-aware, fetch 5yr data, grid-search optimizer, frontend UI"
status: completed
priority: P1
effort: 12h
branch: main
tags: [backtesting, optimization, strategies, frontend]
created: 2026-03-28
---

# Strategy-Aware Backtest + 5-Year Optimization

## Goal
Extend backtest engine to support all 6 strategy types, fetch 5 years of Binance OHLCV data, build a grid-search optimizer to find optimal strategy params (max Sharpe), and show results in frontend.

## Key Decisions
- Extend `BacktestConfig` with optional `strategyType` + `strategyParams` (backward compatible)
- Use Binance public REST API directly (no auth) for historical data fetcher script
- Grid search runs server-side; frontend triggers via API and displays results
- Composite score: 0.4*Sharpe + 0.3*totalReturn + 0.3*(1-maxDrawdown)
- Strategy instances created per-backtest-run (no shared singleton state)

## Phase Table

| # | Phase | Status |
|---|-------|--------|
| 1 | Strategy-Aware Backtest Engine | ✅ Completed |
| 2 | Historical Data Fetcher (5 Years) | ✅ Completed |
| 3 | Strategy Optimizer (Grid Search) | ✅ Completed |
| 4 | Frontend Optimization UI | ✅ Completed |

## Dependencies
- Phase 2 can run in parallel with Phase 1
- Phase 3 depends on Phase 1 + Phase 2
- Phase 4 depends on Phase 3

## Files Overview
- `src/backtesting/backtest-simulator.ts` — main modification target
- `src/backtesting/metrics-calculator.ts` — extend BacktestConfig type
- `src/backtesting/strategy-optimizer.ts` — NEW
- `src/backtesting/strategy-backtest-adapter.ts` — NEW (bridge strategies to backtest)
- `scripts/fetch-historical-data.ts` — NEW
- `src/api/routes/backtest-routes.ts` — add optimize endpoint
- `frontend/src/pages/BacktestingPage.tsx` — add optimizer tab
