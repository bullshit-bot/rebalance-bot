---
status: pending
priority: P1
effort: 4h
depends_on: [phase-01, phase-02]
---

## Context Links

- [Backtest simulator](../../src/backtesting/backtest-simulator.ts)
- [Metrics calculator](../../src/backtesting/metrics-calculator.ts)
- [Run optimization script](../../scripts/run-optimization.ts)

## Overview

Extend backtest simulator to support cash reserve + DCA injection. Run comparative backtests across multiple allocations to find optimal config.

## Key Insights

- Current simulator has no DCA concept — starts with `initialBalance` and only rebalances. Need to inject periodic deposits.
- `BacktestConfig` needs new fields: `dcaAmountUsd`, `dcaIntervalCandles`, `cashReservePct`, `dcaRebalanceEnabled`, `hardRebalanceThreshold`
- Timeline is already chronological candle-by-candle. DCA injection = every N candles, add $X to holdings.
- Cash reserve in backtest: track a virtual USDT holding alongside crypto holdings.

## Requirements

**Functional:**
- BacktestConfig gains: `dcaAmountUsd`, `dcaIntervalCandles`, `cashReservePct`, `dcaRebalanceEnabled`, `hardRebalanceThreshold`
- Simulator injects DCA at configured interval
- DCA routing: if dcaRebalanceEnabled, buy most underweight; else proportional
- Cash reserve maintained as virtual USDT balance
- Traditional rebalance uses hardRebalanceThreshold when DCA mode on
- Run 4 allocation configs + baseline comparison

**Non-functional:**
- Backtest without DCA fields behaves identically to current (backward compat)
- Results persisted to MongoDB for comparison

## Architecture

```
Per-candle loop (existing + new):
  1. Update prices from candle close          [existing]
  2. DCA injection (if interval reached)      [NEW]
     a. If dcaRebalanceEnabled: buy most underweight asset
     b. Else: distribute proportionally
     c. Update cash balance
  3. Check cash reserve                       [NEW]
     a. If cash > target: excess available
     b. If cash < target: flag for rebalance
  4. Drift check + rebalance                  [existing, modified threshold]
  5. Record equity curve point                [existing]
```

## Related Code Files

**Modify:**
- `src/backtesting/metrics-calculator.ts` — Extend `BacktestConfig` with DCA fields
- `src/backtesting/backtest-simulator.ts` — DCA injection loop + cash reserve tracking
- `scripts/run-optimization.ts` — Run comparative backtests

## Implementation Steps

### Step 1: Extend BacktestConfig

In `src/backtesting/metrics-calculator.ts`, add optional fields to `BacktestConfig`:

```typescript
dcaAmountUsd?: number          // e.g., 20 (per injection)
dcaIntervalCandles?: number    // e.g., 1 (every candle = daily for 1d timeframe)
cashReservePct?: number        // e.g., 20
dcaRebalanceEnabled?: boolean  // targeted vs proportional DCA
hardRebalanceThreshold?: number // e.g., 15
```

### Step 2: Add USDT tracking to backtest simulator

In `backtest-simulator.ts`:

1. In `_initHoldings`: if `cashReservePct > 0`, allocate that % to a virtual `USDT/USDT` holding
2. Track cash balance separately: `let cashUsd = config.initialBalance * (cashReservePct / 100)`
3. Crypto holdings initialized with remaining balance

```typescript
private _initHoldings(config: BacktestConfig, prices: Record<string, number>) {
  const cashReservePct = config.cashReservePct ?? 0
  const cashUsd = (cashReservePct / 100) * config.initialBalance
  const cryptoBalance = config.initialBalance - cashUsd
  // ... allocate crypto from cryptoBalance
  // Track cashUsd separately or as holdings['USDT/USDT']
}
```

### Step 3: DCA injection in candle loop

After price update, before drift check:

```typescript
// DCA injection
if (config.dcaAmountUsd && config.dcaIntervalCandles) {
  candlesSinceLastDca++
  if (candlesSinceLastDca >= config.dcaIntervalCandles) {
    candlesSinceLastDca = 0
    totalDcaInjected += config.dcaAmountUsd

    if (config.dcaRebalanceEnabled) {
      // Buy most underweight asset
      this._dcaBuyMostUnderweight(holdings, config, prices, config.dcaAmountUsd, cashUsd)
    } else {
      // Proportional buy across all targets
      this._dcaProportional(holdings, config, prices, config.dcaAmountUsd)
    }
  }
}
```

