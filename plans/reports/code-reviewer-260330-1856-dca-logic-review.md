# DCA Allocation Logic Review

**Date:** 2026-03-30
**Reviewer:** code-reviewer
**Scope:** DCA allocation calculator, target resolver, DCA service, API trigger, strategy config types

## Overall Assessment

The DCA logic is **well-structured and mostly correct**. The crypto-only percentage calculation is applied consistently across all three computation sites. The trend filter guard, proportional split, and single-target routing all follow sound logic. However, there are several issues ranging from a **critical routing bug** to medium-severity inconsistencies and missing input validation.

---

## Critical Issues

### 1. BUG: `dcaRebalanceEnabled=true` + portfolio balanced = silent fallthrough to proportional mode

**File:** `src/dca/dca-service.ts` lines 89-100

When `dcaRebalanceEnabled=true`, `strategyManager.getDCATarget()` returns `null` if all assets are at/above target (fully balanced). The code then **falls through to proportional mode** (`calcProportionalDCA`), which is also likely to return `[]` since nothing is underweight -- but the _intent_ is different.

The real problem occurs in edge cases where `getDCATarget` returns `null` (balanced) but `calcProportionalDCA` still finds tiny deficits due to floating-point precision differences between the two functions' drift calculations. In that scenario, DCA rebalance mode unexpectedly scatters the deposit proportionally instead of holding as cash or buying the highest-target asset.

**Impact:** When `dcaRebalanceEnabled=true` and portfolio is nearly balanced, user expects "concentrate on one asset" behavior but may get proportional spread.

**Fix:** When `dcaRebalanceEnabled=true` and `dcaTarget === null`, return `[]` directly instead of falling through:

```typescript
const dcaRebalanceEnabled = gs?.dcaRebalanceEnabled ?? false
if (dcaRebalanceEnabled) {
  const dcaTarget = getDCATarget(portfolio, targets)
  if (dcaTarget !== null) {
    return calcSingleTargetDCA(dcaTarget, depositAmount, portfolio, targets, minTradeUsd)
  }
  console.log('[DCAService] dcaRebalance enabled but portfolio balanced — no DCA orders')
  return []
}
// Default: proportional allocation
return calcProportionalDCA(depositAmount, portfolio, targets, minTradeUsd)
```

---

## High Priority

### 2. Inconsistent stablecoin exclusion lists across the codebase

Three different stablecoin lists exist:

| Location | Stablecoins |
|---|---|
| `dca-allocation-calculator.ts` | USDT, USDC, BUSD |
| `dca-target-resolver.ts` | USDT, USDC, BUSD |
| `trade-calculator.ts` | USDT, USDC, BUSD |
| `drift-detector.ts` | USDT, USDC, BUSD, **TUSD, DAI, USD** |

If a user holds TUSD or DAI, the DCA modules will count it as crypto value, inflating the denominator and making all assets appear underweight. The drift detector correctly treats it as cash.

**Fix:** Extract a shared `STABLECOINS` constant (or utility function) used everywhere:

```typescript
// src/constants/stablecoins.ts
export const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD'])
export const isStablecoin = (asset: string): boolean => STABLECOINS.has(asset)
```

### 3. `POST /api/dca/trigger` ignores request body -- no way to specify custom amount

**File:** `src/api/server.ts` line 95-98

The endpoint calls `executeScheduledDCA()` with no arguments, ignoring any `amountUsd` the caller might send in the request body. The `executeScheduledDCA` method accepts an optional `amountUsd` parameter but the route never passes it.

**Impact:** API consumers (GoClaw cron, manual triggers) cannot override the DCA amount per-call. They always get the config default or fallback.

**Fix:**
```typescript
app.post('/api/dca/trigger', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const amountUsd = typeof body.amountUsd === 'number' && body.amountUsd > 0
    ? body.amountUsd
    : undefined
  const orders = await dcaService.executeScheduledDCA(amountUsd)
  return c.json({ triggered: true, orders: orders.length, details: orders })
})
```

### 4. `POST /api/dca/trigger` leaks full trade order details including amounts

**File:** `src/api/server.ts` line 97

The response includes `details: orders` which exposes exact trade amounts, pairs, and exchange names. For a production trading bot, this is sensitive operational data.

**Fix:** Return order count + pairs only, or gate detailed output behind an admin flag.

---

## Medium Priority

### 5. No validation on `dcaAmountUsd` at runtime in `executeScheduledDCA`

**File:** `src/dca/dca-service.ts` line 116-117

The config value is cast via `as number | undefined` without validating it's positive or within schema bounds (1-100000). A misconfigured `dcaAmountUsd: 0` or negative value would silently produce no orders or negative-amount orders.

