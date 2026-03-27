---
title: "Volatility-Adjusted Thresholds"
status: pending
priority: P1
effort: 2h
---

# Phase 3: Volatility-Adjusted Thresholds

## Context Links

- [Research: Advanced Strategies](../reports/researcher-260328-0014-advanced-rebalancing-strategies.md) — Section 3
- [Phase 1: Config Backend](./phase-01-strategy-config-backend.md) — depends on config model
- Existing volatility tracker: `src/rebalancer/volatility-tracker.ts` (has `getVolatility()`)
- Current strategy manager: `src/rebalancer/strategy-manager.ts` (has `getDynamicThreshold()` — binary high/low)
- Drift detector: `src/rebalancer/drift-detector.ts`

## Overview

Replace the current binary high/low threshold system with a continuous formula:

```
dynamic_threshold = baseThreshold * (current_vol / avg_vol)
clamped between [minThreshold, maxThreshold]
```

Current `vol-adjusted` mode uses only two fixed values (`DYNAMIC_THRESHOLD_LOW` / `DYNAMIC_THRESHOLD_HIGH`). This phase makes the threshold scale continuously with volatility, which is more responsive and reduces unnecessary trades by 20-30%.

## Key Insights

- Current implementation: binary switch between `DYNAMIC_THRESHOLD_LOW` (3%) and `DYNAMIC_THRESHOLD_HIGH` (8%) based on `isHighVolatility()`
- New formula: continuous scaling — threshold grows/shrinks proportionally with current vs average volatility
- Min/max caps prevent runaway values (too tight in crash, too loose in calm)
- VolatilityTracker already computes 30-day annualized vol — reuse it
- Need to also track average vol over the same window for the ratio

## Requirements

### Functional
- `dynamic_threshold = baseThresholdPct * (currentVol / avgVol)`, clamped to [minThresholdPct, maxThresholdPct]
- Parameters from DB config: `baseThresholdPct` (default 5), `volLookbackDays` (default 30), `minThresholdPct` (default 3), `maxThresholdPct` (default 20)
- Works for `vol-adjusted` strategy mode
- `avgVol` = rolling average of daily volatility readings over `volLookbackDays`

### Non-Functional
- Threshold calculation must complete in <1ms
- Backward compatible: if no `avgVol` data yet, fall back to `baseThresholdPct`

## Architecture

```
VolatilityTracker.getVolatility() → currentVol (annualized %)
VolAdjustedStrategy.getAvgVolatility() → avgVol (rolling average)
  → ratio = currentVol / avgVol
  → threshold = clamp(baseThreshold * ratio, min, max)
  → StrategyManager.getDynamicThreshold() returns this value
  → DriftDetector uses it for rebalance decision
```

## Related Code Files

### Create
- `src/rebalancer/strategies/vol-adjusted-strategy.ts` — continuous threshold calculation

### Modify
- `src/rebalancer/volatility-tracker.ts` — add method to expose rolling vol history for avg computation
- `src/rebalancer/strategy-manager.ts` — replace binary threshold logic with VolAdjustedStrategy delegation

### No Deletes

## Implementation Steps

### Step 1: VolAdjustedStrategy Module

Create `src/rebalancer/strategies/vol-adjusted-strategy.ts`:

```typescript
class VolAdjustedStrategy {
  // Config
  private baseThresholdPct = 5
  private minThresholdPct = 3
  private maxThresholdPct = 20
  private volLookbackDays = 30

  // Rolling window of daily volatility readings
  private volHistory: number[] = []
  private lastDayBucket = 0

  // Record a volatility reading (one per day)
  recordVolatility(annualizedVolPct: number): void

  // Get average volatility over lookback window
  getAvgVolatility(): number

  // Compute dynamic threshold
  getDynamicThreshold(currentVolPct: number): number {
    const avgVol = this.getAvgVolatility()
    if (avgVol <= 0) return this.baseThresholdPct // fallback
    const ratio = currentVolPct / avgVol
    const raw = this.baseThresholdPct * ratio
    return Math.max(this.minThresholdPct, Math.min(this.maxThresholdPct, raw))
  }

  // Update config from strategy config
  applyConfig(params: VolAdjustedParams): void

  // Expose state for API
  getState(): { avgVol: number, currentThreshold: number, samples: number }
}
```

### Step 2: Update VolatilityTracker

In `src/rebalancer/volatility-tracker.ts`:
- Add `getDailyReturns(): number[]` getter (expose read-only copy for vol-adjusted strategy)
- OR: have VolAdjustedStrategy independently track vol readings via `recordVolatility()` (simpler, more decoupled — preferred)

Preferred approach: VolAdjustedStrategy tracks its own vol history (called from StrategyManager when portfolio updates arrive). This avoids coupling to VolatilityTracker internals.

### Step 3: Integrate with StrategyManager

Update `src/rebalancer/strategy-manager.ts`:
- Import `VolAdjustedStrategy`
- In `getDynamicThreshold()`: for `vol-adjusted` mode, delegate to `volAdjusted.getDynamicThreshold(currentVol)`
- Remove the binary `DYNAMIC_THRESHOLD_LOW` / `DYNAMIC_THRESHOLD_HIGH` logic
- In `applyConfig()`: if type is `vol-adjusted`, call `volAdjusted.applyConfig(params)`
- On portfolio update: call `volAdjusted.recordVolatility(volatilityTracker.getVolatility())`

### Step 4: Remove Old Env Vars (Optional)

Consider deprecating `DYNAMIC_THRESHOLD_LOW` and `DYNAMIC_THRESHOLD_HIGH` from `app-config.ts`. They become unnecessary with the continuous formula. Keep them for backward compatibility but log deprecation warning.

### Step 5: Tests

- Unit test `vol-adjusted-strategy.ts`:
  - Threshold scales up when current vol > avg vol
  - Threshold scales down when current vol < avg vol
  - Threshold clamped at min/max
  - Fallback to base threshold when no vol history
  - Rolling window caps at volLookbackDays

## Todo List

- [ ] Create `src/rebalancer/strategies/vol-adjusted-strategy.ts`
- [ ] Integrate VolAdjustedStrategy into StrategyManager.getDynamicThreshold()
- [ ] Feed volatility readings to VolAdjustedStrategy on portfolio updates
- [ ] Update `vol-adjusted` case in shouldRebalance() to use continuous threshold
- [ ] Remove or deprecate binary `DYNAMIC_THRESHOLD_LOW`/`HIGH` from env config
- [ ] Write unit tests for VolAdjustedStrategy
- [ ] Update StrategyManager tests for continuous threshold

## Success Criteria

- [ ] Threshold scales continuously with volatility ratio (not binary)
- [ ] Threshold clamped between minThresholdPct and maxThresholdPct
- [ ] Falls back to baseThresholdPct when insufficient vol data
- [ ] Strategy loads params from DB config (via Phase 1)
- [ ] Falls back to env defaults when no DB config
- [ ] Old binary threshold logic removed/deprecated

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Division by zero (avgVol = 0) | Medium — crash | Guard: if avgVol <= 0, return baseThresholdPct |
| Threshold too loose in extreme vol | Low | maxThresholdPct cap (default 20%) |
| Threshold too tight in flash crash recovery | Low | minThresholdPct floor (default 3%) |

## Security Considerations

- No external data dependencies — uses internal volatility data only
- Config params validated by Zod schema (Phase 1)
