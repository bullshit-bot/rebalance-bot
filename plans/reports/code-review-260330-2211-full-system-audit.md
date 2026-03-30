# Full-System Audit Report

**Date:** 2026-03-30
**Reviewer:** code-reviewer
**Scope:** Backend, Frontend, Config, Deployment, Tests, Docs

---

## Scope

- **Files reviewed:** ~40 core source files across all modules
- **Focus areas:** DCA logic, rebalancing, security, deployment, consistency, race conditions
- **Method:** Manual code review with grep-based cross-reference analysis

## Overall Assessment

The codebase is well-structured with good separation of concerns, comprehensive test coverage, and solid error handling patterns. The DCA logic correctly implements the three-mode routing (proportional, single-target, and bear-hold). Several medium-severity issues were found around consistency, deployment security, and race conditions.

---

## Critical Issues

### C1. MongoDB Port Exposed to All Interfaces in Docker Compose
**File:** `docker-compose.yml:75`
**Impact:** MongoDB is bound to `0.0.0.0:27017` — accessible from the public internet if the host firewall doesn't block it.
**Details:** Backend port correctly uses `127.0.0.1:3001:3001` but MongoDB uses `"27017:27017"` (binds all interfaces).
**Fix:** Change to `"127.0.0.1:27017:27017"` or remove the port mapping entirely since only containers on `app-network` need access.

```yaml
# Before
ports:
  - "27017:27017"
# After
ports:
  - "127.0.0.1:27017:27017"
```

### C2. Rate Limiter Memory Leak
**File:** `src/api/server.ts:30`
**Impact:** `rateLimitMap` grows unboundedly — one entry per unique IP forever. Under a distributed scan or bot attack, this causes OOM.
**Details:** Entries are never evicted. The `resetAt` field exists but expired entries are only overwritten, never deleted.
**Fix:** Add a periodic cleanup (e.g., every 60s via setInterval) or use a LRU cache with max size.

```typescript
// Add after rateLimitMap declaration
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip)
  }
}, 60_000)
```

---

## High Priority

### H1. Strategy Config Activation Race Condition (Non-Atomic Deactivate/Activate)
**File:** `src/api/routes/strategy-config-routes.ts:131-137`
**Impact:** If the process crashes between `updateMany({isActive: true}, {isActive: false})` and `target.save()`, all configs are deactivated with no active config. Bot falls back to env defaults silently.
**Fix:** Use a MongoDB transaction, or at minimum, set activation in a single `findOneAndUpdate` operation.

### H2. Allocation Config Replace is Non-Atomic (Delete-Then-Create)
**File:** `src/api/routes/config-routes.ts:99-109`
**Impact:** If crash between `deleteMany` and `create`, all allocations are wiped. Portfolio tracker will have no targets, DCA and drift detection will malfunction.
**Fix:** Use `bulkWrite` with ordered operations, or a transaction. At minimum, create first then delete old.

### H3. Stablecoin List Inconsistency
**File:** `src/portfolio/portfolio-tracker.ts:237` vs `src/rebalancer/trade-calculator.ts:8`
**Impact:** Portfolio tracker hardcodes `['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD']` while trade calculator uses `STABLECOINS` Set with the same values. If one list is updated but not the other, drift calculations will diverge from trade calculations.
**Fix:** Import and use `STABLECOINS` from `trade-calculator.ts` in portfolio-tracker.ts.

```typescript
// In portfolio-tracker.ts, replace:
if (['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD'].includes(asset)) {
// With:
import { STABLECOINS } from '@rebalancer/trade-calculator'
// ...
if (STABLECOINS.has(asset)) {
```

### H4. ENCRYPTION_KEY Validation Mismatch
**File:** `src/config/app-config.ts:27` vs `src/exchange/api-key-crypto.ts:16`
**Impact:** `app-config.ts` validates `ENCRYPTION_KEY` as `z.string().length(32)` (32 characters), but `api-key-crypto.ts` expects 64 hex characters (32 bytes). Currently unused at runtime (encrypt/decrypt are only imported in tests), but will fail if ever integrated.
**Fix:** Either change app-config validation to `.length(64).regex(/^[0-9a-fA-F]+$/)` or document that the 32-char env value is not used by the crypto module. Since the crypto module is dead code, consider removing ENCRYPTION_KEY from required env vars (it blocks startup if missing).

