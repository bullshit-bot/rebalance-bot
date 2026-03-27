# Strategy Configuration Backend Architecture Research

**Date:** March 28, 2026 | **Researcher:** Claude Code | **Status:** Comprehensive analysis complete

---

## Executive Summary

The Strategy Config page needs a persistent backend layer. Currently, it's hardcoded (localStorage, DEFAULT_CONFIG) with no database connection. We need to:

1. **MongoDB schema** for multi-strategy configs with versioning
2. **REST API** for CRUD + preset management
3. **Hot-reload pattern** (singleton + EventBus) to apply changes without restart
4. **Zod validation** schema shared between frontend/backend
5. **Migration path** from current env-based config to database-driven config

---

## 1. Strategy Configuration Schema Design

### Current State Analysis

**Backend:**
- Config stored in `.env` (env vars: `STRATEGY_MODE`, `REBALANCE_THRESHOLD`, `MOMENTUM_WINDOW_DAYS`, etc.)
- Loaded once at startup via `app-config.ts` using `@t3-oss/env-core + Zod`
- `StrategyManager` singleton holds the mode at runtime, can be hot-swapped via `setMode()`
- Four modes: `threshold`, `equal-weight`, `momentum-tilt`, `vol-adjusted`

**Frontend:**
- `StrategyConfigPage.tsx` uses localStorage (in-memory only)
- `DEFAULT_CONFIG` hardcoded with threshold, cooldown, partial factor, toggles
- No backend integration; presets are static (Conservative/Balanced/Aggressive)

### Recommended MongoDB Schema

**Rationale:** Single collection for strategy configs with polymorphic parameters field + versioning.

```typescript
// src/db/models/strategy-config-model.ts
import { Schema, model } from 'mongoose'
import { z } from 'zod'

// ─── Zod Validation (shared frontend/backend) ─────────────────────────────
export const ThresholdStrategySchema = z.object({
  type: z.literal('threshold'),
  thresholdPct: z.number().min(0.1).max(50),
  minTradeUsd: z.number().min(1).max(100000),
  cooldownHours: z.number().min(0.1).max(168),
})

export const MomentumStrategySchema = z.object({
  type: z.literal('momentum-tilt'),
  thresholdPct: z.number().min(0.1).max(50),
  minTradeUsd: z.number().min(1).max(100000),
  cooldownHours: z.number().min(0.1).max(168),
  momentumWindowDays: z.number().min(5).max(365),
  momentumWeight: z.number().min(0).max(1), // 0=pure threshold, 1=pure momentum
})

export const MeanReversionStrategySchema = z.object({
  type: z.literal('mean-reversion'),
  thresholdPct: z.number().min(0.1).max(50),
  minTradeUsd: z.number().min(1).max(100000),
  lookbackDays: z.number().min(5).max(365),
  zScoreThreshold: z.number().min(0.5).max(4),
})

export const VolAdjustedStrategySchema = z.object({
  type: z.literal('vol-adjusted'),
  minTradeUsd: z.number().min(1).max(100000),
  lowVolThreshold: z.number().min(0.1).max(50),
  highVolThreshold: z.number().min(0.1).max(50),
  volatilityWindow: z.number().min(5).max(365),
})

export const RiskParityStrategySchema = z.object({
  type: z.literal('risk-parity'),
  minTradeUsd: z.number().min(1).max(100000),
  volatilityWindow: z.number().min(5).max(365),
  riskTarget: z.number().min(0.1).max(100), // % volatility target
  rebalanceFrequencyDays: z.number().min(1).max(30),
})

// Union of all strategy types
export const StrategyParamsSchema = z.discriminatedUnion('type', [
  ThresholdStrategySchema,
  MomentumStrategySchema,
  MeanReversionStrategySchema,
  VolAdjustedStrategySchema,
  RiskParityStrategySchema,
])

export type StrategyParams = z.infer<typeof StrategyParamsSchema>

// ─── Configuration Document ────────────────────────────────────────────────
export interface IStrategyConfig {
  _id?: string
  name: string // e.g., "Production Config", "Backtest - Aggressive"
  description?: string
  params: StrategyParams
  isActive: boolean // only ONE active config at a time
  globalSettings: {
    baseAsset: string // e.g., "USDT"
    maxDailyVolume: number // $
    partialFactor: number // 0-1: 1.0 = full rebalance, 0.5 = half correction
    dynamicThreshold: boolean
    trendAware: boolean
    feeAware: boolean
    autoExecute: boolean
  }
  presetName?: string // if created from preset
  history: Array<{
    changedAt: Date
    changedBy?: string // user/admin who made change
    changes: Record<string, unknown> // what was modified
  }>
  createdAt: Date
  updatedAt: Date
  version: number // increment on each save
}

const strategyConfigSchema = new Schema<IStrategyConfig>({
  name: { type: String, required: true, unique: true },
  description: String,
  params: { type: Schema.Types.Mixed, required: true }, // JSON validation happens in app layer
  isActive: { type: Boolean, default: false },
  globalSettings: {
    baseAsset: { type: String, default: 'USDT' },
    maxDailyVolume: { type: Number, default: 50000 },
    partialFactor: { type: Number, default: 0.75, min: 0, max: 1 },
    dynamicThreshold: { type: Boolean, default: false },
    trendAware: { type: Boolean, default: false },
    feeAware: { type: Boolean, default: true },
    autoExecute: { type: Boolean, default: false },
  },
  presetName: String,
  history: [{
    changedAt: Date,
    changedBy: String,
    changes: Schema.Types.Mixed,
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
})

// Ensure only one active config
strategyConfigSchema.index({ isActive: 1 }, {
  sparse: true,
  unique: true,
  partialFilterExpression: { isActive: true },
})

// Ensure name is unique for easy lookup
strategyConfigSchema.index({ name: 1 }, { unique: true })

export const StrategyConfigModel = model<IStrategyConfig>('StrategyConfig', strategyConfigSchema)
export type StrategyConfig = IStrategyConfig & { _id: string }
export type NewStrategyConfig = Omit<IStrategyConfig, '_id' | 'createdAt' | 'updatedAt' | 'version'>
```

