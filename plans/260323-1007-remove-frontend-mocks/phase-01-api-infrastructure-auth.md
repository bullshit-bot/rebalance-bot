---
phase: 01
title: API Infrastructure & Auth
status: pending
priority: critical
---

# Phase 01: API Infrastructure & Auth

## Context

- API client exists at `src/lib/api.ts` with all endpoints but uses `unknown` types everywhere
- Auth is hardcoded mock (admin/admin) in `AuthContext.tsx`
- Backend uses API key auth via `X-API-Key` header
- TanStack React Query v5 configured in App.tsx but no hooks exist
- Login page has hardcoded hint "admin / admin"

## Overview

Add proper TypeScript types to API client. Rewrite auth to API-key-based login. Create base query hook patterns.

## Related Code Files

**Modify:**
- `frontend/src/lib/api.ts` — add response types, fix query params
- `frontend/src/contexts/AuthContext.tsx` — API-key auth instead of mock
- `frontend/src/pages/LoginPage.tsx` — remove mock hints, use API key input

**Create:**
- `frontend/src/lib/api-types.ts` — shared response types matching backend schemas
- `frontend/src/hooks/use-portfolio-queries.ts` — example pattern for other phases

## Implementation Steps

### 1. Create `api-types.ts` with TypeScript interfaces

Define types matching backend response shapes for: Portfolio, Holding, Order/Trade, RebalanceAction, LogEntry, Alert, StrategyConfig, Exchange, BacktestResult, AnalyticsData, TaxEvent, GridBot, SmartOrder, CopySource, AISuggestion.

Base on existing mock interfaces in `mockData.ts` but verify against backend route handlers.

### 2. Type the API client

Replace all `unknown` return types in `api.ts` with proper generics from `api-types.ts`.

### 3. Rewrite AuthContext

- Remove `MOCK_USER` and `MOCK_CREDENTIALS`
- Login flow: user enters API key → call `api.getHealth()` with that key → if 200, store key in localStorage → authenticated
- `getApiKey()` in api.ts already reads from localStorage — just store it there
- Logout: remove apiKey from localStorage
- User info: derive from health response or hardcode role as "Operator" (backend has no user profile endpoint)

### 4. Update LoginPage

- Replace username/password form with single API key input
- Remove "Hint: admin / admin" footer
- On submit: store API key → validate via health check → redirect to dashboard

### 5. Create base query hook pattern

Create `use-portfolio-queries.ts` as reference pattern:
```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Portfolio } from '@/lib/api-types'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.getPortfolio(),
    refetchInterval: 30_000, // 30s auto-refresh
  })
}
```

## Todo List

- [ ] Create `api-types.ts` with all response interfaces
- [ ] Add proper types to `api.ts` (replace `unknown`)
- [ ] Fix query param handling in api.ts (avoid `undefined` in URLs)
- [ ] Rewrite `AuthContext.tsx` — API key based auth
- [ ] Update `LoginPage.tsx` — API key input, remove mock hints
- [ ] Create `use-portfolio-queries.ts` as hook pattern reference
- [ ] Verify api client handles 401 redirect correctly

## Success Criteria

- [ ] Login with valid API key → authenticated, redirected to dashboard
- [ ] Invalid API key → error message
- [ ] 401 from any API call → auto logout and redirect to login
- [ ] All API client methods have proper TypeScript types
- [ ] No references to MOCK_USER or MOCK_CREDENTIALS remain
