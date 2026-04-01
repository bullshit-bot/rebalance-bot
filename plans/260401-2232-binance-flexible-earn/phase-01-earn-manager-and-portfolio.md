# Phase 1: SimpleEarnManager + Portfolio Balance Aggregation

## Context Links
- [Research Report](../reports/researcher-260401-2227-binance-flexible-earn.md)
- [Exchange Manager](../../src/exchange/exchange-manager.ts) — pattern to follow
- [Portfolio Tracker](../../src/portfolio/portfolio-tracker.ts) — needs modification

## Overview
- **Priority**: P1 — foundation for phases 2-3
- **Status**: Pending
- **Effort**: 2.5h
- **Description**: Create SimpleEarnManager module wrapping all Binance Simple Earn Flexible API calls via CCXT implicit methods. Update PortfolioTracker to include Earn balances in total portfolio value and drift calculations.

## Key Insights
- CCXT has no unified Earn methods — use implicit methods: `exchange.sapiPostSimpleEarnFlexibleSubscribe()`
- Earn wallet is SEPARATE from Spot — `fetchBalance()` does NOT include Earn positions
- Flexible redemption is instant (seconds) under normal conditions
- Product IDs (e.g. `BTC001`) must be discovered via product list API, not hardcoded

## Requirements

### Functional
1. SimpleEarnManager can list available flexible products for target assets
2. SimpleEarnManager can subscribe, redeem, and query positions
3. Product ID lookup: given asset symbol (BTC), find its flexible productId
4. Portfolio tracker includes Earn balances in `totalValueUsd` and per-asset values
5. Drift calculation uses combined Spot + Earn balance

### Non-Functional
1. Graceful degradation: if Earn API fails, bot continues with Spot-only
2. Product list cached (1h TTL) — avoid hammering rate-limited endpoint
3. All Earn operations logged for auditability

## Architecture

### SimpleEarnManager (new file)
```
src/exchange/simple-earn-manager.ts
```

Singleton, follows ExchangeManager pattern. Depends on exchange instance from ExchangeManager.

```typescript
// Core interface
interface EarnPosition { asset: string; productId: string; amount: number; }

class SimpleEarnManager {
  // Product discovery + cache
  getProductId(asset: string): Promise<string | null>
  
  // Core operations
  subscribe(asset: string, amount: number): Promise<{ success: boolean; purchaseId?: number }>
  redeem(asset: string, amount: number): Promise<{ success: boolean; redeemId?: number }>
  
  // Position queries
  getFlexiblePositions(): Promise<EarnPosition[]>
  getEarnBalanceMap(): Promise<Map<string, number>>  // asset → amount
}
```

### Data Flow: Balance Aggregation
```
PortfolioTracker.recalculate()
  ├── fetchBalance() → Spot balances (existing)
  └── simpleEarnManager.getEarnBalanceMap() → Earn balances (NEW)
      └── merge into assetTotals before price resolution
```

### Portfolio Tracker Changes
The `processBalanceResponse()` and `recalculate()` methods need to include Earn balances. Key change: after building `assetTotals` from Spot balances, add Earn positions on top.

**Important**: Earn balance fetch is async and rate-limited. Cache Earn positions with 30s TTL to avoid calling on every 10s Spot poll. Earn positions change rarely (only after subscribe/redeem).

## Related Code Files

### Files to Create
- `src/exchange/simple-earn-manager.ts` — Core Earn API wrapper
- `src/exchange/simple-earn-manager.test.ts` — Unit tests

### Files to Modify
- `src/portfolio/portfolio-tracker.ts` — Add Earn balance aggregation in `recalculate()`
- `src/portfolio/portfolio-tracker.test.ts` — Test combined balance scenarios

### Files to Read (reference only)
- `src/exchange/exchange-manager.ts` — Pattern for singleton, DI, error handling
- `src/exchange/exchange-factory.ts` — How exchange instances are created

## Implementation Steps

### Step 1: Create SimpleEarnManager module
1. Create `src/exchange/simple-earn-manager.ts`
2. Implement constructor that accepts exchange instance (or gets from ExchangeManager)
3. Add startup check: verify CCXT implicit methods exist (`typeof exchange.sapiPostSimpleEarnFlexibleSubscribe === 'function'`). If missing, log warning and disable Earn features gracefully.
4. Implement `getFlexibleProducts()` with 1h cache:
   - Call `exchange.sapiGetSimpleEarnFlexibleList({ current: 'SUBSCRIBABLE' })`
   - Parse response rows into `{ productId, asset, minAmount }` map
   - Cache result with timestamp
