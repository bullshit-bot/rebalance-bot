---
status: pending
priority: P2
effort: 1h
depends_on: [phase-01, phase-02, phase-03]
---

## Context Links

- [System architecture](../../docs/system-architecture.md)
- [Deployment guide](../../docs/deployment-guide.md)
- [Codebase summary](../../docs/codebase-summary.md)
- [Project roadmap](../../docs/project-roadmap.md)

## Overview

Update all outdated docs to reflect completed work: strategy implementations, trend filter, DCA+cash reserve, backtest enhancements. Mark both predecessor plans as completed.

## Requirements

Update these docs with current state after Phases 1-3 are done.

## Related Code Files

**Modify:**
- `docs/system-architecture.md`
- `docs/deployment-guide.md`
- `docs/codebase-summary.md`
- `docs/project-roadmap.md`
- `plans/260328-0014-advanced-strategy-config/plan.md` — mark completed
- `plans/260328-1638-cash-aware-dca-rebalancing/plan.md` — mark completed

## Implementation Steps

### Step 1: Update system-architecture.md

Add/update sections for:
- **Strategy Pipeline**: StrategyManager -> MeanReversion / VolAdjusted / MomentumWeighted dispatch
- **Trend Filter**: TrendFilter -> DriftDetector -> RebalanceEngine bear-mode flow
- **DCA Routing**: DCAService -> targeted buy of most underweight asset
- **Cash Reserve**: trade-calculator cashReservePct override
- Update architecture diagram to show trend filter in the rebalancer layer

### Step 2: Update deployment-guide.md

- Add new env vars if any (trendFilterCooldownDays is in GlobalSettings, not env — note this)
- Document MongoDB collections used by TrendFilter (ohlcv candles with `exchange: 'trend-filter'`)
- Note: strategy configs stored in `strategy_configs` collection

### Step 3: Update codebase-summary.md

- Add new files created in Phases 1-3 to directory listing
- Update module descriptions for: `src/rebalancer/strategies/`, `src/backtesting/`, `src/dca/`
- Add test file counts

### Step 4: Update project-roadmap.md

- Mark "Advanced Strategy Config" as completed
- Mark "Cash-Aware DCA Rebalancing" as completed
- Mark "Trend Filter Integration" as completed
- Add next priorities if applicable

### Step 5: Mark predecessor plans completed

- `plans/260328-0014-advanced-strategy-config/plan.md`: set frontmatter `status: completed`, update phase table
- `plans/260328-1638-cash-aware-dca-rebalancing/plan.md`: set frontmatter `status: completed`, update phase table

## Todo List

- [ ] Update system-architecture.md with strategy pipeline + trend filter flow
- [ ] Update deployment-guide.md with new collections and config notes
- [ ] Update codebase-summary.md with new files and modules
- [ ] Update project-roadmap.md with completion status
- [ ] Mark advanced-strategy-config plan as completed
- [ ] Mark cash-aware-dca-rebalancing plan as completed

## Success Criteria

- [ ] All 4 docs updated with accurate current state
- [ ] Both predecessor plan.md files have `status: completed` and all phases marked done
- [ ] No stale references to incomplete features in docs
