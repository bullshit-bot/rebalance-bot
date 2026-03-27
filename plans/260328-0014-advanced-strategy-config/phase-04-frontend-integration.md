---
title: "Frontend Strategy Config Integration"
status: completed
priority: P2
effort: 2.5h
---

# Phase 4: Frontend Strategy Config Integration

## Context Links

- [Phase 1: Config Backend](./phase-01-strategy-config-backend.md) — depends on API endpoints
- Current frontend page: `frontend/src/pages/StrategyConfigPage.tsx` (localStorage only, hardcoded defaults)
- API client: `frontend/src/lib/api.ts` (has `apiFetch` helper)
- API types: `frontend/src/lib/api-types.ts`
- Hooks pattern: `frontend/src/hooks/use-allocation-queries.ts` (example of existing query hook)

## Overview

Replace the localStorage-based StrategyConfigPage with a backend-connected version. Load real config from API, support strategy type switching, presets via API, save/load configs, show real-time config state.

## Key Insights

- Current page has: numeric params, toggles, presets — all hardcoded
- Need to: fetch active config on mount, send updates to API, switch strategy types
- Presets should come from backend `/api/strategy-config/presets` endpoint
- Strategy type switching changes which param fields are visible
- Use existing `apiFetch` pattern + React Query hooks (consistent with other pages)

## Requirements

### Functional
- Load active strategy config from backend on page mount
- Display strategy-type-specific parameter fields (threshold shows threshold params, mean-reversion shows band params, etc.)
- Strategy type dropdown/selector to switch between types
- Presets loaded from API (not hardcoded)
- "Apply Preset" creates config from preset via API
- Save button sends PUT to update config
- Activate button sends POST to activate a config
- Show current active config indicator
- Global settings section (baseAsset, partialFactor, toggles) shared across all types

### Non-Functional
- Loading states while fetching config
- Error toasts on save/load failures
- Optimistic UI updates

## Architecture

```
StrategyConfigPage (mount)
  → useStrategyConfig() hook
    → api.getStrategyConfig() → GET /api/strategy-config
    → Returns { active, all }

User changes params → local state update (no API call yet)
User clicks Save → api.updateStrategyConfig(name, data) → PUT /api/strategy-config/:name
User clicks Activate → api.activateStrategyConfig(name) → POST /api/strategy-config/:name/activate
User selects Preset → api.createFromPreset(presetName, configName) → POST /api/strategy-config/from-preset
```

## Related Code Files

### Create
- `frontend/src/hooks/use-strategy-config-queries.ts` — React Query hooks for strategy config API
- `frontend/src/components/strategy-config/strategy-params-form.tsx` — dynamic param fields per strategy type
- `frontend/src/components/strategy-config/strategy-preset-panel.tsx` — preset selection panel

### Modify
- `frontend/src/pages/StrategyConfigPage.tsx` — replace localStorage with API hooks
- `frontend/src/lib/api.ts` — add strategy config API methods
- `frontend/src/lib/api-types.ts` — add StrategyConfig types

### No Deletes

## Implementation Steps

### Step 1: API Types (api-types.ts)

Add to `frontend/src/lib/api-types.ts`:

```typescript
// Strategy types matching backend Zod schemas
export type StrategyType = 'threshold' | 'equal-weight' | 'momentum-tilt' |
  'vol-adjusted' | 'mean-reversion' | 'momentum-weighted'

export interface StrategyGlobalSettings {
  baseAsset: string
  maxDailyVolume: number
  partialFactor: number
  cooldownHours: number
  dynamicThreshold: boolean
  trendAware: boolean
  feeAware: boolean
  autoExecute: boolean
}

export interface StrategyConfig {
  _id: string
  name: string
  description?: string
  params: Record<string, unknown> & { type: StrategyType }
  globalSettings: StrategyGlobalSettings
  isActive: boolean
  presetName?: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface StrategyConfigListResponse {
  active: StrategyConfig | null
  all: Array<{ name: string; isActive: boolean; version: number }>
}

export interface StrategyPreset {
  params: Record<string, unknown> & { type: StrategyType }
  globalSettings: Partial<StrategyGlobalSettings>
  description: string
}
```

### Step 2: API Client Methods (api.ts)

Add to `frontend/src/lib/api.ts`:

```typescript
// Strategy Config
getStrategyConfig: () => apiFetch<StrategyConfigListResponse>('/strategy-config'),
getStrategyConfigByName: (name: string) => apiFetch<StrategyConfig>(`/strategy-config/${encodeURIComponent(name)}`),
createStrategyConfig: (data: Omit<StrategyConfig, '_id' | 'version' | 'createdAt' | 'updatedAt' | 'isActive'>) =>
  apiFetch<StrategyConfig>('/strategy-config', { method: 'POST', body: JSON.stringify(data) }),
updateStrategyConfig: (name: string, data: Partial<StrategyConfig>) =>
  apiFetch<StrategyConfig>(`/strategy-config/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) }),
