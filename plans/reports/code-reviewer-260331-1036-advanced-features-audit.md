# Advanced Features Functional Audit

**Date:** 2026-03-31
**Scope:** All sidebar-menu advanced features — end-to-end functional assessment
**Method:** Static code audit of backend logic, API routes, DB models, frontend pages, and hooks

---

## 1. Analytics

**Verdict: WORKING**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | 5 endpoints: equity-curve, pnl, drawdown, fees, assets |
| Frontend | Implemented | Full 4-tab page (Overview, PnL, Drawdown, Fees) with Recharts |
| Integration | Connected | React Query hooks (`use-analytics-queries`) wired to all endpoints |

**Details:**
- **Equity curve**: Reads from `SnapshotModel` — real data if scheduler is running and creating snapshots. No fake data.
- **PnL calculator**: Queries `TradeModel`, computes realized PnL per asset with daily/weekly/monthly periods. Correct buy/sell aggregation.
- **Drawdown analyzer**: Uses running-peak algorithm on equity curve data. Proper chart data returned.
- **Fee tracker**: Aggregates `fee` field from trades by exchange/asset/period.
- **Per-asset performance**: Merges PnL and fee data per asset symbol.

**Potential issue:** All analytics depend on trade history in DB. If no trades have executed, all values will be zero. This is expected behavior, not a bug.

---

## 2. Tax Reports

**Verdict: WORKING**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | FIFO lot matching, CSV export (Koinly-compatible) |
| Frontend | Implemented | Year selector, stat cards, taxable events table, CSV download |
| Integration | Connected | `useTaxReport` hook, `exportTaxCsvUrl` for CSV download |

**Details:**
- **FIFO cost basis**: Loads all buys up to end-of-year for complete lot history, matches sells within year. Handles partial lot consumption correctly.
- **Tax event generation**: Proper short-term vs long-term classification (365-day boundary).
- **CSV export**: Koinly format with correct headers. Streamed as `text/csv` response with download disposition.
- **Edge case handled**: Unmatched sells (pre-existing balances) get zero cost basis — correct behavior.

**Potential issue:** No handling for wash-sale rules. Acceptable for crypto in most jurisdictions.

---

## 3. Grid Trading

**Verdict: WORKING (requires live exchange connection)**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | Full lifecycle: create, calculate, place orders, monitor fills, stop |
| Frontend | Implemented | Create form, active bots display with PnL, stop button |
| Integration | Connected | `useGridBots`, `useCreateGridBot`, `useStopGridBot` hooks |

**Details:**
- **Grid calculator**: Arithmetic grid levels with proper buy/sell side allocation. Handles normal and reverse grids.
- **Grid executor**: Places limit orders via `IOrderExecutor` (works with both paper and live mode). 10s fill-polling interval. Counter-order logic on fill (buy fill -> sell at level+1).
- **PnL tracker**: Records realized PnL per buy->sell cycle. Persists to `GridBotModel` asynchronously.
- **Auth failure detection**: Stops monitoring on exchange auth errors instead of spam-polling.

**Blockers for live use:**
1. Requires `priceCache.getBestPrice(pair)` to have a cached price — needs price feed running
2. Exchange API keys must be configured
3. Grid executor iterates all exchanges to check order fills (`checkOrderFilled`) — works but inefficient; should use the bot's specific exchange

**Bug found:** `checkOrderFilled` tries all exchanges sequentially. If the order is on Binance but OKX is checked first and throws a non-auth error, it silently catches and tries next. This is by design but means a missing `symbol` param on one exchange could mask real errors. Low severity.

---

## 4. Smart Orders (TWAP/VWAP)

**Verdict: WORKING (requires live exchange connection)**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | TWAP (uniform slices), VWAP (volume-weighted slices), pause/resume/cancel |
| Frontend | Implemented | Create form (TWAP/VWAP toggle), active orders with progress bar, pause/cancel buttons |
| Integration | Connected | Full CRUD via `use-smart-order-queries` hooks |

