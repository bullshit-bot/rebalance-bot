---
title: "Mean-Reversion Bands Strategy"
status: pending
priority: P1
effort: 3h
---

# Phase 2: Mean-Reversion Bands Strategy

## Context Links

- [Research: Advanced Strategies](../reports/researcher-260328-0014-advanced-rebalancing-strategies.md) — Section 2
- [Phase 1: Config Backend](./phase-01-strategy-config-backend.md) — depends on config model
- Existing volatility tracker: `src/rebalancer/volatility-tracker.ts`
- Drift detector: `src/rebalancer/drift-detector.ts` (currently uses fixed threshold)
- Rebalance engine: `src/rebalancer/rebalance-engine.ts`
- Strategy manager: `src/rebalancer/strategy-manager.ts`

## Overview

Implement Bollinger-band style rebalancing: define volatility-aware bands around target allocations. Rebalance only when drift crosses band boundaries. Bands expand in high-vol periods, contract in calm markets.

**Formula:** `band = targetPct +/- (bandWidthSigma * rollingStdDev(driftHistory, lookbackDays))`

**Expected improvement:** 77% median return vs fixed 5% threshold (research data).

## Key Insights

- 30-day rolling vol + 1.5 sigma optimal for crypto
- Reduces unnecessary trades by 20-30% vs fixed threshold
- Captures mean-reversion premium: buy low (lower band), sell high (upper band)
- Must pair with minimum drift floor to avoid zero-band scenarios in calm markets

## Requirements

### Functional
- Calculate per-asset Bollinger bands around target allocation percentages
- Trigger rebalance only when an asset's drift crosses its band boundary
- Parameters: `lookbackDays` (default 30), `bandWidthSigma` (default 1.5), `minDriftPct` (default 3)
- Integrate with StrategyManager so `shouldRebalance()` uses bands when mode is `mean-reversion`
- Record daily allocation drift samples (one per day per asset, rolling window)

### Non-Functional
- Band calculation must complete in <10ms per asset
- Rolling window capped at `lookbackDays` entries to bound memory

## Architecture

```
price:update → PortfolioTracker recalculates allocations
  → DriftDetector.handlePortfolioUpdate()
    → StrategyManager.shouldRebalance(maxDriftPct)
      → if mode === 'mean-reversion':
        → MeanReversionStrategy.shouldRebalance(assets)
          → For each asset: check if |driftPct| > bandWidth(asset)
          → bandWidth = max(minDriftPct, bandWidthSigma * rollingStdDev)
        → Return true if any asset breaches band
```

## Related Code Files

### Create
- `src/rebalancer/strategies/mean-reversion-strategy.ts` — band calculation + rebalance decision

### Modify
- `src/rebalancer/strategy-manager.ts` — add `mean-reversion` mode, delegate to MeanReversionStrategy
- `src/rebalancer/drift-detector.ts` — use `strategyManager.shouldRebalance()` instead of hardcoded `env.REBALANCE_THRESHOLD`

### No Deletes

## Implementation Steps

### Step 1: MeanReversionStrategy Module

Create `src/rebalancer/strategies/mean-reversion-strategy.ts`:

```typescript
class MeanReversionStrategy {
  // Per-asset rolling window of daily drift samples
  private driftHistory: Map<string, number[]> = new Map()
  private lastDayBucket: Map<string, number> = new Map()

  // Config (loaded from strategy config)
  private lookbackDays = 30
  private bandWidthSigma = 1.5
  private minDriftPct = 3

  // Record a drift observation (one per day per asset)
  recordDrift(asset: string, driftPct: number): void

  // Calculate band width for an asset
  getBandWidth(asset: string): number {
    // stddev of driftHistory for asset * bandWidthSigma
    // floor at minDriftPct
  }

  // Check if any asset breaches its band
  shouldRebalance(assets: Array<{asset: string, driftPct: number}>): boolean

  // Update config from strategy config
  applyConfig(params: MeanReversionParams): void

  // Expose state for API/debugging
  getBandInfo(): Record<string, { bandWidth: number, samples: number }>
}
```

Key logic:
- `getBandWidth(asset)`: compute stddev of rolling drift history, multiply by sigma, floor at minDriftPct
- `shouldRebalance(assets)`: return true if any `|asset.driftPct| > getBandWidth(asset)`
- `recordDrift(asset, driftPct)`: push to rolling buffer (one entry per calendar day, cap at lookbackDays)

### Step 2: Integrate with StrategyManager

Update `src/rebalancer/strategy-manager.ts`:
- Import `MeanReversionStrategy`
- Add `private meanReversion: MeanReversionStrategy`
- In `shouldRebalance()`: add case for `mean-reversion` that delegates to `meanReversion.shouldRebalance()`
- In `applyConfig()`: if type is `mean-reversion`, call `meanReversion.applyConfig(params)`
- Add method `recordAssetDrifts(assets)` called by DriftDetector on each portfolio update

### Step 3: Update DriftDetector

Update `src/rebalancer/drift-detector.ts`:
- Replace hardcoded `env.REBALANCE_THRESHOLD` check with `strategyManager.shouldRebalance(maxDriftPct)`
- Before shouldRebalance check, call `strategyManager.recordAssetDrifts(portfolio.assets)` to feed drift data to mean-reversion strategy
- Pass full asset array (not just max drift) so strategy can do per-asset band checks

### Step 4: Add StrategyMode Type

Update `StrategyMode` type in `strategy-manager.ts`:
- Add `'mean-reversion'` to the union type
- Add to `STRATEGY_MODE` enum in `app-config.ts` (for env fallback)

### Step 5: Tests

- Unit test `mean-reversion-strategy.ts`:
  - Band width increases with volatile drift history
  - Band width floors at `minDriftPct` with calm history
  - `shouldRebalance` returns true only when drift exceeds band
  - Rolling window trims to lookbackDays
- Update `strategy-manager.test.ts` for new mode

## Todo List

- [ ] Create `src/rebalancer/strategies/mean-reversion-strategy.ts`
- [ ] Add `mean-reversion` to `StrategyMode` type
- [ ] Integrate MeanReversionStrategy into StrategyManager
- [ ] Update DriftDetector to use `strategyManager.shouldRebalance()` instead of hardcoded threshold
- [ ] Feed per-asset drift data to strategy on each portfolio update
- [ ] Add `mean-reversion` to env STRATEGY_MODE enum in app-config.ts
- [ ] Write unit tests for MeanReversionStrategy
- [ ] Update StrategyManager tests for new mode

## Success Criteria

- [ ] Band width expands in high-drift periods, contracts in calm periods
- [ ] Band width never drops below `minDriftPct` floor
- [ ] Rebalance triggers only when asset drift exceeds its computed band
- [ ] Strategy loads params from DB config (via Phase 1 config system)
- [ ] Falls back to env defaults when no DB config exists
- [ ] Rolling window correctly caps at lookbackDays entries

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Insufficient drift history on cold start | Low — all bands default to minDriftPct | Use minDriftPct floor; bands tighten only after lookbackDays of data |
| Too-tight bands in low-vol periods | Medium — excessive trading | minDriftPct floor prevents this (default 3%) |
| Per-asset memory growth | Low | Cap rolling window at lookbackDays; max ~50 assets * 365 samples = negligible |

## Security Considerations

- No external data dependencies — uses internal portfolio drift data only
- Config params validated by Zod schema (Phase 1)
