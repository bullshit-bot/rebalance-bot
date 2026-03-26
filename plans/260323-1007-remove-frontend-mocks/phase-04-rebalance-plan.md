---
phase: 04
title: Rebalance Plan Page
status: completed
priority: high
depends_on: [1]
---

# Phase 04: Rebalance Plan Page

## Context

RebalancePlanPage imports: `REBALANCE_ACTIONS`, `PORTFOLIO_VALUE`, `STRATEGY_CONFIG`.

Backend endpoints:
- `GET /api/rebalance/preview` — dry-run trades
- `POST /api/rebalance` — execute rebalance
- `GET /api/rebalance/history` — past rebalances
- `GET /api/portfolio` — for portfolio value

## Related Code Files

**Modify:** `frontend/src/pages/RebalancePlanPage.tsx`
**Create:** `frontend/src/hooks/use-rebalance-queries.ts`

## Implementation Steps

1. Create `use-rebalance-queries.ts`: `useRebalancePreview()`, `useTriggerRebalance()`, `useRebalanceHistory()`
2. Replace mock data with hook calls
3. Add "Execute Rebalance" button wired to `useTriggerRebalance()` mutation
4. Add loading/error states

## Todo List

- [x] Create `use-rebalance-queries.ts`
- [x] Migrate RebalancePlanPage to real data
- [x] Wire execute rebalance mutation
- [x] Add loading/error states

## Success Criteria

- [x] Preview shows real dry-run trades
- [x] Execute button triggers real rebalance
- [x] Zero imports from mockData.ts
