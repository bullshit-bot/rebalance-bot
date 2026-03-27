---
title: "Strategy Config Backend (MongoDB + API)"
status: pending
priority: P1
effort: 3h
---

# Phase 1: Strategy Config Backend

## Context Links

- [Research: Backend Patterns](../reports/researcher-260328-0014-strategy-config-backend-patterns.md)
- Current config: `src/config/app-config.ts` (env-only, loaded once)
- Current routes: `src/api/routes/config-routes.ts` (allocations only)
- Strategy manager: `src/rebalancer/strategy-manager.ts` (has `setMode()` but no persistence)
- Server setup: `src/api/server.ts` (route registration)
- DB models index: `src/db/models/index.ts`

## Overview

Create MongoDB model for strategy configs supporting multiple strategy types via Zod discriminated union. Build REST API for CRUD + activate + presets. Wire hot-reload via EventBus so StrategyManager picks up changes without restart.

## Key Insights

- StrategyManager already has `setMode()` for hot-swap — extend to accept full config params
- Only ONE config can be active at a time (partial unique index on `isActive: true`)
- Env vars remain as bootstrap fallback when no DB config exists
- Zod schemas should be shared between API validation and frontend types

## Requirements

### Functional
- Mongoose model with polymorphic `params` (discriminated union by `type`)
- Strategy types: `threshold`, `equal-weight`, `momentum-tilt`, `vol-adjusted`, `mean-reversion`, `momentum-weighted`
- CRUD endpoints under `/api/strategy-config`
- Activate endpoint: deactivates current, activates target, emits EventBus event
- Presets endpoint: returns built-in preset configs
- Create-from-preset endpoint: clones preset into new DB config
- Version field increments on each update (optimistic concurrency)

### Non-Functional
- Zod validation on all writes — reject invalid params
- History array tracks changes (audit trail)
- <50ms response time for config reads

## Architecture

```
Frontend → POST /api/strategy-config/:name/activate
  → strategyConfigRoutes handler
    → StrategyConfigModel.findOneAndUpdate (deactivate old, activate new)
    → eventBus.emit('strategy:config-changed', { config })
      → StrategyManager.applyConfig(config)
        → Updates mode, threshold, and strategy-specific params
```

## Related Code Files

### Create
- `src/db/models/strategy-config-model.ts` — Mongoose schema + Zod validation schemas
- `src/api/routes/strategy-config-routes.ts` — REST API endpoints
- `src/rebalancer/strategies/strategy-config-types.ts` — shared TypeScript types for strategy params

### Modify
- `src/db/models/index.ts` — export new model
- `src/api/server.ts` — register new route group
- `src/rebalancer/strategy-manager.ts` — add `applyConfig()` method, load from DB on init
- `src/events/event-bus.ts` — add `strategy:config-changed` event type (if typed)

### No Deletes

## Implementation Steps

### Step 1: Zod Schemas + Types (strategy-config-types.ts)

Create `src/rebalancer/strategies/strategy-config-types.ts`:
- Define Zod schemas for each strategy type: `ThresholdParamsSchema`, `MeanReversionParamsSchema`, `VolAdjustedParamsSchema`, `MomentumTiltParamsSchema`, `MomentumWeightedParamsSchema`
- Create `StrategyParamsSchema` as `z.discriminatedUnion('type', [...])`
- Define `GlobalSettingsSchema` with: `baseAsset`, `maxDailyVolume`, `partialFactor`, `cooldownHours`, `dynamicThreshold`, `trendAware`, `feeAware`, `autoExecute`
- Export inferred TypeScript types

**Schema details per type:**

```typescript
// threshold
{ type, thresholdPct (0.1-50), minTradeUsd (1-100000) }

// equal-weight
{ type, thresholdPct (0.1-50), minTradeUsd (1-100000) }

// momentum-tilt (existing)
{ type, thresholdPct, minTradeUsd, momentumWindowDays (5-365), momentumWeight (0-1) }

// vol-adjusted (existing, to be enhanced in Phase 3)
{ type, minTradeUsd, baseThresholdPct (0.1-50), volLookbackDays (5-365), minThresholdPct (0.1-10), maxThresholdPct (5-50) }

// mean-reversion (new, Phase 2)
{ type, minTradeUsd, lookbackDays (5-365), bandWidthSigma (0.5-4), minDriftPct (0.1-20) }

// momentum-weighted (new, Phase 5)
{ type, minTradeUsd, rsiPeriod (5-50), macdFast (5-20), macdSlow (15-50), weightFactor (0.1-1) }
```

