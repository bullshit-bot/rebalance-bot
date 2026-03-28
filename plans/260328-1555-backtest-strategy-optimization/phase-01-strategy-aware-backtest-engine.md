---
title: "Phase 1: Strategy-Aware Backtest Engine"
status: completed
priority: P1
effort: 3h
---

# Phase 1: Strategy-Aware Backtest Engine

## Context Links
- [backtest-simulator.ts](../../src/backtesting/backtest-simulator.ts)
- [metrics-calculator.ts](../../src/backtesting/metrics-calculator.ts)
- [strategy-manager.ts](../../src/rebalancer/strategy-manager.ts)
- [strategy-config-types.ts](../../src/rebalancer/strategies/strategy-config-types.ts)
- [mean-reversion-strategy.ts](../../src/rebalancer/strategies/mean-reversion-strategy.ts)
- [vol-adjusted-strategy.ts](../../src/rebalancer/strategies/vol-adjusted-strategy.ts)
- [momentum-weighted-strategy.ts](../../src/rebalancer/strategies/momentum-weighted-strategy.ts)

## Overview
Extend the backtest engine to support all 6 strategy types instead of fixed-threshold-only. Currently `_needsRebalance()` uses a simple `drift >= threshold` check. We need it to delegate to the appropriate strategy module based on config.

## Key Insights
- `StrategyManager` already has `shouldRebalance()` and `getEffectiveAllocations()` but uses singleton state — backtest needs isolated instances per run
- Strategy modules (mean-reversion, vol-adjusted, momentum-weighted) maintain internal state (drift history, vol history) that must be fed from OHLCV data during simulation
- `BacktestConfig.threshold` is the only rebalance trigger today; new strategies need their own params
- Backward compatibility: if no `strategyType` provided, fall back to current threshold behavior

## Requirements

### Functional
- Add `strategyType?: StrategyType` and `strategyParams?: StrategyParams` to `BacktestConfig`
- `_needsRebalance()` delegates to correct strategy when `strategyType` is set
- For `mean-reversion`: feed drift history from simulation candles, use `shouldRebalance()`
- For `vol-adjusted`: compute daily volatility from candle returns, feed `recordVolatility()`, use `getDynamicThreshold()`
- For `momentum-weighted`: collect price histories per asset, call `getAdjustedAllocations()` before rebalance
- For `momentum-tilt`: use momentum calculator with 50/50 blend
- For `equal-weight`: override allocations to equal weight
- For `threshold` (default): existing behavior unchanged

### Non-Functional
- No shared singleton state between backtest runs
- Each run creates fresh strategy instances
- Keep backtest-simulator.ts under 200 lines (extract adapter)

## Architecture

### New File: `src/backtesting/strategy-backtest-adapter.ts`
Bridge between backtest loop and strategy modules. Encapsulates:
- Fresh strategy instances (no singletons)
- State accumulation (feeding vol/drift/price history each candle)
- Decision methods: `shouldRebalance()` and `getEffectiveAllocations()`

```typescript
// Pseudocode
class StrategyBacktestAdapter {
  constructor(private strategyType: StrategyType, private params: StrategyParams) {
    // Create fresh instances of strategy modules
  }

  /** Feed candle data to update internal strategy state */
  updateState(ohlcvData: Record<string, OHLCVCandle[]>, currentIdx: number): void

  /** Decide if rebalance is needed */
  shouldRebalance(holdings: Record<string, HoldingState>, allocations: Allocation[], totalValue: number): boolean

  /** Get effective allocations (may adjust for momentum-weighted) */
  getEffectiveAllocations(baseAllocations: Allocation[]): Allocation[]
}
```

### Modified: `src/backtesting/metrics-calculator.ts`
Extend `BacktestConfig` interface:
```typescript
export interface BacktestConfig {
  // ... existing fields ...
  strategyType?: StrategyType    // NEW - defaults to 'threshold'
  strategyParams?: StrategyParams // NEW - strategy-specific params
}
```

