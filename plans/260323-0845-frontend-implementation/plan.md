---
title: "Frontend Implementation - Fix, Expand, Wire API, Polish"
description: "Fix existing page bugs, add 8 new pages, replace mock data with API calls, add UX polish"
status: completed
priority: P1
effort: 16h
branch: main
tags: [frontend, react, api-integration, ui]
created: 2026-03-23
---

# Frontend Implementation Plan

## Context
- **Stack**: React + Vite + TanStack Query + shadcn/ui + Recharts + react-router-dom + Tailwind
- **Design system**: Brutalist dark theme via `ui-brutal.tsx` (~987 lines, 50+ components)
- **Backend**: REST at `http://localhost:3001/api` (X-API-Key header) + WebSocket at `ws://localhost:3001/ws?apiKey=xxx`
- **Current state**: 10 pages using mock data from `src/lib/mockData.ts`

## Phases

| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 1 | Fix Existing Pages | [phase-01-fix-existing-pages.md](./phase-01-fix-existing-pages.md) | 2h | ✅ Completed |
| 2 | Add 8 New Pages | [phase-02-add-new-pages.md](./phase-02-add-new-pages.md) | 6h | ✅ Completed |
| 3 | Wire API Layer | [phase-03-wire-api-layer.md](./phase-03-wire-api-layer.md) | 5h | ✅ Completed |
| 4 | UX Polish | [phase-04-ux-polish.md](./phase-04-ux-polish.md) | 3h | ✅ Completed |

## Dependencies
- Phase 2 can start immediately (parallel with Phase 1)
- Phase 3 depends on Phase 1 + 2 (needs pages to exist)
- Phase 4 depends on Phase 3 (polish the wired pages)

## Key Constraints
- All files under 200 lines -- split into sub-components if needed
- Reuse `ui-brutal.tsx` components exclusively (BrutalCard, BrutalButton, BrutalTabs, BrutalTable, BrutalDialog, BrutalInput, BrutalSelect, BrutalPagination, BrutalSkeleton, BrutalProgress, etc.)
- kebab-case file naming
- No mocks/fakes in production code after Phase 3
