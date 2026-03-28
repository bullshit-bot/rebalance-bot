# Code Review: Production Readiness Changes

**Date:** 2026-03-28
**Reviewer:** code-reviewer
**Commit:** 58842e3 (feat: MA100 trend-following filter for bear market protection)

---

## Scope

- **Files reviewed:** 11 (types, trend-filter, rebalance-engine, index.ts, event-bus, telegram-notifier, exchange-manager, portfolio-tracker, health-routes, docker-compose.yml, drift-detector, trade-calculator)
- **LOC changed:** ~250
- **Focus:** Bear rebalance flow correctness, DB persistence safety, event emission timing, circular deps, security

---

## Overall Assessment

Solid production-hardening pass. The bear market protection flow is logically correct end-to-end. Several medium-severity issues found, one high-priority bug in the health endpoint, and one critical concern in the Telegram notifier's `stop()` method.

---

## Critical Issues

### 1. `TelegramNotifier.stop()` removes ALL listeners for shared event types

**File:** `src/notifier/telegram-notifier.ts:103-110`

`eventBus.removeAllListeners('trade:executed')` nukes every subscriber for that event, not just the notifier's listener. The WebSocket handler (`ws-handler.ts:97`) also subscribes to `trade:executed` and `rebalance:completed`. If `stop()` is ever called (graceful shutdown, reconnect), WS clients lose real-time updates silently.

**Impact:** Any module subscribing to those events loses its listener.

**Fix:** Store listener references and use `eventBus.off(event, listener)` instead of `removeAllListeners()`:
```ts
private listeners: Array<{ event: string; fn: Function }> = []

start() {
  const onTrade = (trade) => void this.send(...)
  eventBus.on('trade:executed', onTrade)
  this.listeners.push({ event: 'trade:executed', fn: onTrade })
  // ...
}

stop() {
  for (const { event, fn } of this.listeners) {
    eventBus.off(event, fn)
  }
  this.listeners = []
}
```

---

## High Priority

### 2. Health endpoint calls `isBullish()` which emits `trend:changed` events as side effect

**File:** `src/api/routes/health-routes.ts:33`

