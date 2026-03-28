---
title: "Phase 3: Strategy Optimizer (Grid Search)"
status: completed
priority: P1
effort: 4h
---

# Phase 3: Strategy Optimizer (Grid Search)

## Context Links
- [Phase 1: Strategy-Aware Engine](./phase-01-strategy-aware-backtest-engine.md)
- [Phase 2: Historical Data](./phase-02-historical-data-fetcher.md)
- [backtest-simulator.ts](../../src/backtesting/backtest-simulator.ts)
- [strategy-config-types.ts](../../src/rebalancer/strategies/strategy-config-types.ts)
- [backtest-routes.ts](../../src/api/routes/backtest-routes.ts)

## Overview
Build a grid-search optimizer that runs backtests across parameter combinations for each strategy type, ranks results by composite score, and exposes via API + CLI script.

## Key Insights
- ~200 total parameter combos across all strategies
- Each backtest ~1-3s (CPU bound, daily candles) → ~10 min total
- Existing `backtestSimulator.run()` returns full metrics including Sharpe, totalReturn, maxDrawdown
- Composite score: `0.4*Sharpe + 0.3*normalizedReturn + 0.3*(1-maxDrawdown/100)`
- Grid search is embarrassingly parallel but we'll run sequentially to avoid MongoDB write contention
- Results should be persisted so user can view later without re-running

## Requirements

### Functional
- Define parameter grids for each strategy type
- Run all combos against same backtest config (pairs, date range, initial balance)
- Collect: strategy type, params, Sharpe ratio, total return %, max drawdown %, total trades
- Rank by composite score
- API endpoint: `POST /api/backtest/optimize` — accepts base config + optional strategy filter
- Return top N results (default 20)
- CLI script: `bun run scripts/run-optimization.ts`
- Persist optimization results to MongoDB (new collection or reuse backtest_results)

### Non-Functional
- Progress reporting (X/200 completed)
- Abort on unrecoverable errors (DB disconnect)
- Skip combos that throw (e.g., insufficient data for a lookback period)

## Architecture

### New File: `src/backtesting/strategy-optimizer.ts` (~180 lines)

```typescript
interface OptimizationConfig {
  // Base backtest config (pairs, dates, balance, fee, exchange)
  baseConfig: Omit<BacktestConfig, 'strategyType' | 'strategyParams' | 'threshold'>
  // Optional: only optimize specific strategy types
  strategyTypes?: StrategyType[]
  // How many top results to return
  topN?: number
}

interface OptimizationResult {
  rank: number
  strategyType: StrategyType
  params: StrategyParams
  metrics: BacktestMetrics
  compositeScore: number
}

class StrategyOptimizer {
  async optimize(config: OptimizationConfig): Promise<OptimizationResult[]>
  private generateParameterGrid(strategyType: StrategyType): StrategyParams[]
  private computeCompositeScore(metrics: BacktestMetrics): number
}
```

### New File: `src/backtesting/optimizer-parameter-grids.ts` (~120 lines)
Separate file for parameter grid definitions to keep optimizer clean.

```typescript
// Parameter grids per strategy
export const PARAMETER_GRIDS: Record<StrategyType, StrategyParams[]> = {
  'threshold': [
    { type: 'threshold', thresholdPct: 2, minTradeUsd: 10 },
    { type: 'threshold', thresholdPct: 3, minTradeUsd: 10 },
    { type: 'threshold', thresholdPct: 5, minTradeUsd: 10 },
    { type: 'threshold', thresholdPct: 8, minTradeUsd: 10 },
    { type: 'threshold', thresholdPct: 10, minTradeUsd: 10 },
    { type: 'threshold', thresholdPct: 15, minTradeUsd: 10 },
  ],
  'mean-reversion': [
    // lookbackDays × bandWidthSigma × minDriftPct = 3×4×3 = 36 combos
    // Generated programmatically from:
    // lookbackDays: [14, 30, 60]
    // bandWidthSigma: [1, 1.5, 2, 2.5]
    // minDriftPct: [2, 3, 5]
  ],
  'vol-adjusted': [
    // baseThresholdPct × volLookbackDays × min/max combos
    // baseThresholdPct: [3, 5, 8]
    // volLookbackDays: [14, 30, 60]
    // minThresholdPct: [2, 3]
    // maxThresholdPct: [15, 20, 25]
    // = 3×3×2×3 = 54 combos
  ],
  'momentum-weighted': [
    // rsiPeriod × macdFast/Slow × weightFactor
    // rsiPeriod: [7, 14, 21]
    // macdFast/Slow: [8/21, 12/26, 5/13]
    // weightFactor: [0.2, 0.3, 0.4, 0.5]
    // = 3×3×4 = 36 combos
  ],
  'equal-weight': [
    // thresholdPct: [2, 3, 5, 8, 10, 15] = 6 combos
  ],
  'momentum-tilt': [
    // thresholdPct × momentumWindowDays × momentumWeight
    // thresholdPct: [3, 5, 8]
    // momentumWindowDays: [7, 14, 30]
    // momentumWeight: [0.3, 0.5, 0.7]
    // = 3×3×3 = 27 combos
  ],
}
// Total: 6 + 36 + 54 + 36 + 6 + 27 = 165 combos
```

