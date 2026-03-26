---
phase: 13
title: Smart Orders Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 13: Smart Orders Page

## Context

SmartOrdersPage imports `SMART_ORDERS` mock. UI-only state for create/pause/cancel.

Backend endpoints:
- `GET /api/smart-order/active` — active orders
- `POST /api/smart-order` — create TWAP/VWAP
- `GET /api/smart-order/:id` — execution progress
- `PUT /api/smart-order/:id/pause` — pause
- `PUT /api/smart-order/:id/resume` — resume
- `PUT /api/smart-order/:id/cancel` — cancel

## Related Code Files

**Modify:** `frontend/src/pages/SmartOrdersPage.tsx`
**Create:** `frontend/src/hooks/use-smart-order-queries.ts`

## Implementation Steps

1. Create `use-smart-order-queries.ts`: `useActiveSmartOrders()`, `useCreateSmartOrder()`, `usePauseSmartOrder()`, `useResumeSmartOrder()`, `useCancelSmartOrder()`
2. Replace SMART_ORDERS with query
3. Wire all action buttons to mutations
4. Add auto-refresh for active orders (refetchInterval)
5. Add loading/error states

## Todo List

- [x] Create `use-smart-order-queries.ts`
- [x] Migrate SmartOrdersPage to real data
- [x] Wire create/pause/resume/cancel mutations
- [x] Add loading/error states

## Success Criteria

- [x] Active orders show real data with live progress
- [x] All actions (create, pause, resume, cancel) work via API
- [x] Zero imports from mockData.ts
