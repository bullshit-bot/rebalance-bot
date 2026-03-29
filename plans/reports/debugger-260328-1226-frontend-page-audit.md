---
title: Frontend Page Audit — Mock/Fake Data Analysis
date: 2026-03-28
author: debugger
---

# Frontend Page Audit — Mock/Fake Data Analysis

**Environment:** http://localhost (Docker), API Key: `dev-api-key-2026`
**Method:** Source code inspection + direct API calls (Playwright not needed — code-level audit is conclusive)

---

## API Baseline (all working)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /api/health` | OK | `{binance: connected, okx: disconnected, bybit: disconnected}` |
| `GET /api/portfolio` | OK | 11 assets, totalValue ~$120k |
| `GET /api/portfolio/history` | OK | 35 snapshots |
| `GET /api/rebalance/preview` | OK | 6 proposed trades |
| `GET /api/rebalance/history` | OK | 10+ events |
| `GET /api/trades` | OK | 30 trades (all paper) |
| `GET /api/config/allocations` | OK | 6 targets (BTC/ETH/SOL/USDT/AVAX/LINK) |
| `GET /api/strategy-config` | OK | active config + 7 configs |
| `GET /api/strategy-config/presets` | OK | 5 presets |
| `GET /api/analytics/equity-curve` | OK | 35 data points |
| `GET /api/analytics/pnl` | OK | by asset + period |
| `GET /api/analytics/drawdown` | OK | max -58.5% |
| `GET /api/analytics/fees` | OK | $445 total |
| `GET /api/tax/report` | OK | empty events (no realized gains yet) |
| `GET /api/smart-order/active` | OK | empty array |
| `GET /api/grid/list` | OK | empty array |
| `GET /api/copy/sources` | OK | empty array |
| `GET /api/copy/history` | OK | empty array |
| `GET /api/ai/suggestions` | OK | empty array |
| `GET /api/ai/summary` | OK | text summary |

---

## Page-by-Page Audit

---

### 1. Overview (`/`)
**Status: ✅ Real data**
**Data source:** backend API (`/api/portfolio`, `/api/portfolio/history`, `/api/trades`, `/api/rebalance/preview`)
**API calls:**
- `GET /api/portfolio` — portfolio value, allocation pie, current vs target bar chart
- `GET /api/portfolio/history` — PnL display, portfolio value line chart
- `GET /api/trades?limit=5` — recent orders table
- `GET /api/rebalance/preview` — "Rebalance Recommendations" panel + Pending Actions count

**Issues found:**
- "Drift alerts" section is derived client-side from portfolio assets (no dedicated `/api/alerts` endpoint — **this is intentional by design**)
- Alerts are derived from `driftPct > 3` threshold — correctly reflects real data
- "Last Updated" uses `portfolio.updatedAt` (unix ms timestamp) — renders correctly as time string

---

### 2. Portfolio (`/portfolio`)
**Status: ✅ Real data**
**Data source:** `GET /api/portfolio`
**API calls:** `/api/portfolio`

**Issues found:**
- `CATEGORY_MAP` only covers BTC/ETH/SOL/BNB/AVAX/USDT/USDC/LINK — assets TUSD, DAI, USD are not mapped, so they'd show as "uncategorized" and hidden in non-"All" filter views
- No issues with "undefined", "NaN", or placeholder values — all fields are properly computed

---

### 3. Rebalance Plan (`/rebalance-plan`)
**Status: ⚠️ Partial mock**
**Data source:** `GET /api/portfolio` + `GET /api/rebalance/preview`
**API calls:** `/api/portfolio`, `/api/rebalance/preview`

**Issues found:**
- **"Threshold", "Min Trade", "Partial Factor" stat cards show hard-coded "—" dash** — these values exist in `/api/strategy-config` response but are not fetched here
- "Approve & Execute" button → `POST /api/rebalance` — **working, calls real API**
- "Dry Run" button has no `onClick` handler — **button is non-functional (dead UI)**
- "Reject Plan" button has no `onClick` handler — **button is non-functional (dead UI)**

---

### 4. Orders (`/orders`)
**Status: ✅ Real data**
**Data source:** `GET /api/trades?limit=100`
**API calls:** `/api/trades`

