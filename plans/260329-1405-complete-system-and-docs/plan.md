---
title: "Complete System: Tests, Trend Filter, Backtest DCA, Docs"
description: "Finish all remaining work across strategy tests, trend filter production wiring, backtest DCA integration, and documentation updates"
status: completed
priority: P1
effort: 10h
branch: main
tags: [testing, trend-filter, backtest, dca, docs]
created: 2026-03-29
completed: 2026-03-29
---

## Overview

Consolidates remaining work from two incomplete plans plus new trend-filter integration and docs updates into a single execution plan.

**Predecessors:**
- `plans/260328-0014-advanced-strategy-config/` (Phases 1-3,5 need tests)
- `plans/260328-1638-cash-aware-dca-rebalancing/` (Phase 3 incomplete)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Complete Strategy Tests](./phase-01-complete-strategy-tests.md) | ✅ Completed |
| 2 | [Trend Filter Production Integration](./phase-02-trend-filter-production.md) | ✅ Completed |
| 3 | [Backtest DCA + Cash Integration](./phase-03-backtest-dca-cash.md) | ✅ Completed |
| 4 | [Documentation Update](./phase-04-documentation-update.md) | ✅ Completed |

## Dependencies

```
Phase 1 ──┐
           ├──> Phase 4
Phase 2 ──┤
           │
Phase 3 ───┘  (Phase 3 depends on Phase 2 for trend filter backtest coverage)

Phase 1 and Phase 2: PARALLEL (no file overlap)
Phase 3: after Phase 2
Phase 4: after all
```

## File Ownership

| Phase | Owns (create/modify) |
|-------|---------------------|
| 1 | `src/rebalancer/strategies/*.test.ts`, `src/api/routes/strategy-config-routes.test.ts` |
| 2 | `src/rebalancer/drift-detector.ts`, `src/rebalancer/trend-filter.ts` (whipsaw cooldown), `src/rebalancer/rebalance-engine.ts` |
| 3 | `src/backtesting/backtest-simulator.ts`, `src/backtesting/metrics-calculator.ts`, `scripts/run-optimization.ts` |
| 4 | `docs/*` |

No file overlap between parallel phases (1 and 2).

## Risk Summary

| Risk | L x I | Mitigation |
|------|-------|------------|
| Strategy tests reveal bugs in impl | M x M | Fix in same phase; implementations are simple pure functions |
| Trend filter whipsaw in production | H x H | Cooldown period (default 3 days) prevents rapid flip-flop |
| Backtest DCA changes break existing results | M x H | Backward compat: all new fields optional, default = no-op |
| Docs drift from code | L x L | Phase 4 reads final code state, runs after all impl |

## Rollback

- Phase 1: Delete test files. No production code changes.
- Phase 2: Revert drift-detector.ts and trend-filter.ts to previous commit.
- Phase 3: Revert backtest-simulator.ts and metrics-calculator.ts. New fields are optional = no breakage.
- Phase 4: Docs-only changes, revert via git.
