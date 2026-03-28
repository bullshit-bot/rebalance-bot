---
title: "Phase 4: Frontend Optimization UI"
status: completed
priority: P2
effort: 3h
---

# Phase 4: Frontend Optimization UI

## Context Links
- [BacktestingPage.tsx](../../frontend/src/pages/BacktestingPage.tsx)
- [Phase 3: Optimizer](./phase-03-strategy-optimizer-grid-search.md)
- [strategy-config-types.ts](../../src/rebalancer/strategies/strategy-config-types.ts)

## Overview
Add a "Strategy Optimizer" tab to BacktestingPage with strategy type selector, optimization trigger, results table, and equity curve comparison for top strategies.

## Key Insights
- Current BacktestingPage is ~360 lines (single component, no tabs)
- Need to split into tab components to stay under 200 lines per file
- Recharts already installed for equity curve charts
- API returns `OptimizationResult[]` with metrics + params per combo
- Long-running request (~10 min) needs loading state with progress indicator

## Requirements

### Functional
- Tab bar: "Single Backtest" | "Strategy Optimizer"
- Single Backtest tab: existing functionality (unchanged)
- Strategy Optimizer tab:
  - Base config inputs: pairs, date range, initial balance, fee (reuse from single backtest)
  - Strategy type multi-select filter (or "All")
  - "Run Optimization" button
  - Loading state with progress bar or spinner
  - Results table: rank, strategy type, key params, return%, Sharpe, max drawdown%, trades, composite score
  - Sortable columns (click header to sort)
  - "Apply Best" button: populates single backtest form with winning config
  - Equity curve chart: overlay top 3 strategies (different colors)

### Non-Functional
- Each component file under 200 lines
- Reuse existing brutal UI components (StatCard, SectionTitle, etc.)
- Responsive layout

## Architecture

### File Structure
```
frontend/src/pages/
  BacktestingPage.tsx           — tab container (slim, ~50 lines)
  backtest-single-tab.tsx       — existing single backtest UI (refactored out)
  backtest-optimizer-tab.tsx    — new optimizer tab (~180 lines)
  backtest-optimizer-table.tsx  — results table component (~120 lines)

frontend/src/hooks/
  use-backtest-queries.ts       — add useRunOptimization() mutation

frontend/src/lib/
  api-types.ts                  — add OptimizationResult type
```

### API Types
```typescript
interface OptimizationRequest {
  pairs: string[]
  allocations: { asset: string; targetPct: number }[]
  startDate: number
  endDate: number
  initialBalance: number
  feePct: number
  timeframe: '1d'
  exchange: string
  strategyTypes?: StrategyType[]
  topN?: number
}

interface OptimizationResultItem {
  rank: number
  strategyType: string
  params: Record<string, unknown>
  metrics: {
    totalReturnPct: number
    sharpeRatio: number
    maxDrawdownPct: number
    totalTrades: number
    annualizedReturnPct: number
    volatility: number
  }
  compositeScore: number
  equityCurve?: { timestamp: number; value: number }[]
}
```

## Related Code Files
- **Modify**: `frontend/src/pages/BacktestingPage.tsx` — refactor to tab container
- **Create**: `frontend/src/pages/backtest-single-tab.tsx` — extracted existing UI
- **Create**: `frontend/src/pages/backtest-optimizer-tab.tsx` — optimizer UI
- **Create**: `frontend/src/pages/backtest-optimizer-table.tsx` — sortable results table
- **Modify**: `frontend/src/hooks/use-backtest-queries.ts` — add optimization hook
- **Modify**: `frontend/src/lib/api-types.ts` — add types

## Implementation Steps

1. **Add API types** in `api-types.ts`:
   - `OptimizationRequest`, `OptimizationResultItem` interfaces

2. **Add optimization hook** in `use-backtest-queries.ts`:
   ```typescript
   export function useRunOptimization() {
     return useMutation({
       mutationFn: (config: OptimizationRequest) =>
         apiClient.post('/backtest/optimize', config).then(r => r.data),
     })
   }
   ```

3. **Extract single backtest tab**:
   - Move existing BacktestingPage content to `backtest-single-tab.tsx`
   - Export as `BacktestSingleTab`

4. **Create tab container** in `BacktestingPage.tsx`:
   ```tsx
   const [tab, setTab] = useState<'single' | 'optimizer'>('single')
   return (
     <div>
       <PageTitle>Backtesting</PageTitle>
       <div className="flex gap-2 mb-4">
         <button onClick={() => setTab('single')}>Single Backtest</button>
         <button onClick={() => setTab('optimizer')}>Strategy Optimizer</button>
       </div>
       {tab === 'single' ? <BacktestSingleTab /> : <BacktestOptimizerTab />}
     </div>
   )
   ```

5. **Create optimizer tab** `backtest-optimizer-tab.tsx`:
   - Reuse config inputs (pairs, dates, balance, fee)
   - Add strategy type multi-select checkboxes
   - Run Optimization button → calls `useRunOptimization()`
   - Show loading spinner during optimization
   - On success: render `<BacktestOptimizerTable results={data} />`
   - Equity curve chart: Recharts LineChart with top 3 results overlaid
   - "Apply Best" button: callback to parent to switch to single tab with config

6. **Create results table** `backtest-optimizer-table.tsx`:
   - Sortable columns (useState for sortKey + direction)
   - Columns: Rank, Strategy, Key Params (formatted), Return%, Sharpe, MaxDD%, Trades, Score
   - Highlight top result row
   - Key params display: format strategy-specific params as compact string
     e.g., "lookback=30, sigma=1.5, minDrift=3"

7. **Compile and verify** frontend builds

## Todo List
- [x]Add OptimizationRequest/ResultItem types to api-types.ts
- [x]Add useRunOptimization() hook
- [x]Extract BacktestSingleTab from BacktestingPage
- [x]Create tab container in BacktestingPage
- [x]Create BacktestOptimizerTab with config form + trigger
- [x]Create BacktestOptimizerTable with sortable columns
- [x]Add equity curve comparison chart (top 3)
- [x]Add "Apply Best" button functionality
- [x]Frontend build check — no errors
- [x]Visual QA: layout, responsiveness

## Success Criteria
- [x]Tab switching works between Single Backtest and Optimizer
- [x]Existing single backtest functionality unchanged
- [x]Optimizer tab triggers API call and shows results table
- [x]Table columns are sortable
- [x]Equity curve chart shows top 3 strategies overlaid
- [x]"Apply Best" populates single backtest config
- [x]All component files under 200 lines
- [x]No build errors

## Risk Assessment
- **Long API response (~10 min)**: Frontend must handle timeout gracefully. Set axios timeout to 15 min. Show "Optimizing... this may take several minutes" message.
- **Large response payload**: Top 20 results with equity curves could be ~2MB. If too large, return equity curves only for top 3.
- **BacktestingPage refactor**: Moving existing code to new file risks breaking imports. Verify all imports resolve after refactor.

## Security Considerations
- No new auth surface — uses existing API client
- No user-generated content displayed without sanitization
