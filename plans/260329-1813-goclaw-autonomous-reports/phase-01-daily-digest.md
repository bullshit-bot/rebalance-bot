---
title: "Enhanced Daily Portfolio Digest"
status: completed
priority: P1
effort: 2h
---

## Context

Current `marketSummaryService.generateSummary()` only shows:
- Portfolio value change (start/end/delta)
- Trade count + volume

Too basic. User wants full portfolio breakdown every morning.

## Overview

Enhance daily Telegram report with allocation breakdown, drift status, top movers, and trend filter state. Change schedule from 08:00 UTC to 01:00 UTC (= 08:00 VN).

## Requirements

Report should include:
1. **Portfolio Value** — current total, 24h change ($ and %)
2. **Allocation Breakdown** — each asset: quantity, value, current%, target%, drift%
3. **Drift Status** — max drift asset, whether threshold breached
4. **Top Movers** — which asset gained/lost most in 24h (from snapshots)
5. **Trend Filter** — bull/bear status, MA data points count
6. **Trade Activity** — trades executed in 24h (keep existing)

## Related Code Files

- Modify: `src/ai/market-summary-service.ts` — enhance report content
- Modify: `src/scheduler/cron-scheduler.ts` — change schedule to 01:00 UTC
- Read: `src/portfolio/portfolio-tracker.ts` — getPortfolio() for live data
- Read: `src/rebalancer/trend-filter.ts` — isBullishReadOnly(), getDataPoints()

## Implementation Steps

1. Update `cron-scheduler.ts`: change daily summary cron from `0 8 * * *` to `0 1 * * *`
2. Enhance `market-summary-service.ts`:
   - Import `portfolioTracker` and `trendFilter`
   - Add `buildAllocationSection()` — format each asset row
   - Add `buildDriftSection()` — highlight max drift, threshold status
   - Add `buildTrendSection()` — bull/bear + MA info
   - Enhance `buildPortfolioSection()` — add top movers from snapshot comparison
3. Keep report under 4096 chars (Telegram message limit)

## Todo

- [ ] Change cron schedule to 01:00 UTC
- [ ] Add allocation breakdown section
- [ ] Add drift status section
- [ ] Add trend filter section
- [ ] Add top movers from 24h snapshots
- [ ] Test message format fits Telegram limit

## Success Criteria

- Daily report arrives at 08:00 VN with full portfolio breakdown
- Report is readable and actionable on mobile
- Stays under Telegram message char limit
