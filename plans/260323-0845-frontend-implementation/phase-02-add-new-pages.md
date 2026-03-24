---
title: "Add 8 New Pages"
status: completed
priority: P1
effort: 6h
---

# Phase 2: Add 8 New Pages

## Context Links
- [App router](../../frontend/src/App.tsx)
- [UI components](../../frontend/src/components/ui-brutal.tsx)
- [AppSidebar nav](../../frontend/src/components/AppSidebar.tsx)
- [DashboardLayout](../../frontend/src/components/DashboardLayout.tsx)

## Overview
Add 8 new pages. All use mock data initially (Phase 3 wires API). Each page under 200 lines -- split into sub-components when needed.

## Key Design Decisions
- **Login page** renders outside `DashboardLayout` (standalone route)
- All other pages render inside `DashboardLayout`
- Reuse existing `ui-brutal.tsx` components: BrutalTabs, BrutalTable, BrutalCard, BrutalButton, BrutalInput, BrutalSelect, BrutalProgress, StatCard, BrutalConfirmDialog, etc.
- Charts use Recharts (already installed): LineChart, BarChart, AreaChart, PieChart
- Each page gets its own file in `src/pages/`
- Complex pages split form/table into sub-component files in `src/components/` with page-specific prefix

## Files to Create

### Pages (8 files)
| File | Route | Inside Layout? |
|------|-------|----------------|
| `src/pages/LoginPage.tsx` | `/login` | No |
| `src/pages/BacktestingPage.tsx` | `/backtesting` | Yes |
| `src/pages/AnalyticsPage.tsx` | `/analytics` | Yes |
| `src/pages/TaxPage.tsx` | `/tax` | Yes |
| `src/pages/GridBotPage.tsx` | `/grid` | Yes |
| `src/pages/SmartOrdersPage.tsx` | `/smart-orders` | Yes |
| `src/pages/CopyTradingPage.tsx` | `/copy-trading` | Yes |
| `src/pages/AiSuggestionsPage.tsx` | `/ai-suggestions` | Yes |

### Sub-components (split when page > 200 lines)
| File | Used By |
|------|---------|
| `src/components/backtest-results-panel.tsx` | BacktestingPage |
| `src/components/analytics-chart-panel.tsx` | AnalyticsPage |
| `src/components/grid-bot-card.tsx` | GridBotPage |
| `src/components/smart-order-card.tsx` | SmartOrdersPage |
| `src/components/copy-source-card.tsx` | CopyTradingPage |
| `src/components/ai-suggestion-card.tsx` | AiSuggestionsPage |

### Files to Modify
| File | Change |
|------|--------|
| `src/App.tsx` | Add 8 new routes |
| `src/components/AppSidebar.tsx` | Add 7 nav items + separators |
| `src/lib/mockData.ts` | Add mock data for new pages |

## Implementation Steps

### 1. Update AppSidebar -- add nav items with separator groups

```tsx
const NAV_SECTIONS = [
  {
    label: null, // no label for main section
    items: [
      { title: "Overview", path: "/", icon: LayoutDashboard },
      { title: "Portfolio", path: "/portfolio", icon: Wallet },
      { title: "Rebalance Plan", path: "/rebalance", icon: Repeat },
      { title: "Orders", path: "/orders", icon: ClipboardList },
      { title: "Allocations", path: "/allocations", icon: PieChart },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Backtesting", path: "/backtesting", icon: FlaskConical },
      { title: "Analytics", path: "/analytics", icon: BarChart3 },
      { title: "Grid Bot", path: "/grid", icon: Grid3X3 },
      { title: "Smart Orders", path: "/smart-orders", icon: Timer },
      { title: "Copy Trading", path: "/copy-trading", icon: Copy },
      { title: "AI Suggestions", path: "/ai-suggestions", icon: Brain },
      { title: "Tax Report", path: "/tax", icon: Receipt },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Exchanges", path: "/exchanges", icon: Server },
      { title: "Strategy Config", path: "/strategy", icon: Cog },
      { title: "Logs", path: "/logs", icon: ScrollText },
      { title: "Alerts", path: "/alerts", icon: Bell },
      { title: "Settings", path: "/settings", icon: Settings },
    ],
  },
];
```
- Render sections with separator + label between groups
- Import new lucide icons: FlaskConical, BarChart3, Grid3X3, Timer, Copy, Brain, Receipt

### 2. Update App.tsx -- add routes

```tsx
// Outside DashboardLayout
<Route path="/login" element={<LoginPage />} />

// Inside DashboardLayout
<Route path="/backtesting" element={<BacktestingPage />} />
<Route path="/analytics" element={<AnalyticsPage />} />
<Route path="/tax" element={<TaxPage />} />
<Route path="/grid" element={<GridBotPage />} />
<Route path="/smart-orders" element={<SmartOrdersPage />} />
<Route path="/copy-trading" element={<CopyTradingPage />} />
<Route path="/ai-suggestions" element={<AiSuggestionsPage />} />
```

