---
phase: 09
title: Backtesting Page
status: pending
priority: medium
depends_on: [1]
---

# Phase 09: Backtesting Page

## Context

BacktestingPage imports: `BACKTEST_EQUITY_CURVE`, `BACKTEST_METRICS`, `BACKTEST_TRADES`.

Backend endpoints:
- `POST /api/backtest` — run new backtest
- `GET /api/backtest/list` — list saved results
- `GET /api/backtest/:id` — get specific result

## Related Code Files

**Modify:** `frontend/src/pages/BacktestingPage.tsx`
**Create:** `frontend/src/hooks/use-backtest-queries.ts`

## Implementation Steps

1. Create `use-backtest-queries.ts`: `useBacktestList()`, `useBacktestResult(id)`, `useRunBacktest()`
2. Replace static mock display with: form to configure + run backtest, list of past results, detail view
3. Wire run backtest mutation → show loading → display results
4. Add loading/error states

## Todo List

- [ ] Create `use-backtest-queries.ts`
- [ ] Migrate BacktestingPage to real data
- [ ] Wire run backtest form to mutation
- [ ] Add loading/error states

## Success Criteria

- [ ] Can run a new backtest with real params
- [ ] Results display equity curve, metrics, trades from backend
- [ ] Can view past backtest results
- [ ] Zero imports from mockData.ts
