# Phase Report: Backtest DCA + Cash Reserve + Trend Filter

**Status:** DONE
**Date:** 2026-03-29

## Files Modified

- `src/backtesting/metrics-calculator.ts` (+20 lines)
- `src/backtesting/backtest-simulator.ts` (+175 lines)

## Tasks Completed

- [x] Extended `BacktestConfig` with 5 new optional fields: `dcaAmountUsd`, `dcaIntervalCandles`, `trendFilterMaPeriod`, `trendFilterBearCashPct`, `trendFilterCooldownCandles`
- [x] Added `totalDcaInjected?: number` to `BacktestMetrics`
- [x] Updated `totalReturnPct` formula: `(final - totalInvested) / totalInvested` where `totalInvested = initialBalance + totalDcaInjected` (backward-safe: with no DCA, `totalDcaInjected=0` so behavior is unchanged)
- [x] Added `calculate()` 4th param `totalDcaInjected = 0` (default 0, no breaking change)
- [x] Implemented DCA injection in simulation loop: every `dcaIntervalCandles` candles, inject `dcaAmountUsd` into most underweight asset (bull) or cash (bear)
- [x] Implemented trend filter: accumulate BTC closes, compute SMA, detect bull→bear/bear→bull transition with cooldown, sell to cash on bear transition, re-deploy cash on bull transition
- [x] Added `cashUsd` tracking: equity curve and finalPortfolio include cash position
- [x] Rebalance skipped when `trendFilterMaPeriod > 0 && inBearMode`
- [x] Added `_dcaInjectBullMode()` private helper: buys most underweight asset
- [x] Added `_deployCash()` private helper: re-deploys excess cash on bull transition with fee tracking
- [x] Unused `initial` variable removed from metrics-calculator.ts

## Tests Status

- Type check (tsc --noEmit on source files): PASS (0 errors in modified files)
- `metrics-calculator.test.ts`: 24/24 PASS
- `strategy-backtest-adapter.test.ts`: 19/19 PASS
- `backtest-simulator.isolated.test.ts`: 2 pre-existing timeouts (DB mock incomplete for `BacktestResultModel.create` — not caused by this change)

## Design Decisions

- All new fields default to disabled (0 / undefined) — zero backward compatibility risk
- Bear mode sell uses proportional sell ratio across all holdings (same as `scripts/run-backtest.ts`)
- Cooldown resets only on state flip; countdown ticks every candle while >0
- DCA on candle 0 skipped (candle 0 = initial buy-in at `initialBalance`)
- `cashUsd` starts at 0; `cashReservePct` controls only the bull-mode DCA target pool ratio (no upfront cash extraction at init — matches existing simulator behavior)

## Unresolved Questions

None.
