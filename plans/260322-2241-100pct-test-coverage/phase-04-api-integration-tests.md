---
title: "Phase 4: API & Integration Tests"
description: "Tests for Hono routes, auth middleware, WebSocket handler"
status: completed
priority: P2
effort: 4h
tags: [testing, api, integration]
created: 2026-03-22
---

# Phase 4: API & Integration Tests

## Files to Test (13 files)

### Middleware (1 new test)
- `src/api/middleware/auth-middleware.test.ts` — valid key passes, invalid rejects, timing-safe, rate limiting

### Routes (10 new tests)
- `src/api/routes/health-routes.test.ts` — returns 200 + status
- `src/api/routes/portfolio-routes.test.ts` — GET portfolio, GET history
- `src/api/routes/rebalance-routes.test.ts` — POST trigger, GET preview, GET history
- `src/api/routes/trade-routes.test.ts` — GET trades with filters
- `src/api/routes/config-routes.test.ts` — GET/PUT allocations
- `src/api/routes/backtest-routes.test.ts` — POST run, GET result, GET list
- `src/api/routes/analytics-routes.test.ts` — equity, pnl, drawdown, fees, tax
- `src/api/routes/smart-order-routes.test.ts` — CRUD smart orders
- `src/api/routes/grid-routes.test.ts` — CRUD grid bots
- `src/api/routes/copy-trading-routes.test.ts` — CRUD sources, sync
- `src/api/routes/ai-routes.test.ts` — suggestions, approve/reject

### WebSocket (1 new test)
- `src/api/ws/ws-handler.test.ts` — auth required, message routing, client tracking

### Server (1 new test)
- `src/api/server.test.ts` — all routes mounted, CORS, error handling

## Testing Strategy
- Use Hono's `app.request()` for route testing (no real HTTP server needed)
- Mock service singletons where needed
- Test auth middleware independently
- WebSocket: test upgrade logic + message format

## Todo List
- [x] auth-middleware.test.ts
- [x] health-routes.test.ts
- [x] portfolio-routes.test.ts
- [x] rebalance-routes.test.ts
- [x] trade-routes.test.ts
- [x] config-routes.test.ts
- [x] backtest-routes.test.ts
- [x] analytics-routes.test.ts
- [x] smart-order-routes.test.ts
- [x] grid-routes.test.ts
- [x] copy-trading-routes.test.ts
- [x] ai-routes.test.ts
- [x] ws-handler.test.ts
- [x] server.test.ts