**Schema Decisions:**
- **Polymorphic params**: `z.discriminatedUnion('type', [...])` for type-safe strategy switching
- **History array**: Track all config changes (audit trail + rollback capability)
- **Unique active index**: Only ONE active config at a time (partial + unique for sparse fields)
- **Global settings**: Common knobs shared across strategies (baseAsset, maxDailyVolume, toggles)
- **Version field**: Increment on each save; useful for cache invalidation (v1 → v2)

### Pre-built Presets

```typescript
// src/db/models/strategy-preset-model.ts (optional separate collection)
// OR store presets in JSON constant at app startup

export const STRATEGY_PRESETS = {
  Conservative: {
    params: {
      type: 'threshold',
      thresholdPct: 8,
      minTradeUsd: 20,
      cooldownHours: 8,
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: 30000,
      partialFactor: 0.5,
      dynamicThreshold: false,
      feeAware: true,
    },
    description: 'Wide threshold, slow rebalance. For low-volatility, long-term portfolios.',
  },
  Balanced: {
    params: {
      type: 'threshold',
      thresholdPct: 5,
      minTradeUsd: 15,
      cooldownHours: 4,
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: 50000,
      partialFactor: 0.75,
      dynamicThreshold: false,
      feeAware: true,
    },
    description: 'Standard configuration. Suitable for most portfolios.',
  },
  Aggressive: {
    params: {
      type: 'threshold',
      thresholdPct: 2,
      minTradeUsd: 10,
      cooldownHours: 1,
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: 100000,
      partialFactor: 1.0,
      dynamicThreshold: true,
      feeAware: true,
    },
    description: 'Tight threshold, fast rebalance. For active traders.',
  },
  MomentumTilt: {
    params: {
      type: 'momentum-tilt',
      thresholdPct: 4,
      minTradeUsd: 15,
      cooldownHours: 2,
      momentumWindowDays: 30,
      momentumWeight: 0.5,
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: 75000,
      partialFactor: 0.8,
      trendAware: true,
      feeAware: true,
    },
    description: 'Blends momentum signals with threshold rebalancing.',
  },
  RiskParity: {
    params: {
      type: 'risk-parity',
      minTradeUsd: 20,
      volatilityWindow: 60,
      riskTarget: 15, // 15% annual volatility
      rebalanceFrequencyDays: 7,
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: 60000,
      partialFactor: 0.75,
      dynamicThreshold: true,
      feeAware: true,
    },
    description: 'Allocates by risk, not capital. Targets constant portfolio volatility.',
  },
}
```

