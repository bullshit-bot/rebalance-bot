---
status: pending
priority: P1
effort: 3h
depends_on: [phase-02]
---

## Context Links

- [Backtest simulator](../../src/backtesting/backtest-simulator.ts)
- [Metrics calculator](../../src/backtesting/metrics-calculator.ts)
- [Strategy backtest adapter](../../src/backtesting/strategy-backtest-adapter.ts)
- [Existing phase-03 spec](../260328-1638-cash-aware-dca-rebalancing/phase-03-backtest-cash-dca.md)
- [DCA allocation calculator](../../src/dca/dca-allocation-calculator.ts)

## Overview

Complete Phase 3 from the cash-aware-dca-rebalancing plan. Extend backtest simulator to support:
1. Periodic DCA injection (buy most underweight or proportional)
2. Cash reserve tracking throughout simulation
3. Trend filter integration in backtest (uses Phase 2 work)
4. Comparative backtest scripts

This phase depends on Phase 2 because trend filter should be testable in backtest scenarios.

## Key Insights

- Current simulator: starts with `initialBalance`, rebalances on drift, no deposits
- DCA injection = every N candles, add $X; either targeted (most underweight) or proportional
- Cash reserve = virtual USDT holding; never traded below target %
- All new BacktestConfig fields are optional = backward compatible
- Trend filter in backtest: simulate MA check per candle, skip rebalance in "bear" periods or shift to high cash

## Requirements

**Functional:**
- `BacktestConfig` gains: `dcaAmountUsd`, `dcaIntervalCandles`, `cashReservePct`, `dcaRebalanceEnabled`, `hardRebalanceThreshold`, `trendFilterEnabled`, `trendFilterMA`, `bearCashPct`
- Simulator injects DCA deposits at configured interval
- DCA routing: dcaRebalanceEnabled=true buys most underweight asset; false = proportional
- Cash reserve maintained as virtual USDT balance, excluded from crypto rebalancing
- Trend filter in backtest: compute MA from BTC candle data, switch to bear cash target when below MA
- Run comparison script with test matrix

**Non-functional:**
- Backward compat: omitting new fields = identical behavior to current
- Results persisted to MongoDB

## Related Code Files

**Modify:**
- `src/backtesting/metrics-calculator.ts` — Add DCA + trend filter fields to BacktestConfig
- `src/backtesting/backtest-simulator.ts` — DCA injection, cash tracking, trend filter sim

**Create:**
- `scripts/run-dca-backtest-comparison.ts` — Comparative backtest runner

**Read only:**
- `src/dca/dca-allocation-calculator.ts` — Reference for targeted DCA logic
- `src/rebalancer/trend-filter.ts` — Reference for MA calculation (replicate in backtest)

## Implementation Steps

### Step 1: Extend BacktestConfig

In `metrics-calculator.ts`, add optional fields:

```typescript
// DCA fields
dcaAmountUsd?: number          // USD per injection (e.g., 20)
dcaIntervalCandles?: number    // inject every N candles (1 = every candle)
dcaRebalanceEnabled?: boolean  // targeted vs proportional
cashReservePct?: number        // % held in cash
hardRebalanceThreshold?: number // override threshold when DCA mode on

// Trend filter fields
trendFilterEnabled?: boolean
trendFilterMA?: number         // MA period (default 100)
bearCashPct?: number           // cash % in bear market
```

### Step 2: Add cash tracking to simulator

In `backtest-simulator.ts`:

1. In `_initHoldings`: if `cashReservePct > 0`, reserve that % as `cashUsd` variable; allocate remaining to crypto
2. Track `cashUsd` as a running balance alongside holdings
3. Include `cashUsd` in equity curve calculations: `totalEquity = cryptoValue + cashUsd`

### Step 3: Implement DCA injection in candle loop

After price update, before drift check:

