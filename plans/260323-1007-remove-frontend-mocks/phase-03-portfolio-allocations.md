---
phase: 03
title: Portfolio & Allocations Pages
status: completed
priority: high
depends_on: [1]
---

# Phase 03: Portfolio & Allocations Pages

## Context

- **PortfolioPage**: imports `HOLDINGS`, `PORTFOLIO_VALUE` — displays asset table with weights
- **AllocationsPage**: imports `HOLDINGS` — editable target allocation form

Backend endpoints:
- `GET /api/portfolio` — current holdings with values
- `GET /api/config/allocations` — target allocations
- `PUT /api/config/allocations` — update targets
- `DELETE /api/config/allocations/:asset` — remove asset

## Related Code Files

**Modify:**
- `frontend/src/pages/PortfolioPage.tsx`
- `frontend/src/pages/AllocationsPage.tsx`

**Create:**
- `frontend/src/hooks/use-allocation-queries.ts`

## Implementation Steps

1. Create `use-allocation-queries.ts` with: `useAllocations()`, `useUpdateAllocations()`, `useDeleteAllocation()`
2. PortfolioPage: replace HOLDINGS with `usePortfolio()` hook, compute derived values
3. AllocationsPage: load current allocations via `useAllocations()`, save via `useUpdateAllocations()` mutation
4. Add loading/error states to both pages
5. Invalidate portfolio queries after allocation changes

## Todo List

- [x] Create `use-allocation-queries.ts`
- [x] Migrate PortfolioPage to real data
- [x] Migrate AllocationsPage to real data with save functionality
- [x] Wire mutation for updating allocations
- [x] Add loading/error states

## Success Criteria

- [x] Portfolio page shows real holdings from backend
- [x] Allocations page loads real targets
- [x] Saving allocations persists to backend
- [x] Deleting an allocation works
- [x] Zero imports from mockData.ts
