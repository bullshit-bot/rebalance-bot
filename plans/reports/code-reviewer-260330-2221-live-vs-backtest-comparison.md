# Live vs Backtest Logic Comparison Report

**Date:** 2026-03-30
**Reviewer:** code-reviewer
**Scope:** 15 files across live system + backtest simulator

---

## Executive Summary

Found **5 Critical**, **3 High**, and **4 Medium** discrepancies. The most dangerous issues involve trade amount interpretation mismatch, missing execution guards in backtest, and trend filter buffer logic divergence. Backtest results are **moderately unreliable** as predictors of live performance due to these gaps.

---

## Comparison Table

| # | Logic Area | Live Behavior | Backtest Behavior | Match | Impact |
|---|-----------|---------------|-------------------|-------|--------|
| 1 | **Trade amount units** | `calculateTrades()` returns `baseQty` (asset units): `absDeltaUsd / price` (line 162) | `_simulateRebalance()` treats `order.amount` as USD (line 475): `costUsd = order.amount`, then `assetAmount = costUsd / price` — **double-divides by price** | **MISMATCH** | **CRITICAL** |
| 2 | **Trend filter buffer** | `isBullish()` uses `bufferPct`: bull if `price >= MA * (1 - buffer/100)` (line 143) | `_buildTimeline` trend check: `nowBear = btcCurrentPrice < ma` (line 139) — **no buffer applied** | **MISMATCH** | **CRITICAL** |
| 3 | **MAX_TRADE_USD guard** | `ExecutionGuard.canExecute()` rejects trades > `MAX_TRADE_USD` | Backtest has **no MAX_TRADE_USD check** — unlimited trade sizes | **MISSING** | **CRITICAL** |
| 4 | **Daily loss limit** | `ExecutionGuard` tracks cumulative daily fees, blocks trading when `DAILY_LOSS_LIMIT_PCT` breached | Backtest has **no daily loss circuit breaker** | **MISSING** | **CRITICAL** |
| 5 | **DCA fee deduction** | `_dcaInjectBullMode()` does **not deduct fees** on DCA buys (line 549: `amount += dcaAmountUsd / price`) | Live DCA goes through executor which charges exchange fees | **MISMATCH** | **CRITICAL** |
| 6 | **Trend filter cooldown units** | Live uses `cooldownDays` (calendar days): `elapsed = (Date.now() - lastFlip) / 86400000` (trend-filter.ts:114) | Backtest uses `cooldownCandles`: decrements counter per candle (line 141). On 1h timeframe, 3 cooldown candles = 3 hours vs 3 days | **MISMATCH** | **HIGH** |
| 7 | **DCA routing logic** | Live `calculateDCAAllocation()` checks crypto value vs configDcaAmount, falls back to proportional mode when small, uses `getDCATarget()` for single-target | Backtest `_dcaInjectBullMode()` always picks most underweight by USD drift — no proportional fallback, no minimum crypto check | **MISMATCH** | **HIGH** |
| 8 | **Cash reserve in rebalance** | `calculateTrades()` accepts `cashReservePct` param and computes `cryptoPoolUsd = totalUsd - targetCashUsd` | `_simulateRebalance()` calls `calculateTrades(portfolio, effectiveAllocations, prices)` — **never passes cashReservePct** (line 467) | **MISMATCH** | **HIGH** |
| 9 | **Slippage modeling** | Live uses market orders; real slippage occurs (order book depth, spread) | Backtest executes at exact candle close price; **no slippage model** | **MISSING** | **MEDIUM** |
| 10 | **Rebalance cooldown** | `DriftDetector.canRebalance()` enforces `REBALANCE_COOLDOWN_HOURS` between rebalances | Backtest checks drift every candle with **no cooldown** between rebalances | **MISSING** | **MEDIUM** |
| 11 | **MIN_TRADE_USD** | `calculateTrades()` filters deltas < `env.MIN_TRADE_USD` (line 90) | Backtest passes through `calculateTrades()` which uses `env.MIN_TRADE_USD` at runtime — but env may differ from backtest config's `minTradeUsd` param | **PARTIAL** | **MEDIUM** |
| 12 | **Price source** | Live: real-time polling via `priceCache.getBestPrice()`, may have stale prices, gaps | Backtest: historical candle close prices, perfect data, no gaps within timeline | **EXPECTED** | **MEDIUM** |
| 13 | **Drift threshold (>= vs >)** | `DriftDetector` uses `Math.abs(a.driftPct) > threshold` (strict gt, line 155) | Backtest `_needsRebalance` uses `drift >= threshold` (gte, line 418); `_exceedsThreshold` also uses `>=` (line 175) | **MISMATCH** | **LOW** |
| 14 | **Fee calculation** | Both use `feePct` multiplied by trade value | Match | **OK** | N/A |
| 15 | **Stablecoin exclusion** | Both exclude STABLECOINS set from crypto % calculations | Match | **OK** | N/A |
| 16 | **Strategy implementations** | Live uses singleton instances (MeanReversion, VolAdjusted, MomentumWeighted) | Backtest creates isolated instances via `StrategyBacktestAdapter` — **correct isolation** | **OK** | N/A |
| 17 | **Equal-weight** | `toEqualWeight()`: `100 / allocations.length` per asset | `_equalWeightAllocations()`: same formula | **OK** | N/A |

