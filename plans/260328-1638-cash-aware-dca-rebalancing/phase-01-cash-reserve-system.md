---
status: completed
priority: P1
effort: 3h
---

## Context Links

- [Strategy config types](../../src/rebalancer/strategies/strategy-config-types.ts)
- [Trade calculator](../../src/rebalancer/trade-calculator.ts)
- [Strategy presets](../../src/db/models/strategy-config-model.ts)

## Overview

Add cash reserve concept: a configurable % of portfolio held in stablecoins (USDT/USDC/BUSD), never traded. Rebalancing only operates on the non-cash portion.

## Key Insights

- Trade calculator already skips USDT/USDC/BUSD (line 49). Need to extend this to treat cash as a managed allocation target.
- `GlobalSettingsSchema` in strategy-config-types.ts is the right place for cash reserve config (applies to all strategies).
- Cash reserve is NOT a tradeable asset allocation — it's a constraint that scales down crypto allocations.

## Requirements

**Functional:**
- `cashReservePct` config field (0-50%, default 0 for backward compat)
- Trade calculator must compute crypto targets against non-cash portfolio value
- If cash > target: deploy excess to underweight crypto. If cash < target: sell crypto to replenish
- Stablecoins (USDT, USDC, BUSD) all count as "cash"

**Non-functional:**
- Zero breaking changes to existing configs (default 0% reserve = current behavior)
- Cash logic contained in trade-calculator, not scattered

## Architecture

```
Portfolio ($100K, cashReservePct=20%)
  |
  +-- Cash portion: $20K (USDT/USDC/BUSD combined)
  |     -> If >$20K: excess available for crypto buys
  |     -> If <$20K: sell crypto to replenish
  |
  +-- Crypto portion: $80K (rebalanced per strategy allocations)
        -> BTC 40% of $80K = $32K
        -> ETH 15% of $80K = $12K
        -> SOL 12% of $80K = $9.6K
        -> BNB 13% of $80K = $10.4K
        -> etc.
```

## Related Code Files

**Modify:**
- `src/rebalancer/strategies/strategy-config-types.ts` — Add `cashReservePct` to `GlobalSettingsSchema`
- `src/rebalancer/trade-calculator.ts` — Cash-aware trade generation
- `src/db/models/strategy-config-model.ts` — Update presets with cash defaults

**No new files needed.**

## Implementation Steps

### Step 1: Add config fields to GlobalSettingsSchema

In `src/rebalancer/strategies/strategy-config-types.ts`:

```typescript
// Add to GlobalSettingsSchema
cashReservePct: z.number().min(0).max(50).default(0),
```

### Step 2: Modify calculateTrades for cash awareness

In `src/rebalancer/trade-calculator.ts`:

1. Accept optional `cashReservePct` parameter (from global settings)
2. Compute `cashValueUsd` = sum of USDT + USDC + BUSD holdings
3. Compute `targetCashUsd` = `totalUsd * cashReservePct / 100`
4. Compute `cryptoPoolUsd` = `totalUsd - targetCashUsd`
5. Recompute crypto target values against `cryptoPoolUsd` instead of `totalUsd`
6. If `cashValueUsd > targetCashUsd`: excess cash is available, no extra sells needed
7. If `cashValueUsd < targetCashUsd`: add sell orders to bring cash up to target

Key change in delta calculation:
```typescript
// Before:
const targetUsd = (targetPct / 100) * totalUsd
// After (when cashReservePct > 0):
const cryptoPoolUsd = totalUsd * (1 - cashReservePct / 100)
const targetUsd = (targetPct / 100) * cryptoPoolUsd
```

Note: `targetPct` still sums to 100% for crypto assets. The cash reserve is a separate layer.

### Step 3: Add helper to identify stablecoins

In trade-calculator.ts, extract stablecoin check:
```typescript
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD'])
const isStablecoin = (asset: string) => STABLECOINS.has(asset)
```

### Step 4: Handle cash replenishment

When `cashValueUsd < targetCashUsd`, the deficit must come from selling crypto. Distribute the sell proportionally across all overweight assets (those above their crypto-pool target).

### Step 5: Update presets

In `src/db/models/strategy-config-model.ts`, add `cashReservePct: 0` to existing presets' globalSettings (explicit default). Add new preset:

```typescript
CashAwareBalanced: {
  description: 'Balanced strategy with 20% USDT cash reserve',
  params: { type: 'threshold', thresholdPct: 5, minTradeUsd: 15 },
  globalSettings: { cashReservePct: 20, partialFactor: 0.75, cooldownHours: 4, ... },
}
```

## Todo List

- [x] Add `cashReservePct` to `GlobalSettingsSchema` in strategy-config-types.ts
- [x] Extract `STABLECOINS` set and `isStablecoin` helper in trade-calculator.ts
- [x] Modify `calculateTrades` to accept cashReservePct and compute crypto pool
- [x] Implement cash surplus logic (excess cash -> more crypto buys)
- [x] Implement cash deficit logic (sell crypto -> replenish cash)
- [x] Add CashAwareBalanced preset to strategy-config-model.ts
- [x] Add DCARebalance preset to strategy-config-model.ts
- [ ] Unit test: cashReservePct=0 produces identical results to current behavior
- [ ] Unit test: cashReservePct=20 correctly scales crypto targets to 80% of portfolio
- [ ] Unit test: cash deficit triggers proportional sells

## Success Criteria

- [x] `cashReservePct=0` is backward-compatible (no behavior change)
- [x] `cashReservePct=20` with $100K portfolio targets $20K in stablecoins, $80K in crypto
- [x] Cash surplus auto-deploys to underweight crypto
- [x] Cash deficit triggers sells to replenish reserve
- [x] All existing tests still pass
- [x] New preset available in DB

## Risk Assessment

- **Cash drag in bull market**: 20% uninvested reduces upside. Backtest in Phase 3 quantifies impact.
- **Stablecoin depeg**: USDT/USDC/BUSD treated as $1. Not handling depeg scenarios (acceptable for v1).
