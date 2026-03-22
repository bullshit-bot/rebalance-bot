# Code Review: Rebalance Bot Backend

**Reviewer**: code-reviewer
**Date**: 2026-03-22
**Runtime**: Bun + TypeScript (strict mode)
**LOC**: ~4,600 (source only, excluding tests)
**Type-check**: PASSES (zero errors)

---

## Summary

- **Overall quality: 7.5/10**
- Critical issues: 3
- Important issues: 7
- Minor issues: 8

The codebase is well-structured with clean separation of concerns, good TypeScript strictness (exactOptionalPropertyTypes enabled), typed event bus, and thoughtful architecture. However, there are real security vulnerabilities, concurrency edge cases, and missing validation in the critical financial path that must be addressed before production use with real funds.

---

## Group Ratings

| Group | Rating | Notes |
|-------|--------|-------|
| G1: Core | **Critical** | Encryption key handling, amount/USD confusion in trade calculator, race in drift detector |
| G2: Data & Events | **Minor** | Clean schema, well-typed event bus, solid config validation |
| G3: Services | **Important** | Portfolio tracker DB query in hot path, DCA deposit heuristic fragile |
| G4: API & Integration | **Important** | WebSocket auth missing, CORS wide open, no rate limiting |
| G5: Advanced | **Minor** | Backtest O(n) candle lookup, copy-trading SSRF risk |

---

## Critical Issues (fix immediately)

### C1. Encryption key handled as UTF-8 string, not validated as 32 bytes

**File**: `src/exchange/api-key-crypto.ts:17`

`Buffer.from(key, 'utf8')` does NOT guarantee 32 bytes for AES-256. A 32-character UTF-8 string with multibyte characters (accented letters, emoji) will produce >32 bytes and silently corrupt encryption or throw at runtime.

```typescript
// Current (broken for multibyte)
const keyBuffer = Buffer.from(key, 'utf8')

// Fix: validate length and prefer hex encoding
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'hex') // expect 64 hex chars = 32 bytes
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)')
  }
  // ...
}
```

The env config validates `ENCRYPTION_KEY` as `.length(32)` which is character count, not byte count. If using hex encoding, change to `.length(64)`.

**Impact**: Potential data loss — encrypted API keys become unrecoverable if key encoding changes.

### C2. trade-calculator `amount` field is USD, but order-executor treats it as base quantity

**File**: `src/rebalancer/trade-calculator.ts:89-90` vs `src/executor/order-executor.ts:106`

```typescript
// trade-calculator.ts line 89 — amount is USD
amount: d.absDeltaUsd,   // denominated in USD; executor converts to base qty

// order-executor.ts line 106 — passes amount directly as CCXT quantity
const limitOrder = await exchange.createOrder(
  order.pair, 'limit', order.side, order.amount, currentPrice
)
```

CCXT's `createOrder` expects base currency quantity (e.g. 0.5 BTC), NOT USD amount. The comment says "executor converts to base qty" but **no conversion exists**. A $500 USD delta would attempt to buy 500 BTC instead of $500 worth of BTC.

```typescript
// Fix in order-executor.ts executeOnce():
const baseAmount = order.amount / currentPrice  // Convert USD to base qty
const limitOrder = await exchange.createOrder(
  order.pair, 'limit', order.side, baseAmount, currentPrice
)
```

**Impact**: Orders will be placed for wildly wrong amounts in live mode. Paper trading masks this because it also doesn't validate.

### C3. WebSocket connections have no authentication

**File**: `src/api/server.ts:72-73`, `src/api/ws/ws-handler.ts`

The `/ws` endpoint upgrades to WebSocket without any auth check. The auth middleware only applies to `/api/*` routes. Anyone can connect to `/ws` and receive real-time portfolio data, trade executions, and exchange status.

```typescript
// Fix: validate API key from query param or protocol header before upgrade
if (url.pathname === '/ws') {
  const apiKey = url.searchParams.get('apiKey')
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 })
  }
  const upgraded = server.upgrade(req, { data: {} })
  // ...
}
```

**Impact**: Information disclosure of portfolio holdings, trade activity, exchange connectivity.

---

## Important Issues (fix before production)

### I1. Auth middleware uses direct string comparison (timing attack)

**File**: `src/api/middleware/auth-middleware.ts:12`

```typescript
if (!apiKey || apiKey !== env.API_KEY) {
```

Direct `!==` comparison leaks timing information. Use constant-time comparison:

```typescript
import { timingSafeEqual } from 'crypto'

const a = Buffer.from(apiKey, 'utf8')
const b = Buffer.from(env.API_KEY, 'utf8')
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  return c.json({ error: 'Unauthorized' }, 401)
}
```

