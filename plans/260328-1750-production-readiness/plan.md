---
title: "Production Readiness Hardening"
description: "Reliability fixes for mainnet deployment — persist MA data, bear rebalance, alerts, error handling"
status: completed
priority: P1
effort: 6h
branch: main
tags: [production, reliability, mainnet]
created: 2026-03-28
---

# Production Readiness Hardening

Personal crypto bot reliability hardening for mainnet use on 8GB VPS.

## Phase Table

| # | Phase | Status |
|---|-------|--------|
| 1 | [Persist MA Data + Bear Rebalance](./phase-01-persist-ma-bear-rebalance.md) | ✅ Completed |
| 2 | [Telegram Alerts](./phase-02-telegram-alerts.md) | ✅ Completed |
| 3 | [Error Handling + Health Monitoring](./phase-03-error-handling-health.md) | ✅ Completed |
| 4 | [Docker Hardening + Mainnet Guide](./phase-04-docker-mainnet-guide.md) | ✅ Completed |

## Key Dependencies

- Phase 1 must complete before Phase 2 (bear/bull signal alert needs persisted trend data)
- Phases 3-4 are independent of each other

## Architecture Notes

- `OhlcvCandleModel` already exists with exchange/pair/timeframe/timestamp/close fields -- reuse for MA persistence
- `RebalanceTrigger` type missing `'trend-filter-bear'` -- must extend
- `TelegramNotifier` already handles 7 event types -- extend with 3 more
- Docker backend already has `restart: unless-stopped` + healthcheck
