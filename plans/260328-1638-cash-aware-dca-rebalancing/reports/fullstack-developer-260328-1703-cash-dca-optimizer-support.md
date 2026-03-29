## Phase Implementation Report

### Executed Phase
- Phase: cash-aware-dca-rebalancing
- Plan: /Users/dungngo97/Documents/rebalance-bot/plans/260328-1638-cash-aware-dca-rebalancing
- Status: completed

### Files Modified

1. `src/backtesting/optimizer-parameter-grids.ts` (+50 lines)
   - Added `cashReservePct?` and `dcaRebalanceEnabled?` to `ParamCombination` interface
   - Added exported `generateCashDCAGrid()` function (~20 combos: 4 base strategies × cashPct[0,10,20] × dca[false,true], skipping dcaRoute=true when cashPct=0)

2. `src/backtesting/metrics-calculator.ts` (+4 lines)
   - Added `cashReservePct?` and `dcaRebalanceEnabled?` fields to `BacktestConfig` interface

3. `src/backtesting/strategy-optimizer.ts` (+12 lines)
   - Imported `generateCashDCAGrid`
   - Added `includeCashScenarios?` to `OptimizationRequest`
   - Added `cashReservePct?` and `dcaRebalanceEnabled?` to `OptimizationResultItem`
   - `optimize()` appends cash+DCA grid when `includeCashScenarios=true`
   - Passes `cashReservePct` and `dcaRebalanceEnabled` through to `BacktestConfig` per combo
   - Result items carry `cashReservePct` and `dcaRebalanceEnabled`

4. `src/api/routes/backtest-routes.ts` (+5 lines)
   - `/backtest/optimize` handler reads `includeCashScenarios` bool from request body and forwards it to `OptimizationRequest`

5. `frontend/src/lib/api-types.ts` (+5 lines)
   - Added `includeCashScenarios?` to `OptimizationRequest`
   - Added `cashReservePct?` and `dcaRebalanceEnabled?` to `OptimizationResultItem`

6. `frontend/src/pages/backtest-optimizer-tab.tsx` (+15 lines)
   - `includeCashScenarios` state (default: true)
   - Checkbox UI: "Include cash reserve scenarios (cash 0/10/20% + DCA routing, ~20 extra combos)"
   - Combo count display updated: shows "98+20" when enabled, "98" otherwise
   - `includeCashScenarios` forwarded in `mutation.mutate(...)` call

### Tasks Completed
- [x] `ParamCombination` extended with optional cash+DCA fields
- [x] `generateCashDCAGrid()` implemented and exported
- [x] `BacktestConfig` extended with `cashReservePct` and `dcaRebalanceEnabled`
- [x] `strategy-optimizer.ts` merges cash grid when `includeCashScenarios=true`
- [x] Optimizer results carry cash/DCA metadata fields
- [x] Route handler forwards `includeCashScenarios` flag
- [x] Frontend types updated
- [x] Frontend optimizer tab has "Include cash reserve scenarios" checkbox

### Tests Status
- Backend build: pass (bundled 1146 modules, no errors)
- Frontend build: pass (vite build success, no type errors)
- Unit tests: not run (no test runner invocation requested)

### Issues Encountered
None. Both builds clean on first attempt.

### Next Steps
- The `cashReservePct` field is stored in `BacktestConfig` and passed through but the simulator itself does not yet act on it (i.e., no actual cash buffer is carved out of the portfolio). To make it functionally meaningful, `backtest-simulator.ts::_initHoldings` should subtract `cashReservePct` from investable balance, and `_simulateRebalance` should cap buy orders accordingly. That is a separate enhancement from what was requested here.
- `dcaRebalanceEnabled` is similarly recorded but not wired to TWAP/VWAP order routing — the simulator uses immediate execution regardless. DCA routing would require integration with the smart-order subsystem.

### Unresolved Questions
1. Should `cashReservePct` actually reduce the investable capital in the simulator now, or is recording + surfacing in results sufficient for this phase?
2. Is `dcaRebalanceEnabled` expected to trigger real DCA slicing inside the backtest loop, or is it metadata-only for the optimizer output at this stage?