### H5. Exchange Manager Sandbox Type Mismatch
**File:** `src/exchange/exchange-manager.ts:150-158`
**Impact:** `buildExchangeConfigs()` returns `Map<ExchangeName, { apiKey; secret; password? }>` but line 157 adds `sandbox: boolean` which isn't in the type. The `sandbox` property survives at runtime (JS doesn't strip extra properties from object literals in Map values) but is invisible to TypeScript. Any refactoring that destructures the map values will silently drop sandbox, disabling testnet mode.
**Fix:** Add `sandbox?: boolean` to the return type, or better, use the existing `ExchangeCredentials` type from `exchange-factory.ts`.

---

## Medium Priority

### M1. Dead Code: PAPER_TRADING References
**Files:** `docker-compose.yml`, `deploy.yml:43,94`, `README.md:136`, `.env.example`, `playwright.config.ts:29`, CI workflows
**Impact:** `PAPER_TRADING` env var is still deployed and documented but has no effect — executor/index.ts always returns the real executor. This is confusing for operators.
**Fix:** Remove all `PAPER_TRADING` references from deploy scripts, env files, README, and CI configs.

### M2. Stale Comment: "Paper mode" in DCA Service
**File:** `src/dca/dca-service.ts:126-127`
**Impact:** Comment says "In paper mode, logs the order but doesn't execute" but paper mode was removed. Misleading for maintainers.
**Fix:** Remove the paper mode comment.

### M3. Portfolio Tracker Uses `process.env` Directly for Threshold
**File:** `src/portfolio/portfolio-tracker.ts:18-19`
**Impact:** `REBALANCE_THRESHOLD` is read directly from `process.env` instead of from the validated `env` config. This bypasses the Zod validation and could silently default to NaN if the env var contains a non-numeric string.
**Fix:** Use `env.REBALANCE_THRESHOLD` from `@config/app-config`.

### M4. Telegram Notification Throttle Is Per-Event-Type, Not Per-Asset
**File:** `src/notifier/telegram-notifier.ts:110-115`
**Impact:** The throttle key is just `eventType` (e.g., "trade:executed"). If BTC and ETH trades execute within 30 minutes, only the first notification is sent. The second trade (different asset) is silently suppressed.
**Fix:** Include asset or pair in the throttle key: `${eventType}:${trade.pair}`.

### M5. WebSocket API Key in URL Query Parameter
**File:** `src/api/server.ts:126-128`
**Impact:** API key sent as `?apiKey=<key>` in WebSocket URL. Query parameters appear in server access logs, browser history, and may be logged by reverse proxies. Less secure than header-based auth.
**Fix:** Accept the API key as a Sec-WebSocket-Protocol subprotocol or in the first message after connection. Alternatively, document that reverse proxy logs should not capture query strings.

### M6. No Input Validation on `/api/dca/trigger` Endpoint
**File:** `src/api/server.ts:95-98`
**Impact:** The DCA trigger endpoint has no request body validation and no protection against rapid repeated calls. An authenticated user could trigger unlimited DCA executions.
**Fix:** Add rate limiting or cooldown for the DCA trigger endpoint.

### M7. ExecutionGuard Portfolio Value Estimate Only Counts USDT
**File:** `src/executor/order-executor.ts:240-255`
**Impact:** `estimatePortfolioValueUsd()` only fetches the USDT balance — all other assets are ignored. This means the daily loss limit percentage is calculated against USDT holdings only, not the true portfolio value. A portfolio of mostly BTC would have an artificially low limit.
**Fix:** Use `portfolioTracker.getPortfolio()?.totalValueUsd` instead of fetching balance from exchange.

---

## Low Priority

