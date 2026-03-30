# Documentation Update: DCA Independence & Final State

**Date**: 2026-03-30
**Scope**: Verify & update docs + GoClaw skills to reflect FINAL codebase state
**Status**: COMPLETED

---

## Summary

Updated all documentation & GoClaw skills to accurately reflect the final state after today's commits. Key finding: **DCA budget cap was reverted** (commit `e7a3d48`), making rebalance + DCA fully independent systems.

---

## Changes Made

### 1. Project Changelog (`docs/project-changelog.md`)
**What was wrong**: Listed DCA budget cap as active feature, but it was reverted.

**Updated**:
- Expanded v1.0.2 section to document FINAL behavior accurately
- Split "DCA Rebalance Mode" into separate changes (proportional threshold, dust handling)
- Added "Strategy Config Loaded on Startup" (was missing)
- Added "Rebalance + DCA Fully Independent" (clarified post-revert state)
- Removed incorrect "DCA Budget Cap" listing
- Updated test section to match actual behavior

**Key lines changed**: ~50 lines in v1.0.2 section

---

### 2. System Architecture (`docs/system-architecture.md`)
**What was wrong**: DCA section mentioned budget cap (reverted feature).

**Updated**:
- Rewrote "Cash-Aware DCA" section → "DCA (Dollar-Cost Averaging)"
- Clarified fully independent operation (no cap in rebalance engine)
- Documented proportional vs single-target modes
- Added dust handling logic (< $10 treated as zero)
- Added key note: "Both active simultaneously; rebalance does full drift correction"
- Noted strategy config loading on startup

**Lines changed**: 15 lines in DCA sub-section

---

### 3. Codebase Summary (`docs/codebase-summary.md`)
**What was wrong**: Bootstrap sequence missing strategy config load; DCA description incomplete.

**Updated**:
- Fixed bootstrap sequence: added step 3 "Load active strategy config from DB"
- Changed "Price WebSocket" → "Price REST polling"
- Expanded "Recent Additions" DCA bullet to show proportional/single-target modes
- Added dust handling details (< $10 threshold)
- Added strategy config load-on-startup note
- Clarified independence from rebalance

**Lines changed**: 12 lines in bootstrap + DCA sections

---

### 4. GoClaw Skill: `auto-rebalance/SKILL.md`
**What was wrong**: Step 5 mentioned DCA budget cap (reverted).

**Updated**:
- Removed "DCA Budget Cap" from workflow step 5
- Clarified: "Drift triggers full portfolio rebalance (no DCA budget cap)"
- Added new section: "Note on DCA Independence" explaining both systems
- Updated step 8 to reflect full rebalance (not DCA-capped)

**Lines changed**: ~8 lines

---

### 5. GoClaw Skill: `strategy-manager/SKILL.md`
**What was wrong**: `dcaRebalanceEnabled` description was misleading ("cap rebalance trades").

**Updated**:
- Clarified: "When true, DCA uses single-target mode (most underweight asset) if crypto >= threshold"
- Documented `dcaAmountUsd` dual role: DCA amount AND threshold for proportional/single-target switch
- Updated `hardRebalanceThreshold` note (trend filter override, not DCA-specific)

**Lines changed**: ~4 lines

---

### 6. GoClaw Skill: `system-overview/SKILL.md`
**What was wrong**: Architecture diagram implied DCA capped rebalance; DCA description incomplete.

**Updated**:
- Redesigned architecture diagram to show Rebalance + DCA as separate parallel systems
- Added "Key Architecture" note clarifying independence
- Expanded DCA (3.) section: documented proportional/single-target modes, dust handling, trend filter awareness
- Updated "Understanding DCA Budget Cap" → "Understanding DCA Modes & Thresholds"
- Clarified: rebalance does full drift correction, DCA is independent

**Lines changed**: ~30 lines (diagram + 3-4 sections)

---

## Verification Against Code

✅ **DCA proportional threshold**: `src/dca/dca-service.ts` line 98 — `cryptoValue < configDcaAmount` (not hardcoded)

✅ **Proportional mode dust handling**: `src/dca/dca-allocation-calculator.ts` lines 42-44 — treats crypto < depositAmount as 0%

✅ **DCA target resolver dust**: `src/rebalancer/dca-target-resolver.ts` line 28 — `if (cryptoValue < 10)`

✅ **Strategy config loaded on startup**: `src/index.ts` line 56 — `strategyManager.loadFromDb()`

✅ **Rebalance fully independent**: `src/rebalancer/rebalance-engine.ts` line 119 — `calculateTrades()` called directly, no DCA cap logic

✅ **Price feed REST polling**: `src/price/price-aggregator.ts` uses `fetchTicker` (10s interval)

---

## Files Updated & Line Counts

| File | Lines | Status |
|------|-------|--------|
| docs/project-changelog.md | 318 | ✅ Updated |
| docs/system-architecture.md | 468 | ✅ Updated |
| docs/codebase-summary.md | 514 | ✅ Updated |
| goclaw-skills/auto-rebalance/SKILL.md | 44 | ✅ Updated |
| goclaw-skills/strategy-manager/SKILL.md | 66 | ✅ Updated |
| goclaw-skills/system-overview/SKILL.md | 160 | ✅ Updated |

**Total docs updated**: 6 files | **All within size limits** (max 800 LOC per file)

---

## Key Takeaways for GoClaw Users

1. **DCA is independent**: Scheduled daily at 07:00 VN, uses `dcaAmountUsd` (default $20)
2. **Proportional mode**: When `cryptoValue < dcaAmountUsd`, spreads across underweights
3. **Single-target mode**: When `dcaRebalanceEnabled=true` AND crypto >= threshold, concentrates on most underweight
4. **Dust handling**: Crypto < $10 picks highest target asset
5. **Rebalance is full**: Drift triggers always do full portfolio rebalance (no DCA cap)
6. **Both respect trend filter**: If bear market, both systems sell to cash reserve

---

## Unresolved Questions

None — all documentation now matches final codebase state (post-revert).