### Modified: `src/api/routes/backtest-routes.ts`
Add `POST /api/backtest/optimize` endpoint.

### New File: `scripts/run-optimization.ts` (~60 lines)
CLI wrapper that connects to DB, runs optimizer, prints results table.

## Related Code Files
- **Create**: `src/backtesting/strategy-optimizer.ts`
- **Create**: `src/backtesting/optimizer-parameter-grids.ts`
- **Create**: `scripts/run-optimization.ts`
- **Modify**: `src/api/routes/backtest-routes.ts` — add optimize endpoint

## Implementation Steps

1. **Create `optimizer-parameter-grids.ts`**:
   - Define grid arrays for each strategy type
   - Use helper function to generate cartesian product combos
   - Export `PARAMETER_GRIDS` and `getAllCombinations(strategyType?)` function

2. **Create `strategy-optimizer.ts`**:
   - `optimize()` method:
     a. Get parameter combos from grids (filtered by strategyTypes if specified)
     b. For each combo: build full `BacktestConfig`, call `backtestSimulator.run()`
     c. Wrap in try/catch — skip failed combos with warning
     d. Compute composite score for each result
     e. Sort by composite score descending
     f. Return top N
   - `computeCompositeScore()`:
     ```typescript
     const normalizedReturn = Math.max(0, metrics.totalReturnPct) / 100
     const normalizedDD = metrics.maxDrawdownPct / 100
     return 0.4 * metrics.sharpeRatio + 0.3 * normalizedReturn + 0.3 * (1 - normalizedDD)
     ```
   - Progress callback: `onProgress?: (completed: number, total: number) => void`

3. **Add API endpoint** in `backtest-routes.ts`:
   ```typescript
   backtestRoutes.post('/backtest/optimize', async (c) => {
     const body = await c.req.json()
     // Validate: pairs, allocations, startDate, endDate, initialBalance, feePct, timeframe, exchange
     // Optional: strategyTypes[], topN
     const results = await strategyOptimizer.optimize(body)
     return c.json(results)
   })
   ```

4. **Create `scripts/run-optimization.ts`**:
   - Connect to DB
   - Define default config (6 pairs, 2021-2026, $10K, 0.1% fee)
   - Run optimizer
   - Print ranked table to console

5. **Compile and test**

## Todo List
- [x]Create optimizer-parameter-grids.ts with all strategy grids
- [x]Create strategy-optimizer.ts with optimize() method
- [x]Implement composite score calculation
- [x]Add progress reporting callback
- [x]Add POST /api/backtest/optimize endpoint
- [x]Create scripts/run-optimization.ts CLI
- [x]Compile check
- [x]Test: run optimization for threshold-only (fast, 6 combos)
- [x]Test: full optimization (all strategies)

## Success Criteria
- [x]Grid generates ~165 parameter combinations
- [x]Optimizer runs all combos and returns ranked results
- [x]API endpoint returns top 20 results with metrics
- [x]CLI script prints formatted table
- [x]Failed combos logged but don't crash optimizer
- [x]All files under 200 lines

## Risk Assessment
- **10 min runtime for full grid**: acceptable for batch operation; API should return 202 or use streaming. For v1, synchronous is fine with timeout set to 15 min.
- **MongoDB write volume**: 165 backtest results persisted. Each ~5KB = ~800KB total. Negligible.
- **Memory**: each backtest creates ~1825 equity curve points. 165 concurrent results in memory ~= 165 × 50KB = ~8MB. Fine.

## Security Considerations
- Optimizer endpoint should have rate limiting (1 concurrent optimization per user)
- No new auth surface — uses existing API middleware