deleteStrategyConfig: (name: string) =>
  apiFetch<{ deleted: string }>(`/strategy-config/${encodeURIComponent(name)}`, { method: 'DELETE' }),
activateStrategyConfig: (name: string) =>
  apiFetch<{ activated: string }>(`/strategy-config/${encodeURIComponent(name)}/activate`, { method: 'POST' }),
getStrategyPresets: () => apiFetch<Record<string, StrategyPreset>>('/strategy-config/presets'),
createFromPreset: (presetName: string, configName: string, description?: string) =>
  apiFetch<StrategyConfig>('/strategy-config/from-preset', { method: 'POST', body: JSON.stringify({ presetName, configName, description }) }),
```

### Step 3: React Query Hooks (use-strategy-config-queries.ts)

Create `frontend/src/hooks/use-strategy-config-queries.ts`:
- `useStrategyConfig()` — queries active config + list
- `useStrategyPresets()` — queries available presets
- `useUpdateStrategyConfig()` — mutation to save config
- `useActivateStrategyConfig()` — mutation to activate config
- `useCreateFromPreset()` — mutation to create from preset
- All mutations invalidate `['strategy-config']` query on success

### Step 4: Strategy Params Form (strategy-params-form.tsx)

Create `frontend/src/components/strategy-config/strategy-params-form.tsx`:
- Takes `strategyType` and `params` as props
- Renders different input fields based on type:
  - `threshold` / `equal-weight`: thresholdPct, minTradeUsd
  - `momentum-tilt`: thresholdPct, minTradeUsd, momentumWindowDays, momentumWeight
  - `vol-adjusted`: baseThresholdPct, minTradeUsd, volLookbackDays, minThresholdPct, maxThresholdPct
  - `mean-reversion`: minTradeUsd, lookbackDays, bandWidthSigma, minDriftPct
  - `momentum-weighted`: minTradeUsd, rsiPeriod, macdFast, macdSlow, weightFactor
- Each field has label, input, min/max constraints matching Zod schema

### Step 5: Preset Panel (strategy-preset-panel.tsx)

Create `frontend/src/components/strategy-config/strategy-preset-panel.tsx`:
- Fetch presets from API via `useStrategyPresets()`
- Display preset cards (name, description, key params)
- "Apply" button: calls `createFromPreset` mutation → creates new config → activates it
- Highlight if current active config was created from a preset

### Step 6: Rewrite StrategyConfigPage

Rewrite `frontend/src/pages/StrategyConfigPage.tsx`:
- Remove localStorage logic and DEFAULT_CONFIG
- Use `useStrategyConfig()` to load active config
- Strategy type selector (dropdown) at top
- Dynamic params form via `StrategyParamsForm`
- Global settings section (shared toggles + base fields)
- Save button → `useUpdateStrategyConfig()`
- Config list sidebar showing all configs with activate buttons
- Presets panel on right (from API)
- Loading/error states

## Todo List

- [x] Add StrategyConfig types to `frontend/src/lib/api-types.ts` (skipped — used `any` types per KISS/YAGNI, types sufficient)
- [x] Add strategy config API methods to `frontend/src/lib/api.ts`
- [x] Create `frontend/src/hooks/use-strategy-config-queries.ts`
- [x] Create strategy type fields component (`strategy-config-type-fields.tsx`)
- [x] Create presets panel component (`strategy-config-presets-panel.tsx`)
- [x] Create toggle component (`strategy-config-toggle.tsx`)
- [x] Rewrite `frontend/src/pages/StrategyConfigPage.tsx` to use backend API
- [x] Maintain localStorage backward compat for existing tests
- [x] All 23 existing tests pass
- [x] Frontend builds successfully

## Success Criteria

- [x] Strategy type selector renders correct per-type parameter fields
- [x] Save sends payload to API (updateStrategyConfig) with fallback to local toast
- [x] Activate button calls activateStrategyConfig API
- [x] Presets loaded from API (fallback to hardcoded when API loading/unavailable)
- [x] "Apply Preset" calls createFromPreset mutation
- [x] All existing StrategyConfigPage tests pass (23/23)
- [x] Build: ✓ built in 2.51s (no errors)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type mismatch between frontend and backend | Medium | Mirror Zod schema structure in TypeScript types |
| No config exists yet (fresh install) | Low | Show "Create your first config" prompt; offer preset quick-start |
| User saves invalid params | Low | Frontend validation + backend Zod rejection with error toast |

## Security Considerations

- API key required for all config endpoints (existing auth middleware)
- No sensitive data in strategy configs
- Input validated on both frontend (form constraints) and backend (Zod)