**Issues found:**
- All trade data is real (30 paper trades from backend)
- Status is hardcoded to `"filled"` for all trades — accurate since backend only stores executed trades, but could be misleading if there are cancelled/failed states
- Filter tab "Filled" works correctly; "All" shows all trades

---

### 5. Allocations (`/allocations`)
**Status: ✅ Real data**
**Data source:** `GET /api/portfolio` + `GET /api/config/allocations`
**API calls:** `/api/portfolio`, `/api/config/allocations`

**Issues found:**
- Pie chart shows "Target Allocation" from `/api/config/allocations` — real data (6 assets: BTC 35%, ETH 25%, SOL 15%, USDT 10%, AVAX 8%, LINK 7%)
- Portfolio has 11 assets but only 6 have allocation targets — the extra 5 (BNB, TUSD, USDC, DAI, USD) show target 0% which is correct but shows them in the "rebalance band" as "±4% (default)" rather than a computed value
- **No edit UI** — user cannot modify allocations from this page. The `updateAllocations` / `deleteAllocation` API hooks exist in the codebase but are not used in any page
- "Rebalance band" display is always "±custom" or "±4" based on presence of `minTradeUsd`, not the actual percentage band — **misleading label**

---

### 6. Exchanges (`/exchanges`)
**Status: ⚠️ Partial mock**
**Data source:** `GET /api/health` + `GET /api/portfolio`
**API calls:** `/api/health`, `/api/portfolio`

**Issues found:**
- Exchange status (connected/disconnected) is **real** from `/api/health`
- Spot balance per exchange computed from portfolio assets — **real data**
- "API Label" is **hardcoded** to `"trading-bot"` when connected
- "Mode" field is **hardcoded** to `"Testnet (Sandbox)"` for binance when connected, otherwise `"—"` — not from API
- **"Sync Now" button** calls `toast.success()` only — **no API call made, pure UI mockup**
- **"Reconnect" button** has no `onClick` handler — **non-functional dead button**
- **"API Permission Checklist"** is **fully hardcoded**: `i < 3` = checked for Binance, `i < 1` = checked for OKX — **fake data, not from API**

---

### 7. Strategy Config (`/strategy-config`)
**Status: ⚠️ Partial mock**
**Data source:** Mix of localStorage + `GET /api/strategy-config` + `GET /api/strategy-config/presets`
**API calls:** `/api/strategy-config`, `/api/strategy-config/presets`, `PUT /api/strategy-config/:name`, `POST /api/strategy-config/:name/activate`

**Issues found:**
- **Parameters displayed use localStorage as primary source** — initial state is `loadLocal()` from `localStorage.getItem("rb_strategy_config")`, not from API active config params
- API is only used to get `activeName` (for routing save/activate calls) and preset list
- **API params (`thresholdPct`, `minTradeUsd`, `partialFactor`, etc.) are NOT synced back to the form fields** — if a different client or system modifies the active config, the page will show stale localStorage values
- "Save Config" → `PUT /api/strategy-config/:name` — **API call works**
- "Activate" → `POST /api/strategy-config/:name/activate` — **API call works**
- "Restore Defaults" → resets to hardcoded defaults, **no API call**
- Presets panel: when API presets load → clicking applies via `POST /api/strategy-config/from-preset` — **real API**
- Falls back to hardcoded `FALLBACK_PRESETS` during loading (brief, then replaced by API data)

---

### 8. Logs (`/logs`)
**Status: ⚠️ Partial mock**
**Data source:** Derived from `GET /api/trades?limit=50`
**API calls:** `/api/trades`

**Issues found:**
- **No dedicated logs API** — logs are fabricated from trade records. Every trade becomes an "execution" log entry
- **Level filter chips** (Info, Warning, Error, Sync) produce **empty results** since all trades map to level `"execution"` — these filter options are non-functional
- Log count reflects actual trade count (real data), but the log concept itself is a workaround
- **"Export Logs" button** has no `onClick` handler — **non-functional dead button**

---

### 9. Alerts (`/alerts`)
**Status: ✅ Real data (derived)**
**Data source:** `GET /api/health` + `GET /api/portfolio`
**API calls:** `/api/health`, `/api/portfolio`

