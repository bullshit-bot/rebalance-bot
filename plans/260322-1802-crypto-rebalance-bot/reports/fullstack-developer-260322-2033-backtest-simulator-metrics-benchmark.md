# Phase Implementation Report

## Executed Phase
- Phase: Phase 2, Steps 2-3 (backtesting engine)
- Plan: /Users/dungngo97/Documents/rebalance-bot/plans/260322-1802-crypto-rebalance-bot
- Status: completed

## Files Modified
- `src/backtesting/metrics-calculator.ts` — created, 200 lines. Exports `BacktestConfig`, `BacktestMetrics`, `SimulatedTrade`, `MetricsCalculator`, `metricsCalculator` singleton.
- `src/backtesting/benchmark-comparator.ts` — created, 148 lines. Exports `BenchmarkResult`, `BenchmarkComparator`, `benchmarkComparator` singleton.
- `src/backtesting/backtest-simulator.ts` — created, 198 lines. Exports `BacktestResult`, `BacktestSimulator`, `backtestSimulator` singleton. Re-exports all types.

## Tasks Completed
- [x] `metrics-calculator.ts`: total return, annualized return (CAGR), Sharpe (0% risk-free), max drawdown, win rate, volatility, fee/trade stats
- [x] `benchmark-comparator.ts`: buy-and-hold equity curve with target-weighted initial allocation; inner-join timestamp intersection; delegates to metricsCalculator for comparable stats
- [x] `backtest-simulator.ts`: loads OHLCV via getCachedData → loadData fallback; inner-join timeline; virtual portfolio init at first candle; drift-threshold rebalance loop using calculateTrades; fee deduction; equity curve; DB persist via `backtestResults` table

## Tests Status
- Type check: pass (0 errors in backtesting files)
- Pre-existing failures in `api-key-crypto.test.ts`, `price-cache.test.ts`, `trade-calculator.test.ts` — not introduced by this phase

## Issues Encountered
- `@backtesting/*` path alias not in tsconfig.json — used relative imports within the module instead (correct approach, no alias needed for intra-module imports)
- `noUnusedLocals`/`noUnusedParameters` strict mode required renaming `config` → `_config` in `_zeroMetrics` and dropping `trades` from destructure in `benchmark-comparator`
- `BacktestConfig` places `exchange: ExchangeName` as a required field (needed for `historicalDataLoader` which requires exchange); the spec did not include it but it is mandatory for data loading

## Next Steps
- Downstream: API endpoint / CLI runner can call `backtestSimulator.run(config)` directly
- `@backtesting/*` alias could be added to tsconfig for cleaner imports if more modules reference this module from outside

## Unresolved Questions
- None
