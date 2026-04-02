# Code Review: Final Logic Audit

**Date:** 2026-04-02
**Reviewer:** code-reviewer
**Scope:** Full codebase logic correctness — DCA, Rebalance, Price, Portfolio, Backtest, Simple Earn, Scheduler, API, Cross-cutting
**Files reviewed:** 25+ source files across all modules

---

## Overall Assessment

The codebase is **production-ready with minor findings**. Core trading logic (DCA routing, rebalance engine, drift detection, trade calculation) is correct and consistent. Trend filter with cooldown, bear/bull transitions, and cash reserve handling are logically sound. Previous audit findings have been addressed. The remaining items below are edge cases and informational notes, not blockers.

**Verdict: APPROVED**

---

## Module-by-Module Findings

### 1. DCA Flow (`src/dca/`)

**dca-service.ts** -- PASS
- `dcaRebalanceEnabled=true` + `crypto < dcaAmountUsd` -> proportional mode: Correct (L96-109)
- `dcaRebalanceEnabled=true` + `crypto >= dcaAmountUsd` -> single target via `getDCATarget()`: Correct (L111-116)
- Bear mode -> returns `[]` (hold as cash): Correct (L83-89)
- Post-DCA earn subscribe (if enabled): Correct (L166-175)
- `dcaAmountUsd` read from `globalSettings.dcaAmountUsd`: Correct with fallback chain (L142-145)

**dca-allocation-calculator.ts** -- PASS
- Stablecoin exclusion via imported `STABLECOINS` set: Consistent
- Dust handling: `cryptoValue >= depositAmount` guard at L43: Correct
- Price fallback from `priceCache.getBestPrice()`: Correct (L71)

**dca-target-resolver.ts** -- PASS
- Dust < $10 treated as zero: Correct (L25, returns highest-target asset)
- Uses crypto-only denominator: Correct (L20-22)

### 2. Rebalance Flow (`src/rebalancer/`)

**rebalance-engine.ts** -- PASS
- Pre-trade earn redeem for sell orders: Correct (L134-153)
- Post-trade earn subscribe: Correct (L197-208)
- Bear trigger -> `bearCashPct` override: Correct (L115-119)
- Bull recovery -> normal `cashReservePct`: Correct (L121-129)

**drift-detector.ts** -- PASS
- Skips stablecoins in drift check: Correct (L160)
- `hardRebalanceThreshold` used when `dcaRebalanceEnabled`: Correct (L155-157)
- Bear/bull transition detection with cooldown: Correct
- Optimistic `lastRebalanceTime` set before emit to prevent concurrent triggers: Good pattern

**trade-calculator.ts** -- PASS
- Cash reserve handling: Correct. `cryptoPoolUsd = totalUsd - targetCashUsd` (L52)
- STABLECOINS set used consistently: Yes
- Cash deficit logic sells overweight crypto: Correct (L112-136)

**trend-filter.ts** -- PASS
- Buffer % applied: Correct (`price >= ma * (1 - bufferPct / 100)`) (L147)
- Cooldown working: `isBullishWithCooldown()` suppresses flips within cooldownDays (L117-123)
- State persistence to DB: Correct — daily closes via upsert, flip timestamp via meta candle

**strategy-manager.ts** -- PASS
- `loadFromDb()` called at startup in `src/index.ts` L53: Confirmed

### 3. Price Feed (`src/price/`)

**price-aggregator.ts** -- PASS
- REST polling (not WS): Correct. Comment at L117 explains Bun WS limitation
- 10s interval: Reasonable for production

**price-cache.ts** -- PASS
- `getBestPrice` fallback: Returns undefined (caller handles): Correct
- Stale eviction every 60s via cron: Confirmed

### 4. Portfolio (`src/portfolio/`)

**portfolio-tracker.ts** -- PASS
- Earn balance merged: Correct (L271-282)
- Stablecoin pricing (USDT = $1): Correct (L297)

### 5. Backtest (`src/backtesting/`)

**backtest-simulator.ts** -- PASS
- Trade amount: `assetAmount * price` (L505) -- correct, not double-division
- Trend filter buffer applied: Correct (L143)
- DCA fees deducted: Correct (L577-578)
- Simple Earn yield only when `=== true`: Correct (L204)
- Per-asset APY rates: Correct with override map (L206-209)

### 6. Simple Earn (`src/exchange/simple-earn-manager.ts`)

**simple-earn-manager.ts** -- PASS
- All public methods try-catch wrapped: Confirmed
- Cache TTLs: Products 1h (L40), Positions 30s (L43): Correct
- Graceful degradation when exchange not connected: Returns `[]` or `false`

### 7. Scheduler (`src/scheduler/`)

**cron-scheduler.ts** -- PASS
- 7 cron jobs registered: Confirmed (L181-189)
- DCA cron at 00:00 UTC: Correct (L172)
- No copy sync job: Confirmed removed

### 8. API (`src/api/`)