Every `GET /api/health` call invokes `trendFilter.isBullish()`, which on line 91-93 of `trend-filter.ts` emits `trend:changed` if state differs from `lastBullish`. If autoheal or monitoring polls `/health` frequently, and the BTC price oscillates around the MA, this could:
- Trigger spurious trend flip notifications via Telegram
- Potentially trigger bear rebalances (if `isBullish` is called before drift-detector's own call updates `lastBullish`)

**Impact:** False trend-change Telegram alerts; potential double-rebalance triggers in edge cases.

**Fix:** Add a read-only query method that doesn't emit events:
```ts
/** Read-only: returns last computed bull/bear state without emitting events. */
getLastBullish(maPeriod = 100, bufferPct = 2): boolean {
  const ma = this.sma(maPeriod)
  if (ma === null) return true
  const currentPrice = this.dailyCloses[this.dailyCloses.length - 1] ?? 0
  return currentPrice >= ma * (1 - bufferPct / 100)
}
```

Use `getLastBullish()` in health-routes and telegram startup instead of `isBullish()`.

### 3. Startup `isBullish()` call in Telegram notifier has same side-effect problem

**File:** `src/notifier/telegram-notifier.ts:91`

```ts
const trend = trendFilter.isBullish() ? 'BULL' : 'BEAR'
```

Called during `start()` -- uses default params (100, 2) instead of the strategy config's `trendFilterMA` and `trendFilterBuffer`. Also modifies `lastBullish` state with potentially wrong parameters.

**Fix:** Use the read-only method proposed above, or at minimum pass the correct MA/buffer params from strategy config.

---

## Medium Priority

### 4. Fire-and-forget DB write in `recordPrice()` can silently lose data

**File:** `src/rebalancer/trend-filter.ts:66-72`

The `.catch()` logs the error but in-memory state has already advanced. If MongoDB is briefly unavailable (network blip), the day's candle is lost from DB but exists in memory. On restart, `loadFromDb()` would have a gap.

**Impact:** After restart, MA calculation may jump if a day's data was never persisted.

**Mitigation (acceptable trade-off):** This is a known fire-and-forget pattern. The impact is minor -- a single missing data point in 100+ won't meaningfully shift the MA. However, consider adding a retry queue or at minimum a metric/counter for failed persists so operators can monitor.

### 5. `recordPrice()` updates today's close on every price tick but never persists the update

**File:** `src/rebalancer/trend-filter.ts:55-57`

When `today === lastRecordedDay`, the in-memory close is updated to the latest price, but no DB write occurs. The DB entry still has the first price of the day. On restart mid-day, the MA uses the opening price instead of the latest.

**Impact:** Minor inaccuracy after intra-day restart. The MA-100 is a slow indicator so the difference is negligible in practice.

**Optional fix:** Persist the close update periodically (e.g., every hour) or on graceful shutdown.

### 6. `bearCashPct` fallback hardcoded to 70 in two places

**File:** `src/rebalancer/rebalance-engine.ts:109` and `src/rebalancer/drift-detector.ts:100`

Both default to 70% but this magic number isn't centralized. If one changes, the other may not.

**Fix:** Extract to a shared constant:
```ts
export const DEFAULT_BEAR_CASH_PCT = 70
```

### 7. No `trend-filter-bear` trigger in RebalanceModel enum/validation

The DB stores `triggerType: trigger` as a string. If MongoDB has schema validation or if the frontend has an enum for display, `'trend-filter-bear'` may not be recognized. Verify the DB model and frontend handle this new trigger type.

### 8. Docker autoheal has full Docker socket access

**File:** `docker-compose.yml:155`

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

This grants container-escape-level privileges. The autoheal container can control all containers on the host.

**Mitigation:** This is standard for autoheal and acceptable if the host is a dedicated bot server. For shared infrastructure, consider using Docker's `--read-only` rootfs or a socket proxy like `tecnativa/docker-socket-proxy`.

---

## Low Priority

### 9. `dailyCloses.shift()` is O(n) on the 400-element array

**File:** `src/rebalancer/trend-filter.ts:62`

Called once per day -- completely negligible performance impact. Noted for completeness.

### 10. `MONGO_PASSWORD` exposed via docker-compose env interpolation

**File:** `docker-compose.yml:42,75`

The password is sourced from `.env` via `${MONGO_PASSWORD}`. This is fine for self-hosted deployments but ensure `.env` is in `.gitignore` and `.dockerignore`.

---

## Edge Cases Found by Scouting

1. **Race: drift-detector and health-route both call `isBullish()`** -- if health poll arrives between drift-detector checks, `lastBullish` gets set by health route with potentially different params, causing drift-detector's next call to miss or falsely detect a flip.

2. **Bear rebalance with no trades:** If all crypto is already sold (100% stablecoins) but `cashPct < bearCashPct` due to rounding, the engine creates a rebalance record with 0 trades. Not harmful but creates noise in rebalance history.

3. **Cold start with empty DB + trend filter enabled:** `isBullish()` returns `true` (safe default), so bear protection is inactive until 100 daily closes accumulate (~3.3 months). This is documented and intentional.

4. **`telegram-notifier.stop()` called during shutdown removes WS handler listeners** -- see Critical Issue #1.

---

## Positive Observations

- Type-safe event bus with `EventMap` -- excellent pattern, prevents payload mismatches at compile time
- `lastBullish: null` guards against false trend flip on startup -- good edge case handling
- 30s timeout on `loadMarkets()` prevents hanging -- proper production hardening
- WebSocket to REST fallback in portfolio-tracker -- resilient to exchange WS outages
- Autoheal container with resource limits -- production-ready Docker config
- `upsert: true` on candle persist -- idempotent, handles duplicate day entries cleanly

---

## Recommended Actions (Priority Order)

1. **[Critical]** Replace `removeAllListeners()` in `telegram-notifier.stop()` with specific `off()` calls
2. **[High]** Add a read-only `getLastBullish()` to `TrendFilter`; use it in health-routes and telegram startup
3. **[Medium]** Extract `DEFAULT_BEAR_CASH_PCT = 70` to shared constant
4. **[Medium]** Verify frontend handles `'trend-filter-bear'` trigger display
5. **[Low]** Consider persisting intra-day close updates on shutdown

---

## Metrics

- **Type Coverage:** Good -- `RebalanceTrigger` union properly extended, `EventMap` covers `trend:changed`
- **Test Coverage:** Not assessed (no new tests in this diff for bear rebalance flow -- recommend adding)
- **Linting Issues:** Not run (read-only review)

---

## Unresolved Questions

1. Is there a bull-to-bear recovery flow? When trend flips back to bull, does the engine rebalance back to normal allocations, or does it wait for normal drift threshold? Currently it just stops emitting `trend-filter-bear` and resumes normal drift checking -- which seems correct but should be verified with product requirements.
2. Should `trend:changed` events be persisted to DB for audit trail? Currently only emitted transiently.
3. Are there integration tests for the full bear trigger path (drift-detector -> rebalance-engine -> trade-calculator with cashReservePct)?