### L1. `watchTicker` Method Is Dead Code
**File:** `src/price/price-aggregator.ts:165-208`
**Impact:** The `watchTicker` method is defined but never called — `pollTicker` is used instead because Bun doesn't support CCXT Pro WebSocket upgrade. Dead code increases maintenance burden.
**Fix:** Remove `watchTicker` or mark it with a comment explaining it's kept for future Bun WebSocket support.

### L2. Frontend API Client Uses `any` for Strategy Config Types
**File:** `frontend/src/lib/api.ts:143-155`
**Impact:** Strategy config endpoints use `any` types instead of proper TypeScript interfaces. Reduces type safety in the frontend.
**Fix:** Define proper types for strategy config API responses.

### L3. `quoteAssets` Set Hardcoded in Portfolio Tracker
**File:** `src/portfolio/portfolio-tracker.ts:281`
**Impact:** `quoteAssets = new Set(['USDT', 'USDC'])` is a third stablecoin list (subset of the two in H3). Should be derived from the canonical `STABLECOINS` set.

### L4. Deploy Script Uses `git reset --hard`
**File:** `.github/workflows/deploy.yml:66`
**Impact:** Any local changes on the VPS (manual hotfixes, logs) are silently destroyed on every deploy. This is intentional but could lose emergency patches.
**Fix:** Consider `git stash` before reset, or document that manual VPS changes are ephemeral.

---

## Informational

### I1. DCA Logic Verification
The DCA logic correctly implements the intended routing:
- `dcaRebalanceEnabled=true` + crypto < dcaAmount → **proportional** (line 98-103)
- `dcaRebalanceEnabled=true` + crypto >= dcaAmount → **single underweight** (line 106-109)
- `dcaRebalanceEnabled=false` → **always proportional** (line 116)
- Trend filter bear → **hold cash** (line 82-87)
- Stablecoin exclusion uses `STABLECOINS` Set consistently within DCA files

### I2. Security Positives
- Auth middleware uses `timingSafeEqual` for API key comparison (prevents timing attacks)
- AES-256-GCM with random IV for key encryption
- CORS is permissive but documented as "restrict via reverse proxy"
- Backend port bound to `127.0.0.1` in Docker (only MongoDB is exposed)
- Deployment generates `.env` from GitHub Secrets (no secrets in repo)

### I3. Error Handling Positives
- All event handlers have `.catch()` chains
- Executor has retry with exponential backoff
- Network errors trigger duplicate-order detection before retry
- Graceful shutdown persists trend filter state

### I4. Architecture Observations
- All services use singleton pattern with DI support for testing
- Event bus provides loose coupling between modules
- Target allocation cache has 60s TTL to avoid N+1 DB queries
- Price cache eviction runs every 60s via cron

---

## Recommended Actions (Priority Order)

1. **[Critical]** Bind MongoDB port to `127.0.0.1` in docker-compose.yml
2. **[Critical]** Add eviction to rate limiter Map
3. **[High]** Make strategy config activation atomic (transaction or single update)
4. **[High]** Make allocation replacement atomic
5. **[High]** Unify stablecoin lists to single source of truth
6. **[Medium]** Clean up dead PAPER_TRADING references
7. **[Medium]** Fix telegram notification throttle key to include asset
8. **[Medium]** Use validated env config for REBALANCE_THRESHOLD in portfolio-tracker
9. **[Low]** Remove dead watchTicker code or add explanatory comment
10. **[Low]** Add proper TypeScript types to frontend strategy config API

---

## Unresolved Questions

1. Is `ENCRYPTION_KEY` actually used in production for anything? If only in tests, it should be optional in app-config to avoid requiring a dummy value at startup.
2. Is the MongoDB port exposure on the VPS mitigated by a firewall rule? If yes, the docker-compose fix is defense-in-depth rather than critical.
3. Should the `/api/dca/trigger` endpoint require a separate permission level since it executes real trades?

---

**Status:** DONE
**Summary:** 2 critical, 5 high, 7 medium, 4 low findings. Core DCA/rebalance logic is correct. Main concerns are deployment security (MongoDB exposure), memory safety (rate limiter leak), and data integrity (non-atomic DB operations for config changes).
