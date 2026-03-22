---
title: "Phase 3: Advanced Execution"
description: "TWAP/VWAP smart order execution, grid trading bot with auto order placement"
status: completed
priority: P2
effort: 25h
tags: [crypto, execution, grid-trading, phase-3]
created: 2026-03-22
---

# Phase 3: Advanced Execution

## Context

- Master plan: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-core-engine.md) (order executor), [Phase 2](./phase-02-intelligence-analytics.md) (analytics)

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 25h
- **Description**: TWAP/VWAP smart order execution, grid trading bot

## Key Insights

- TWAP/VWAP reduces slippage 0.1-0.5% on large orders — significant for portfolio rebalances
- Grid trading: profitable in sideways markets, complement rebalancing in trending markets
- Both reuse OrderExecutor from Phase 1 (just different order scheduling logic)
- Pionex grid bot is gold standard — our implementation covers core features

## Requirements

### Functional

**TWAP/VWAP:**
- F1: TWAP execution: split large order into N sub-orders over T time period
- F2: VWAP execution: weight sub-orders by volume profile
- F3: Configurable: total amount, duration, number of slices, max slippage
- F4: Real-time progress tracking (% complete, avg fill price, slippage)
- F5: Cancel/pause ongoing TWAP/VWAP execution
- F6: Auto-select TWAP/VWAP for rebalance orders above configurable threshold

**Grid Trading:**
- F7: Create grid bot: asset pair, price range, grid levels, investment amount
- F8: Auto-place limit orders at grid levels (buy below, sell above)
- F9: When order fills → place opposite order at next grid level
- F10: Track grid bot PnL in real-time
- F11: Stop grid bot: cancel all open orders, report final PnL
- F12: Multiple grid bots running simultaneously
- F13: Support: normal grid (spot), reverse grid

### Non-Functional
- NF1: TWAP/VWAP orders survive bot restart (persist state in DB)
- NF2: Grid bot detects and recovers from partially filled orders
- NF3: Grid bot respects exchange minimum order sizes

## Architecture

```
TWAP/VWAP ENGINE
┌─────────────────────────────────────────┐
│  TwapEngine                             │
│    ↓ split order into time-slices       │
│  VwapEngine                             │
│    ↓ weight slices by volume profile    │
│  SliceScheduler                         │
│    ↓ schedule sub-orders via croner     │
│  OrderExecutor (from Phase 1)           │
│    ↓ execute each slice                 │
│  ExecutionTracker                       │
│    ↓ track progress, avg price          │
└─────────────────────────────────────────┘

GRID TRADING ENGINE
┌─────────────────────────────────────────┐
│  GridBotManager                         │
│    ↓ create/stop/list grid bots        │
│  GridCalculator                         │
│    ↓ calculate grid levels + order sizes│
│  GridExecutor                           │
│    ↓ place/monitor grid orders          │
│  OrderExecutor (from Phase 1)           │
│    ↓ execute individual orders          │
│  GridPnLTracker                         │
│    ↓ track realized/unrealized PnL      │
└─────────────────────────────────────────┘
```

## Files to Create

```
src/
├── twap-vwap/
│   ├── twap-engine.ts               # TWAP order splitting
│   ├── vwap-engine.ts               # VWAP volume-weighted splitting
│   ├── slice-scheduler.ts           # Schedule + execute sub-orders
│   └── execution-tracker.ts         # Track progress + metrics
├── grid/
│   ├── grid-bot-manager.ts          # CRUD grid bots
│   ├── grid-calculator.ts           # Calculate levels + sizes
│   ├── grid-executor.ts             # Place + monitor grid orders
│   └── grid-pnl-tracker.ts         # Real-time grid PnL
├── api/routes/
│   ├── twap-vwap-routes.ts          # TWAP/VWAP API
│   └── grid-routes.ts              # Grid bot API
```

## Database Schema (additions)

```sql
-- Active TWAP/VWAP executions
CREATE TABLE smart_orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('twap', 'vwap')),
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  total_amount REAL NOT NULL,
  filled_amount REAL DEFAULT 0,
  avg_price REAL,
  slices_total INTEGER NOT NULL,
  slices_completed INTEGER DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'cancelled')),
  config JSON NOT NULL,
  rebalance_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Grid bot instances
CREATE TABLE grid_bots (
  id TEXT PRIMARY KEY,
  exchange TEXT NOT NULL,
  pair TEXT NOT NULL,
  grid_type TEXT NOT NULL CHECK(grid_type IN ('normal', 'reverse')),
  price_lower REAL NOT NULL,
  price_upper REAL NOT NULL,
  grid_levels INTEGER NOT NULL,
  investment REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'stopped')),
  total_profit REAL DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  config JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stopped_at DATETIME
);

-- Grid orders (individual grid level orders)
CREATE TABLE grid_orders (
  id INTEGER PRIMARY KEY,
  grid_bot_id TEXT NOT NULL REFERENCES grid_bots(id),
  level INTEGER NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open', 'filled', 'cancelled')),
  exchange_order_id TEXT,
  filled_at DATETIME
);
```