### I2. No rate limiting on API endpoints

**File**: `src/api/server.ts`

No rate limiting middleware. POST /api/rebalance/execute, POST /api/backtest, POST /api/ai/suggestion are all expensive operations with no throttle. An attacker with the API key (or via WebSocket info leak) could trigger unlimited rebalances.

### I3. Portfolio tracker fires DB query on every balance tick

**File**: `src/portfolio/portfolio-tracker.ts:201`

`loadAndBuildPortfolio()` calls `this.getTargetAllocations()` which hits SQLite on every single balance update from every exchange. With multiple exchanges updating frequently, this is unnecessary I/O.

```typescript
// Fix: cache allocations with a short TTL
private cachedAllocations: Allocation[] | null = null
private cacheExpiry = 0

private async getCachedAllocations(): Promise<Allocation[]> {
  if (this.cachedAllocations && Date.now() < this.cacheExpiry) {
    return this.cachedAllocations
  }
  this.cachedAllocations = await this.getTargetAllocations()
  this.cacheExpiry = Date.now() + 30_000 // 30s TTL
  return this.cachedAllocations
}
```

### I4. REBALANCE_THRESHOLD duplicated, not from env singleton

**File**: `src/portfolio/portfolio-tracker.ts:17`

```typescript
const REBALANCE_THRESHOLD = Number(process.env.REBALANCE_THRESHOLD ?? '5')
```

This reads `process.env` directly instead of using the validated `env` from app-config. If the env var is missing, this silently defaults to 5 while the rest of the app uses the t3-env validated value. Use `env.REBALANCE_THRESHOLD` instead.

### I5. DCA deposit detection is fragile — no actual deposit confirmation

**File**: `src/dca/dca-service.ts:181-182`

A 1% portfolio increase triggers "deposit detected". In crypto, a 1% price move within a balance-update cycle is normal. The service only logs suggestions (not auto-executes), which mitigates the risk, but the heuristic will generate false positives frequently in volatile markets.

Consider: require confirmation via API endpoint or cross-reference with actual deposit history from exchange.

### I6. Copy trading source fetcher is vulnerable to SSRF

**File**: `src/copy-trading/portfolio-source-fetcher.ts:64`

`fetch(url)` with user-provided URL. No URL validation against internal networks:

```typescript
// Add basic SSRF protection
const parsed = new URL(url)
if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)) {
  throw new Error('Internal URLs are not allowed')
}
if (parsed.protocol !== 'https:') {
  throw new Error('Only HTTPS sources are allowed')
}
```

### I7. ExecutionGuard daily loss tracking only counts fees, not actual P&L

**File**: `src/executor/execution-guard.ts:81`

```typescript
recordTrade(result: TradeResult): void {
  this.dailyLossUsd += result.fee  // Only fees, not actual losses
}
```

The comment acknowledges this is a proxy, but it means a bot losing $5000 on trades but paying $5 in fees would show $5 daily loss. The guard would never trigger. For production use, this needs actual P&L tracking or at minimum track sell proceeds vs estimated cost basis.

---

## Minor Issues (nice to have)

### M1. `exchangeManager.getStatus()` hardcodes exchange list

**File**: `src/exchange/exchange-manager.ts:95`

```typescript
const allExchanges: ExchangeName[] = ['binance', 'okx', 'bybit']
```

Should derive from ExchangeName type or a shared constant to avoid drift.

### M2. PaperTradingEngine does not check ExecutionGuard

**File**: `src/executor/paper-trading-engine.ts`

The real OrderExecutor checks `executionGuard.canExecute()` before trading, but PaperTradingEngine bypasses it entirely. Paper mode should still respect safety limits for realistic simulation.

### M3. No database migrations — tables created implicitly

**File**: `src/db/database.ts`

Schema is defined in Drizzle but there's no migration runner. For SQLite this is manageable, but schema changes will fail silently on existing databases. Consider adding `drizzle-kit push` or `migrate` to the startup sequence.

### M4. `CopyTradingManager.getSyncHistory` creates unused query

**File**: `src/copy-trading/copy-trading-manager.ts:94-109`

```typescript
const query = db.select()...  // Built but never used when sourceId is present
if (sourceId) {
  return db.select()...  // Completely new query
}
return query
```

The first query is wasted when `sourceId` is provided.

### M5. Backtest simulator uses O(n) `find()` per timestamp per pair

**File**: `src/backtesting/backtest-simulator.ts:180`