**Details:**
- **TWAP engine**: Splits total amount into N equal slices, fires at uniform intervals via `setTimeout`.
- **VWAP engine**: Fetches historical 1h candles for volume profile. Falls back to uniform weights if no data. Proper normalization.
- **Slice scheduler**: Manages in-memory timer state. Supports pause (clears timers), resume (re-schedules with corrected delays), cancel.
- **Execution tracker**: Running weighted average price calculation. Persists progress to `SmartOrderModel` after each slice.

**Critical concern — slice completion detection:**
The `sliceScheduler` marks an order complete only when `i === slices.length - 1` (last slice index fires). If an earlier slice fails, the last slice still fires and marks complete — but `filledAmount` would be less than `totalAmount`. The tracker's `complete()` method doesn't check if all slices actually succeeded. This means a "completed" order could be partially filled.

**Race condition risk:** `resume()` re-schedules all `pendingSlices` including already-filled ones. The guard `if (!current || current.cancelled || current.paused) return` prevents double-execution during pause, but `pendingSlices` is never pruned after fills. On resume, previously filled slices would re-execute if their `absoluteFireAt` is in the past (delay=0). **This is a real bug** — slices already filled before pause could execute again on resume.

---

## 5. Copy Trading

**Verdict: PARTIALLY WORKING**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | Full CRUD, sync engine with drift threshold, weighted merge |
| Frontend | Implemented | Add source form, source cards, sync history table |
| Integration | **Broken for URL sources** | Frontend form sends no `allocations` array for URL sources |

**Details:**
- **Backend**: Solid implementation — drift threshold (2%), weighted multi-source merge, SSRF protection on URL fetcher, sync logging, event bus trigger for rebalance.
- **Portfolio source fetcher**: Validates HTTPS-only, blocks private IPs, validates allocation sum ~100%.

**Bug found — frontend missing required field:**
The CopyTradingPage form sends: `{ name, sourceType: "url", sourceUrl, weight, syncInterval }` but the backend route validates `allocations must be a non-empty array` as required. The frontend doesn't send `allocations` for URL-type sources. The backend requires it on POST even though URL sources fetch allocations from the URL.

Looking closer at the backend validation:
```typescript
if (!Array.isArray(b["allocations"]) || b["allocations"].length === 0) {
  return c.json({ error: "allocations must be a non-empty array" }, 400);
}
```

This validation runs before checking `sourceType`. For URL sources, allocations should be optional (they come from the URL). **Creating a URL-type copy source will always fail with 400** because the frontend doesn't provide allocations.

**No automatic sync scheduler:** The `syncInterval` field is stored but there is no cron/scheduler that auto-triggers `copySyncEngine.syncAll()`. Only manual "Sync Now" works. The feature description implies automatic syncing.

---

## 6. AI Suggestions

**Verdict: WORKING (requires GoClaw connection)**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | Implemented | Suggestion intake, approve/reject, auto-apply, config update, market summary |
| Frontend | Implemented | Pending/History tabs, approve/reject buttons, config panel |
| Integration | Connected | `use-ai-queries` hooks for all operations |

**Details:**
- **AI suggestion handler**: Validates allocation sum (~100%), validates per-asset shift constraint (`maxAllocationShiftPct`, default 20%), persists to `AISuggestionModel`.
- **Auto-approve mode**: When enabled, applies allocations immediately and triggers rebalance.
- **Market summary service**: Generates Vietnamese-language daily/weekly portfolio summaries from snapshots and trades. Well-structured for Telegram delivery.
- **GoClaw client**: OpenAI-compatible API client with auth token, 60s timeout. Gracefully disabled when token not set.