5. Implement `getProductId(asset)`: lookup from cached product list
6. Implement `subscribe(asset, amount)`:
   - Lookup productId via `getProductId()`
   - Call `exchange.sapiPostSimpleEarnFlexibleSubscribe({ productId, amount: amount.toString() })`
   - Return `{ success, purchaseId }` or throw on error
7. Implement `redeem(asset, amount)`:
   - Lookup productId
   - Call `exchange.sapiPostSimpleEarnFlexibleRedeem({ productId, amount: amount.toString(), destAccount: 'SPOT' })`
   - Return `{ success, redeemId }`
8. Implement `getFlexiblePositions()`:
   - Call `exchange.sapiGetSimpleEarnFlexiblePosition({})`
   - Parse response into `EarnPosition[]`
   - Cache with 30s TTL
9. Implement `getEarnBalanceMap()`:
   - Call `getFlexiblePositions()` (uses cache)
   - Return `Map<string, number>` of asset → total amount

### Step 2: Update PortfolioTracker to aggregate Earn balances
1. Import `simpleEarnManager` singleton
2. In `recalculate()`, after building `assetTotals` from Spot balances:
   - Check if simpleEarnEnabled (read from strategyManager config)
   - If enabled, call `simpleEarnManager.getEarnBalanceMap()` (cached, fast)
   - Merge Earn amounts into `assetTotals`: for each Earn position, add amount to existing asset or create new entry
3. Handle errors: if Earn fetch fails, log warning and continue with Spot-only (graceful degradation)
4. Note: `recalculate()` is currently sync. The Earn balance fetch is async but cached. Options:
   - Option A (recommended): Make `recalculate()` async, await Earn balance
   - Option B: Use a separate cached field updated on a timer; `recalculate()` reads from cache synchronously
   - Choose Option B to minimize disruption — add `earnBalanceCache: Map<string, number>` field, refreshed every 30s by a separate interval

### Step 3: Earn balance polling loop
1. Add `startEarnPolling()` method to PortfolioTracker (or SimpleEarnManager)
2. Every 30s, fetch Earn positions and update cache
3. Cache is read synchronously by `recalculate()` — no async change needed
4. Stop polling in `stopWatching()`

### Step 4: Write unit tests
1. Test SimpleEarnManager with mocked exchange:
   - Product list parsing + caching
   - Subscribe success/failure
   - Redeem success/failure
   - Position parsing
   - Graceful handling when implicit methods missing
2. Test PortfolioTracker with Earn balance:
   - Combined balance calculation (Spot 0.5 BTC + Earn 0.3 BTC = 0.8 BTC)
   - Drift calculation uses combined balance
   - Earn API failure → falls back to Spot-only

## Todo List
- [ ] Create `src/exchange/simple-earn-manager.ts` with core interface
- [ ] Implement product list discovery with 1h cache
- [ ] Implement subscribe/redeem/getPositions methods
- [ ] Implement `getEarnBalanceMap()` with 30s cache
- [ ] Add startup CCXT implicit method verification
- [ ] Update `portfolio-tracker.ts` to merge Earn balances
- [ ] Add Earn balance polling loop (30s interval)
- [ ] Write unit tests for SimpleEarnManager
- [ ] Write unit tests for combined portfolio balance
- [ ] Verify graceful degradation when Earn unavailable

## Success Criteria
- [ ] `simpleEarnManager.getFlexiblePositions()` returns parsed positions from Binance API
- [ ] `simpleEarnManager.subscribe('BTC', 0.001)` successfully subscribes (integration test)
- [ ] Portfolio `totalValueUsd` includes both Spot and Earn balances
- [ ] Drift calculation produces correct results with mixed Spot+Earn holdings
- [ ] When Earn API fails, bot logs warning and continues with Spot-only balance
- [ ] All unit tests pass

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| CCXT implicit methods missing in current version | Check at startup; log warning; disable Earn features |
| Product list endpoint rate limited (1/10s) | Cache for 1h; only refresh on cache miss |
| `recalculate()` is sync, Earn fetch is async | Use cached Earn balance (30s poll), read synchronously |
| Earn positions change during subscribe/redeem | Invalidate cache after each subscribe/redeem call |

## Security Considerations
- No new API keys needed — uses existing Binance key
- Earn operations require Earn permission on API key — document in setup guide
- No secrets stored; all config in GlobalSettings (DB) or env vars