### Modified: `src/backtesting/backtest-simulator.ts`
- In `run()`: create `StrategyBacktestAdapter` if `config.strategyType` is set
- In main loop: call `adapter.updateState()` each candle, then `adapter.shouldRebalance()`
- Before rebalance: use `adapter.getEffectiveAllocations()` for momentum-weighted
- Fallback: no adapter → existing threshold logic (backward compatible)

## Related Code Files
- **Modify**: `src/backtesting/metrics-calculator.ts` — extend BacktestConfig type
- **Modify**: `src/backtesting/backtest-simulator.ts` — integrate adapter
- **Create**: `src/backtesting/strategy-backtest-adapter.ts` — strategy bridge
- **Modify**: `src/api/routes/backtest-routes.ts` — accept strategyType/strategyParams in validation

## Implementation Steps

1. **Extend `BacktestConfig`** in `metrics-calculator.ts`:
   - Add optional `strategyType` and `strategyParams` fields
   - Import `StrategyType` and `StrategyParams` types

2. **Create `strategy-backtest-adapter.ts`** (~150 lines):
   - Constructor takes `strategyType` + `strategyParams`
   - Creates fresh `MeanReversionStrategy`, `VolAdjustedStrategy`, `MomentumWeightedStrategy` instances
   - `updateState()`: given all OHLCV data and current candle index, computes and feeds:
     - Volatility (daily return stddev) → `volAdjusted.recordVolatility()`
     - Per-asset drift → `meanReversion.recordDrift()`
     - Price histories → stored for momentum-weighted
   - `shouldRebalance()`: dispatches to appropriate strategy
   - `getEffectiveAllocations()`: dispatches for momentum-weighted/equal-weight/momentum-tilt

3. **Integrate adapter in `backtest-simulator.ts`**:
   - In `run()`: conditionally create adapter
   - In candle loop: call `adapter.updateState(ohlcvData, currentTimestampIndex)`
   - Replace `this._needsRebalance()` call with `adapter.shouldRebalance()` when adapter exists
   - Before `_simulateRebalance()`: get effective allocations from adapter
   - Pass effective allocations to `_simulateRebalance()`

4. **Update `backtest-routes.ts` validation**:
   - Accept optional `strategyType` and `strategyParams` in request body
   - Validate `strategyParams` matches `strategyType` using Zod discriminated union

5. **Compile and verify** no type errors

## Todo List
- [x] Extend BacktestConfig with strategyType + strategyParams
- [x] Create strategy-backtest-adapter.ts with fresh instances per run
- [x] Implement updateState() for vol, drift, price history feeding
- [x] Implement shouldRebalance() dispatch for all 6 strategies
- [x] Implement getEffectiveAllocations() dispatch
- [x] Integrate adapter into backtest-simulator.ts candle loop
- [x] Update backtest-routes.ts validation for new fields
- [x] Compile check — no type errors
- [x] Manual test: run backtest with threshold (backward compat)
- [x] Manual test: run backtest with mean-reversion params

## Success Criteria
- [x] Backtest with no strategyType works identically to before
- [x] Backtest with each of 6 strategy types produces valid results
- [x] Strategy state is isolated per backtest run (no singleton leakage)
- [ ] All files under 200 lines (backtest-simulator.ts was already 342 lines pre-task; adapter extracted as intended)
- [x] No compile errors

## Risk Assessment
- **Strategy state accumulation**: mean-reversion needs enough drift history before bands become meaningful. Mitigation: first N candles use minDriftPct as fallback (already handled by getBandWidth)
- **Momentum-weighted needs price history**: first ~26 candles (MACD slow period) will have neutral scores. Acceptable — matches real-world warmup.
- **Performance**: extra computation per candle is O(assets) — negligible for daily candles

## Security Considerations
- No new external inputs beyond existing strategy params (validated by Zod)
- No auth changes
