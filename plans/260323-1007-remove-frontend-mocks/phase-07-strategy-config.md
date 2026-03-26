---
phase: 07
title: Strategy Config Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 07: Strategy Config Page

## Context

StrategyConfigPage imports `STRATEGY_CONFIG` mock. Also has hardcoded `PRESETS` array.

Backend: No dedicated strategy config endpoint found in routes. Strategy config may be managed via env vars or a config file on backend. Need to verify.

**Fallback:** If no backend endpoint, keep config as local state but persist to localStorage. Flag for future backend endpoint.

## Related Code Files

**Modify:** `frontend/src/pages/StrategyConfigPage.tsx`

## Implementation Steps

1. Check backend for strategy config endpoint
2. If exists: create hook and wire up
3. If not: use localStorage persistence as intermediate solution, mark TODO
4. Remove STRATEGY_CONFIG mock import either way

## Todo List

- [x] Verify strategy config backend endpoint
- [x] Create hook or localStorage fallback
- [x] Migrate StrategyConfigPage away from mock
- [x] Add loading/error states if using API

## Success Criteria

- [x] Config page reads/saves settings (API or localStorage)
- [x] Zero imports from mockData.ts
