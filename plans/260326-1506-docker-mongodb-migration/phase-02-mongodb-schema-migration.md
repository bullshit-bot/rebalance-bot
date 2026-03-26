---
title: "MongoDB Schema Migration"
status: completed
priority: P1
---

## Overview

Convert 14 Drizzle SQLite table schemas to Mongoose document schemas. Install Mongoose, create new `src/db/` module with connection + models. Preserve existing TypeScript types.

## Context Links

- [MongoDB ODM Report](../reports/researcher-260326-1512-mongodb-odm-comparison.md)
- Current schema: `src/db/schema.ts` (316 lines, 14 tables)
- Current DB init: `src/db/database.ts`

## Key Insights

- Drizzle uses `InferSelectModel`/`InferInsertModel` for types — Mongoose can infer types from schema too
- JSON-serialized text columns (`holdings`, `config`, `trades` etc.) should become embedded subdocuments or `Schema.Types.Mixed`
- Integer timestamps (`unixepoch()`) should become `Date` fields with `default: Date.now`
- SQLite autoincrement IDs → MongoDB `_id` (ObjectId) for most tables; some use text IDs (keep as string `_id`)
- Unique indexes map directly to Mongoose `unique: true` or compound index definitions

## Requirements

**Functional:**
- 14 Mongoose schemas matching current Drizzle table definitions
- TypeScript types exported: `Allocation`, `Trade`, `Rebalance`, etc.
- MongoDB connection singleton similar to current `db` export
- Indexes match current SQLite indexes

**Non-functional:**
- Schema files < 200 lines each — split by domain if needed
- Connection handles reconnection gracefully

## Schema Mapping (14 tables → 14 collections)

| Drizzle Table | Mongoose Model | ID Strategy | Notes |
|---------------|---------------|-------------|-------|
| `allocations` | `Allocation` | ObjectId | unique index on [asset, exchange] |
| `snapshots` | `Snapshot` | ObjectId | `holdings`/`allocations` → Mixed |
| `trades` | `Trade` | ObjectId | index on rebalanceId |
| `rebalances` | `Rebalance` | String `_id` | `beforeState`/`afterState` → Mixed |
| `exchangeConfigs` | `ExchangeConfig` | ObjectId | unique on `name` |
| `ohlcvCandles` | `OhlcvCandle` | ObjectId | compound unique index |
| `backtestResults` | `BacktestResult` | String `_id` | `config`/`metrics`/`trades`/`benchmark` → Mixed |
| `smartOrders` | `SmartOrder` | String `_id` | `config` → Mixed |
| `gridBots` | `GridBot` | String `_id` | `config` → Mixed |
| `gridOrders` | `GridOrder` | ObjectId | |
| `aiSuggestions` | `AISuggestion` | String `_id` | `suggestedAllocations`/`sentimentData` → Mixed |
| `copySources` | `CopySource` | String `_id` | `allocations` → Mixed |
| `copySyncLog` | `CopySyncLog` | ObjectId | |

## Related Code Files

**Create:**
- `src/db/connection.ts` — Mongoose connection singleton
- `src/db/models/allocation-model.ts`
- `src/db/models/snapshot-model.ts`
- `src/db/models/trade-model.ts`
- `src/db/models/rebalance-model.ts`
- `src/db/models/exchange-config-model.ts`
- `src/db/models/ohlcv-candle-model.ts`
- `src/db/models/backtest-result-model.ts`
- `src/db/models/smart-order-model.ts`
- `src/db/models/grid-bot-model.ts`
- `src/db/models/grid-order-model.ts`
- `src/db/models/ai-suggestion-model.ts`
- `src/db/models/copy-source-model.ts`
- `src/db/models/copy-sync-log-model.ts`
- `src/db/models/index.ts` — barrel export

**Modify:**
- `src/db/database.ts` — replace Drizzle init with Mongoose connection
- `package.json` — add `mongoose`, remove `drizzle-orm`, `@libsql/client`

**Delete (Phase 6):**
- `src/db/schema.ts` — after all imports migrated
- `drizzle.config.ts`

