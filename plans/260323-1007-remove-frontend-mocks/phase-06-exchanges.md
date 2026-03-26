---
phase: 06
title: Exchanges Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 06: Exchanges Page

## Context

ExchangesPage imports `EXCHANGES` mock.

Backend: `GET /api/health` returns exchange connection status. No dedicated `/exchanges/status` endpoint — need to verify what exists.

**Note:** `api.ts` has `getExchangeStatus()` calling `/exchanges/status` but backend may not have this route. Fallback: derive from health endpoint.

## Related Code Files

**Modify:** `frontend/src/pages/ExchangesPage.tsx`
**Create:** `frontend/src/hooks/use-exchange-queries.ts`

## Implementation Steps

1. Verify backend has `/exchanges/status` or similar endpoint
2. Create `use-exchange-queries.ts`: `useExchangeStatus()`
3. Replace EXCHANGES mock with hook call
4. Add loading/error states

## Todo List

- [x] Verify exchange status endpoint exists
- [x] Create `use-exchange-queries.ts`
- [x] Migrate ExchangesPage to real data
- [x] Add loading/error states

## Success Criteria

- [x] Exchange connection status shows real data
- [x] Zero imports from mockData.ts
