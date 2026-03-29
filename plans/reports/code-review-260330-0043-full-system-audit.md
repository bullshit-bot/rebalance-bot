# Full System Audit Report

**Date:** 2026-03-30
**Reviewer:** code-reviewer
**Scope:** Backend (src/), Frontend (frontend/src/), MCP Server, Docker, Config

---

## Critical Issues (HIGH)

### H1. `strategy:config-changed` event not in EventMap — type-unsafe emit/subscribe
- **Files:** `src/events/event-bus.ts:17-33`, `src/api/routes/strategy-config-routes.ts:105,141`, `src/rebalancer/strategy-manager.ts:55`
- **Problem:** `strategy:config-changed` is emitted and subscribed but missing from `EventMap`. TypeScript flags this. The `strategy-manager.ts` casts to `(config: unknown)` to work around it, and `strategy-config-routes.ts` gets a compile error (`TS2345`).
- **Impact:** Any typo in event name silently breaks hot-reload of strategy config. No type safety on payload.
- **Fix:** Add `'strategy:config-changed': IStrategyConfig` to `EventMap` interface. Remove the `unknown` cast in strategy-manager.

### H2. Unused import `StrategyParamsSchema` in strategy-config-routes.ts
- **File:** `src/api/routes/strategy-config-routes.ts:7`
- **Problem:** `StrategyParamsSchema` imported but never used (TS6133 error).
- **Fix:** Remove from import statement.

### H3. `DATABASE_URL` env var is dead reference (SQLite artifact)
- **File:** `src/config/app-config.ts:47,93`
- **Problem:** `DATABASE_URL` defaults to `file:./data/bot.db` (SQLite format) but the system uses MongoDB via `MONGODB_URI` (loaded directly from `process.env` in `src/db/connection.ts`). This is confusing and `DATABASE_URL` is never consumed.
- **Fix:** Remove `DATABASE_URL` from app-config.ts. Add `MONGODB_URI` to validated env if desired.

### H4. `.env.example` missing `GOCLAW_URL`
- **File:** `.env.example`
- **Problem:** Backend requires `GOCLAW_URL` (used in docker-compose as `http://goclaw:18790`), but `.env.example` does not document it. Developers setting up locally will miss this.
- **Fix:** Add `GOCLAW_URL=http://goclaw:18790` to `.env.example` under GoClaw section.

### H5. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in app-config but unused by backend code
- **File:** `src/config/app-config.ts:30-31,82-83`
- **Problem:** After the GoClaw migration, the backend no longer directly uses these vars — Telegram is handled entirely by GoClaw. But they remain in `app-config.ts` validation, potentially confusing.
- **Severity:** LOW (not breaking, but misleading). These vars are passed to GoClaw's Docker env, so they're still needed in `.env` but not in the backend's validated config.
- **Fix:** Remove from `app-config.ts` server validation. They only need to be in `.env` for docker-compose passthrough to the GoClaw container.

---

## Medium Priority Issues (MED)

### M1. `strategy-config-type-fields.tsx` exports unused component/functions
- **File:** `frontend/src/pages/strategy-config-type-fields.tsx`
- **Problem:** `StrategyTypeFields` component, `getDefaultParams`, and `STRATEGY_TYPES` are exported but never imported anywhere (only `StrategyType` type is used by StrategyConfigPage). Dead code from pre-simplification.
- **Fix:** Keep only the `StrategyType` type export. Remove unused component, `getDefaultParams`, `STRATEGY_TYPES`, `FieldDef`, `TYPE_FIELDS`, and `Props`.

### M2. `telegram-notifier.ts:158` hardcodes "MA100" label
- **File:** `src/notifier/telegram-notifier.ts:158`
- **Problem:** `describeTrendChange` always says "MA100" regardless of the actual MA period configured. The period is configurable (MA110 is optimal per backtest).
- **Fix:** Accept the MA period in the trend:changed event payload, or label it generically as "MA" instead of "MA100".

### M3. `backtest-routes.ts:234-241` — type casting workaround for `OptimizationRequest`
- **File:** `src/api/routes/backtest-routes.ts:236,241`
- **Problem:** `OptimizationRequest` is cast via `as Record<string, unknown>` which TypeScript flags as unsafe (TS2352).
- **Fix:** Use `(request as unknown as Record<string, unknown>)` or better, add `timeframe` and `includeCashScenarios` as optional fields on the `OptimizationRequest` type.

### M4. `.env.example` has `MONGODB_URI` with hardcoded placeholder inconsistent with docker-compose
- **File:** `.env.example:47`, `docker-compose.yml`
- **Problem:** `.env.example` sets `MONGODB_URI=mongodb://admin:your-mongo-password-here@mongodb:27017/rebalance?authSource=admin` but docker-compose overrides `MONGODB_URI` via environment block using `${MONGO_PASSWORD}`. The `.env` value is redundant when using docker-compose. Not harmful, but confusing to newcomers.
- **Fix:** Add comment in `.env.example` that docker-compose overrides this from `MONGO_PASSWORD`.

