# Phase 2: Auto-Subscribe & Auto-Redeem Integration

## Context Links
- [Phase 1](./phase-01-earn-manager-and-portfolio.md) — prerequisite
- [DCA Service](../../src/dca/dca-service.ts) — subscribe after DCA buy
- [Rebalance Engine](../../src/rebalancer/rebalance-engine.ts) — redeem before sell
- [Drift Detector](../../src/rebalancer/drift-detector.ts) — reference only

## Overview
- **Priority**: P1
- **Status**: Pending
- **Effort**: 2.5h
- **Description**: Wire auto-subscribe into DCA flow (subscribe idle coins after buy) and auto-redeem into rebalance flow (redeem from Earn before executing sell trades).

## Key Insights
- DCA buys happen daily → subscribe proceeds to Earn immediately after fill
- Rebalance sells require coins in Spot → must redeem from Earn first
- Redemption is instant but needs polling to confirm settlement (2-5s typical)
- Subscribe ALL idle target-asset balances, not just the DCA amount (catch any leftovers)
- Bear trigger sells crypto → must redeem ALL Earn positions for those assets

## Requirements

### Functional
1. After DCA buy executes, subscribe purchased asset's full Spot balance to Earn
2. Before rebalance sell, redeem required amounts from Earn to Spot
3. Poll for settlement (Spot balance reflects redeemed amount) with configurable timeout
4. On settlement timeout, proceed with whatever is available in Spot (partial rebalance)
5. After rebalance completes, subscribe any remaining idle balances to Earn

### Non-Functional
1. Settlement polling timeout: 30s default, configurable via `simpleEarnSettleTimeoutMs`
2. Subscribe/redeem failures must not block DCA or rebalance — log error and continue
3. All operations emit events for Telegram notifications

## Architecture

### DCA → Subscribe Flow
```
DCAService.executeScheduledDCA()
  └── executor.executeBatch(orders) → fills
      └── NEW: simpleEarnManager.subscribeAll(targetAssets)
          ├── For each target asset with Spot balance > minAmount
          │   └── subscribe(asset, spotBalance)
          └── Log results, emit earn:subscribed event
```

### Rebalance → Redeem → Trade Flow
```
RebalanceEngine.execute(trigger)
  └── NEW: Pre-trade redemption step
      ├── calculateTrades() → identify sell-side orders
      ├── For each sell order: check if asset has Earn position
      │   └── simpleEarnManager.redeem(asset, neededAmount)
      ├── waitForSettlement(assets, timeout)
      │   └── Poll fetchBalance() every 2s until amounts appear
      └── Execute trades (existing flow)
      └── NEW: Post-trade subscribe step
          └── simpleEarnManager.subscribeAll(targetAssets)
```

### Settlement Polling
```typescript
async waitForSettlement(expected: Map<string, number>, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const balance = await exchange.fetchBalance();
    const allSettled = [...expected].every(([asset, amount]) => 
      (balance[asset]?.free ?? 0) >= amount * 0.99  // 1% tolerance
    );
    if (allSettled) return true;
    await sleep(2000);
  }
  return false; // timeout — proceed with available balance
}
```

## Related Code Files

### Files to Modify
- `src/dca/dca-service.ts` — Add post-DCA subscribe call in `executeScheduledDCA()`
- `src/rebalancer/rebalance-engine.ts` — Add pre-trade redeem + post-trade subscribe in `execute()`

### Files to Read (reference only)
- `src/exchange/simple-earn-manager.ts` — Phase 1 output
- `src/rebalancer/trade-calculator.ts` — Understand sell-side order identification
- `src/executor/order-executor.ts` — Understand execution flow

## Implementation Steps

### Step 1: Add `subscribeAll()` helper to SimpleEarnManager
1. New method `subscribeAll(assets: string[])`: for each asset in list, get Spot free balance from exchange, subscribe if > min amount
2. New method `redeemForRebalance(sellOrders: TradeOrder[])`: for each sell-side order, check Earn position, redeem needed amount
3. New method `waitForSettlement(expected, timeoutMs)`: poll fetchBalance until amounts appear in Spot
4. These are orchestration helpers — they compose the core subscribe/redeem from Phase 1

