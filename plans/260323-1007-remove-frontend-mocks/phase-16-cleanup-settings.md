---
phase: 16
title: Cleanup & Settings
status: completed
priority: low
depends_on: [2,3,4,5,6,7,8,9,10,11,12,13,14,15]
---

# Phase 16: Cleanup & Settings

## Context

After all pages migrated, `mockData.ts` should have zero imports. SettingsPage has local-only toggles — verify if any need backend persistence.

## Implementation Steps

1. Verify zero imports of `mockData.ts` across entire frontend
2. Delete `frontend/src/lib/mockData.ts`
3. Review SettingsPage — check if any settings need backend API
4. Remove any remaining mock-related comments (e.g., "// TODO: replace with real API")
5. Clean up unused type exports from mockData that may have been re-exported
6. Final build check — `npm run build` must pass with zero errors
7. Verify WebSocket integration works for real-time updates

## Todo List

- [x] Verify zero mockData imports (`grep -r "mockData" frontend/src/`)
- [x] Delete `mockData.ts`
- [x] Review SettingsPage for any needed backend calls
- [x] Remove mock-related TODO comments
- [x] Run `npm run build` — verify clean build
- [x] Test all pages load without errors

## Success Criteria

- [x] `mockData.ts` deleted
- [x] Clean build with zero errors
- [x] All 16 pages fetch real data from backend
- [x] No mock data references remain in codebase