**Fix:** Clamp and validate after extraction:
```typescript
const rawAmount = amountUsd ?? configAmount ?? FALLBACK_DCA_AMOUNT
const amount = Math.max(1, rawAmount)
```

### 6. `getDCATarget` returns highest-target asset when cryptoValue=0, but doesn't account for price availability

**File:** `src/rebalancer/dca-target-resolver.ts` lines 27-37

When portfolio is 100% USDT (no crypto), `getDCATarget` picks the highest-target asset (BTC at 40%). But if the price cache has no price for BTC (e.g., on cold start before any ticker poll), `calcSingleTargetDCA` will skip it and return `[]`. The user loses a DCA cycle.

A better approach: when cryptoValue=0, iterate allocations by descending targetPct and return the first asset that has a price available.

### 7. Deposit detection may trigger DCA on price-only increases

**File:** `src/dca/dca-service.ts` lines 153-198

`DEPOSIT_THRESHOLD_PCT = 1` means a 1% portfolio value increase triggers deposit detection. In crypto, 1% price moves happen frequently. The code comments acknowledge this ("suggestion-only signal") but the `onPortfolioUpdate` handler directly calls `calculateDCAAllocation` and logs orders. If the system is later changed to auto-execute on deposit detection, this would cause spurious buys.

**Recommendation:** Consider a higher threshold (3-5%) or cross-check against USDT balance increase specifically.

### 8. Missing error handling in `executeScheduledDCA` -- partial execution not reported

**File:** `src/dca/dca-service.ts` lines 126-131

If `executor.executeBatch(orders)` throws, the error is caught and logged, but the function still returns the _intended_ orders (not the executed ones). Callers (including the API endpoint) will see `orders.length > 0` and assume success.

**Fix:** Return empty array on execution failure, or return a result object with success/failure status.

---

## Low Priority

### 9. Repeated price derivation logic

Both `calcProportionalDCA` (lines 64-69) and `calcSingleTargetDCA` (lines 105-111) have identical price resolution code: check portfolio asset, fallback to price cache. This should be extracted into a shared helper.

### 10. `trendFilter.isBullish` vs `isBullishWithCooldown` inconsistency

`dca-service.ts` uses `trendFilter.isBullish()` (no cooldown), while `drift-detector.ts` uses `isBullishWithCooldown()`. This means DCA can buy crypto while the drift detector still considers the market bearish (within cooldown window), creating contradictory behavior.

**Recommendation:** Use `isBullishWithCooldown` in DCA service too for consistency.

---

## Positive Observations

- Crypto-only % calculation is correctly applied in all three computation sites (calculator, resolver, trade-calculator)
- Zero-crypto edge case is properly handled in `getDCATarget` (picks highest target)
- Price fallback to `priceCache.getBestPrice` covers the cold-portfolio scenario
- Trend filter bear guard correctly prevents DCA buys in downtrends
- Clean separation: resolver picks target, calculator computes orders, service orchestrates
- `calcSingleTargetDCA` correctly validates `depositAmount < minTradeUsd` before proceeding
- Zod schema for `dcaAmountUsd` has proper min/max bounds (1-100000)

---

## Summary of Findings

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | **Critical** | Fallthrough from rebalance mode to proportional mode | dca-service.ts |
| 2 | High | Inconsistent stablecoin lists | multiple |
| 3 | High | API trigger ignores request body amountUsd | server.ts |
| 4 | High | Trade details leaked in API response | server.ts |
| 5 | Medium | No runtime validation on dcaAmountUsd | dca-service.ts |
| 6 | Medium | No price check for cold-start target selection | dca-target-resolver.ts |
| 7 | Medium | 1% deposit threshold too sensitive for crypto | dca-service.ts |
| 8 | Medium | Execution failure returns intended orders, not actual | dca-service.ts |
| 9 | Low | Duplicated price resolution logic | dca-allocation-calculator.ts |
| 10 | Low | isBullish vs isBullishWithCooldown inconsistency | dca-service.ts |

---

## Unresolved Questions

1. Is the deposit auto-detection path (`onPortfolioUpdate`) actually used in production, or is all DCA now triggered via cron/API? If only cron, the deposit detection code is dead weight and its edge cases are moot.
2. Should the `POST /api/dca/trigger` endpoint support dry-run mode (return orders without executing)?
3. Are TUSD and DAI actually held in the portfolio, or is the drift-detector stablecoin list overly broad?

---

**Status:** DONE
**Summary:** DCA logic is structurally sound with correct crypto-only % math, but has a critical routing bug (rebalance mode fallthrough to proportional), inconsistent stablecoin lists, and missing API input validation. 10 issues identified: 1 critical, 3 high, 4 medium, 2 low.