---

## 2. REST API Design Patterns

### Endpoints

```
# Config CRUD
GET    /api/strategy-config              # Get active config + all configs list
GET    /api/strategy-config/:name        # Get specific config by name
POST   /api/strategy-config              # Create new config
PUT    /api/strategy-config/:name        # Update existing config
DELETE /api/strategy-config/:name        # Delete config

# Activation
POST   /api/strategy-config/:name/activate  # Set as active + emit event

# Presets & Templates
GET    /api/strategy-config/presets      # List all presets (from constant)
POST   /api/strategy-config/from-preset  # Create config from preset
POST   /api/strategy-config/:name/clone  # Clone existing config with new name

# History & Validation
GET    /api/strategy-config/:name/history  # Audit trail of changes
POST   /api/strategy-config/:name/validate # Dry-run validation (no save)
```

### Request/Response Examples

```typescript
// POST /api/strategy-config
{
  "name": "My Momentum Config",
  "description": "Aggressive momentum tilt for Q2",
  "params": {
    "type": "momentum-tilt",
    "thresholdPct": 4,
    "minTradeUsd": 15,
    "cooldownHours": 2,
    "momentumWindowDays": 30,
    "momentumWeight": 0.6
  },
  "globalSettings": {
    "baseAsset": "USDT",
    "maxDailyVolume": 75000,
    "partialFactor": 0.8,
    "dynamicThreshold": true,
    "trendAware": true,
    "feeAware": true,
    "autoExecute": false
  }
}

// Response (201)
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "My Momentum Config",
  "description": "Aggressive momentum tilt for Q2",
  "params": { ... },
  "globalSettings": { ... },
  "isActive": false,
  "version": 1,
  "createdAt": "2026-03-28T12:00:00Z",
  "updatedAt": "2026-03-28T12:00:00Z",
  "history": []
}

// GET /api/strategy-config (active config info)
{
  "active": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Production Config",
    "params": { "type": "threshold", "thresholdPct": 5, ... },
    "globalSettings": { ... },
    "isActive": true,
    "version": 3
  },
  "all": [
    { "name": "Production Config", "isActive": true, "version": 3 },
    { "name": "My Momentum Config", "isActive": false, "version": 1 },
    { "name": "Backtest - Aggressive", "isActive": false, "version": 2 }
  ]
}

// POST /api/strategy-config/:name/activate
// Request body: {} (empty, uses :name)
// Response: 200 { "activated": "Production Config", "version": 3 }

// POST /api/strategy-config/from-preset
{
  "presetName": "Aggressive",
  "configName": "My Aggressive Setup",
  "description": "Custom variant of Aggressive preset"
}

// GET /api/strategy-config/:name/history
[
  {
    "version": 3,
    "changedAt": "2026-03-28T11:55:00Z",
    "changedBy": "user@example.com",
    "changes": {
      "params.thresholdPct": { "old": 4, "new": 5 },
      "globalSettings.autoExecute": { "old": false, "new": true }
    }
  },
  ...
]
```

### API Implementation Pattern (Hono)