## Implementation Steps

1. Install dependencies
   ```bash
   bun add mongoose
   bun remove drizzle-orm drizzle-kit @libsql/client
   ```

2. Create `src/db/connection.ts`
   ```typescript
   import mongoose from 'mongoose'

   const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/rebalance'

   export async function connectDB(): Promise<typeof mongoose> {
     return mongoose.connect(MONGODB_URI)
   }

   export { mongoose }
   ```

3. Create model files (one per collection). Example for `allocation-model.ts`:
   ```typescript
   import { Schema, model } from 'mongoose'

   export interface IAllocation {
     asset: string
     targetPct: number
     exchange?: string | null
     minTradeUsd: number
     updatedAt: Date
   }

   const allocationSchema = new Schema<IAllocation>({
     asset: { type: String, required: true },
     targetPct: { type: Number, required: true },
     exchange: { type: String, default: null },
     minTradeUsd: { type: Number, default: 10 },
     updatedAt: { type: Date, default: Date.now },
   })

   allocationSchema.index({ asset: 1, exchange: 1 }, { unique: true })

   export const AllocationModel = model<IAllocation>('Allocation', allocationSchema)
   export type Allocation = IAllocation & { _id: string }
   ```

4. Create barrel `src/db/models/index.ts` — re-export all models + types

5. Update `src/db/database.ts` — export `connectDB` and all models, keep backward-compatible `db` export pattern

6. Type conversion rules:
   - `integer("id").primaryKey({ autoIncrement: true })` → ObjectId `_id`
   - `text("id").primaryKey()` → `{ type: String, required: true }` as `_id`
   - `real()` → `Number`
   - `text()` → `String`
   - `integer().default(0)` → `{ type: Number, default: 0 }`
   - `integer("enabled").default(1)` → `{ type: Boolean, default: true }`
   - `integer("timestamp")` (unix epoch) → `{ type: Date }`
   - `text("config")` (JSON blob) → `{ type: Schema.Types.Mixed }`
   - `text("side", { enum: [...] })` → `{ type: String, enum: [...] }`

## Todo List

- [x] Install `mongoose`, remove Drizzle deps from `package.json`
- [x] Create `src/db/connection.ts`
- [x] Create `src/db/models/allocation-model.ts`
- [x] Create `src/db/models/snapshot-model.ts`
- [x] Create `src/db/models/trade-model.ts`
- [x] Create `src/db/models/rebalance-model.ts`
- [x] Create `src/db/models/exchange-config-model.ts`
- [x] Create `src/db/models/ohlcv-candle-model.ts`
- [x] Create `src/db/models/backtest-result-model.ts`
- [x] Create `src/db/models/smart-order-model.ts`
- [x] Create `src/db/models/grid-bot-model.ts`
- [x] Create `src/db/models/grid-order-model.ts`
- [x] Create `src/db/models/ai-suggestion-model.ts`
- [x] Create `src/db/models/copy-source-model.ts`
- [x] Create `src/db/models/copy-sync-log-model.ts`
- [x] Create `src/db/models/index.ts` barrel export
- [x] Update `src/db/database.ts` with Mongoose connection
- [x] Verify all TypeScript types compile
- [x] Verify indexes match current Drizzle indexes

## Success Criteria

- [x] All 14 Mongoose models compile without errors
- [x] Types are backward-compatible (same field names consumers expect)
- [x] `connectDB()` connects to MongoDB successfully
- [x] Indexes created match current SQLite indexes
- [x] `bun run build` succeeds with new schemas

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type mismatches | Runtime errors | Use strict TS; test model creation |
| JSON blob fields | Data loss | Map to `Schema.Types.Mixed`; validate in migration |
| Boolean vs integer | Logic bugs | SQLite uses 0/1, Mongoose uses true/false — update all checks |
| Missing indexes | Performance | Audit all Drizzle indexes before conversion |

## Security Considerations

- `exchangeConfigs` stores encrypted API keys — schema unchanged, still encrypted text
- MongoDB auth credentials in env vars only