```typescript
const candle = candles.find((c) => c.timestamp === ts)
```

For a 1-year hourly backtest with 5 pairs, this is ~8,760 * 5 linear scans. Build a Map<number, OHLCVCandle> per pair before iterating.

### M6. AI suggestion handler uses `as never` type cast for event emission

**File**: `src/ai/ai-suggestion-handler.ts:54-59`

```typescript
eventBus.emit("alert" as never, { ... } as never)
```

The `alert` event is not in the EventMap. Either add it to EventMap or remove the emission. The `as never` cast bypasses type safety entirely.

### M7. `applyAllocations` in AI handler deletes ALL allocations then re-inserts

**File**: `src/ai/ai-suggestion-handler.ts:164-165`

Not transactional — a crash between DELETE and INSERT leaves the allocations table empty. Wrap in a transaction:

```typescript
await db.transaction(async (tx) => {
  await tx.delete(allocations)
  await tx.insert(allocations).values(...)
})
```

### M8. CORS is fully permissive

**File**: `src/api/server.ts:23`

```typescript
app.use('*', cors())
```

Comment says "restrict via reverse proxy" but if deployed without one, any origin can call the API. At minimum, make origin configurable via env var.

---

## Security Audit

| Area | Status | Notes |
|------|--------|-------|
| API Authentication | Partial | API key present but timing-unsafe; WS unauthenticated |
| Encryption at rest | Needs fix | Key derivation flawed (C1) |
| Input validation | Good | Zod for env, manual validation in routes |
| SQL injection | Safe | Drizzle ORM parameterizes all queries |
| SSRF | Vulnerable | Copy trading URL fetch (I6) |
| Rate limiting | Missing | No throttling on any endpoint |
| Secrets in logs | Clean | API keys not logged |
| CORS | Too permissive | Wildcard origin |
| Dependency security | Not audited | Would need `bun audit` |

---

## Performance Concerns

1. **Portfolio tracker DB query per tick** (I3) — most impactful, will cause I/O bottleneck under load
2. **Backtest O(n) candle lookup** (M5) — makes backtest 10-100x slower than necessary for large datasets
3. **Copy sync engine sequential DB updates** (line 97-107 in copy-sync-engine.ts) — should batch upserts
4. **No price aggregator debounce** — every tick emits event + triggers portfolio recalc. Consider batching price updates (e.g. 100ms window)

---

## Positive Observations

1. **Excellent TypeScript strictness** — `exactOptionalPropertyTypes`, `strictNullChecks`, `noImplicitAny` all enabled. Zero type errors.
2. **Clean singleton pattern** — consistent `class + export const` pattern across all modules
3. **Typed event bus** — compile-time enforcement of event payloads prevents a whole class of runtime errors
4. **Graceful shutdown** — proper reverse-order teardown with error handling in `src/index.ts`
5. **Paper trading as default** — `PAPER_TRADING=true` default prevents accidental live trades
6. **Well-structured env validation** — t3-env + Zod catches config errors at startup
7. **Good error boundaries** — most async operations have try/catch with meaningful error messages
8. **Clean separation** — each module has a single responsibility with minimal coupling
9. **Limit-then-market fallback** — order executor strategy is a sound production pattern

---

## Recommended Actions (prioritized)

1. **[CRITICAL]** Fix USD-to-base-quantity conversion in order executor (C2) — this WILL cause wrong order sizes
2. **[CRITICAL]** Fix encryption key handling to use hex encoding with byte-length validation (C1)
3. **[CRITICAL]** Add WebSocket authentication (C3)
4. **[HIGH]** Add constant-time API key comparison (I1)
5. **[HIGH]** Add rate limiting middleware (I2)
6. **[HIGH]** Cache target allocations in portfolio tracker (I3)
7. **[HIGH]** Fix SSRF in portfolio source fetcher (I6)
8. **[HIGH]** Improve execution guard to track actual losses, not just fees (I7)
9. **[MEDIUM]** Add `alert` event to EventMap, remove `as never` casts (M6)
10. **[MEDIUM]** Wrap allocation updates in transactions (M7)
11. **[MEDIUM]** Add PaperTradingEngine guard checks (M2)
12. **[LOW]** Optimize backtest candle lookups (M5)

---

## Unresolved Questions

- Is the `strategyManager` intentionally not wired into the drift detector yet? The code comment says "later integration step" but the strategies are fully implemented.
- Are database migrations managed externally (e.g. via drizzle-kit CLI)? No migration runner found in startup.
- Is there an intended mechanism to confirm deposits for DCA beyond the heuristic, or is suggestion-only the design goal?
