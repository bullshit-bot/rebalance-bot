---
title: Remove All Frontend Mocks — Real API Integration
status: completed
created: 2026-03-23
priority: high
---

# Remove All Frontend Mocks — Real API Integration

## Summary

All 16 frontend pages use 100% mock data from `mockData.ts`. Backend has 30+ API endpoints already built. Task: replace every mock import with real `api.*` calls via TanStack React Query hooks.

## Current State

- **Frontend**: React 18 + TypeScript + TanStack React Query v5 (configured but unused)
- **API Client**: `src/lib/api.ts` — fully built with all endpoints, never called
- **Mock Source**: `src/lib/mockData.ts` (439 lines) — imported by all 16 pages
- **Auth**: Hardcoded admin/admin in `AuthContext.tsx`
- **WebSocket**: `src/hooks/use-websocket.ts` — configured but unused

## Architecture Decision

**Pattern**: Create React Query custom hooks per domain in `src/hooks/` that call `api.*` methods. Pages consume hooks instead of mock imports. Loading/error states via `isLoading`/`isError` from useQuery.

**Auth**: Switch to API-key-based auth (store in localStorage, validate via `/api/health`).

## Phase Overview

| # | Phase | Pages | Effort | Status |
|---|-------|-------|--------|--------|
| 01 | API Infrastructure & Auth | Login, AuthContext | M | ✅ Completed |
| 02 | Overview Page | Overview | L | ✅ Completed |
| 03 | Portfolio & Allocations | Portfolio, Allocations | M | ✅ Completed |
| 04 | Rebalance Plan | Rebalance | S | ✅ Completed |
| 05 | Orders & Trades | Orders | S | ✅ Completed |
| 06 | Exchanges | Exchanges | S | ✅ Completed |
| 07 | Strategy Config | Strategy | S | ✅ Completed |
| 08 | Logs & Alerts | Logs, Alerts | S | ✅ Completed |
| 09 | Backtesting | Backtesting | M | ✅ Completed |
| 10 | Analytics | Analytics | M | ✅ Completed |
| 11 | Tax | Tax | S | ✅ Completed |
| 12 | Grid Trading | Grid | M | ✅ Completed |
| 13 | Smart Orders | Smart Orders | M | ✅ Completed |
| 14 | Copy Trading | Copy Trading | M | ✅ Completed |
| 15 | AI Suggestions | AI Suggestions | M | ✅ Completed |
| 16 | Cleanup & Settings | Settings, mockData.ts removal | S | ✅ Completed |

## Dependencies

- Phase 01 (Auth) must complete first — all other phases depend on it
- Phases 02-15 are independent and can run in parallel
- Phase 16 (Cleanup) runs last after all pages migrated

## Key Files

- `frontend/src/lib/api.ts` — API client (already built, needs type safety)
- `frontend/src/lib/mockData.ts` — to be deleted after full migration
- `frontend/src/contexts/AuthContext.tsx` — auth rewrite
- `frontend/src/hooks/` — new query hooks per domain
- `frontend/src/pages/*.tsx` — all 16 pages to update

## Risk Assessment

- **Backend may return different shapes than mock data** — need to verify each endpoint's response and adapt types
- **No backend running locally** — need `VITE_API_URL` + `API_KEY` configured
- **Loading/error states missing** — pages currently render instantly; need loading skeletons and error boundaries