### Step 2: Wire subscribe into DCA flow
1. In `dca-service.ts` → `executeScheduledDCA()`, after `executor.executeBatch(orders)` succeeds:
   - Check if `simpleEarnEnabled` in globalSettings
   - If enabled, call `simpleEarnManager.subscribeAll(targetAssetSymbols)`
   - Wrap in try/catch — subscribe failure must not fail the DCA
   - Log: `[DCAService] Subscribed idle balances to Earn`
2. Target assets = all assets from the strategy's allocation config (BTC, ETH, SOL, BNB)

### Step 3: Wire redeem into rebalance flow
1. In `rebalance-engine.ts` → `execute()`, between Step 3 (calculateTrades) and Step 5 (executeOrders):
   - Check if `simpleEarnEnabled` in globalSettings
   - Identify sell-side orders from `orders` array (orders where we're selling crypto)
   - Call `simpleEarnManager.redeemForRebalance(sellOrders)`
   - Call `simpleEarnManager.waitForSettlement(expectedAmounts, timeoutMs)`
   - If settlement times out, log warning but proceed (will trade from available Spot balance)
2. After successful trade execution (after Step 8):
   - Call `simpleEarnManager.subscribeAll(targetAssets)` to re-subscribe remaining balances
   - Wrap in try/catch — post-trade subscribe failure is non-critical

### Step 4: Add events for monitoring
1. Define events: `earn:subscribed`, `earn:redeemed`, `earn:settlement-timeout`
2. Emit from SimpleEarnManager orchestration methods
3. These will be picked up by the existing Telegram notifier in Phase 3

### Step 5: Write unit tests
1. Test DCA → subscribe flow:
   - After DCA buy, verify `subscribeAll()` called with correct assets
   - Subscribe failure doesn't fail DCA
   - simpleEarnEnabled=false skips subscribe
2. Test Rebalance → redeem flow:
   - Before sell, verify `redeemForRebalance()` called with sell-side orders
   - Settlement polling succeeds → trades execute normally
   - Settlement timeout → trades execute with available balance
   - simpleEarnEnabled=false skips redeem
3. Test settlement polling:
   - Returns true when balance appears within timeout
   - Returns false on timeout
   - Handles exchange errors gracefully

## Todo List
- [ ] Add `subscribeAll()` method to SimpleEarnManager
- [ ] Add `redeemForRebalance()` method to SimpleEarnManager
- [ ] Add `waitForSettlement()` method to SimpleEarnManager
- [ ] Wire subscribe into `DCAService.executeScheduledDCA()` (post-buy)
- [ ] Wire redeem into `RebalanceEngine.execute()` (pre-sell)
- [ ] Wire subscribe into `RebalanceEngine.execute()` (post-trade)
- [ ] Add earn events (subscribed, redeemed, settlement-timeout)
- [ ] Write unit tests for DCA → subscribe flow
- [ ] Write unit tests for rebalance → redeem → trade flow
- [ ] Write unit tests for settlement polling

## Success Criteria
- [ ] After scheduled DCA buy, idle coin balances auto-subscribe to Earn
- [ ] Before rebalance sell, required amounts auto-redeem from Earn to Spot
- [ ] Settlement polling confirms funds available before trading
- [ ] Settlement timeout logs warning but doesn't block rebalance
- [ ] Earn feature disabled → DCA and rebalance work exactly as before (no regression)
- [ ] Subscribe/redeem failures don't crash the bot
- [ ] All unit tests pass

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Redemption takes longer than timeout | Proceed with Spot-only; log warning; alert via Telegram |
| Subscribe call fails after DCA | Catch error, log, continue — no impact on DCA |
| Race condition: redeem + poll + trade | Sequential execution; no concurrency within single rebalance |
| Insufficient Spot balance after partial settlement | Trade calculator already handles available balance |

## Security Considerations
- No new permissions needed beyond Phase 1
- Settlement polling uses existing fetchBalance — no new attack surface
- All amounts validated (> 0, > minAmount) before API calls