```typescript
// src/api/routes/strategy-config-routes.ts
import { Hono } from 'hono'
import { StrategyConfigModel } from '@db/database'
import { StrategyParamsSchema } from '@db/models/strategy-config-model'
import { eventBus } from '@events/event-bus'

const strategyConfigRoutes = new Hono()

// Middleware: parse + validate body against Zod schema
async function validateStrategyConfig(c: any) {
  try {
    const body = await c.req.json()
    // Validate params with Zod
    const validated = StrategyParamsSchema.parse(body.params)
    return { ...body, params: validated }
  } catch (err) {
    throw { status: 400, error: `Validation failed: ${err.message}` }
  }
}

// GET /api/strategy-config — active + all list
strategyConfigRoutes.get('/', async (c) => {
  try {
    const active = await StrategyConfigModel.findOne({ isActive: true }).lean()
    const all = await StrategyConfigModel.find().select('name isActive version').lean()
    return c.json({ active, all }, 200)
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// GET /api/strategy-config/:name
strategyConfigRoutes.get('/:name', async (c) => {
  const name = c.req.param('name')
  try {
    const config = await StrategyConfigModel.findOne({ name }).lean()
    if (!config) return c.json({ error: 'Config not found' }, 404)
    return c.json(config, 200)
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// POST /api/strategy-config — create new
strategyConfigRoutes.post('/', async (c) => {
  let body: any
  try {
    body = await c.req.json()
    // Validate params
    const validatedParams = StrategyParamsSchema.parse(body.params)

    const newConfig = new StrategyConfigModel({
      name: body.name,
      description: body.description,
      params: validatedParams,
      globalSettings: body.globalSettings,
      presetName: body.presetName,
      history: [],
    })

    const saved = await newConfig.save()
    return c.json(saved.toObject(), 201)
  } catch (err: any) {
    if (err.code === 11000) { // MongoDB duplicate key
      return c.json({ error: `Config "${body?.name}" already exists` }, 409)
    }
    return c.json({ error: err.message }, 400)
  }
})

// PUT /api/strategy-config/:name — update existing
strategyConfigRoutes.put('/:name', async (c) => {
  const name = c.req.param('name')
  let body: any
  try {
    body = await c.req.json()
    const validatedParams = StrategyParamsSchema.parse(body.params)

    const config = await StrategyConfigModel.findOne({ name })
    if (!config) return c.json({ error: 'Config not found' }, 404)

    // Record changes for history
    const changes: Record<string, unknown> = {}
    if (JSON.stringify(config.params) !== JSON.stringify(validatedParams)) {
      changes.params = { old: config.params, new: validatedParams }
    }
    if (JSON.stringify(config.globalSettings) !== JSON.stringify(body.globalSettings)) {
      changes.globalSettings = { old: config.globalSettings, new: body.globalSettings }
    }

    // Update fields
    config.params = validatedParams
    config.globalSettings = body.globalSettings
    config.description = body.description
    config.version += 1
    config.updatedAt = new Date()

    // Track history
    if (Object.keys(changes).length > 0) {
      config.history.push({
        changedAt: new Date(),
        changedBy: c.req.header('X-User-Id') || 'system',
        changes,
      })
    }

    const saved = await config.save()

    // Emit event if this is the active config
    if (config.isActive) {
      eventBus.emit('strategy-config:updated', { config: saved.toObject(), version: saved.version })
    }

    return c.json(saved.toObject(), 200)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// POST /api/strategy-config/:name/activate
strategyConfigRoutes.post('/:name/activate', async (c) => {
  const name = c.req.param('name')
  try {
    // Deactivate all others
    await StrategyConfigModel.updateMany({ isActive: true }, { isActive: false })

    // Activate this one
    const config = await StrategyConfigModel.findOneAndUpdate(
      { name },
      { isActive: true, updatedAt: new Date() },
      { new: true }
    )

    if (!config) return c.json({ error: 'Config not found' }, 404)

    // Emit event to all listeners
    eventBus.emit('strategy-config:activated', {
      config: config.toObject(),
      version: config.version
    })

    return c.json({ activated: name, version: config.version }, 200)
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// DELETE /api/strategy-config/:name
strategyConfigRoutes.delete('/:name', async (c) => {
  const name = c.req.param('name')
  try {
    const config = await StrategyConfigModel.findOne({ name })
    if (!config) return c.json({ error: 'Config not found' }, 404)

    if (config.isActive) {
      return c.json({ error: 'Cannot delete active config' }, 409)
    }

    await StrategyConfigModel.deleteOne({ name })
    return c.json({ deleted: name }, 200)
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

export { strategyConfigRoutes }
```

