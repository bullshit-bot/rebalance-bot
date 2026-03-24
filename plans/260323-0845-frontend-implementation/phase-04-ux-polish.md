---
title: "UX Polish"
status: completed
priority: P2
effort: 3h
---

# Phase 4: UX Polish

## Context Links
- [UI components](../../frontend/src/components/ui-brutal.tsx) — BrutalPagination, BrutalConfirmDialog, BrutalSkeleton, BrutalToast already exist
- [Sonner toaster](../../frontend/src/App.tsx) — already mounted

## Overview
Add pagination, search, confirmation dialogs, loading skeletons, and toast notifications across all pages. Final pass to ensure consistent UX.

## Key Design Decisions
- Use `BrutalPagination` from ui-brutal.tsx (already exists, props: current, total, onChange)
- Use `BrutalConfirmDialog` for destructive actions (already exists)
- Use `BrutalSkeleton` for loading states (already exists)
- Use Sonner `toast()` for notifications (already mounted in App.tsx)
- Search uses `BrutalInput` with filter logic (client-side for small datasets, server-side later if needed)
- Page size: 10 rows default for all tables

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/OrdersPage.tsx` | Add pagination + search input |
| `src/pages/LogsPage.tsx` | Add pagination + search input |
| `src/pages/TaxPage.tsx` | Add pagination to tax events table |
| `src/pages/RebalancePlanPage.tsx` | Confirm dialog before execute |
| `src/pages/GridBotPage.tsx` | Confirm dialog before stop bot |
| `src/pages/SmartOrdersPage.tsx` | Confirm dialog before cancel order |
| `src/pages/CopyTradingPage.tsx` | Confirm dialog before delete source |
| `src/pages/AiSuggestionsPage.tsx` | Confirm dialog before reject |
| `src/pages/SettingsPage.tsx` | Toast on save, confirm on clear cache |
| `src/pages/BacktestingPage.tsx` | Loading state during backtest run |
| All pages with API calls | Skeleton loading states (done in Phase 3, verify here) |

### Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/use-paginated-data.ts` | Reusable pagination logic hook |
| `src/hooks/use-search-filter.ts` | Reusable search/filter logic hook |

## Implementation Steps

### 1. Create `src/hooks/use-paginated-data.ts`
```ts
export function usePaginatedData<T>(data: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = Math.ceil(data.length / pageSize);
  const paginated = data.slice((page - 1) * pageSize, page * pageSize);
  return { paginated, page, total, setPage };
}
```

### 2. Create `src/hooks/use-search-filter.ts`
```ts
export function useSearchFilter<T>(data: T[], searchFields: (keyof T)[], query: string): T[] {
  if (!query.trim()) return data;
  const q = query.toLowerCase();
  return data.filter(item =>
    searchFields.some(field => String(item[field]).toLowerCase().includes(q))
  );
}
```

### 3. Add pagination + search to OrdersPage
- Add `BrutalInput` search bar above table (search by symbol, exchange, id)
- Apply `useSearchFilter` then `usePaginatedData`
- Add `BrutalPagination` below table
- Show result count: "Showing X of Y orders"

### 4. Add pagination + search to LogsPage
- Same pattern: search by message, level
- BrutalPagination below table

### 5. Add pagination to TaxPage
- Paginate tax events table (no search needed -- small dataset per year)

### 6. Add confirmation dialogs for destructive actions
Use `BrutalConfirmDialog` (already in ui-brutal.tsx):

| Page | Action | Dialog Message |
|------|--------|---------------|
| RebalancePlanPage | Execute rebalance | "Execute rebalance with X orders totaling $Y?" |
| GridBotPage | Stop bot | "Stop grid bot for {pair}? Open orders will be cancelled." |
| SmartOrdersPage | Cancel order | "Cancel {type} order for {pair}?" |
| CopyTradingPage | Delete source | "Remove copy source {name}? Sync will stop." |
| AiSuggestionsPage | Reject suggestion | "Reject suggestion: {title}?" |
| SettingsPage | Clear cache | "Clear all local cached data?" |

Pattern:
```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
const [pendingAction, setPendingAction] = useState<() => void>(() => {});

// In button onClick:
setPendingAction(() => () => doThing());
setConfirmOpen(true);

// In JSX:
<BrutalConfirmDialog
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  onConfirm={pendingAction}
  title="Confirm"
  message="Are you sure?"
  variant="danger"
/>
```

### 7. Add toast notifications
Already using Sonner (mounted in App.tsx). Add toasts for:
- Form submissions: `toast.success("Backtest started")`, `toast.success("Settings saved")`
- Mutation errors: `toast.error(error.message)` (mostly done in Phase 3 hooks)
- WebSocket events: `toast.info("Rebalance completed")` on `rebalance:completed` event
- CSV export: `toast.success("Tax report exported")`

### 8. Verify loading skeletons on all pages
Audit each page to ensure:
- `isLoading` state renders `BrutalSkeleton` components
- Skeleton layout roughly matches final layout (cards = rect skeletons, tables = multiple line skeletons)
- Minimum skeleton pattern per page:
```tsx
if (isLoading) return (
  <div>
    <PageTitle>Page Name</PageTitle>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1,2,3,4].map(i => <BrutalSkeleton key={i} variant="rect" height="80px" />)}
    </div>
    <BrutalSkeleton variant="rect" height="300px" />
  </div>
);
```

### 9. Update sidebar with active indicators
- Verify all 17 nav items highlight correctly on their route
- Test collapsed sidebar shows icons only for new items

## Todo List
- [x] Create `src/hooks/use-paginated-data.ts`
- [x] Create `src/hooks/use-search-filter.ts`
- [x] Add pagination + search to OrdersPage
- [x] Add pagination + search to LogsPage
- [x] Add pagination to TaxPage
- [x] Add confirm dialog to RebalancePlanPage (execute)
- [x] Add confirm dialog to GridBotPage (stop)
- [x] Add confirm dialog to SmartOrdersPage (cancel)
- [x] Add confirm dialog to CopyTradingPage (delete source)
- [x] Add confirm dialog to AiSuggestionsPage (reject)
- [x] Add confirm dialog to SettingsPage (clear cache)
- [x] Add toast notifications for form submissions + WS events
- [x] Audit all pages for loading skeleton coverage
- [x] Verify sidebar active state for all 17 routes

## Success Criteria
- [x] Orders + Logs tables paginated with 10 rows/page
- [x] Search filters work on Orders (symbol, exchange) and Logs (message)
- [x] All destructive actions require confirmation dialog
- [x] Toast appears on every form submission (success + error)
- [x] Every page with API data shows skeletons while loading
- [x] Sidebar correctly highlights active route for all pages
- [x] No console errors or warnings in browser

## Risk Assessment
- **Low risk**: all changes are additive UX enhancements
- **Edge case**: empty search results -- show BrutalEmptyState component
- **Edge case**: pagination on filtered results -- reset page to 1 when filter/search changes