**Issues found:**
- No dedicated `/api/alerts` endpoint — alerts derived client-side from health + portfolio data
- Exchange disconnect alerts: OKX and Bybit will show as "critical" alerts (both disconnected per health API)
- Drift alerts: assets with `|driftPct| > 3` generate warnings — from real portfolio data
- "Dismiss" button works locally (tracked in component state) but does **not persist** to any API or localStorage — dismissed alerts reappear on page reload

---

### 10. Backtesting (`/backtesting`)
**Status: ✅ Real data**
**Data source:** `POST /api/backtest` on form submit
**API calls:** `POST /api/backtest` (on submit)

**Issues found:**
- Form fields are all local state with sensible defaults (no mock data)
- Results only appear after running — correctly shows "no results" state initially
- Default date range is hardcoded: `2026-02-01` to `2026-03-01` — acceptable as defaults

---

### 11. Analytics (`/analytics`)
**Status: ✅ Real data**
**Data source:** `GET /api/analytics/equity-curve`, `/api/analytics/pnl`, `/api/analytics/drawdown`, `/api/analytics/fees`
**API calls:** All 4 analytics endpoints

**Issues found:**
- All data is real from backend
- Net PnL shows `-$188,926` — this is a computed unrealized PnL based on trade simulation, may look alarming but is technically correct
- "Total Return" in Overview tab computes `(last - first) / first` from equity curve data — valid

---

### 12. Tax Reports (`/tax-reports`)
**Status: ✅ Real data**
**Data source:** `GET /api/tax/report?year=2026`
**API calls:** `/api/tax/report`