---

## 3. Hot-Reload Config Pattern (No Restart Required)

### Current StrategyManager Hot-Swap

The codebase already has `strategyManager.setMode()` for runtime mode switching. We extend this:

```typescript
// src/rebalancer/strategy-config-service.ts (NEW)
import { StrategyConfigModel } from '@db/database'
import type { StrategyConfig } from '@db/models/strategy-config-model'
import { eventBus } from '@events/event-bus'
import { strategyManager } from './strategy-manager'

/**
 * Singleton service that:
 * 1. Loads active config at startup
 * 2. Listens to config:updated events
 * 3. Applies changes to running services
 * 4. Provides getter for current config
 */
class StrategyConfigService {
  private activeConfig: StrategyConfig | null = null
  private version: number = 0

  async initialize() {
    // Load active config on startup
    const config = await StrategyConfigModel.findOne({ isActive: true })
    if (config) {
      this.activeConfig = config.toObject()
      this.version = config.version
      this.applyConfig(config.toObject())
      console.info('[StrategyConfigService] Loaded active config: %s (v%d)', config.name, config.version)
    } else {
      console.warn('[StrategyConfigService] No active config found; using defaults')
    }

    // Listen for config changes from API
    eventBus.on('strategy-config:activated', ({ config, version }) => {
      console.info('[StrategyConfigService] Config activated: %s (v%d)', config.name, version)
      this.activeConfig = config
      this.version = version
      this.applyConfig(config)
    })

    eventBus.on('strategy-config:updated', ({ config, version }) => {
      if (config._id === this.activeConfig?._id) {
        console.info('[StrategyConfigService] Active config updated (v%d → v%d)', this.version, version)
        this.activeConfig = config
        this.version = version
        this.applyConfig(config)
      }
    })
  }

  /**
   * Apply config changes to running services.
   * This is where the magic happens — no restart needed.
   */
  private applyConfig(config: StrategyConfig) {
    const params = config.params

    // Update StrategyManager with new mode
    strategyManager.setMode(params.type)

    // Update individual strategy parameters via specialized methods
    if (params.type === 'momentum-tilt') {
      // e.g., update momentum calculator window
      momentumCalculator.setWindowDays(params.momentumWindowDays)
    }

    if (params.type === 'vol-adjusted') {
      // update volatility thresholds
      volatilityTracker.setHighVolThreshold(params.highVolThreshold)
      volatilityTracker.setLowVolThreshold(params.lowVolThreshold)
    }

    // Update global settings (applied everywhere)
    this.updateGlobalSettings(config.globalSettings)

    // Emit event so UI can update
    eventBus.emit('config-applied', { version: this.version })
  }

  private updateGlobalSettings(settings: IStrategyConfig['globalSettings']) {
    // These would be stored in a GlobalSettingsService or similar
    // For now, example of how to apply them:
    console.debug('[StrategyConfigService] Global settings updated', {
      baseAsset: settings.baseAsset,
      maxDailyVolume: settings.maxDailyVolume,
      partialFactor: settings.partialFactor,
    })
  }

  getActiveConfig(): StrategyConfig | null {
    return this.activeConfig
  }

  getVersion(): number {
    return this.version
  }
}

export const strategyConfigService = new StrategyConfigService()
```

### Event Bus Integration

Add new events to the event map:

```typescript
// src/events/event-bus.ts (additions)
interface EventMap {
  'strategy-config:activated': { config: StrategyConfig; version: number }
  'strategy-config:updated': { config: StrategyConfig; version: number }
  'config-applied': { version: number }
  // ... existing events
}
```

### Startup Initialization

```typescript
// src/index.ts (additions)
import { strategyConfigService } from '@rebalancer/strategy-config-service'

async function main() {
  // ... existing setup

  // Initialize strategy config service (loads from DB, listens for changes)
  await strategyConfigService.initialize()

  // ... rest of startup
}
```

