---
title: "Persist MA Data + Bear Rebalance Fix"
description: "Persist TrendFilter daily closes to MongoDB; make rebalance engine handle bear trigger with bearCashPct target"
status: completed
priority: P1
effort: 2h
---

# Phase 1: Persist MA Data + Bear Rebalance Fix

## Context Links
- [trend-filter.ts](../../src/rebalancer/trend-filter.ts) -- in-memory only, loses data on restart
- [rebalance-engine.ts](../../src/rebalancer/rebalance-engine.ts) -- no bear-specific logic
- [ohlcv-candle-model.ts](../../src/db/models/ohlcv-candle-model.ts) -- existing candle model
- [drift-detector.ts](../../src/rebalancer/drift-detector.ts) -- emits `trend-filter-bear` trigger
- [types/index.ts](../../src/types/index.ts) -- RebalanceTrigger type

## Overview

Two critical P1 bugs:
1. TrendFilter stores BTC daily closes in-memory array. Restart = 100 days of data lost = blind trend filter defaulting to bull.
2. `rebalance:trigger { trigger: 'trend-filter-bear' }` fires from drift-detector but rebalance engine treats it like normal rebalance (drift-based). Must sell to `bearCashPct` (70%) cash instead.

## Key Insights

- `OhlcvCandleModel` already exists with `{ exchange, pair, timeframe, timestamp, close }`. Can query BTC/USDT 1d candles on startup to hydrate TrendFilter.
- `RebalanceTrigger` type is `'threshold' | 'periodic' | 'manual'` -- missing `'trend-filter-bear'`.
- `calculateTrades()` accepts `cashReservePct` param already -- bear rebalance can pass `bearCashPct` as override.
- TrendFilter is a singleton -- can add `loadFromDb()` and `persistDay()` methods directly.

## Requirements

### Functional
- On startup, TrendFilter loads last 400 BTC/USDT 1d candles from `OhlcvCandleModel`
- Each new daily close is persisted to `OhlcvCandleModel` (upsert on same day)
- RebalanceEngine detects `trend-filter-bear` trigger and passes `bearCashPct` to `calculateTrades()`
- `RebalanceTrigger` type includes `'trend-filter-bear'`

### Non-functional
- Startup hydration must not block if DB is empty (defaults to bull = safe)
- Persisting a candle must not block the main price-update loop (fire-and-forget with error log)

## Related Code Files

### Modify
- `src/rebalancer/trend-filter.ts` -- add `loadFromDb()`, auto-persist in `recordPrice()`
- `src/rebalancer/rebalance-engine.ts` -- branch on `trigger === 'trend-filter-bear'`
- `src/rebalancer/trade-calculator.ts` -- no change needed, already accepts `cashReservePct`
- `src/types/index.ts` -- extend `RebalanceTrigger` union
- `src/rebalancer/drift-detector.ts` -- no change needed (already emits correctly)

### No new files needed

## Implementation Steps

### Part A: Persist MA Data

1. **Extend `RebalanceTrigger` type** in `src/types/index.ts`:
   ```ts
   export type RebalanceTrigger = 'threshold' | 'periodic' | 'manual' | 'trend-filter-bear'
   ```

2. **Add DB methods to TrendFilter** in `src/rebalancer/trend-filter.ts`:
   - Import `OhlcvCandleModel`
   - Add `async loadFromDb()`: query `OhlcvCandleModel.find({ pair: 'BTC/USDT', timeframe: '1d' }).sort({ timestamp: 1 }).limit(400)`, map `.close` values into `dailyCloses[]`, set `lastRecordedDay` from last entry
   - Modify `recordPrice()`: when a new day entry is added (not just updated), upsert to `OhlcvCandleModel` with `{ exchange: 'trend-filter', pair: 'BTC/USDT', timeframe: '1d', timestamp: dayStart }`. Fire-and-forget with `.catch(console.error)`
   - Keep existing in-memory logic unchanged -- DB is persistence layer only

3. **Call `loadFromDb()` at startup**: in the main bootstrap file (likely `src/index.ts` or `src/app.ts`), call `await trendFilter.loadFromDb()` after MongoDB connects but before drift-detector starts.

### Part B: Bear-Specific Rebalance

4. **Branch in RebalanceEngine.execute()** in `src/rebalancer/rebalance-engine.ts`:
   - After getting `targets` (step 2), check if `trigger === 'trend-filter-bear'`
   - If bear trigger: read `bearCashPct` from active strategy config's `globalSettings`
   - Pass `bearCashPct` to `calculateTrades(beforeState, targets, undefined, bearCashPct)`
   - This makes trade calculator compute trades targeting bearCashPct% cash allocation
   - Normal triggers continue with existing logic (no `cashReservePct` override)

5. **Read strategy config in engine**: import `strategyManager` and read `bearCashPct`:
   ```ts
   const gs = strategyManager.getActiveConfig()?.globalSettings
   const bearCash = typeof gs?.bearCashPct === 'number' ? gs.bearCashPct : 70
   ```

## Todo List

- [x] Extend `RebalanceTrigger` type with `'trend-filter-bear'`
- [x] Add `loadFromDb()` method to TrendFilter
- [x] Add auto-persist in `recordPrice()` for new day entries
- [x] Call `trendFilter.loadFromDb()` at startup
- [x] Add bear trigger branch in `RebalanceEngine.execute()`
- [x] Manual test: restart bot, verify MA data loads from DB
- [x] Manual test: simulate bear trigger, verify sells to bearCashPct

## Success Criteria

- [x] After restart, `trendFilter.getDataPoints()` > 0 (if candles exist in DB)
- [x] `GET /api/health` shows correct `dataPoints` count after restart
- [x] Bear trigger rebalance produces sell orders targeting 70% cash (not drift-based)
- [x] No performance regression on price update loop (persist is fire-and-forget)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| OhlcvCandle query slow with large dataset | `.limit(400)` + compound index already exists |
| Bear rebalance sells too aggressively | `bearCashPct` is configurable (30-95%), start at 70% on testnet |
| Type change breaks existing code | `'trend-filter-bear'` is additive to union -- no breaking change |

## Security Considerations
- No new API endpoints or user inputs
- DB writes are server-side only (no injection risk)