**Issues found:**
- Backend returns zero gains/losses for 2026 (paper trades don't generate realized tax events) — this is correct, not a mock
- "Export CSV" button calls `GET /api/tax/export` via direct link — API call is real
- Year selector only lists 2024/2025/2026 — hardcoded dropdown

---

### 13. Grid Trading (`/grid-trading`)
**Status: ✅ Real data**
**Data source:** `GET /api/grid/list`
**API calls:** `/api/grid/list`, `POST /api/grid` (on create), `PUT /api/grid/:id/stop`

**Issues found:**
- Bot list is empty (no bots created yet) — correctly shows empty state from real API
- Form fields use local state with sensible defaults — no fake data
- Create and Stop mutations call real API endpoints

---

### 14. Smart Orders (`/smart-orders`)
**Status: ✅ Real data**
**Data source:** `GET /api/smart-order/active`
**API calls:** `/api/smart-order/active`, `POST /api/smart-order`, `PUT /api/smart-order/:id/pause|resume|cancel`

**Issues found:**
- Orders list is empty (none created) — shows correct empty state from API
- All mutations call real API endpoints

---

### 15. Copy Trading (`/copy-trading`)
**Status: ✅ Real data**
**Data source:** `GET /api/copy/sources`, `GET /api/copy/history`
**API calls:** `/api/copy/sources`, `/api/copy/history`, `POST /api/copy/source`, `DELETE /api/copy/source/:id`, `POST /api/copy/sync`

**Issues found:**
- Sources and history are empty — real API returns `[]`
- All mutations call real API

---

### 16. AI Suggestions (`/ai-suggestions`)
**Status: ✅ Real data**
**Data source:** `GET /api/ai/suggestions`
**API calls:** `/api/ai/suggestions`, `PUT /api/ai/suggestion/:id/approve|reject`, `PUT /api/ai/config`

**Issues found:**
- Suggestions list is empty — real API returns `[]`
- ConfigTab's `autoApprove` and `maxShift` are local state initialized to hardcoded defaults (`false`, `5`) — **not fetched from API** (no GET /api/ai/config endpoint)
- "Save Config" → `PUT /api/ai/config` works but there's no way to read current config back

---

### 17. Settings (`/settings`)
**Status: ❌ All mock/hardcoded**
**Data source:** None (all local state / hardcoded)
**API calls:** None

**Issues found:**
- All toggle states are local React state with hardcoded defaults — **not persisted anywhere**
- Select dropdowns use `defaultValue` (uncontrolled) — **not from API or localStorage**
- **"Save Settings"** → `toast.success("Settings saved")` only — **no API call, no persistence**
- **"Export Portfolio Data (JSON)"** button — **no `onClick`, non-functional**
- **"Export Order History (CSV)"** button — **no `onClick`, non-functional**
- **"Clear Local Cache"** button — **no `onClick`, non-functional**
- This entire page is a UI skeleton with no backend integration

---

## Summary Table

| Page | Status | API Calls | Issues |
|---|---|---|---|
| Overview | ✅ Real | portfolio, history, trades, preview | Minor: alerts derived client-side |
| Portfolio | ✅ Real | portfolio | TUSD/DAI/USD have no category in filter |
| Rebalance Plan | ⚠️ Partial | portfolio, preview, rebalance (POST) | 3 stat cards show "—"; Dry Run & Reject buttons dead |
| Orders | ✅ Real | trades | All statuses hardcoded to "filled" |
| Allocations | ✅ Real | portfolio, config/allocations | No edit UI; rebalance band label misleading |
| Exchanges | ⚠️ Partial | health, portfolio | API Label/Mode hardcoded; Sync Now/Reconnect buttons fake; Permission checklist hardcoded |
| Strategy Config | ⚠️ Partial | strategy-config, presets | Params from localStorage, not synced from API active config |
| Logs | ⚠️ Partial | trades | No real log API; level filters non-functional; Export button dead |
| Alerts | ✅ Real | health, portfolio | Dismissals not persisted |
| Backtesting | ✅ Real | backtest (POST) | — |
| Analytics | ✅ Real | all 4 analytics endpoints | — |
| Tax Reports | ✅ Real | tax/report | Events empty (correct for paper trades) |
| Grid Trading | ✅ Real | grid/list, grid (POST/PUT) | Empty state is correct |
| Smart Orders | ✅ Real | smart-order/active, smart-order (POST/PUT) | Empty state is correct |
| Copy Trading | ✅ Real | copy/sources, copy/history | Empty state is correct |
| AI Suggestions | ✅ Real | ai/suggestions | ConfigTab reads defaults, no GET config API |
| Settings | ❌ Mock | None | Fully hardcoded, no persistence anywhere |

---

## Critical Issues (Priority)

### P1 — Non-functional buttons (silent failures)
1. **Rebalance Plan**: "Dry Run" and "Reject Plan" buttons have no `onClick` — no feedback to user
2. **Exchanges**: "Sync Now" shows toast but doesn't call API; "Reconnect" button has no handler
3. **Exchanges**: "API Permission Checklist" is hardcoded (`i < 3` logic) — always shows same values regardless of actual API permissions
4. **Logs**: "Export Logs" button has no handler
5. **Settings**: "Export Portfolio Data", "Export Order History", "Clear Local Cache" — all non-functional
6. **Settings**: "Save Settings" shows success toast but saves nothing

### P2 — Stale/misleading data
7. **Strategy Config**: Form fields initialized from `localStorage` not from active API config — if config is changed server-side or by another client, form shows stale data
8. **Rebalance Plan**: Threshold/Min Trade/Partial Factor stats show hardcoded "—" instead of fetching from `/api/strategy-config`

### P3 — Missing functionality
9. **Allocations**: No edit UI — `updateAllocations` and `deleteAllocation` hooks exist but unused in any page. Users cannot change target allocations from the frontend
10. **AI Suggestions**: No GET endpoint for AI config — `autoApprove`/`maxShift` always reset to defaults on page load
11. **Settings**: Entire page has no backend — notification prefs, defaults etc. are not persisted

### P4 — Log system limitation
12. **Logs**: Derived entirely from trades. Only `execution` level entries exist. Info/Warning/Error/Sync filter tabs produce empty results. No real system log API.

---

## Unresolved Questions

1. Is the Settings page intentionally a skeleton (Phase N+1 work), or should it persist to the backend?
2. Should there be a dedicated `/api/alerts` endpoint, or is client-side derivation the intended long-term approach?
3. Should `/api/logs` be added as a real system log endpoint (backend logs from the rebalance engine, scheduler, etc.)?
4. Is the Strategy Config page design intentional (localStorage primary, API secondary) for offline/fallback support, or should it sync from API on mount?
5. Is the Allocations page intentionally read-only (managed via config files / API directly), or should an edit UI be added?
