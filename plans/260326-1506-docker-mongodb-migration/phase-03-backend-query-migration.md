---
title: "Backend Query Migration"
status: completed
priority: P1
---

## Overview

Refactor all 48 files that import from `src/db/` to use Mongoose queries instead of Drizzle. This is the largest phase — organized by module.

## Context Links

- Current schema: `src/db/schema.ts`
- Phase 2 models: `src/db/models/`

## Key Insights

- Drizzle uses `db.select().from(table).where(eq(...))` → Mongoose uses `Model.find({ field: value })`
- Drizzle `db.insert(table).values({})` → `Model.create({})`
- Drizzle `db.update(table).set({}).where()` → `Model.updateOne({}, {})`
- Drizzle `db.delete(table).where()` → `Model.deleteOne({})`
- Integer booleans (`is_paper: 0/1`) → real booleans in Mongoose
- JSON text fields (`JSON.parse(row.holdings)`) → direct object access in Mongoose
- `sql\`(unixepoch())\`` → `Date.now()` or Mongoose `default: Date.now`

## Query Translation Reference

```typescript
// SELECT
// Drizzle: db.select().from(allocations).where(eq(allocations.exchange, 'binance'))
// Mongoose: AllocationModel.find({ exchange: 'binance' })

// INSERT
// Drizzle: db.insert(trades).values({ pair: 'BTC/USDT', ... })
// Mongoose: TradeModel.create({ pair: 'BTC/USDT', ... })

// UPDATE
// Drizzle: db.update(allocations).set({ targetPct: 50 }).where(eq(allocations.id, 1))
// Mongoose: AllocationModel.updateOne({ _id: id }, { targetPct: 50 })

// DELETE
// Drizzle: db.delete(trades).where(eq(trades.id, 1))
// Mongoose: TradeModel.deleteOne({ _id: id })

// COUNT
// Drizzle: db.select({ count: sql`count(*)` }).from(trades)
// Mongoose: TradeModel.countDocuments({})

// ORDER BY + LIMIT
// Drizzle: db.select().from(snapshots).orderBy(desc(snapshots.createdAt)).limit(10)
// Mongoose: SnapshotModel.find().sort({ createdAt: -1 }).limit(10)
```

## Sub-tasks by Module (48 files)

### Sub-task A: Core Services (6 files)
| File | Models Used |
|------|-------------|
| `src/db/database.ts` | Connection setup |
| `src/index.ts` | DB init on startup |
| `src/portfolio/portfolio-tracker.ts` | Allocation, Snapshot |
| `src/portfolio/snapshot-service.ts` | Snapshot |
| `src/rebalancer/rebalance-engine.ts` | Rebalance, Trade, Allocation |
| `src/executor/order-executor.ts` | Trade |

### Sub-task B: API Routes (7 files)
| File | Models Used |
|------|-------------|
| `src/api/routes/portfolio-routes.ts` | Allocation, Snapshot |
| `src/api/routes/rebalance-routes.ts` | Rebalance, Trade |
| `src/api/routes/config-routes.ts` | ExchangeConfig |
| `src/api/routes/trade-routes.ts` | Trade |
| `src/api/routes/backtest-routes.ts` | BacktestResult, OhlcvCandle |
| `src/api/routes/smart-order-routes.ts` | SmartOrder |
| `src/api/routes/copy-trading-routes.ts` | CopySource, CopySyncLog |

### Sub-task C: Trading Modules (10 files)
| File | Models Used |
|------|-------------|
| `src/executor/paper-trading-engine.ts` | Trade |
| `src/grid/grid-bot-manager.ts` | GridBot, GridOrder |
| `src/grid/grid-executor.ts` | GridBot, GridOrder |
| `src/grid/grid-pnl-tracker.ts` | GridBot, GridOrder |
| `src/twap-vwap/twap-engine.ts` | SmartOrder |
| `src/twap-vwap/vwap-engine.ts` | SmartOrder |
| `src/twap-vwap/slice-scheduler.ts` | SmartOrder |
| `src/twap-vwap/execution-tracker.ts` | SmartOrder |
| `src/copy-trading/copy-trading-manager.ts` | CopySource, CopySyncLog |
| `src/copy-trading/copy-sync-engine.ts` | CopySource, CopySyncLog |

### Sub-task D: Analytics & Backtesting (6 files)
| File | Models Used |
|------|-------------|
| `src/analytics/pnl-calculator.ts` | Trade, Snapshot |
| `src/analytics/fee-tracker.ts` | Trade |
| `src/analytics/tax-reporter.ts` | Trade |
| `src/analytics/equity-curve-builder.ts` | Snapshot, Trade |
| `src/backtesting/backtest-simulator.ts` | BacktestResult |
| `src/backtesting/historical-data-loader.ts` | OhlcvCandle |

