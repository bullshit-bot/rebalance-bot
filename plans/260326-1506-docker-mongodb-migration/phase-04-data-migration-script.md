---
title: "Data Migration Script"
status: completed
priority: P2
---

## Overview

Create script to export existing SQLite data to JSON, transform types, and seed into MongoDB. Handles 14 tables.

## Context Links

- Current DB: `data/rebalance.db` (SQLite)
- Target: MongoDB `rebalance` database

## Requirements

- Export all 14 SQLite tables to JSON
- Convert data types: integer timestamps → Date, integer booleans → boolean, JSON text → objects
- Import into MongoDB collections via Mongoose models
- Validate record counts match
- Idempotent (safe to re-run)

## Related Code Files

**Create:**
- `scripts/migrate-sqlite-to-mongodb.ts`

## Implementation Steps

1. Create `scripts/migrate-sqlite-to-mongodb.ts`:
   - Read SQLite via `@libsql/client` (keep as dev dep temporarily)
   - For each table: `SELECT * FROM table_name`
   - Transform each row:
     - `integer timestamp` → `new Date(value * 1000)` (unixepoch is seconds)
     - `is_paper: 0|1` → `boolean`
     - `enabled: 0|1` → `boolean`
     - `sandbox: 0|1` → `boolean`
     - JSON text fields → `JSON.parse(value)`
     - `integer id` → let MongoDB assign ObjectId
     - `text id` → keep as `_id` string
   - Insert via `Model.insertMany(transformedRows)`
   - Log count per collection

2. Add npm script: `"migrate": "bun run scripts/migrate-sqlite-to-mongodb.ts"`

3. Validation step: compare source/target counts per table

## Data Type Conversion Map

| SQLite Column Pattern | MongoDB Type | Conversion |
|----------------------|-------------|------------|
| `integer("updated_at")` (unixepoch) | `Date` | `new Date(val * 1000)` |
| `integer("is_paper").default(0)` | `Boolean` | `!!val` |
| `integer("enabled").default(1)` | `Boolean` | `!!val` |
| `integer("sandbox").default(0)` | `Boolean` | `!!val` |
| `text("holdings")` (JSON) | `Object` | `JSON.parse(val)` |
| `text("config")` (JSON) | `Object` | `JSON.parse(val)` |
| `integer("id") autoIncrement` | `ObjectId` | Auto-generated |
| `text("id") primaryKey` | `String _id` | Keep as-is |
| `integer("timestamp")` (unix ms) | `Date` | `new Date(val)` (already ms) |

## Todo List

- [x] Create `scripts/migrate-sqlite-to-mongodb.ts`
- [x] Handle all 14 tables with correct type conversions
- [x] Add validation: compare record counts source vs target
- [x] Add `--dry-run` flag to preview without writing
- [x] Test with sample data
- [x] Document in README migration steps

## Success Criteria

- [x] Script runs without errors on existing SQLite database
- [x] All records migrated with correct types
- [x] Record counts match between SQLite and MongoDB
- [x] Dates are correct (not off by 1000x)
- [x] JSON fields are proper objects, not strings
- [x] Script is idempotent (clears collections before insert)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timestamp precision | Wrong dates | ohlcvCandles uses ms, others use seconds — handle both |
| Null JSON fields | Parse error | Guard with `val ? JSON.parse(val) : null` |
| Large datasets | Memory/timeout | Use batched `insertMany` (1000 docs per batch) |
| Foreign key references | Broken links | Preserve original string IDs as references |
