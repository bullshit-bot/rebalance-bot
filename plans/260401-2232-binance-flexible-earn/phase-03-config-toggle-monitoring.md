# Phase 3: Config, Toggle & Monitoring

## Context Links
- [Phase 1](./phase-01-earn-manager-and-portfolio.md) — prerequisite
- [Phase 2](./phase-02-auto-subscribe-redeem.md) — prerequisite
- [Strategy Config Types](../../src/rebalancer/strategies/strategy-config-types.ts) — schema to extend
- [Research Report](../reports/researcher-260401-2227-binance-flexible-earn.md) — config recommendations

## Overview
- **Priority**: P2
- **Status**: Pending
- **Effort**: 1h
- **Description**: Add `simpleEarnEnabled` toggle and related config fields to GlobalSettings schema. Wire Telegram notifications for Earn events. Add API endpoint for Earn status.

## Requirements

### Functional
1. `simpleEarnEnabled` boolean in GlobalSettings (default: false)
2. `simpleEarnSettleTimeoutMs` number in GlobalSettings (default: 30000)
3. Telegram notifications for: subscribe, redeem, settlement timeout
4. API endpoint `GET /api/earn/status` returning current Earn positions + total value

### Non-Functional
1. Feature defaults to OFF — explicit opt-in required
2. Config changes via existing strategy update API — no new endpoints for config
3. Earn status endpoint is read-only, no auth changes needed

## Architecture

### GlobalSettings Schema Extension
```typescript
// Add to GlobalSettingsSchema in strategy-config-types.ts
simpleEarnEnabled: z.boolean().default(false),
simpleEarnSettleTimeoutMs: z.number().min(5000).max(120000).default(30000),
```

### Telegram Notifications
Listen to events from Phase 2 and format as Telegram messages via existing notifier:

```
earn:subscribed → "Subscribed {amount} {asset} to Flexible Earn (APY ~{rate}%)"
earn:redeemed → "Redeemed {amount} {asset} from Earn → Spot for rebalance"
earn:settlement-timeout → "⚠ Earn settlement timeout — proceeding with Spot balance"
```

### API Endpoint
```
GET /api/earn/status
Response: {
  enabled: boolean,
  positions: [{ asset, amount, productId }],
  totalValueUsd: number
}
```

## Related Code Files

### Files to Modify
- `src/rebalancer/strategies/strategy-config-types.ts` — Add Earn config fields to GlobalSettingsSchema
- `src/notifier/` — Add Earn event handlers (or extend existing telegram notifier)
- `src/api/` — Add `/api/earn/status` route

### Files to Read (reference only)
- `src/api/` — Existing API route patterns
- `src/notifier/` — Existing notification patterns

## Implementation Steps

### Step 1: Extend GlobalSettings schema
1. In `strategy-config-types.ts`, add to `GlobalSettingsSchema`:
   - `simpleEarnEnabled: z.boolean().default(false)`
   - `simpleEarnSettleTimeoutMs: z.number().min(5000).max(120000).default(30000)`
2. These fields are already used by Phases 1-2 via `gs?.simpleEarnEnabled` checks — adding them to the schema ensures validation and defaults

### Step 2: Add Telegram notifications for Earn events
1. In the notifier module, subscribe to `earn:subscribed`, `earn:redeemed`, `earn:settlement-timeout` events
2. Format human-readable messages
3. Send via existing Telegram bot integration

### Step 3: Add API endpoint for Earn status
1. Create route handler for `GET /api/earn/status`
2. Call `simpleEarnManager.getFlexiblePositions()`
3. Calculate USD values using priceCache
4. Return JSON response

### Step 4: Write tests
1. Test schema validation accepts/rejects Earn config fields
2. Test API endpoint returns correct structure
3. Test notification formatting

## Todo List
- [ ] Add `simpleEarnEnabled` and `simpleEarnSettleTimeoutMs` to GlobalSettingsSchema
- [ ] Add Telegram notifications for Earn events
- [ ] Add `GET /api/earn/status` endpoint
- [ ] Write schema validation tests
- [ ] Write API endpoint tests

## Success Criteria
- [ ] `simpleEarnEnabled: true` accepted by strategy config update API
- [ ] Invalid `simpleEarnSettleTimeoutMs` (< 5000) rejected by schema
- [ ] Earn subscribe/redeem events appear as Telegram notifications
- [ ] `GET /api/earn/status` returns current positions
- [ ] Feature is OFF by default — existing deployments unaffected

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Schema change breaks existing configs | New fields have defaults; additive-only change |
| Telegram spam from frequent subscribes | Subscribes only happen after DCA (1x/day) or rebalance (rare) |

## Security Considerations
- API endpoint is read-only — same auth as other `/api/*` routes
- No sensitive data exposed (positions are not secret)
