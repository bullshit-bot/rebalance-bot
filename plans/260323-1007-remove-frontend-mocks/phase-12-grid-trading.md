---
phase: 12
title: Grid Trading Page
status: pending
priority: medium
depends_on: [1]
---

# Phase 12: Grid Trading Page

## Context

GridTradingPage imports `GRID_BOTS` mock. UI-only state for create/stop — no persistence.

Backend endpoints:
- `GET /api/grid/list` — all grid bots
- `POST /api/grid` — create bot
- `GET /api/grid/:id` — bot status + PnL
- `PUT /api/grid/:id/stop` — stop bot

## Related Code Files

**Modify:** `frontend/src/pages/GridTradingPage.tsx`
**Create:** `frontend/src/hooks/use-grid-queries.ts`

## Implementation Steps

1. Create `use-grid-queries.ts`: `useGridBots()`, `useCreateGridBot()`, `useStopGridBot()`
2. Replace GRID_BOTS with `useGridBots()` query
3. Wire create form to `useCreateGridBot()` mutation
4. Wire stop button to `useStopGridBot()` mutation
5. Invalidate grid list after mutations
6. Add loading/error states

## Todo List

- [ ] Create `use-grid-queries.ts`
- [ ] Migrate GridTradingPage to real data
- [ ] Wire create/stop mutations
- [ ] Add loading/error states

## Success Criteria

- [ ] Grid bot list shows real bots from backend
- [ ] Can create and stop bots via API
- [ ] Zero imports from mockData.ts
