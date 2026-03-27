---
title: "Advanced Strategy Config System"
description: "Database-driven strategy config with mean-reversion bands, vol-adjusted thresholds, momentum weighting, and frontend integration"
status: pending
priority: P1
effort: 12h
branch: main
tags: [strategy, config, backend, frontend, mongodb]
created: 2026-03-28
---

# Advanced Strategy Config System

## Context

Current state: strategy params live in `.env` (loaded once at startup via `app-config.ts`). Frontend `StrategyConfigPage` uses localStorage with hardcoded defaults — no backend connection. StrategyManager supports 4 modes but can't persist config changes or switch strategy types at runtime from the UI.

Goal: database-driven strategy configuration with new strategy implementations (mean-reversion bands, vol-adjusted dynamic thresholds, momentum-weighted rebalancing) and full frontend integration.

## Key Decisions

1. **Single `strategy_configs` collection** with polymorphic `params` field (discriminated union via Zod)
2. **Hot-reload via EventBus** — `strategy:config-changed` event triggers StrategyManager re-read
3. **Env vars remain as fallback** — if no active DB config exists, fall back to env defaults
4. **New strategies extend existing architecture** — MeanReversionStrategy and VolAdjustedStrategy are new modules under `src/rebalancer/strategies/`; they integrate with existing DriftDetector + RebalanceEngine
5. **Momentum-weighted is Phase 5** (deferred) — higher complexity, needs solid foundation first

## Research Reports

- [Advanced Rebalancing Strategies](../reports/researcher-260328-0014-advanced-rebalancing-strategies.md)
- [Strategy Config Backend Patterns](../reports/researcher-260328-0014-strategy-config-backend-patterns.md)

## Phase Table

| # | Phase | Status |
|---|-------|--------|
| 1 | [Strategy Config Backend](./phase-01-strategy-config-backend.md) | Pending |
| 2 | [Mean-Reversion Bands Strategy](./phase-02-mean-reversion-bands.md) | Pending |
| 3 | [Volatility-Adjusted Thresholds](./phase-03-volatility-adjusted-thresholds.md) | Pending |
| 4 | [Frontend Strategy Config Integration](./phase-04-frontend-integration.md) | ✅ Completed |
| 5 | [Momentum-Weighted Rebalancing](./phase-05-momentum-weighted-rebalancing.md) | Pending |

## Dependencies

- Phase 2, 3 depend on Phase 1 (need config model to store strategy params)
- Phase 4 depends on Phase 1 (needs API endpoints)
- Phase 5 depends on Phase 1 (needs config model + scoring infrastructure)
- Phases 2 and 3 are independent of each other

## Risk Summary

| Risk | Mitigation |
|------|------------|
| Hot-reload race conditions | Use version field + optimistic locking |
| Strategy switching mid-rebalance | Check `isExecuting` flag before applying new config |
| Env fallback conflicts with DB config | DB config always wins if present; env is bootstrap-only |
| Frontend type drift from backend | Share Zod schemas via `shared/` or generate types |
