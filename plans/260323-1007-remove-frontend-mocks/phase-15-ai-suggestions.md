---
phase: 15
title: AI Suggestions Page
status: completed
priority: medium
depends_on: [1]
---

# Phase 15: AI Suggestions Page

## Context

AISuggestionsPage imports `AI_SUGGESTIONS` mock. UI-only approve/reject.

Backend endpoints:
- `GET /api/ai/suggestions?status=` — list suggestions
- `PUT /api/ai/suggestion/:id/approve` — approve
- `PUT /api/ai/suggestion/:id/reject` — reject
- `PUT /api/ai/config` — update AI config
- `GET /api/ai/summary` — market summary

## Related Code Files

**Modify:** `frontend/src/pages/AISuggestionsPage.tsx`
**Create:** `frontend/src/hooks/use-ai-queries.ts`

## Implementation Steps

1. Create `use-ai-queries.ts`: `useAISuggestions(status?)`, `useApproveSuggestion()`, `useRejectSuggestion()`, `useAIConfig()`, `useMarketSummary()`
2. Replace mock with query
3. Wire approve/reject buttons to mutations
4. Invalidate suggestions list after approve/reject
5. Add loading/error states

## Todo List

- [x] Create `use-ai-queries.ts`
- [x] Migrate AISuggestionsPage to real data
- [x] Wire approve/reject mutations
- [x] Add loading/error states

## Success Criteria

- [x] Suggestions list shows real AI-generated data
- [x] Approve/reject actions persist to backend
- [x] Zero imports from mockData.ts
