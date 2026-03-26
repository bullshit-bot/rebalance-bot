---
phase: 05
title: Orders Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 05: Orders Page

## Context

OrdersPage imports `ORDERS` mock array.

Backend: `GET /api/trades?limit=50&rebalanceId=...`

## Related Code Files

**Modify:** `frontend/src/pages/OrdersPage.tsx`
**Create:** `frontend/src/hooks/use-trade-queries.ts`

## Implementation Steps

1. Create `use-trade-queries.ts`: `useTrades(limit, rebalanceId?)`
2. Replace ORDERS with hook call
3. Add pagination/limit controls if not already present
4. Add loading/error states

## Todo List

- [x] Create `use-trade-queries.ts`
- [x] Migrate OrdersPage to real data
- [x] Add loading/error states

## Success Criteria

- [x] Orders list shows real trades from backend
- [x] Zero imports from mockData.ts