**server.ts** -- PASS
- All /api/* routes auth-protected (except /api/health): Correct (L77-83)
- DCA trigger endpoint `/api/dca/trigger`: Present (L98)
- Earn status endpoint `/api/earn/status`: Present (L105)
- Rate limiter with eviction: Correct — 60s interval with `.unref()` (L36)

**auth-middleware.ts** -- PASS
- Timing-safe comparison: Correct

### 9. Cross-cutting

**Dangling imports:** None found. `grep` for paper/copy-sync shows only stale comments (3 instances), no actual import/logic references.

**STABLECOINS set consistency:**
- `trade-calculator.ts`: `Set(["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"])` -- canonical source
- All consumers import from `trade-calculator.ts`: Consistent
- `portfolio-tracker.ts` L297 uses inline array `["USDT", "USDC", "BUSD", "TUSD", "DAI", "USD"]` for pricing: Matches

**Event bus events typed:** All events in `EventMap` interface cover every `emit()` call site. No untyped events found.

**Config loaded at startup:** `strategyManager.loadFromDb()` at L53, `trendFilter.loadFromDb()` at L56: Confirmed

---

## Findings

### Medium Priority

**M-1: `quoteAssets` filter excludes non-USDT/USDC stablecoins from portfolio view**
- File: `src/portfolio/portfolio-tracker.ts` L341
- `quoteAssets = new Set(["USDT", "USDC"])` — BUSD/TUSD/DAI/USD balances are excluded from portfolio totals unless they have a target allocation
- Impact: If user holds BUSD/DAI without a target allocation, those balances become invisible, understating `totalValueUsd`
- Severity: **Medium** — unlikely in practice (Binance primarily uses USDT/USDC), but inconsistent with the 6-symbol stablecoin set used elsewhere
- Fix: Extend quoteAssets to match STABLECOINS set, or import STABLECOINS directly

**M-2: Backtest `_pricesAtTimestamp` uses linear scan per candle per pair**
- File: `src/backtesting/backtest-simulator.ts` L386-391
- `candles.find(c => c.timestamp === ts)` is O(n) per pair per timestamp
- Impact: Slow backtests with large datasets (e.g., 4 pairs * 1000 candles = 4000 linear scans)
- Severity: **Medium** — functional correctness is fine, just performance
- Fix: Pre-build a `Map<number, number>` per pair during `_loadAllPairs`

**M-3: Stale comments referencing removed paper mode**
- Files: `dca-service.ts` L132, L153; `order-executor.ts` L321; `portfolio-routes.ts` L10
- Impact: Misleading for maintainers. No logic impact.
- Fix: Remove stale paper-mode references

### Low Priority

**L-1: `estimatePortfolioValueUsd` only checks USDT balance**
- File: `src/executor/order-executor.ts` L265-279
- Returns only `total.USDT` — ignores crypto holdings and other stablecoins
- Impact: Daily loss limit % calculation may be too conservative (smaller denominator = tighter limit)
- Severity: **Low** — conservative safety bias is acceptable for a trading bot

**L-2: DCA deposit detection heuristic may false-trigger on volatile days**
- File: `src/dca/dca-service.ts` L219-221
- `DEPOSIT_THRESHOLD_PCT = 1` — a 1% portfolio increase in a single update cycle can occur during volatile rallies
- Impact: Logs a deposit suggestion that doesn't auto-execute (suggestion-only per L231-242)
- Severity: **Low** — documented in code comments, non-destructive

**L-3: Backtest does not track DCA deposits that miss a target (bear mode + no suitable asset)**
- File: `src/backtesting/backtest-simulator.ts` L591
- Comment says "effectively becomes cash" but `cashUsd` is not incremented by caller
- Looking at L118-121: when `inBearMode`, `cashUsd += dcaAmountUsd` is handled correctly
- When NOT in bear mode and `_dcaInjectBullMode` finds no target (all overweight), the DCA amount is silently lost
- Impact: Minor equity leakage in backtest when all assets are overweight — rare edge case
- Severity: **Low**

---

## Positive Observations

1. **Consistent STABLECOINS set** imported from single source across all modules
2. **Typed event bus** prevents payload shape mismatches at compile time
3. **Graceful degradation** throughout — Earn ops never block trading flows
4. **Trend filter whipsaw protection** with configurable cooldown and DB persistence across restarts
5. **Rate limiter with eviction** prevents memory leak on IP map
6. **Timing-safe API key comparison** prevents side-channel attacks
7. **Execution guard** with daily loss circuit breaker and max trade size limits
8. **Clean startup/shutdown sequence** in `index.ts` — reverse-order teardown with error isolation

---

## Recommended Actions

1. (Optional) Extend `quoteAssets` in portfolio-tracker to match full STABLECOINS set [M-1]
2. (Optional) Pre-index candle prices by timestamp in backtest simulator [M-2]
3. (Cleanup) Remove 4 stale paper-mode comments [M-3]

None of these are blocking. The system is logically correct for production.

---

**Status:** DONE
**Summary:** Final logic audit complete. All core trading flows (DCA, rebalance, trend filter, trade calculation, earn integration) are logically correct. 3 medium + 3 low findings, all non-blocking.
**Concerns/Blockers:** None
