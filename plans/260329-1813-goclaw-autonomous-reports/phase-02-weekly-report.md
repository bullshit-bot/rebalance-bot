---
title: "Weekly Performance Report"
status: completed
priority: P2
effort: 2h
---

## Context

No weekly summary exists. User wants end-of-week digest comparing performance vs benchmarks.

## Overview

New weekly cron job (Sunday 08:00 VN = 01:00 UTC) that aggregates 7 days of data into a performance report sent via Telegram.

## Requirements

1. **Weekly P&L** — portfolio value start/end of week, $ and % change
2. **Asset Performance** — each asset's individual % change over the week
3. **vs Benchmark** — compare portfolio return vs BTC-only and ETH-only holding
4. **Rebalance History** — how many rebalances triggered, total fees paid
5. **Fee Summary** — total trading fees for the week
6. **Allocation Drift Trend** — average drift over the week (from snapshots)

## Related Code Files

- Create: `src/ai/weekly-report-service.ts` — new service for weekly aggregation
- Modify: `src/scheduler/cron-scheduler.ts` — add weekly cron job
- Read: `src/db/database.ts` — SnapshotModel, TradeModel for historical queries

## Implementation Steps

1. Create `weekly-report-service.ts`:
   - Query snapshots from 7 days ago to now
   - Calculate portfolio P&L from first/last snapshot
   - Query trades for fee summary and rebalance count
   - Calculate per-asset performance from snapshot asset breakdowns
   - Format BTC/ETH benchmark comparison (use price cache or snapshot data)
2. Add to `cron-scheduler.ts`:
   - New cron: `0 1 * * 0` (Sunday 01:00 UTC = 08:00 VN)
   - Wire to `weeklyReportService.generateReport()` → `telegramNotifier.sendMessage()`
3. Add DI interface for testability

## Todo

- [ ] Create weekly-report-service.ts with aggregation logic
- [ ] Add weekly cron job to scheduler
- [ ] Format report for Telegram (HTML, under 4096 chars)
- [ ] Test with sample data

## Success Criteria

- Weekly report arrives every Sunday 08:00 VN
- Shows meaningful performance comparison vs holding BTC/ETH
- Fee tracking helps assess rebalancing cost-effectiveness
