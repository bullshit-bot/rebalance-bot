---
title: "Fix Existing Pages"
status: completed
priority: P1
effort: 2h
---

# Phase 1: Fix Existing Pages (Bugs + Cleanup)

## Context Links
- [App router](../../frontend/src/App.tsx)
- [Mock data](../../frontend/src/lib/mockData.ts)
- [UI components](../../frontend/src/components/ui-brutal.tsx)

## Overview
Fix bugs, remove dead code, and clean up hard-coded sections across existing 10 pages.

## Related Code Files

### Files to Modify
- `frontend/src/App.tsx` — remove Index route
- `frontend/src/pages/AllocationsPage.tsx` — fix progress bar, remove Core/Satellite + Cash Reserve
- `frontend/src/pages/OverviewPage.tsx` — show all 5 rebalance actions
- `frontend/src/components/DashboardHeader.tsx` — remove user avatar/dropdown if present (currently clean, verify)
- `frontend/src/pages/SettingsPage.tsx` — remove Appearance section (Theme/Accent/Layout)
- `frontend/src/pages/PortfolioPage.tsx` — make filter buttons actually filter data

### Files to Delete
- `frontend/src/pages/Index.tsx` — unused placeholder

## Implementation Steps

### 1. Delete Index.tsx + remove route
- Delete `src/pages/Index.tsx`
- In `App.tsx`: no Index import exists (already clean, OverviewPage is at `/`). Verify no route references Index.

### 2. Fix AllocationsPage progress bar (line 64)
**Bug**: `style={{ width: \`${(h.currentPct / 50) * 100}%\` }}`
**Fix**: `style={{ width: \`${h.currentPct}%\` }}`
- `currentPct` is already a percentage (e.g., 38.9), so use it directly as the bar width

### 3. Remove AllocationsPage hard-coded sections (lines 74-101)
- Delete the entire `grid grid-cols-1 md:grid-cols-2 gap-4` div containing:
  - "Core / Satellite" card (hard-coded 60%/30%)
  - "Cash Reserve" card (hard-coded 10%/8.4%)
- These are static, non-functional, and misleading

### 4. OverviewPage: show all 5 rebalance actions (line 70)
**Bug**: `.slice(0, 4)` only shows 4 of 5 actions
**Fix**: Change to `.slice(0, 5)` to show all 5
- REBALANCE_ACTIONS has exactly 5 items, all should display

### 5. DashboardHeader: verify no user avatar
- Current code (verified): no avatar/dropdown exists. Header has: logo, badges, stats, action buttons.
- **No change needed** -- already clean for personal bot mode.

### 6. SettingsPage: remove Appearance section (lines 42-46)
- Remove the entire "Appearance" `brutal-card` div containing:
  - Theme selector (Light/Dark/System)
  - Accent Color selector
  - Layout Density selector
- Keep: Defaults, Notifications, Data sections
- Rename "Defaults" to "Exchange" for clarity

### 7. PortfolioPage: make filter buttons functional
- Current state: `filter` state exists, buttons toggle it, but table always shows `HOLDINGS` unfiltered
- Add filter logic mapping:
  - "All" -> all holdings
  - "Large Cap" -> BTC, ETH
  - "Alt" -> SOL, AVAX, LINK (non-BTC, non-ETH, non-stablecoin)
  - "Stablecoin" -> USDT, USDC, BUSD, DAI
- Apply filter to HOLDINGS before rendering table:
```tsx
const LARGE_CAP = ["BTC", "ETH"];
const STABLECOINS = ["USDT", "USDC", "BUSD", "DAI"];

const filtered = filter === "All" ? HOLDINGS
  : filter === "Large Cap" ? HOLDINGS.filter(h => LARGE_CAP.includes(h.asset))
  : filter === "Stablecoin" ? HOLDINGS.filter(h => STABLECOINS.includes(h.asset))
  : HOLDINGS.filter(h => !LARGE_CAP.includes(h.asset) && !STABLECOINS.includes(h.asset));
```
- Use `filtered` in table tbody map

## Todo List
- [x] Delete `Index.tsx`, verify no route references it
- [x] Fix AllocationsPage progress bar: `currentPct` directly
- [x] Remove AllocationsPage Core/Satellite + Cash Reserve sections
- [x] OverviewPage: `.slice(0, 5)` for all 5 rebalance actions
- [x] Verify DashboardHeader has no user avatar (confirmed clean)
- [x] SettingsPage: remove Appearance card, rename Defaults to Exchange
- [x] PortfolioPage: implement filter logic for Large Cap / Alt / Stablecoin

## Success Criteria
- [x] No `Index.tsx` file exists
- [x] AllocationsPage progress bars show correct width proportional to percentage
- [x] AllocationsPage has no hard-coded Core/Satellite or Cash Reserve cards
- [x] OverviewPage shows 5 rebalance recommendations
- [x] No user avatar in header
- [x] SettingsPage has 3 sections: Exchange, Notifications, Data
- [x] PortfolioPage filter buttons filter the holdings table

## Risk Assessment
- **Low risk**: all changes are isolated to individual page files
- No shared state or cross-page dependencies affected