### 3. LoginPage (`/login`)
- Standalone page, dark bg, centered card
- API key input field (password type, toggle visibility)
- "Connect" button
- Store key in localStorage on submit
- Redirect to `/` on success
- No sidebar, no header

### 4. BacktestingPage (`/backtesting`)
- **Top**: Form card -- date range (from/to inputs), strategy select, initial capital input, "Run Backtest" button
- **Bottom**: Results panel (extracted to `backtest-results-panel.tsx`):
  - 4 StatCards: Total Return, Sharpe Ratio, Max Drawdown, Win Rate
  - Equity curve LineChart
  - Trade list table (date, pair, side, pnl)

### 5. AnalyticsPage (`/analytics`)
- BrutalTabs with 4 tabs: Overview, PnL, Drawdown, Fees
- **Overview tab**: 4 StatCards (Total PnL, Best Day, Worst Day, Avg Daily) + equity curve chart
- **PnL tab**: Bar chart of daily PnL
- **Drawdown tab**: Area chart (negative values, red fill)
- **Fees tab**: Bar chart of fee breakdown by asset
- Extract chart rendering to `analytics-chart-panel.tsx`

### 6. TaxPage (`/tax`)
- Year selector (BrutalSelect, years 2024-2026)
- Summary StatCards: Total Gains, Total Losses, Net, Tax Estimate
- Tax events table: Date, Asset, Type (buy/sell/swap), Amount, Cost Basis, Proceeds, Gain/Loss
- "Export CSV" button (calls API endpoint later, stub for now)

### 7. GridBotPage (`/grid`)
- **Top**: Create form card -- pair select, upper/lower price, grid count, investment amount, "Create" button
- **Bottom**: Active bots grid (cards layout)
  - Each card (`grid-bot-card.tsx`): pair, status badge, profit, grid range, "Stop" button
  - Use BrutalCard + BrutalProgress for fill level

### 8. SmartOrdersPage (`/smart-orders`)
- **Top**: Create form -- order type (TWAP/VWAP radio), pair, total qty, duration, "Create" button
- **Bottom**: Active orders list
  - Each card (`smart-order-card.tsx`): type badge, pair, progress bar (filled/total), time remaining, Pause/Cancel buttons

### 9. CopyTradingPage (`/copy-trading`)
- BrutalTabs: Sources, Sync History
- **Sources tab**: "Add Source" button + source cards (`copy-source-card.tsx`)
  - Card: name, exchange, status badge, sync toggle, allocation %, Edit/Delete buttons
- **Sync History tab**: Table -- time, source, action, pair, qty, status

### 10. AiSuggestionsPage (`/ai-suggestions`)
- BrutalTabs: Pending, History, Config
- **Pending tab**: suggestion cards (`ai-suggestion-card.tsx`)
  - Card: title, reasoning, confidence badge, suggested action, Approve/Reject buttons
- **History tab**: Table of past suggestions -- date, title, action, status (approved/rejected)
- **Config tab**: Form -- model select, risk tolerance slider, auto-approve toggle, "Save" button

### 11. Add mock data to mockData.ts
Add minimal mock arrays for new pages:
- `BACKTEST_RESULT` -- equity curve points + metrics
- `ANALYTICS_PNL` -- daily pnl array
- `TAX_EVENTS` -- sample tax events
- `GRID_BOTS` -- 2-3 sample bots
- `SMART_ORDERS_ACTIVE` -- 2 sample orders
- `COPY_SOURCES` -- 2 sample sources
- `COPY_HISTORY` -- 5 sample syncs
- `AI_SUGGESTIONS` -- 3 sample suggestions

## Todo List
- [x] Add mock data for all 8 new pages to `mockData.ts`
- [x] Update `AppSidebar.tsx` with sectioned nav (3 groups, 7 new items)
- [x] Update `App.tsx` with 8 new routes
- [x] Create `LoginPage.tsx` (standalone, API key input)
- [x] Create `BacktestingPage.tsx` + `backtest-results-panel.tsx`
- [x] Create `AnalyticsPage.tsx` + `analytics-chart-panel.tsx`
- [x] Create `TaxPage.tsx`
- [x] Create `GridBotPage.tsx` + `grid-bot-card.tsx`
- [x] Create `SmartOrdersPage.tsx` + `smart-order-card.tsx`
- [x] Create `CopyTradingPage.tsx` + `copy-source-card.tsx`
- [x] Create `AiSuggestionsPage.tsx` + `ai-suggestion-card.tsx`

## Success Criteria
- [x] All 8 pages render without errors
- [x] Login page is outside DashboardLayout, all others inside
- [x] Sidebar shows 3 sections with separators
- [x] Each page file under 200 lines
- [x] All pages use ui-brutal.tsx components (no custom styled divs)
- [x] Charts render with mock data via Recharts
- [x] `npm run build` succeeds with no TS errors

## Risk Assessment
- **Medium**: 14 new files -- need careful import management
- **Mitigation**: Build after each page to catch TS errors early
- `ui-brutal.tsx` is 987 lines -- if new components needed, consider extracting to `ui-brutal-extended.tsx` but unlikely given the 50+ existing components
