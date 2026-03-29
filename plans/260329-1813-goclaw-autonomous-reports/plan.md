---
title: "GoClaw Autonomous Reports & Actions"
description: "Make GoClaw useful: scheduled Telegram reports, AI market insights, autonomous drift response"
status: completed
completed: 2026-03-29
priority: P1
effort: 8h
branch: main
tags: [goclaw, telegram, cron, ai, autonomous]
created: 2026-03-29
---

## Overview

GoClaw has 8 AI skills and 28 MCP tools but sits idle. Wire it into the system with:
- Enhanced daily/weekly Telegram reports
- AI-powered market insights on schedule
- Autonomous drift response (analyze + rebalance + report)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Enhanced Daily Portfolio Digest](./phase-01-daily-digest.md) | ✅ Completed |
| 2 | [Weekly Performance Report](./phase-02-weekly-report.md) | ✅ Completed |
| 3 | [GoClaw AI Scheduled Insights](./phase-03-goclaw-ai-insights.md) | ✅ Completed |
| 4 | [Autonomous Drift Response](./phase-04-autonomous-drift.md) | ✅ Completed |

## Dependencies

```
Phase 1 ──┐
           ├──> Phase 3 (needs enhanced data gathering)
Phase 2 ──┘
Phase 3 ──> Phase 4 (needs GoClaw integration working)
```

## Key Decisions

- Daily report: 01:00 UTC = 08:00 VN
- Weekly report: Sunday 01:00 UTC
- GoClaw: Full autonomous mode — auto-rebalance on drift + report to Telegram
- All notifications routed through GoClaw (backend Grammy removed)
- GoClaw Telegram channel enabled on VPS
- 3 GoClaw cron jobs: daily report, weekly report, 12h AI insights
