# Planner Report: Complete System & Docs

**Date**: 2026-03-29
**Plan**: `plans/260329-1405-complete-system-and-docs/`

## Summary

Created unified 4-phase plan consolidating all remaining work from two incomplete plans plus new trend-filter production integration and docs updates.

## Phases

| # | Phase | Effort | Parallel? |
|---|-------|--------|-----------|
| 1 | Complete Strategy Tests (5 test files, ~34 cases) | 3h | Yes (with P2) |
| 2 | Trend Filter Production (whipsaw cooldown, RebalanceEngine bear-mode, bull recovery) | 3h | Yes (with P1) |
| 3 | Backtest DCA+Cash+TrendFilter (DCA injection, cash tracking, 16-scenario comparison) | 3h | After P2 |
| 4 | Documentation Update (4 docs + mark 2 plans completed) | 1h | After all |

## Key Architecture Decisions

1. **Whipsaw protection**: 3-day cooldown between trend flips (new `trendFilterCooldownDays` in GlobalSettings). Persisted to DB for restart resilience.
2. **Bear trigger payload**: DriftDetector includes `bearCashPct` in event payload so RebalanceEngine can pass it to trade-calculator without re-reading config.
3. **Backtest trend filter**: Simplified MA simulation inline (no TrendFilter class dependency) — keeps backtest self-contained and deterministic.
4. **All new BacktestConfig fields optional**: Zero backward compat risk.

## File Ownership (No Conflicts)

- Phase 1: `src/rebalancer/strategies/*.test.ts`, `src/api/routes/strategy-config-routes.test.ts`, `src/backtesting/strategy-backtest-adapter.test.ts`
- Phase 2: `src/rebalancer/drift-detector.ts`, `src/rebalancer/trend-filter.ts`, `src/rebalancer/rebalance-engine.ts`, `src/rebalancer/strategies/strategy-config-types.ts`
- Phase 3: `src/backtesting/backtest-simulator.ts`, `src/backtesting/metrics-calculator.ts`, `scripts/run-dca-backtest-comparison.ts`
- Phase 4: `docs/*`, predecessor `plan.md` files

## What This Completes

- Advanced Strategy Config plan: Phases 1-3,5 tests written (Phase 4 already done)
- Cash-Aware DCA plan: Phase 3 fully implemented
- NEW: Trend filter production-ready with whipsaw protection
- All docs current

## Files Created

- `plans/260329-1405-complete-system-and-docs/plan.md`
- `plans/260329-1405-complete-system-and-docs/phase-01-complete-strategy-tests.md`
- `plans/260329-1405-complete-system-and-docs/phase-02-trend-filter-production.md`
- `plans/260329-1405-complete-system-and-docs/phase-03-backtest-dca-cash.md`
- `plans/260329-1405-complete-system-and-docs/phase-04-documentation-update.md`

**Status:** DONE
**Summary:** Created complete 4-phase plan (10h total effort) with dependency graph, file ownership, risk mitigations, and detailed implementation steps per phase.
