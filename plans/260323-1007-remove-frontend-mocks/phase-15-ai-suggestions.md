---
phase: 15
title: AI Suggestions Page
status: pending
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

- [ ] Create `use-ai-queries.ts`
- [ ] Migrate AISuggestionsPage to real data
- [ ] Wire approve/reject mutations
- [ ] Add loading/error states

## Success Criteria

- [ ] Suggestions list shows real AI-generated data
- [ ] Approve/reject actions persist to backend
- [ ] Zero imports from mockData.ts