### M5. DCA service `executeScheduledDCA` has TODO for execution wiring
- **File:** `src/dca/dca-service.ts:123`
- **Problem:** `// TODO: wire to order executor for live/paper execution` — scheduled DCA calculates orders but never actually executes them.
- **Impact:** Scheduled DCA is a no-op in production. Orders are logged but not submitted.
- **Fix:** Wire to `orderExecutor.executeOrders(orders)` when ready for live. Flag this as known limitation.

### M6. `StrategyParamsSchema` not used for runtime validation in PUT route
- **File:** `src/api/routes/strategy-config-routes.ts:91-93`
- **Problem:** When updating params, `parsed.data.params` is assigned directly without validating against `StrategyParamsSchema`. The `UpdateStrategyConfigSchema` likely validates the envelope but may not deeply validate strategy-specific params.
- **Fix:** Add `StrategyParamsSchema.parse(parsed.data.params)` before assigning.

---

## Low Priority Issues (LOW)

### L1. `bearCashPct: 70` in `strategy-config-global-settings.tsx:32`
- **File:** `frontend/src/pages/strategy-config-global-settings.tsx:32`
- **Problem:** Default bearCashPct is 70 in the frontend defaults. The optimal config from backtesting uses 100. Not a bug, just suboptimal default.
- **Fix:** Consider updating to 100 to match optimal config.

### L2. `thresholdPct: 5` in many test fixtures
- **Files:** Multiple test files use `threshold: 5` in fixture data.
- **Problem:** These are test values, not production defaults. The actual optimal is 8. Not a bug — tests use arbitrary valid values.
- **No fix needed.** Test fixtures don't need to match production defaults.

### L3. `cooldownDays = 3` default in trend-filter.ts
- **File:** `src/rebalancer/trend-filter.ts:101`
- **Problem:** Default cooldown is 3 days in the function signature, but backtest-optimal is 1 day. The actual value is overridden by strategy config at call sites, so this default only matters if called without args.
- **Fix:** Consider updating default to 1, but low priority since strategy config overrides.

### L4. `metrics-calculator.ts:54` comment mentions "Default: 3" for cooldown
- **File:** `src/backtesting/metrics-calculator.ts:54`
- **Problem:** Comment says default cooldown is 3 candles, which is correct for backtesting context (not days).
- **No fix needed.**

### L5. Frontend compile is CLEAN (0 errors)
- No frontend TypeScript errors found.

### L6. Backend non-test compile errors — limited to known issues
- All non-test TS errors are covered by H1, H2, M3 above.

### L7. No Grammy references found anywhere in src/
- Migration from Grammy to GoClaw is complete.

---

## Package.json Audit

### Dependencies — all used:
- `@t3-oss/env-core` — app-config.ts
- `ccxt` — exchange-manager.ts, exchange-factory.ts
- `croner` — cron-scheduler.ts
- `hono` — API server
- `mongoose` — database models
- `zod` — schema validation

### DevDependencies — all used:
- `@biomejs/biome` — linter
- `@types/bun` — type definitions
- `typescript` — compiler

**No unused dependencies found.**

---

## Docker-compose Audit

- All env vars properly wired
- `GOCLAW_URL` correctly set to `http://goclaw:18790` in backend environment block
- `BACKEND_API_KEY` for MCP server correctly references `${API_KEY}`
- Health checks present on all services
- Resource limits defined
- **No issues found.**

---

## Summary

| Severity | Count | Fixed in commit |
|----------|-------|-----------------|
| HIGH     | 5     | H1, H2, H3, H4, H5 -- all fixed |
| MED      | 6     | M1, M2, M3 fixed; M4 (comment), M5 (TODO), M6 (validation) deferred |
| LOW      | 7     | None (cosmetic/test-only) |

**Commit:** `6f22f37` — fix: resolve type-safety gaps, dead code, and missing config from system audit

**Also fixed (bonus):** Removed dead `waitForFill` + `LIMIT_ORDER_WAIT_MS` + `POLL_INTERVAL_MS` from order-executor (leftover from limit+fallback removal). Prefixed unused `totalValueUsd` param in portfolio-tracker.

**Overall Assessment:** Codebase is production-functional. No security vulnerabilities or data leaks found. Main issues were type-safety gaps (strategy event not in EventMap), dead code (SQLite reference, unused imports), and missing documentation (.env.example gaps). The Grammy-to-GoClaw migration is complete with no residual references.