### Step 2: Mongoose Model (strategy-config-model.ts)

Create `src/db/models/strategy-config-model.ts`:
- Schema fields: `name` (unique), `description`, `params` (Mixed, validated in app layer), `isActive` (Boolean), `globalSettings` (subdocument), `presetName`, `history` (array of changes), `version` (Number)
- Partial unique index on `{ isActive: 1 }` where `isActive: true` — enforces single active config
- Pre-save hook: increment `version`, push to `history`
- Export model + register in `src/db/models/index.ts`

### Step 3: Presets Constant

Add to `strategy-config-model.ts` or separate file:
- `STRATEGY_PRESETS` object with: `Conservative`, `Balanced`, `Aggressive`, `MomentumTilt`, `MeanReversion`
- Each preset includes `params` + `globalSettings` + `description`

### Step 4: Strategy Config Routes (strategy-config-routes.ts)

Create `src/api/routes/strategy-config-routes.ts`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Active config + list of all configs (name, isActive, version) |
| GET | `/:name` | Full config by name |
| POST | `/` | Create new config (Zod-validate params) |
| PUT | `/:name` | Update existing config (Zod-validate, increment version, push history) |
| DELETE | `/:name` | Delete config (prevent deleting active config) |
| POST | `/:name/activate` | Deactivate current, activate target, emit event |
| GET | `/presets` | Return STRATEGY_PRESETS constant |
| POST | `/from-preset` | Create config from preset name + custom name |

### Step 5: Wire Hot-Reload

- In activate handler: after DB update, emit `eventBus.emit('strategy:config-changed', config)`
- In `strategy-manager.ts`: add `applyConfig(config: IStrategyConfig)` method that:
  - Sets `this.mode` from `config.params.type`
  - Stores full config for strategy-specific param access
  - Logs mode change
- On startup: `strategyManager.loadFromDb()` — reads active config from DB, falls back to env

### Step 6: Register Route in Server

- In `src/api/server.ts`: import and register `app.route('/api/strategy-config', strategyConfigRoutes)`

## Todo List

- [ ] Create `src/rebalancer/strategies/strategy-config-types.ts` with Zod schemas
- [ ] Create `src/db/models/strategy-config-model.ts` with Mongoose schema + presets
- [ ] Export model from `src/db/models/index.ts`
- [ ] Create `src/api/routes/strategy-config-routes.ts` with all endpoints
- [ ] Update `src/api/server.ts` to register new routes
- [ ] Add `applyConfig()` and `loadFromDb()` to `src/rebalancer/strategy-manager.ts`
- [ ] Emit `strategy:config-changed` event on activate
- [ ] Write unit tests for Zod validation schemas
- [ ] Write isolated route tests for strategy-config-routes

## Success Criteria

- [ ] `GET /api/strategy-config` returns active config + list
- [ ] `POST /api/strategy-config` creates with Zod validation (rejects bad params)
- [ ] `POST /api/strategy-config/:name/activate` swaps active config and emits event
- [ ] `GET /api/strategy-config/presets` returns 5 presets
- [ ] StrategyManager picks up new config via EventBus without restart
- [ ] Env vars still work as fallback when DB has no active config
- [ ] Only one config can be active at a time (unique index enforced)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Activate during rebalance execution | High — could change params mid-trade | Check rebalance status before applying; queue if executing |
| Zod schema mismatch frontend/backend | Medium | Export types from shared file; generate frontend types |
| Migration from env-only to DB config | Low | Graceful fallback: if no DB config, use env defaults |

## Security Considerations

- Validate all input with Zod — no raw params saved to DB
- Prevent deleting active config (would leave system without strategy)
- Rate limit config changes to prevent abuse
- Log all config changes in history array for audit trail
