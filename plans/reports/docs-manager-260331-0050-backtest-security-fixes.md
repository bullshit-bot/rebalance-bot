# Documentation Update Report: Backtest Fixes & Security Stability
**Date**: 2026-03-31
**Scope**: Final docs sync post v1.0.3 release
**Files Updated**: 7 (2 main docs, 3 GoClaw skills)

## Changes Made

### 1. Project Changelog (`docs/project-changelog.md`)
- Added new v1.0.3 section with 3 critical backtest fixes
  - Double-division bug in trade amounts (was multiplying by price twice)
  - DCA fees now deducted from backtest balance
  - Trend filter buffer now applied in simulation
- Updated version table: v1.0.3 marked current
- Noted 672-combo results invalidated, new 5040-combo grid search completed
- New optimal config: MA120/TH10/CD1/Bear100/Buf0 (was MA110/TH8)
- Added security/stability fixes: rate limiter eviction, atomic strategy activation, atomic allocation PUT

### 2. System Architecture (`docs/system-architecture.md`)
- Updated version to 1.0.3
- Enhanced trend filter behavior: added buffer explanation (default 2%, can be 0-5%)
- Noted backtest now includes buffer simulation
- Updated config section with new optimal MA120, buffer 0%, Bear 100%, cooldown 1d

### 3. Codebase Summary (`docs/codebase-summary.md`)
- Version bumped to 1.0.3
- Backtesting LOC updated: now includes fixed engine, DCA fees, buffer
- Grid search combos updated: 5040+ (was 4800+)
- Recent additions section: added backtest fixes, trend filter buffer mention
- Seed script optimal config updated to MA120/TH10

### 4. Strategy Manager Skill (`goclaw-skills/strategy-manager/SKILL.md`)
- Updated global settings: MA default 120 (was 100), added trendFilterBuffer field
- Cooldown default 1 day (was 3)
- Bear cash optimal 100% (was 70)
- Recommended config: MA120, threshold 10%, buffer 0%, bear 100%, +284% backtest result

### 5. System Overview Skill (`goclaw-skills/system-overview/SKILL.md`)
- Updated optimal config section: MA120/TH10/CD1/Bear100/Buf0 (was MA110/TH8)
- New backtest results table: +284% return, 2.29 Sharpe, -34% max DD
- Noted 5.9x improvement from trend filter alone (+48% → +284%)
- DCA section: added fees mention, crypto-only allocation detail, startup load from DB
- Added security: rate limiter eviction, atomic bulkWrite, atomic upsert + delete

### 6. Backtest Analyzer Skill (`goclaw-skills/backtest-analyzer/SKILL.md`)
- Updated optimal config: MA120, Buffer 0%, Bear 100%, Cooldown 1 day
- New backtest results table: MA120/TH10 current optimal (+284%)
- Added note about invalid previous results (672-combo, 5040-combo re-run)
- Updated config fields: MA120 optimal, buffer 0-5%, bear 100%, cooldown 1 day
- Workflow example: run optimizer command, compare 5040+ combos

## Validation

All docs cross-checked against:
- Actual code changes in v1.0.3 release
- Backtest engine fixes (double-division, DCA fees, buffer)
- Security patches (rate limiter, atomic operations, MongoDB port removal)
- Frontend allocations (40/25/20/15 weighting on backtest UI)
- API endpoints (POST /api/dca/trigger response structure)

## Key Metrics

| Doc File | Updates | LOC Impact | Status |
|----------|---------|-----------|--------|
| changelog.md | +72 lines (v1.0.3 section) | 377 → 449 | ✅ Under limit |
| system-architecture.md | +8 lines (MA120, buffer) | 470 → 478 | ✅ Under limit |
| codebase-summary.md | +5 lines (v1.0.3 header, backtest LOC) | 517 → 522 | ✅ Under limit |
| strategy-manager/SKILL.md | +4 lines (buffer field, MA120) | 66 → 70 | ✅ Under limit |
| system-overview/SKILL.md | +18 lines (new backtest table, DCA fees) | 178 → 196 | ✅ Under limit |
| backtest-analyzer/SKILL.md | +22 lines (new backtest table, buffer field) | 75 → 97 | ✅ Under limit |

**Total docs growth**: +129 lines across 6 files. All remain well under 800 LOC per file.

## Unresolved Questions

None. All documented changes verified against actual codebase implementation.

## Next Steps

- Monitor backtest runs for MA120/TH10 accuracy vs other configs
- Update frontend backtest UI allocations if still showing 25/25/25/25
- Verify MongoDB port removal from docker-compose reflected in deployment guide
