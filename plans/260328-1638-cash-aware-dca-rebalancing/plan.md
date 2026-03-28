---
title: "Cash-Aware DCA Rebalancing + Optimal Allocation"
description: "Add cash reserve, DCA-based rebalance routing, backtest new strategies, update frontend config"
status: in_progress
priority: P1
effort: 12h
branch: main
tags: [rebalancing, dca, backtest, cash-reserve]
created: 2026-03-28
---

## Overview

Replace expensive sell+buy rebalancing with cash reserve + DCA routing. New deposits buy the most underweight asset instead of proportional allocation. Traditional rebalance only triggers at high drift thresholds, cutting fees dramatically.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Cash Reserve System | ✅ Completed |
| 2 | DCA-Based Rebalance Routing | ✅ Completed |
| 3 | Backtest Cash Reserve + DCA Routing | Pending |
| 4 | Frontend + Config Integration | ✅ Completed |

## Key Dependencies

- Phase 2 depends on Phase 1 (cash reserve config must exist)
- Phase 3 depends on Phases 1+2 (backtest needs both features)
- Phase 4 depends on Phase 1 (needs new config fields)
- Existing 5yr backtest data in MongoDB (10,950 candles per asset)

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `src/rebalancer/strategies/strategy-config-types.ts` | 1 | Add cashReservePct, dcaRebalance fields to GlobalSettings |
| `src/db/models/strategy-config-model.ts` | 1 | Add cash-aware presets |
| `src/rebalancer/trade-calculator.ts` | 1 | Skip cash assets based on reserve target |
| `src/rebalancer/drift-detector.ts` | 2 | Support hardRebalanceThreshold |
| `src/dca/dca-service.ts` | 2 | Route DCA to most underweight asset |
| `src/rebalancer/strategy-manager.ts` | 2 | Integrate DCA rebalance mode |
| `src/backtesting/backtest-simulator.ts` | 3 | DCA injection + cash reserve sim |
| `src/backtesting/metrics-calculator.ts` | 3 | Add DCA-specific fields to BacktestConfig |
| `scripts/run-optimization.ts` | 3 | Run cash+DCA allocation comparisons |
| `frontend/src/pages/StrategyConfigPage.tsx` | 4 | Cash reserve UI controls |

## Risk Assessment

- **Cash drag**: 20% cash reserve reduces upside in strong bull markets. Mitigated by backtest comparison.
- **DCA routing concentration**: Buying only 1 asset per deposit could over-concentrate if deposit is large relative to portfolio. Mitigated by falling back to proportional allocation when no asset is significantly underweight.
- **Backtest overfitting**: Testing only 4 allocations limits overfitting risk.