### Sub-task E: Integration Tests (19 files)
All `*.integration.test.ts` files need:
- Replace `initDatabase(':memory:')` with in-memory MongoDB or test MongoDB instance
- Create test helper: `setupTestDB()` / `teardownTestDB()`
- Update all Drizzle query assertions to Mongoose

Files:
- `src/portfolio/portfolio-tracker.integration.test.ts`
- `src/portfolio/snapshot-service.integration.test.ts`
- `src/analytics/fee-tracker.integration.test.ts`
- `src/analytics/drawdown-analyzer.integration.test.ts`
- `src/analytics/pnl-calculator.integration.test.ts`
- `src/analytics/tax-reporter.integration.test.ts`
- `src/api/routes/rebalance-routes.integration.test.ts`
- `src/api/routes/backtest-routes.integration.test.ts`
- `src/api/routes/copy-trading-routes.integration.test.ts`
- `src/api/routes/config-routes.integration.test.ts`
- `src/api/routes/portfolio-routes.integration.test.ts`
- `src/grid/grid-executor.integration.test.ts`
- `src/grid/grid-bot-manager.integration.test.ts`
- `src/backtesting/backtest-simulator.integration.test.ts`
- `src/backtesting/historical-data-loader.integration.test.ts`
- `src/twap-vwap/slice-scheduler.integration.test.ts`
- `src/twap-vwap/execution-tracker.integration.test.ts`
- `src/twap-vwap/vwap-engine.integration.test.ts`
- `src/executor/paper-trading-engine.integration.test.ts`
- `src/copy-trading/copy-trading-manager.integration.test.ts`

## Implementation Steps

1. **Create test helper** `src/db/test-helpers.ts`
   - `setupTestDB()` — connect to `mongodb://localhost:27017/rebalance-test`, clear all collections
   - `teardownTestDB()` — drop database, disconnect
   - Use `mongodb-memory-server` for CI (no external MongoDB needed)

2. **Migrate Sub-task A** (core services) first — these are imported by everything else

3. **Migrate Sub-task B** (API routes) — update imports, convert queries

4. **Migrate Sub-task C** (trading modules)

5. **Migrate Sub-task D** (analytics/backtesting)

6. **Migrate Sub-task E** (integration tests) — use test helper, update assertions

7. **Common patterns to search-replace:**
   - `import { db } from '@db/database'` → `import { AllocationModel } from '@db/models'`
   - `import { eq, desc, and, sql } from 'drizzle-orm'` → remove
   - `import * as schema from '@db/schema'` → `import { ... } from '@db/models'`
   - `db.select().from(schema.X)` → `XModel.find()`
   - `db.insert(schema.X).values(data)` → `XModel.create(data)`
   - `JSON.parse(row.fieldName)` → `row.fieldName` (already object in Mongoose)
   - `JSON.stringify(data)` for storage → just pass object directly

## Todo List

- [x] Create `src/db/test-helpers.ts` with `setupTestDB`/`teardownTestDB`
- [x] Install `mongodb-memory-server` as dev dependency
- [x] Migrate core services (Sub-task A — 6 files)
- [x] Migrate API routes (Sub-task B — 7 files)
- [x] Migrate trading modules (Sub-task C — 10 files)
- [x] Migrate analytics & backtesting (Sub-task D — 6 files)
- [x] Migrate integration tests (Sub-task E — 19 files)
- [x] Remove all `drizzle-orm` imports
- [x] Run `bun test` — all tests pass
- [x] Verify no remaining Drizzle imports (`grep -r "drizzle-orm" src/`)

## Success Criteria

- [x] Zero imports from `drizzle-orm` in `src/`
- [x] All 48 files use Mongoose models
- [x] All integration tests pass with MongoDB
- [x] `bun test ./src/` passes with 0 failures
- [x] No `JSON.parse`/`JSON.stringify` for db fields that are now subdocuments

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Query semantics differ | Wrong results | Test each module after migration |
| Missing await on Mongoose ops | Silent failures | Mongoose returns promises; lint for unhandled |
| Boolean conversion (0/1 → bool) | Logic bugs | Search all `=== 0`, `=== 1` checks on db fields |
| mongodb-memory-server size | CI slow | Cache in CI, or use service container |
| Transaction support | Data inconsistency | Mongoose sessions for multi-doc ops (few cases) |
