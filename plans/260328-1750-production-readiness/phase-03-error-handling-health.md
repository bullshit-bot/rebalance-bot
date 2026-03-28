---
title: "Error Handling + Health Monitoring"
description: "Add timeouts to exchange init, enhance health endpoint with memory/last-update info"
status: completed
priority: P2
effort: 1h
---

# Phase 3: Error Handling + Health Monitoring

## Context Links
- [exchange-manager.ts](../../src/exchange/exchange-manager.ts) -- `loadMarkets()` no timeout
- [health-routes.ts](../../src/api/routes/health-routes.ts) -- basic health endpoint

## Overview

Two P2 improvements:
1. `exchangeManager.initialize()` calls `loadMarkets()` with no timeout -- can hang forever if exchange is down
2. Health endpoint only shows uptime + exchange status + trend. Missing: memory usage, last successful price update, system info for debugging

## Related Code Files

### Modify
- `src/exchange/exchange-manager.ts` -- add timeout wrapper around `loadMarkets()`
- `src/api/routes/health-routes.ts` -- add memory, lastPriceUpdate, version info

## Implementation Steps

### Part A: Exchange Timeout

1. **Wrap `loadMarkets()` with timeout** in `exchange-manager.ts`:
   ```ts
   const LOAD_MARKETS_TIMEOUT = 30_000 // 30s

   await Promise.race([
     exchange.loadMarkets(),
     new Promise((_, reject) =>
       setTimeout(() => reject(new Error('loadMarkets timeout')), LOAD_MARKETS_TIMEOUT)
     )
   ])
   ```
   - Existing try/catch around init loop already handles errors gracefully (logs + skips exchange)
   - No structural change needed -- just wrap the one call

2. **Verify existing error handling**: `initialize()` already has try/catch per exchange. Confirm it logs and continues (doesn't throw). Check that failed exchanges don't prevent bot startup.

### Part B: Enhanced Health Endpoint

3. **Extend health response** in `health-routes.ts`:
   ```ts
   {
     status: 'ok',
     uptimeSeconds: ...,
     memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
     version: process.env.npm_package_version || 'unknown',
     lastPriceUpdate: portfolioTracker.getLastUpdateTime(), // need to add getter
     exchanges: ...,
     trendStatus: ...,
   }
   ```

4. **Add `getLastUpdateTime()` to PortfolioTracker**: track `private lastUpdateTime = 0` in portfolio-tracker, set it in recalculate. Expose via getter.

## Todo List

- [x] Add 30s timeout to `loadMarkets()` in exchange-manager
- [x] Add `lastUpdateTime` tracking to portfolio-tracker
- [x] Extend health endpoint with memoryMb, version, lastPriceUpdate
- [x] Verify exchange init error handling doesn't crash bot

## Success Criteria

- [x] Bot starts even if one exchange is unreachable (timeout after 30s, skip, continue)
- [x] `GET /api/health` returns memoryMb, version, and lastPriceUpdate fields
- [x] Health endpoint responds in <100ms

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Timeout too short for slow regions | 30s is generous; configurable via env var if needed |
| Memory info exposes system details | Health endpoint is internal/VPS only, acceptable |