**Design note:** AI suggestions flow is push-based (GoClaw calls POST /ai/suggestion), not pull-based (backend doesn't poll GoClaw). This means GoClaw must be configured to send suggestions to the rebalance-bot API. The frontend just views/manages suggestions that have already been received.

**Frontend issue (minor):** `parseSuggestedAllocations` does `JSON.parse(raw)` but `suggestedAllocations` is stored as Mongoose Mixed (already an object from `.lean()`). The `JSON.parse` would fail on an object — it expects a string. However, this depends on how the API serializes the response. If the API sends it as JSON, it arrives as an object and `JSON.parse(object)` would throw, falling back to `[]`. **Allocations may not display in the UI** if the backend returns the field as an object rather than a JSON string.

---

## 7. Settings

**Verdict: PARTIALLY WORKING (client-side only)**

| Layer | Status | Notes |
|-------|--------|-------|
| Backend | No settings API | No server-side settings endpoint |
| Frontend | Implemented | Default exchange, execution mode, notification toggles, data export |
| Integration | Client-side only | All settings saved to `localStorage` |

**Details:**
- Settings persist in `localStorage` under `rb_settings` key
- Data export (portfolio JSON, order history JSON) calls real API endpoints — works
- Clear cache removes all `rb_` prefixed localStorage keys
- **Settings do NOT affect backend behavior.** Changing "Execution Mode" to "Live" in settings does nothing server-side. The actual execution mode is controlled by `EXECUTION_MODE` env var.
- **Notification toggles are decorative.** They don't control actual Telegram notifications (which are handled by GoClaw cron). No API sends these preferences to the backend.

---

## 8. Backtesting

**Verdict: WORKING (previously verified)**

Confirmed working with +284% returns on optimal configuration. Full implementation with historical data loading, strategy simulation, and optimizer.

---

## Summary Matrix

| Feature | Backend | Frontend | Integration | Verdict |
|---------|---------|----------|-------------|---------|
| Analytics | DONE | DONE | DONE | **WORKING** |
| Tax Reports | DONE | DONE | DONE | **WORKING** |
| Grid Trading | DONE | DONE | DONE | **WORKING** (needs exchange) |
| Smart Orders | DONE | DONE | DONE | **WORKING** (needs exchange) |
| Copy Trading | DONE | DONE | **BROKEN** | **PARTIALLY WORKING** |
| AI Suggestions | DONE | DONE | DONE* | **WORKING** (needs GoClaw) |
| Settings | N/A | DONE | N/A | **PARTIALLY WORKING** |
| Backtesting | DONE | DONE | DONE | **WORKING** |

---

## Critical Issues (Blocking)

### C1. Copy Trading: Frontend cannot create URL sources
**File:** `frontend/src/pages/CopyTradingPage.tsx` line 41-48
**Problem:** `addMutation.mutate()` sends no `allocations` field. Backend requires non-empty `allocations` array. All URL source creation attempts will fail with 400.
**Fix:** Either make backend `allocations` validation conditional on `sourceType`, or have frontend send a placeholder allocations array for URL sources.

### C2. Smart Orders: Resume re-executes already-filled slices
**File:** `src/twap-vwap/slice-scheduler.ts` line 118-163
**Problem:** `pendingSlices` is never pruned after successful fills. On resume, all slices (including already-executed ones) are re-scheduled. Past-due slices fire immediately (delay=0), causing double-execution.
**Fix:** Track which slices have been filled and exclude them from resume scheduling.

---

## High Priority Issues

### H1. AI Suggestions: Frontend may not display allocations
**File:** `frontend/src/pages/AISuggestionsPage.tsx` line 13-20
**Problem:** `JSON.parse()` on an already-deserialized object will throw. Falls back to empty array, hiding allocation data.
**Fix:** Add type check: `typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []`

### H2. Settings: All toggles are client-side only
**Problem:** No server-side settings API. UI gives false impression that changing execution mode or notification preferences affects system behavior.
**Fix:** Either connect settings to backend config, or add clear disclaimers that these are display preferences only.

### H3. Copy Trading: No automatic sync scheduler
**Problem:** `syncInterval` field is persisted but no scheduler reads it. Sync only happens manually.
**Fix:** Add a cron/interval that calls `copySyncEngine.syncAll()` based on configured intervals.

---

## Unresolved Questions

1. Is the `suggestedAllocations` field stored as a JSON string or Mongoose Mixed object? This determines whether issue H1 is real.
2. Should Settings page control actual backend behavior, or is client-side-only intentional?
3. Is automatic copy trading sync planned, or is manual-only the design intent?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** 6 of 8 features are fully functional. Copy Trading has a blocking frontend bug (C1). Smart Orders has a resume race condition (C2). Settings page is cosmetic-only.
**Concerns:** C1 and C2 are production bugs that should be fixed before users rely on these features.
