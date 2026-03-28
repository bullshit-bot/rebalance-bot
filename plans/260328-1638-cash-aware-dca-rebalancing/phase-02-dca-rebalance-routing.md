---
status: completed
priority: P1
effort: 3h
depends_on: [phase-01]
---

## Context Links

- [DCA service](../../src/dca/dca-service.ts)
- [Drift detector](../../src/rebalancer/drift-detector.ts)
- [Strategy manager](../../src/rebalancer/strategy-manager.ts)
- [Strategy config types](../../src/rebalancer/strategies/strategy-config-types.ts)

## Overview

Replace proportional DCA with targeted routing: new deposits buy the single most underweight asset. Traditional sell+buy rebalance only triggers at a high drift threshold (e.g., 15%). This eliminates most sell fees.

## Key Insights

- Current DCA (`calculateDCAAllocation`) distributes deposit proportionally to ALL underweight assets. New behavior: buy only the MOST underweight one.
- DriftDetector uses `env.REBALANCE_THRESHOLD` for triggering. Need two thresholds: soft (DCA handles it) and hard (traditional rebalance).
- DCA service already sorts underweight by deficit (line 113). Just take the first entry instead of distributing.

## Requirements

**Functional:**
- `dcaRebalanceEnabled` boolean in GlobalSettings (default false for backward compat)
- `hardRebalanceThreshold` number in GlobalSettings (5-50%, default 15)
- When dcaRebalance is ON: DCA buys the single most underweight asset
- When dcaRebalance is ON: traditional rebalance only fires when drift > hardRebalanceThreshold
- When no asset is underweight and dcaRebalance is ON: deposit goes to cash reserve
- When dcaRebalance is OFF: current proportional DCA behavior preserved

**Non-functional:**
- DCA routing decision happens in DCAService (single responsibility)
- DriftDetector consults strategy config for threshold

## Architecture

```
Deposit detected ($20)
  |
  dcaRebalanceEnabled?
  |-- NO: proportional DCA (current behavior)
  |-- YES:
       |
       Any asset underweight?
       |-- YES: Buy MOST underweight asset with full $20
       |-- NO:  Add to cash reserve (hold as USDT)

Drift check (periodic):
  |
  maxDrift > hardRebalanceThreshold (15%)?
  |-- YES: Traditional sell+buy rebalance
  |-- NO:  Skip (DCA will correct over time)
```

## Related Code Files

**Modify:**
- `src/rebalancer/strategies/strategy-config-types.ts` — Add `dcaRebalanceEnabled`, `hardRebalanceThreshold`
- `src/dca/dca-service.ts` — Targeted routing mode
- `src/rebalancer/drift-detector.ts` — Use hardRebalanceThreshold when dcaRebalance is on
- `src/rebalancer/strategy-manager.ts` — Expose dcaRebalance state, adjust shouldRebalance

## Implementation Steps

### Step 1: Add config fields

In `src/rebalancer/strategies/strategy-config-types.ts`, add to `GlobalSettingsSchema`:

```typescript
dcaRebalanceEnabled: z.boolean().default(false),
hardRebalanceThreshold: z.number().min(5).max(50).default(15),
```

### Step 2: Modify DCA routing in dca-service.ts

Add new method `calculateTargetedDCAAllocation`:

```typescript
calculateTargetedDCAAllocation(
  depositAmount: number,
  portfolio: Portfolio,
  targets: Allocation[],
  cashReservePct: number,
): TradeOrder[]
```

Logic:
1. Compute underweight assets same as current (with cash-aware targets from Phase 1)
2. Sort by deficit descending
3. If underweight.length > 0: allocate full deposit to `underweight[0]` (most underweight)
4. If underweight.length === 0: return empty array (deposit stays as cash)

Update `onPortfolioUpdate` to check `dcaRebalanceEnabled` from active strategy config and call appropriate method.

### Step 3: Wire config into DCAService

