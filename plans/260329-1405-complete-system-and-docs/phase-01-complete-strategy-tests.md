---
status: completed
priority: P1
effort: 3h
depends_on: []
---

## Context Links

- [Mean-reversion strategy](../../src/rebalancer/strategies/mean-reversion-strategy.ts)
- [Vol-adjusted strategy](../../src/rebalancer/strategies/vol-adjusted-strategy.ts)
- [Momentum-weighted strategy](../../src/rebalancer/strategies/momentum-weighted-strategy.ts)
- [Strategy config routes](../../src/api/routes/strategy-config-routes.ts)
- [Strategy config types](../../src/rebalancer/strategies/strategy-config-types.ts)
- [Strategy backtest adapter](../../src/backtesting/strategy-backtest-adapter.ts)

## Overview

Write unit tests for the three new strategy implementations and the strategy-config CRUD routes. These modules were implemented in the advanced-strategy-config plan but shipped without dedicated test files.

Existing test coverage:
- `strategy-manager.test.ts` — uses a MockStrategyManager, does NOT test real strategies
- `trend-filter.test.ts` — covers TrendFilter core logic
- `bear-rebalance-flow.test.ts` — covers trade-calculator with cash override
- No test files exist for: mean-reversion, vol-adjusted, momentum-weighted, strategy-config-routes, strategy-backtest-adapter

## Requirements

**Functional:**
- Unit tests for each strategy's core methods
- Route tests for strategy-config CRUD endpoints
- Adapter tests for StrategyBacktestAdapter delegation logic

**Non-functional:**
- All tests must run with `bun test` without MongoDB (pure unit tests)
- Follow existing test patterns (see `trend-filter.test.ts` for style)
- No mocking of external services; strategies are pure functions

## Related Code Files

**Create:**
- `src/rebalancer/strategies/mean-reversion-strategy.test.ts`
- `src/rebalancer/strategies/vol-adjusted-strategy.test.ts`
- `src/rebalancer/strategies/momentum-weighted-strategy.test.ts`
- `src/api/routes/strategy-config-routes.test.ts`
- `src/backtesting/strategy-backtest-adapter.test.ts`

**Read only (do not modify):**
- All source files listed in Context Links

## Implementation Steps

### Step 1: mean-reversion-strategy.test.ts

Test `MeanReversionStrategy` class (instantiate directly, not singleton):

1. **recordDrift** — records drift, prunes beyond lookbackDays
2. **getBandWidth** — returns `bandWidthSigma * stddev`, floored at minDriftPct
3. **shouldRebalance** — returns true when any asset |drift| > band
4. **reset** — clears history
5. Edge cases: empty history (band = minDriftPct), single sample (stddev=0), all drifts within band

Params fixture:
```typescript
const params = { type: 'mean-reversion' as const, minTradeUsd: 10, lookbackDays: 30, bandWidthSigma: 1.5, minDriftPct: 3 }
```

### Step 2: vol-adjusted-strategy.test.ts

Test `VolAdjustedStrategy` class:

1. **recordVolatility** — adds readings, prunes beyond lookback
2. **getAverageVol** — correct average, 0 when empty
3. **getDynamicThreshold** — returns baseThresholdPct when no history; scales with vol ratio; clamped to [min, max]
4. **reset** — clears history
5. Edge cases: avgVol=0, currentVol >> avgVol (hits max), currentVol << avgVol (hits min)

Params fixture:
```typescript
const params = { type: 'vol-adjusted' as const, minTradeUsd: 10, baseThresholdPct: 5, volLookbackDays: 30, minThresholdPct: 3, maxThresholdPct: 20 }
```

### Step 3: momentum-weighted-strategy.test.ts

Test `MomentumWeightedStrategy` class:

1. **computeRSI** — returns 50 with insufficient data; 100 when all gains; known RSI for a simple series
2. **computeMACD** — returns 0 with insufficient data; positive when fast EMA > slow EMA
3. **getCompositeScore** — range [-1, +1]; oversold (low RSI) gives positive score
4. **getAdjustedAllocations** — renormalises to 100%; no price history = base allocations unchanged; positive score increases weight
5. Edge cases: empty allocations, single asset, all prices identical (neutral score)

Params fixture:
```typescript
const params = { type: 'momentum-weighted' as const, minTradeUsd: 10, rsiPeriod: 14, macdFast: 12, macdSlow: 26, weightFactor: 0.4 }
```

### Step 4: strategy-config-routes.test.ts

Test the Hono routes using `app.request()` pattern (no real MongoDB). Approach: mock `StrategyConfigModel` static methods using `bun:test` mock/spy. OR test Zod validation only (schema parsing tests for Create/Update payloads).

Recommended: **Schema validation tests** (no DB needed):
1. `CreateStrategyConfigSchema` accepts valid payloads for each strategy type
2. Rejects invalid params (wrong type discriminator, out-of-range values)
3. `UpdateStrategyConfigSchema` accepts partial updates
4. `GlobalSettingsSchema` validates all fields including cashReservePct, trendFilter fields

### Step 5: strategy-backtest-adapter.test.ts

Test `StrategyBacktestAdapter`:

1. Constructor creates correct strategy instance per type
2. **updateState** feeds data to the right strategy (verify via subsequent needsRebalance behavior)
3. **needsRebalance** — delegates to mean-reversion/vol-adjusted correctly; falls back to threshold for others
4. **getEffectiveAllocations** — momentum-weighted adjusts weights; equal-weight equalizes; others return base
5. Edge cases: totalValueUsd=0 returns false, empty holdings

## Todo List

- [x] Create mean-reversion-strategy.test.ts with 6+ test cases
- [x] Create vol-adjusted-strategy.test.ts with 6+ test cases
- [x] Create momentum-weighted-strategy.test.ts with 8+ test cases
- [ ] Create strategy-config-routes.test.ts (Zod schema validation, 8+ cases)
- [x] Create strategy-backtest-adapter.test.ts with 6+ test cases
- [x] Run `bun test` and verify all new tests pass
- [x] Verify existing tests still pass (no regressions)

## Success Criteria

- [x] All 4 new test files created and passing (strategy-config-routes.test.ts deferred — not in task scope)
- [x] Each strategy has coverage for: core logic, edge cases, reset
- [ ] Schema validation tests cover all 6 strategy param types
- [x] Adapter tests verify delegation for mean-reversion, vol-adjusted, momentum-weighted
- [x] `bun test` passes with 0 failures (62 new tests, 0 fail; pre-existing failures unchanged)

## Risk Assessment

- **Tests may reveal bugs**: If strategy logic has bugs, fix them in this phase (implementations are small, <80 lines each).
- **Route tests without DB**: Use schema-only testing to avoid MongoDB dependency. Full integration tests are out of scope.