1. Track `candlesSinceLastDca` counter
2. When counter reaches `dcaIntervalCandles`: inject `dcaAmountUsd`
3. If `dcaRebalanceEnabled`: find most underweight crypto asset, buy it
4. Else: distribute proportionally across all target assets
5. Record DCA trades in trade log with type indicator
6. Track `totalDcaInjected` for return calculation

### Step 4: Implement trend filter in backtest

1. Track rolling BTC close prices (same as TrendFilter.dailyCloses)
2. Compute SMA(trendFilterMA) per candle
3. If BTC price < MA: bear mode — use `bearCashPct` as rebalance target
4. If BTC price >= MA: bull mode — use normal allocations
5. This replaces the fixed threshold with regime-dependent behavior

### Step 5: Adjust return metrics for DCA

Update metrics calculation:
- `totalInvested = initialBalance + totalDcaInjected`
- `totalReturnPct = (finalValue - totalInvested) / totalInvested * 100`
- Add `totalDcaInjected` to BacktestMetrics or result object

### Step 6: Create comparison script

Create `scripts/run-dca-backtest-comparison.ts`:

Test matrix (4 allocations x 3-4 modes):

**Allocations:**
1. BTC40-ETH15-SOL12-BNB13-CASH20
2. BTC35-ETH15-SOL15-BNB15-CASH20
3. BTC45-ETH10-SOL15-BNB10-CASH20
4. BTC50-ETH10-SOL10-BNB10-CASH20

**Modes per allocation:**
1. Baseline: no cash reserve, traditional rebalance, no DCA
2. Cash+DCA: cash reserve + targeted DCA + hardRebalanceThreshold=15
3. Cash+DCA+TrendFilter: mode 2 + trendFilterEnabled + MA100 + bearCashPct=90
4. Cash only: cash reserve + proportional DCA

Config: $1K initial, $20/day DCA, 5yr (2021-01-01 to 2025-12-31), 1d timeframe, 0.1% fee.

Output: markdown table with Final Value, Return %, Sharpe, MaxDD, Trades, Fees.

### Step 7: Add backtest tests

Add test cases to `src/backtesting/backtest-simulator.test.ts`:
1. Backtest without DCA fields = identical to current behavior
2. DCA injection adds correct amount at interval
3. Cash reserve maintained throughout simulation
4. Targeted DCA buys most underweight asset

## Todo List

- [ ] Add DCA + trend filter fields to BacktestConfig in metrics-calculator.ts
- [ ] Add cash tracking (cashUsd variable) to backtest simulator
- [ ] Modify `_initHoldings` to respect cashReservePct
- [ ] Implement DCA injection in candle loop
- [ ] Implement `_dcaBuyMostUnderweight` helper method
- [ ] Implement `_dcaProportional` helper method
- [ ] Implement trend filter MA simulation in candle loop
- [ ] Adjust rebalance threshold for DCA mode
- [ ] Track totalDcaInjected and adjust return metrics
- [ ] Create scripts/run-dca-backtest-comparison.ts with test matrix
- [ ] Add backtest tests for DCA + cash reserve
- [ ] Verify baseline matches existing backtest results

## Success Criteria

- [ ] Backtest without new fields produces identical results (backward compat)
- [ ] DCA injection adds correct $ amount at configured intervals
- [ ] Targeted DCA buys only most underweight asset
- [ ] Cash reserve maintained throughout simulation
- [ ] Trend filter switches to bear cash allocation when BTC < MA
- [ ] Comparison script runs 16 scenarios and outputs markdown table
- [ ] Return calculations account for total invested (initial + DCA)
- [ ] All tests pass

## Risk Assessment

- **Backtest accuracy**: DCA uses end-of-candle prices, consistent with existing rebalance logic.
- **Performance**: 16 scenarios x 10,950 candles = moderate compute. Should complete <10 min.
- **Metric distortion**: DCA inflows inflate portfolio value. Using (finalValue - totalInvested) / totalInvested for return.
- **Trend filter in backtest vs production**: Backtest uses simplified SMA on close prices. Production uses TrendFilter class with DB persistence. Results may differ slightly due to intra-day price updates in production.