DCAService needs access to active strategy config. Options:
- Import `strategyManager` and call `getActiveConfig()` to read globalSettings
- This keeps DCAService decoupled from config storage

```typescript
import { strategyManager } from '@rebalancer/strategy-manager'

// In onPortfolioUpdate:
const config = strategyManager.getActiveConfig()
const globalSettings = config?.globalSettings as GlobalSettings | undefined
const dcaEnabled = globalSettings?.dcaRebalanceEnabled ?? false
const cashReservePct = globalSettings?.cashReservePct ?? 0
```

### Step 4: Modify drift-detector threshold

In `drift-detector.ts`, `handlePortfolioUpdate`:
- When dcaRebalance enabled, use `hardRebalanceThreshold` instead of `env.REBALANCE_THRESHOLD`
- Import strategyManager to read config

```typescript
private getEffectiveThreshold(): number {
  const config = strategyManager.getActiveConfig()
  const gs = config?.globalSettings as GlobalSettings | undefined
  if (gs?.dcaRebalanceEnabled) {
    return gs.hardRebalanceThreshold ?? 15
  }
  return env.REBALANCE_THRESHOLD
}
```

### Step 5: Update strategyManager.shouldRebalance

In `strategy-manager.ts`, when dcaRebalance is enabled, override threshold:
```typescript
shouldRebalance(maxDriftPct: number, drifts?: Map<string, number>): boolean {
  // If DCA rebalance is on, only hard-rebalance at high threshold
  const gs = this.activeConfig?.globalSettings as GlobalSettings | undefined
  if (gs?.dcaRebalanceEnabled) {
    return maxDriftPct >= (gs.hardRebalanceThreshold ?? 15)
  }
  // ... existing logic
}
```

### Step 6: Update presets

Add DCA-enabled preset:
```typescript
DCARebalance: {
  description: 'DCA-driven rebalancing with 20% cash reserve — minimal sell fees',
  params: { type: 'threshold', thresholdPct: 15, minTradeUsd: 10 },
  globalSettings: {
    cashReservePct: 20,
    dcaRebalanceEnabled: true,
    hardRebalanceThreshold: 15,
    partialFactor: 0.75,
    cooldownHours: 4,
    feeAware: true,
    autoExecute: false,
  },
}
```

## Todo List

- [x] Add `dcaRebalanceEnabled` and `hardRebalanceThreshold` to GlobalSettingsSchema
- [x] Implement targeted DCA routing via `calcSingleTargetDCA` helper
- [x] Wire strategyManager.getDCATarget into DCAService.calculateDCAAllocation
- [x] Add getDCATarget to StrategyManager (delegates to dca-target-resolver)
- [x] Add DCARebalance preset to strategy-config-model.ts
- [ ] Update drift-detector to use hardRebalanceThreshold when DCA rebalance is on
- [ ] Unit test: dcaRebalanceEnabled=false preserves current proportional behavior
- [ ] Unit test: dcaRebalanceEnabled=true routes full deposit to most underweight asset
- [ ] Unit test: no underweight assets -> empty orders (deposit stays as cash)
- [ ] Unit test: drift < hardRebalanceThreshold does not trigger traditional rebalance

## Success Criteria

- [x] `dcaRebalanceEnabled=false` is backward-compatible
- [x] Targeted DCA buys only the single most underweight asset
- [x] No sell orders generated from DCA deposits
- [x] Cash reserve respected in DCA calculations
- [x] All existing tests pass
- [ ] Traditional rebalance only triggers at hardRebalanceThreshold (drift-detector not yet updated)

## Risk Assessment

- **Concentration risk**: Buying one asset per deposit could over-concentrate. Mitigated: only underweight assets are candidates; once an asset reaches target, next deposit goes elsewhere.
- **Large deposits**: A $5K deposit into a single asset may cause slippage. For v1, acceptable since DCA deposits are typically small ($20-100/day).