**Key points:**
- **No restart needed**: Config changes applied immediately via EventBus
- **Version tracking**: Every change increments version; allows cache invalidation
- **Audit trail**: All changes logged in `history` array
- **Fallback**: If no active config, use env defaults (backward compatible)

---

## 4. Frontend Integration Patterns (React Query)

### Shared Zod Schema

```typescript
// src/schemas/strategy-schema.ts (shared between frontend/backend)
import { z } from 'zod'

export const StrategyParamsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('threshold'),
    thresholdPct: z.number().min(0.1).max(50),
    minTradeUsd: z.number().min(1).max(100000),
    cooldownHours: z.number().min(0.1).max(168),
  }),
  z.object({
    type: z.literal('momentum-tilt'),
    thresholdPct: z.number().min(0.1).max(50),
    minTradeUsd: z.number().min(1).max(100000),
    cooldownHours: z.number().min(0.1).max(168),
    momentumWindowDays: z.number().min(5).max(365),
    momentumWeight: z.number().min(0).max(1),
  }),
  // ... other strategies
])

export type StrategyParams = z.infer<typeof StrategyParamsSchema>
```

### React Query Hooks

```typescript
// frontend/src/hooks/use-strategy-config.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StrategyParamsSchema, type StrategyParams } from '@/schemas/strategy-schema'

export function useStrategyConfig() {
  return useQuery({
    queryKey: ['strategy-config'],
    queryFn: async () => {
      const res = await fetch('/api/strategy-config')
      if (!res.ok) throw new Error('Failed to fetch strategy config')
      return res.json()
    },
    staleTime: 10 * 1000, // 10s
    refetchInterval: 30 * 1000, // poll every 30s for external changes
  })
}

export function useStrategyConfigByName(name: string) {
  return useQuery({
    queryKey: ['strategy-config', name],
    queryFn: async () => {
      const res = await fetch(`/api/strategy-config/${name}`)
      if (!res.ok) throw new Error('Config not found')
      return res.json()
    },
  })
}

export function useCreateStrategyConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: {
      name: string
      description?: string
      params: StrategyParams
      globalSettings: Record<string, unknown>
    }) => {
      // Validate params client-side
      const validated = StrategyParamsSchema.parse(config.params)

      const res = await fetch('/api/strategy-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, params: validated }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create config')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-config'] })
    },
  })
}

export function useActivateStrategyConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/strategy-config/${name}/activate`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to activate config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-config'] })
    },
  })
}

export function useUpdateStrategyConfig(name: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: {
      description?: string
      params?: Partial<StrategyParams>
      globalSettings?: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/strategy-config/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error('Failed to update config')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-config'] })
    },
  })
}

export function useStrategyPresets() {
  return useQuery({
    queryKey: ['strategy-presets'],
    queryFn: async () => {
      const res = await fetch('/api/strategy-config/presets')
      if (!res.ok) throw new Error('Failed to fetch presets')
      return res.json()
    },
  })
}

export function useApplyPreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { presetName: string; configName: string }) => {
      const res = await fetch('/api/strategy-config/from-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('Failed to create config from preset')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-config'] })
    },
  })
}
```

### Updated StrategyConfigPage

```typescript
// frontend/src/pages/StrategyConfigPage.tsx (refactored)
import { useState } from 'react'
import { toast } from 'sonner'
import { PageTitle, SectionTitle } from '@/components/ui-brutal'
import { useStrategyConfig, useUpdateStrategyConfig, useActivateStrategyConfig } from '@/hooks/use-strategy-config'
import type { StrategyParams } from '@/schemas/strategy-schema'

