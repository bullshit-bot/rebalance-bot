---
phase: 08
title: Logs & Alerts Pages
status: pending
priority: medium
depends_on: [1]
---

# Phase 08: Logs & Alerts Pages

## Context

- **LogsPage**: imports `LOGS` mock
- **AlertsPage**: imports `ALERTS` mock

Backend: No dedicated logs or alerts endpoints found in routes. Logs may come from WebSocket events. Alerts may be derived from exchange status + rebalance events.

**Options:**
- WebSocket `use-websocket.ts` already exists — wire it for real-time logs
- Build alerts from health/exchange status checks
- If no backend endpoints: use WebSocket for logs, derive alerts from portfolio/exchange state

## Related Code Files

**Modify:**
- `frontend/src/pages/LogsPage.tsx`
- `frontend/src/pages/AlertsPage.tsx`
- `frontend/src/hooks/use-websocket.ts` — activate for real-time data

## Implementation Steps

1. Verify backend log/alert endpoints or WebSocket event types
2. For Logs: connect WebSocket, accumulate log events in state
3. For Alerts: derive from exchange errors, drift thresholds, rebalance failures
4. Add loading/error states
5. Remove mock imports

## Todo List

- [ ] Verify log/alert backend endpoints
- [ ] Wire WebSocket for real-time logs
- [ ] Build alert derivation logic
- [ ] Migrate LogsPage to real data
- [ ] Migrate AlertsPage to real data

## Success Criteria

- [ ] Logs page shows real-time or historical logs
- [ ] Alerts page shows derived alerts from system state
- [ ] Zero imports from mockData.ts
