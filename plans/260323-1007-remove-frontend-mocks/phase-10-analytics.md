---
phase: 10
title: Analytics Page
status: pending
priority: medium
depends_on: [1]
---

# Phase 10: Analytics Page

## Context

AnalyticsPage imports: `ANALYTICS_EQUITY`, `ANALYTICS_PNL_DAILY`, `ANALYTICS_DRAWDOWN`, `ANALYTICS_FEES_BREAKDOWN`.

Backend endpoints:
- `GET /api/analytics/equity-curve?from=&to=`
- `GET /api/analytics/pnl?from=&to=`
- `GET /api/analytics/drawdown?from=&to=`
- `GET /api/analytics/fees?from=&to=`
- `GET /api/analytics/assets`

## Related Code Files

**Modify:** `frontend/src/pages/AnalyticsPage.tsx`
**Create:** `frontend/src/hooks/use-analytics-queries.ts`

## Implementation Steps

1. Create `use-analytics-queries.ts`: `useEquityCurve(from, to)`, `usePnL(from, to)`, `useDrawdown(from, to)`, `useFees(from, to)`, `useAssetPerformance()`
2. Add date range picker for filtering
3. Replace all mock arrays with hook calls
4. Add loading/error states per chart

## Todo List

- [ ] Create `use-analytics-queries.ts`
- [ ] Migrate AnalyticsPage to real data
- [ ] Add date range filter controls
- [ ] Add loading/error states per chart section

## Success Criteria

- [ ] All 4 charts show real data from backend
- [ ] Date range filtering works
- [ ] Zero imports from mockData.ts