export default function StrategyConfigPage() {
  const { data, isLoading, error } = useStrategyConfig()
  const updateMutation = useUpdateStrategyConfig(data?.active?.name)
  const activateMutation = useActivateStrategyConfig()

  const [isEditing, setIsEditing] = useState(false)
  const [editedParams, setEditedParams] = useState<StrategyParams | null>(null)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data?.active) return <div>No active config</div>

  const activeConfig = data.active
  const globalSettings = activeConfig.globalSettings

  const handleSave = async () => {
    if (!editedParams) return

    try {
      await updateMutation.mutateAsync({
        params: editedParams,
        globalSettings,
      })
      toast.success('Config updated')
      setIsEditing(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleActivate = async (configName: string) => {
    try {
      await activateMutation.mutateAsync(configName)
      toast.success(`Activated: ${configName}`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <PageTitle>Strategy Config</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Active Config Editor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="brutal-card">
            <SectionTitle>
              {activeConfig.name} (v{activeConfig.version})
            </SectionTitle>

            {/* Strategy Type Selector */}
            <div className="mb-4">
              <label className="stat-label mb-2 block">Strategy Type</label>
              <select
                className="brutal-input w-full"
                value={editedParams?.type || activeConfig.params.type}
                onChange={(e) => {
                  // Handle type change with type-specific defaults
                  const newType = e.target.value as StrategyParams['type']
                  // ... set editedParams to new strategy type with defaults
                }}
              >
                <option value="threshold">Threshold</option>
                <option value="momentum-tilt">Momentum Tilt</option>
                <option value="mean-reversion">Mean Reversion</option>
                <option value="vol-adjusted">Vol-Adjusted</option>
                <option value="risk-parity">Risk Parity</option>
              </select>
            </div>

            {/* Strategy-Specific Params */}
            <div className="space-y-3">
              {activeConfig.params.type === 'threshold' && (
                <>
                  <div>
                    <label className="stat-label mb-1 block">Threshold %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      className="brutal-input w-full"
                      value={editedParams?.thresholdPct || activeConfig.params.thresholdPct}
                      onChange={(e) => setEditedParams({ ...editedParams, thresholdPct: Number(e.target.value) })}
                    />
                  </div>
                  {/* ... other threshold params */}
                </>
              )}
              {/* ... other strategy type UIs */}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} className="brutal-btn-primary">Save</button>
              <button onClick={() => setIsEditing(false)} className="brutal-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>

        {/* Config List & Presets */}
        <div className="lg:col-span-5 space-y-4">
          <div className="brutal-card">
            <SectionTitle>Saved Configs</SectionTitle>
            <div className="space-y-2">
              {data.all.map((config: any) => (
                <button
                  key={config.name}
                  onClick={() => handleActivate(config.name)}
                  className={`w-full text-left p-3 rounded-md border-[2px] transition-all ${
                    config.isActive
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-foreground/20 hover:bg-secondary'
                  }`}
                >
                  <div className="font-bold text-sm">{config.name}</div>
                  <div className="text-xs text-muted-foreground">v{config.version}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 5. Migration Path from Current Hardcoded Config

### Phase 1: Parallel Running (0 downtime)

1. **Deploy schema + API routes** (new code, backward compatible)
2. **Keep using env vars** (old behavior unchanged)
3. **Set one default config in DB** to match current `.env`
4. **Seed presets** (Conservative, Balanced, Aggressive)

### Phase 2: Switch to Database

1. **Load active config from DB** if it exists (StrategyConfigService.initialize())
2. **Fall back to env vars** if no active config (safety net)
3. **Update UI** to CRUD configs instead of localStorage
4. **Remove localStorage**, fetch from API

### Phase 3: Cleanup

1. Remove env var-based strategy config (keep API_KEY, ENCRYPTION_KEY, DATABASE_URL)
2. Migrate any existing user overrides to configs in DB
3. Document the new flow in README/docs

### Step-by-step Migration Script

```typescript
// scripts/migrate-strategy-config.ts
import { connectDB, StrategyConfigModel } from '@db/database'
import { env } from '@config/app-config'
import { STRATEGY_PRESETS } from '@db/models/strategy-config-model'

async function main() {
  await connectDB()

  // 1. Create default config from current .env
  const defaultConfig = {
    name: 'Default',
    description: 'Migrated from .env',
    params: {
      type: env.STRATEGY_MODE,
      thresholdPct: env.REBALANCE_THRESHOLD,
      minTradeUsd: env.MIN_TRADE_USD,
      cooldownHours: env.REBALANCE_COOLDOWN_HOURS,
      // ... fill in other params based on env vars
    },
    globalSettings: {
      baseAsset: 'USDT',
      maxDailyVolume: env.MAX_TRADE_USD * 10,
      partialFactor: 0.75,
      dynamicThreshold: false,
      feeAware: true,
      autoExecute: false,
    },
    isActive: true,
  }

  const existing = await StrategyConfigModel.findOne({ name: 'Default' })
  if (!existing) {
    await StrategyConfigModel.create(defaultConfig)
    console.log('✓ Created default config from .env')
  }

  // 2. Create presets
  for (const [presetName, presetData] of Object.entries(STRATEGY_PRESETS)) {
    const exists = await StrategyConfigModel.findOne({ name: presetName })
    if (!exists) {
      await StrategyConfigModel.create({
        name: presetName,
        description: presetData.description,
        params: presetData.params,
        globalSettings: presetData.globalSettings,
        presetName,
        isActive: false,
      })
      console.log(`✓ Created preset: ${presetName}`)
    }
  }

  console.log('Migration complete!')
}

main().catch(console.error)
```

---

## 6. Comparison: Design Alternatives

| Aspect | **Recommended** | **Alternative** | **Trade-offs** |
|--------|-----------------|-----------------|---|
| **Schema** | Single poly collection + `params` field | Separate collection per strategy | Simpler schema per type, but harder to query across types; harder to add new strategies |
| **Presets** | JSON constant (STRATEGY_PRESETS) | Separate "presets" collection | Presets always available, no DB lookup; but less flexible if presets need DB history |
| **Hot-reload** | EventBus + singleton service | Polling (check DB every 5s) | Zero-latency changes; but slight memory overhead for listener. Polling is simpler but adds latency |
| **History** | Array in document | Separate audit log collection | Compact, one query per config; but large arrays degrade over time. Separate collection is more scalable |
| **Activation** | Unique partial index (only 1 active) | Field in separate table | Enforces constraint at DB level; but more complex queries. Separate table easier to index |
| **Validation** | Zod (shared FE/BE) | JSON Schema in DB + runtime validation | Type-safe, same schema everywhere; but larger bundle. JSON Schema is lighter but less type-safe |

---

## 7. Specific Recommendations for Your Stack

### Use Mongoose? Or Drizzle?

**README says**: Currently using **Drizzle ORM + SQLite** for trades/allocations.

**Your allocation-model.ts uses**: **Mongoose** (MongoDB).

**Recommendation:** Stick with **Mongoose** since you already have it set up. The schema examples above are Mongoose.

### Environment-Based Defaults

Keep in `.env.example`:
```bash
# Legacy config (fallback if no DB config active)
STRATEGY_MODE=threshold
REBALANCE_THRESHOLD=5
REBALANCE_COOLDOWN_HOURS=1
MIN_TRADE_USD=10
MAX_TRADE_USD=5000
```

These are only used if `StrategyConfigService` finds no active config.

### WebSocket Real-time Sync

Optional: Add WebSocket event for config changes:

```typescript
// src/api/ws/ws-handler.ts (additions)
eventBus.on('strategy-config:activated', (data) => {
  // Broadcast to all connected clients
  broadcast({
    type: 'strategy-config:activated',
    payload: data,
  })
})
```

Frontend can optionally subscribe:
```typescript
// frontend/src/hooks/use-strategy-config-ws.ts
useEffect(() => {
  ws.subscribe('strategy-config:activated', (data) => {
    queryClient.setQueryData(['strategy-config'], data)
  })
}, [])
```

---

## Unresolved Questions

1. **Multiple users/accounts?** If so, add `userId` field to StrategyConfig schema and scope queries
2. **Config validation rules?** Should some params (e.g., momentumWeight) be incompatible with others?
3. **Audit trail retention?** Keep all history forever or archive old entries?
4. **A/B testing support?** Should we support multiple active configs, each with a weight (e.g., 70% Config A, 30% Config B)?
5. **Backtesting integration?** Should backtest jobs specify which config to use, or always use active?
