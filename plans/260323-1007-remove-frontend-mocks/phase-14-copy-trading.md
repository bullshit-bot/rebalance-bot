---
phase: 14
title: Copy Trading Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 14: Copy Trading Page

## Context

CopyTradingPage imports `COPY_SOURCES`, `COPY_SYNC_HISTORY` mocks. UI-only state for add/remove/sync.

Backend endpoints:
- `GET /api/copy/sources` — all sources
- `POST /api/copy/source` — add source
- `PUT /api/copy/source/:id` — update
- `DELETE /api/copy/source/:id` — remove
- `POST /api/copy/sync` — force sync
- `GET /api/copy/history` — sync history

## Related Code Files

**Modify:** `frontend/src/pages/CopyTradingPage.tsx`
**Create:** `frontend/src/hooks/use-copy-trading-queries.ts`

## Implementation Steps

1. Create `use-copy-trading-queries.ts`: `useCopySources()`, `useCopyHistory()`, `useAddCopySource()`, `useUpdateCopySource()`, `useDeleteCopySource()`, `useSyncCopy()`
2. Replace mocks with queries
3. Wire all CRUD + sync actions to mutations
4. Invalidate queries after mutations
5. Add loading/error states

## Todo List

- [x] Create `use-copy-trading-queries.ts`
- [x] Migrate CopyTradingPage to real data
- [x] Wire all CRUD + sync mutations
- [x] Add loading/error states

## Success Criteria

- [x] Sources list shows real data
- [x] Can add/edit/remove/sync sources via API
- [x] Sync history shows real events
- [x] Zero imports from mockData.ts