### Step 4: Implement _dcaBuyMostUnderweight

```typescript
private _dcaBuyMostUnderweight(
  holdings: Record<string, HoldingState>,
  config: BacktestConfig,
  prices: Record<string, number>,
  depositUsd: number,
  cashUsd: number,
): { cashUsd: number; trade: SimulatedTrade | null } {
  // 1. Compute total value including cash
  // 2. Find most underweight crypto asset
  // 3. If found: buy it with full deposit, deduct fee
  // 4. If not found: add deposit to cash reserve
}
```

### Step 5: Adjust rebalance threshold in backtest

When `dcaRebalanceEnabled`, use `hardRebalanceThreshold` instead of `config.threshold`:

```typescript
const effectiveThreshold = config.dcaRebalanceEnabled
  ? (config.hardRebalanceThreshold ?? 15)
  : config.threshold
```

### Step 6: Update metrics to track DCA

Add to BacktestMetrics or result:
- `totalDcaInjected`: total USD deposited via DCA
- `totalInvested`: initialBalance + totalDcaInjected
- Adjust return calculations: `totalReturnPct = (finalValue - totalInvested) / totalInvested * 100`

### Step 7: Run comparative backtests in run-optimization.ts

Define test matrix:

```typescript
const allocations = [
  { name: 'BTC40-ETH15-SOL12-BNB13-CASH20', allocs: [...], cashReservePct: 20 },
  { name: 'BTC35-ETH15-SOL15-BNB15-CASH20', allocs: [...], cashReservePct: 20 },
  { name: 'BTC45-ETH10-SOL15-BNB10-CASH20', allocs: [...], cashReservePct: 20 },
  { name: 'BTC50-ETH10-SOL10-BNB10-CASH20', allocs: [...], cashReservePct: 20 },
]

// For each allocation, run:
// 1. Baseline: no cash reserve, traditional rebalance, no DCA
// 2. Cash+DCA: cash reserve + DCA routing + hardRebalanceThreshold=15
// 3. Cash only: cash reserve + proportional DCA (no targeted routing)
```

Config: $1K initial, $20/day DCA, 5yr (2021-01-01 to 2025-12-31), 1d timeframe, 0.1% fee.

### Step 8: Output comparison table

Log results as markdown table:
```
| Allocation | Mode | Final Value | Return % | Sharpe | MaxDD | Trades | Fees |
```

## Todo List

- [ ] Add DCA fields to BacktestConfig in metrics-calculator.ts
- [ ] Add cash tracking (USDT balance) to backtest simulator
- [ ] Modify `_initHoldings` to respect cashReservePct
- [ ] Implement DCA injection in candle loop
- [ ] Implement `_dcaBuyMostUnderweight` method
- [ ] Implement `_dcaProportional` method
- [ ] Adjust rebalance threshold for DCA mode in simulator
- [ ] Track totalDcaInjected and adjust return metrics
- [ ] Update run-optimization.ts with test matrix (4 allocations x 3 modes)
- [ ] Output comparison table with all metrics
- [ ] Verify baseline matches existing backtest ($60.4K)

## Success Criteria

- [ ] Backtest without DCA fields produces identical results to current
- [ ] DCA injection adds correct $ amount at configured intervals
- [ ] Targeted DCA buys only most underweight asset in backtest
- [ ] Cash reserve maintained throughout simulation
- [ ] Comparison table shows all 12 scenarios (4 allocs x 3 modes)
- [ ] Return calculations account for total invested (initial + DCA)

## Risk Assessment

- **Backtest accuracy**: DCA injection timing affects results. Using end-of-candle prices for buys (consistent with existing rebalance logic).
- **Large simulation**: 12 scenarios x 10,950 candles = moderate compute. Should complete in <5 min.
- **Metric distortion**: DCA inflows inflate portfolio value. Must use TWR or adjust for deposits in return calculation.
