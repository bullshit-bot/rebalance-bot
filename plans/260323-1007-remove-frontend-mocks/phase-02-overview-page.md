---
phase: 02
title: Overview Page
status: completed
priority: high
depends_on: [1]
---

# Phase 02: Overview Page

## Context

OverviewPage imports 11 mock constants: PORTFOLIO_VALUE, PNL_24H, PNL_24H_PCT, CASH_AVAILABLE, DRIFT_SCORE, PENDING_ACTIONS, HOLDINGS, ORDERS, ALERTS, PORTFOLIO_HISTORY, REBALANCE_ACTIONS.

Backend endpoints needed:
- `GET /api/portfolio` — holdings, total value, drift
- `GET /api/portfolio/history` — chart data
- `GET /api/trades?limit=5` — recent orders
- `GET /api/rebalance/preview` — pending rebalance actions

No dedicated alerts endpoint exists — alerts derived from exchange status and logs.

## Related Code Files

**Modify:**
- `frontend/src/pages/OverviewPage.tsx`

**Create:**
- `frontend/src/hooks/use-overview-queries.ts`

## Implementation Steps

1. Create `use-overview-queries.ts` with: `usePortfolio()`, `usePortfolioHistory()`, `useRecentTrades()`, `useRebalancePreview()`
2. Replace all mock imports in OverviewPage with hook calls
3. Add loading skeletons (already has `SkeletonStatCard` and `SkeletonChartCard` components)
4. Add error state handling
5. Compute derived values (PNL_24H, DRIFT_SCORE, etc.) from portfolio response
6. Wire up PORTFOLIO_HISTORY chart to real `/portfolio/history` data

## Todo List

- [x] Create `use-overview-queries.ts`
- [x] Replace mock imports with real queries in OverviewPage
- [x] Wire loading skeletons to `isLoading` state
- [x] Add error boundary/fallback
- [x] Remove mock data computed at module level (pieData, comparisonData)

## Success Criteria

- [x] Overview loads real portfolio data from backend
- [x] Charts show real history data
- [x] Loading state shows skeletons
- [x] Error state shows meaningful message
- [x] Zero imports from mockData.ts