---

## Critical Issues Detail

### 1. Trade Amount Double-Division (CRITICAL)

**The most dangerous bug.** `calculateTrades()` returns `amount` in base asset units (`deltaUsd / price`). But `_simulateRebalance()` (line 475) treats `order.amount` as USD:

```typescript
// backtest-simulator.ts:475-476
const costUsd = order.amount    // WRONG: order.amount is already in base units
const assetAmount = costUsd / price  // double-divides by price
```

**Impact:** For BTC at $60k, a $600 rebalance trade would produce `order.amount = 0.01 BTC`. Backtest interprets this as `costUsd = 0.01`, then `assetAmount = 0.01/60000 = 0.000000167 BTC`. Trades are ~3,600,000x too small. Rebalancing is effectively **non-functional** in backtest. Returns shown are almost entirely buy-and-hold, not rebalancing alpha.

**Fix:** `const costUsd = order.amount * price`

### 2. Trend Filter Missing Buffer (CRITICAL)

Live uses a configurable buffer (default 2%) to prevent whipsaw: price must drop 2% below MA to trigger bear. Backtest uses raw `price < MA` with no buffer, causing more frequent bear triggers and earlier exits.

**Impact:** Backtest overestimates trend filter value by triggering defensive mode too aggressively.

### 3-4. Missing Execution Guards (CRITICAL)

Backtest has no MAX_TRADE_USD or daily loss limit. Live system caps individual trades and halts after cumulative losses. Backtest can execute arbitrarily large trades and trade through drawdowns.

**Impact:** Backtest may show results achievable only without the safety guards that live system enforces.

### 5. DCA Fee-Free in Backtest (CRITICAL)

`_dcaInjectBullMode()` adds `dcaAmountUsd / price` directly with no fee deduction. Over hundreds of DCA events, this compounds to a material overstatement of returns.

---

## High Priority Issues Detail

### 6. Cooldown Unit Mismatch

On 1h timeframe: backtest `trendFilterCooldownCandles=3` = 3 hours. Live `cooldownDays=3` = 3 calendar days. This means backtest allows 24x more frequent trend flips on hourly data, dramatically changing bear/bull transition behavior.

### 7. DCA Routing Divergence

Live has sophisticated routing: proportional mode for small portfolios, single-target for established ones, bear-mode cash holdback. Backtest always picks single most-underweight asset with no size-based fallback.

### 8. Cash Reserve Not Passed to calculateTrades

When backtest calls `calculateTrades()`, it never passes `cashReservePct`. This means all target calculations use `cryptoPoolUsd = totalUsd` instead of `totalUsd * (1 - cashReservePct/100)`. Cash reserve strategy results are unreliable.

---

## Positive Observations

- Strategy implementations (mean-reversion, vol-adjusted, momentum-weighted) use the **same class code** in both live and backtest — good reuse via `StrategyBacktestAdapter`
- Backtest correctly creates **isolated strategy instances** per run to prevent state pollution
- Fee structure is consistent (percentage-based)
- Stablecoin handling is shared via the same `STABLECOINS` set
- `calculateTrades()` is shared between live and backtest — the core trade math is the same (but the output is misinterpreted)

---

## Recommended Fix Priority

1. **Fix trade amount interpretation** in `_simulateRebalance()` — multiply by price, not treat as USD. This alone invalidates all existing backtest results.
2. **Add trend filter buffer** to backtest bear detection logic
3. **Pass cashReservePct** to `calculateTrades()` in `_simulateRebalance()`
4. **Add fee deduction** to `_dcaInjectBullMode()`
5. **Normalize cooldown units** — convert cooldownCandles to match the timeframe (e.g., `cooldownCandles = cooldownDays * 24` for 1h)
6. **Add MAX_TRADE_USD cap** to backtest (optional but recommended for realistic simulation)
7. **Add rebalance cooldown** to backtest loop
8. **Mirror DCA routing logic** (proportional fallback for small portfolios)

---

## Unresolved Questions

1. Has anyone validated backtest results against actual live trading outcomes? The trade amount bug (#1) means all historical backtest results are essentially buy-and-hold with negligible rebalancing.
2. Should backtest model slippage? For small portfolios ($1k-$10k) on major pairs, slippage is likely <0.1%, but for optimization comparison it may matter.
3. The `>` vs `>=` threshold comparison (#13) — which is the intended behavior? They should be consistent.

---

**Status:** DONE
**Summary:** Found 5 critical discrepancies between live and backtest logic. The trade amount double-division bug (#1) is the most severe — it effectively disables rebalancing in backtest, making all results unreliable. Trend filter buffer omission and missing cash reserve passthrough further degrade backtest fidelity.
**Concerns:** All existing backtest results (including the 4800-combo grid search) should be considered invalidated pending fix of issue #1.