## API Endpoints (additions)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/smart-order` | Create TWAP/VWAP order |
| GET | `/api/smart-order/:id` | Get execution progress |
| PUT | `/api/smart-order/:id/pause` | Pause execution |
| PUT | `/api/smart-order/:id/cancel` | Cancel execution |
| GET | `/api/smart-order/active` | List active smart orders |
| POST | `/api/grid` | Create grid bot |
| GET | `/api/grid/:id` | Get grid bot status + PnL |
| PUT | `/api/grid/:id/stop` | Stop grid bot |
| GET | `/api/grid/list` | List all grid bots |

## Implementation Steps

### Step 1: TWAP Engine (5h)
1. Create `src/twap-vwap/twap-engine.ts`
   - Split order: total_amount / slices = amount_per_slice
   - Time interval: duration / slices = interval_per_slice
2. Create `src/twap-vwap/slice-scheduler.ts`
   - Schedule sub-orders using setTimeout/setInterval
   - Persist state to DB (survive restart)
   - On restart: resume from last completed slice
3. Create `src/twap-vwap/execution-tracker.ts`
   - Track: filled amount, avg price, slippage vs market

### Step 2: VWAP Engine (4h)
1. Create `src/twap-vwap/vwap-engine.ts`
   - Fetch volume profile from OHLCV data (Phase 2 data loader)
   - Weight slices: more volume at high-volume periods
   - Example: if volume peaks 9-10 AM, execute 30% of order then
2. Integrate with slice-scheduler (same execution path as TWAP)

### Step 3: Smart Order Integration (2h)
1. Add to RebalanceEngine: if trade amount > threshold → use TWAP/VWAP
2. Configurable threshold (e.g., orders > $500 use TWAP)
3. Add smart_orders DB table + migration

### Step 4: Grid Calculator (4h)
1. Create `src/grid/grid-calculator.ts`
   - Input: price_lower, price_upper, grid_levels, investment
   - Calculate: price at each level, order size per level
   - Geometric or arithmetic grid spacing
2. Create `src/grid/grid-pnl-tracker.ts`
   - Track per-grid profit (buy-sell difference)
   - Calculate total realized + unrealized PnL

### Step 5: Grid Executor (6h)
1. Create `src/grid/grid-executor.ts`
   - Place initial grid orders (limit orders at each level)
   - Monitor via CCXT Pro `watchOrders()` stream
   - On fill: place opposite order at next level
   - Handle partial fills
   - Track exchange order IDs
2. Create `src/grid/grid-bot-manager.ts`
   - Create: validate params → calculate grid → place orders
   - Stop: cancel all open orders → report final PnL
   - List: return all bots with current status

### Step 6: API Routes (4h)
1. Create `src/api/routes/twap-vwap-routes.ts`
2. Create `src/api/routes/grid-routes.ts`
3. Add WebSocket events: smart-order progress, grid fill notifications

## Todo List

- [x] Step 1: TWAP engine (order splitting + scheduling + restart recovery)
- [x] Step 2: VWAP engine (volume-weighted splitting)
- [x] Step 3: Smart order integration with RebalanceEngine
- [x] Step 4: Grid calculator (levels, sizes, PnL tracking)
- [x] Step 5: Grid executor (place, monitor, flip orders)
- [x] Step 6: API routes for smart orders + grid bots

## Success Criteria

- [x] TWAP splits $1000 order into 10 slices over 10 minutes correctly
- [x] VWAP weights slices by volume profile
- [x] Smart order survives bot restart, resumes from last slice
- [x] Grid bot places correct orders at calculated levels
- [x] Grid order fill triggers opposite order placement
- [x] Grid PnL calculation is accurate
- [x] Multiple grid bots run simultaneously without conflict
- [x] All operations work in paper trading mode

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grid order not detected as filled | High | Periodic order status poll as backup to WebSocket |
| TWAP/VWAP interrupted by rebalance | Medium | Lock asset during smart order execution |
| Exchange minimum order size > grid slice | Medium | Validate during grid creation, reject if too small |
| Price moves outside grid range | Low | Alert user, option to auto-expand or stop |
