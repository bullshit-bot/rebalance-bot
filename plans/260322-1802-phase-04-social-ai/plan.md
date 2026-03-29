---
title: "Phase 4: Social & AI"
description: "OpenClaw AI market intelligence, copy trading with portfolio sync"
status: completed
priority: P2
effort: 25h
tags: [crypto, ai, openclaw, copy-trading, phase-4]
created: 2026-03-22
---

# Phase 4: Social & AI

## Context

- Master plan: [plan.md](./plan.md)
- Depends on: [Phase 1](./phase-01-core-engine.md), [Phase 2](./phase-02-intelligence-analytics.md)
- [OpenClaw Research](../reports/research-260322-1802-openclaw.md)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Implementation | ✅ Completed |

## Overview

- **Priority**: P2
- **Status**: Pending
- **Effort**: 25h
- **Description**: OpenClaw AI market intelligence integration, copy trading system

## Key Insights

- OpenClaw = local-first AI agent platform, NOT a trading library
- Hybrid approach: OpenClaw for analysis/alerts, rebalance-bot for execution
- Copy trading for personal use = follow public strategies/allocations, not a marketplace
- OpenClaw skills are Markdown-based, easy to create custom crypto skills
- Human-in-the-loop by default — can auto-approve for trusted signals

## Requirements

### Functional

**OpenClaw AI Intelligence:**
- F1: OpenClaw skill reads crypto news (CoinDesk, CoinTelegraph, on-chain data)
- F2: AI analyzes market sentiment per tracked asset
- F3: AI generates allocation adjustment suggestions with reasoning
- F4: Suggestions sent via Telegram for user approval
- F5: Approved suggestions auto-update target allocations in bot
- F6: Configurable: full-auto (no approval needed) or human-in-the-loop
- F7: Daily market summary report via Telegram
- F8: Alert on major events (exchange hack, regulation news, whale movements)

**Copy Trading:**
- F9: Import target allocations from public portfolios (JSON/URL)
- F10: Follow mode: auto-sync allocation to match source portfolio
- F11: Configurable sync interval (1h, 4h, daily)
- F12: Drift tolerance: only sync if source changed > X%
- F13: Multiple sources: can follow multiple portfolios with weights
- F14: Copy trading history log

### Non-Functional
- NF1: OpenClaw runs as separate Docker container
- NF2: Communication via REST API (not tight coupling)
- NF3: Bot works fine without OpenClaw (graceful degradation)
- NF4: Copy trading source validation (reject malformed data)

## Architecture

```
┌──────────────────────────────┐     ┌──────────────────────────┐
│        OPENCLAW               │     │    REBALANCE BOT          │
│  (separate Docker container)  │     │                           │
│                               │     │                           │
│  ┌─────────────────────────┐  │     │                           │
│  │  Crypto News Skill      │  │     │                           │
│  │  - CoinDesk RSS         │  │     │                           │
│  │  - Twitter/X sentiment  │  │     │                           │
│  │  - On-chain alerts      │  │     │                           │
│  └───────────┬─────────────┘  │     │                           │
│              ▼                │     │                           │
│  ┌─────────────────────────┐  │     │                           │
│  │  Market Analysis Skill  │  │     │                           │
│  │  - Sentiment scoring    │  │     │                           │
│  │  - Trend analysis       │  │     │                           │
│  │  - Risk assessment      │  │     │                           │
│  └───────────┬─────────────┘  │     │                           │
│              ▼                │     │                           │
│  ┌─────────────────────────┐  │     │  ┌─────────────────────┐  │
│  │  Allocation Advisor     │──┼──API─▶│  AI Suggestion       │  │
│  │  - Suggest new targets  │  │     │  │  Handler             │  │
│  │  - Reasoning            │  │     │  │  - Validate          │  │
│  └─────────────────────────┘  │     │  │  - Apply/Queue       │  │
│              │                │     │  └─────────────────────┘  │
│              ▼                │     │                           │
│         Telegram              │     │  ┌─────────────────────┐  │
│         (approval)            │     │  │  Copy Trading Sync   │  │
│                               │     │  │  - Import sources    │  │
│                               │     │  │  - Periodic sync     │  │
│                               │     │  │  - Weighted merge    │  │
│                               │     │  └─────────────────────┘  │
└──────────────────────────────┘     └──────────────────────────┘
```

## Files to Create

```
src/
├── ai/
│   ├── ai-suggestion-handler.ts     # Receive + validate + apply AI suggestions
│   ├── ai-config.ts                 # OpenClaw connection config
│   └── market-summary-service.ts    # Generate daily summary from analytics data
├── copy-trading/
│   ├── copy-trading-manager.ts      # CRUD copy sources
│   ├── portfolio-source-fetcher.ts  # Fetch allocations from source
│   ├── copy-sync-engine.ts          # Sync logic: compare + adjust
│   └── copy-trading-history.ts      # Log sync events
├── api/routes/
│   ├── ai-routes.ts                 # AI suggestion endpoints
│   └── copy-trading-routes.ts       # Copy trading endpoints

# OpenClaw custom skills (separate repo/directory)
openclaw-skills/
├── crypto-news/
│   └── SKILL.md                     # News aggregation skill
├── market-analysis/
│   └── SKILL.md                     # Sentiment + trend analysis
└── allocation-advisor/
    └── SKILL.md                     # Allocation suggestion skill
```

## Database Schema (additions)

```sql
-- AI suggestions log
CREATE TABLE ai_suggestions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'openclaw',
  suggested_allocations JSON NOT NULL,
  reasoning TEXT NOT NULL,
  sentiment_data JSON,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'auto-applied')),
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy trading sources
CREATE TABLE copy_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('url', 'manual')),
  source_url TEXT,
  allocations JSON NOT NULL,
  weight REAL DEFAULT 1.0,       -- for weighted merge
  sync_interval TEXT DEFAULT '4h',
  enabled INTEGER DEFAULT 1,
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy trading sync history
CREATE TABLE copy_sync_log (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES copy_sources(id),
  before_allocations JSON NOT NULL,
  after_allocations JSON NOT NULL,
  changes_applied INTEGER DEFAULT 0,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints (additions)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/suggestion` | Receive suggestion from OpenClaw |
| GET | `/api/ai/suggestions` | List suggestions (pending/history) |
| PUT | `/api/ai/suggestion/:id/approve` | Approve suggestion |
| PUT | `/api/ai/suggestion/:id/reject` | Reject suggestion |
| PUT | `/api/ai/config` | Update AI config (auto-approve, etc.) |
| GET | `/api/ai/summary` | Get latest market summary |
| POST | `/api/copy/source` | Add copy trading source |
| GET | `/api/copy/sources` | List all sources |
| PUT | `/api/copy/source/:id` | Update source |
| DELETE | `/api/copy/source/:id` | Remove source |
| POST | `/api/copy/sync` | Force sync now |
| GET | `/api/copy/history` | Sync history |

## Implementation Steps

### Step 1: AI Suggestion Handler (4h)
1. Create `src/ai/ai-config.ts` — OpenClaw URL, auto-approve toggle
2. Create `src/ai/ai-suggestion-handler.ts`:
   - REST endpoint receives suggestions from OpenClaw
   - Validate: allocations sum to 100%, assets are tracked
   - If auto-approve: apply immediately
   - If manual: save as pending, notify Telegram
   - On approval: update allocations table → trigger rebalance
3. Add ai_suggestions table + migration

### Step 2: Market Summary Service (3h)
1. Create `src/ai/market-summary-service.ts`:
   - Query analytics data (Phase 2): PnL, top/bottom performers
   - Format daily summary message
   - Send via Telegram (scheduled: daily 8 AM)
2. Add to cron scheduler

### Step 3: OpenClaw Skills (6h)
1. Create `openclaw-skills/crypto-news/SKILL.md`:
   - Aggregate from RSS feeds (CoinDesk, CoinTelegraph)
   - Filter for tracked assets (BTC, ETH, SOL, etc.)
   - Summarize key headlines
2. Create `openclaw-skills/market-analysis/SKILL.md`:
   - Sentiment scoring per asset (-1 to +1)
   - Trend direction (bullish/bearish/neutral)
   - Risk level assessment
3. Create `openclaw-skills/allocation-advisor/SKILL.md`:
   - Input: current allocations + sentiment + trends
   - Output: suggested new allocations + reasoning
   - POST to rebalance-bot API

### Step 4: Copy Trading Manager (5h)
1. Create `src/copy-trading/copy-trading-manager.ts` — CRUD for sources
2. Create `src/copy-trading/portfolio-source-fetcher.ts`:
   - Fetch allocations from URL (JSON format)
   - Validate response schema
   - Handle errors gracefully
3. Create `src/copy-trading/copy-sync-engine.ts`:
   - Compare source allocations vs current target
   - Apply drift tolerance (only sync if changed > X%)
   - Weighted merge if multiple sources
   - Update allocations table → trigger rebalance
4. Create `src/copy-trading/copy-trading-history.ts` — log all syncs

### Step 5: Copy Trading Scheduler (3h)
1. Add sync schedules to cron scheduler
2. Per-source configurable interval (1h, 4h, daily)
3. Telegram notification on sync

### Step 6: API Routes + Docker (4h)
1. Create `src/api/routes/ai-routes.ts`
2. Create `src/api/routes/copy-trading-routes.ts`
3. Add OpenClaw to docker-compose.yml as separate service
4. Integration test: OpenClaw → suggestion → bot applies

## Todo List

- [x] Step 1: AI suggestion handler (receive, validate, approve/reject)
- [x] Step 2: Market summary service (daily Telegram report)
- [x] Step 3: OpenClaw custom skills (news, analysis, advisor)
- [x] Step 4: Copy trading manager (sources, fetcher, sync engine)
- [x] Step 5: Copy trading scheduler (periodic sync)
- [x] Step 6: API routes + Docker compose for OpenClaw

## Success Criteria

- [x] OpenClaw skill sends allocation suggestion to bot API
- [x] Suggestion appears in Telegram with approve/reject buttons
- [x] Approved suggestion updates target allocations
- [x] Auto-approve mode works without human intervention
- [x] Daily market summary sent via Telegram at configured time
- [x] Copy trading syncs from JSON URL correctly
- [x] Weighted merge of multiple sources calculates correctly
- [x] Bot works normally when OpenClaw is offline (graceful degradation)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenClaw AI hallucination → bad allocation | High | Human-in-the-loop default, max allocation change limit per suggestion |
| Copy trading source serves malicious data | Medium | Validate schema, cap max allocation change per sync |
| OpenClaw downtime | Low | Bot continues with last known allocations, no dependency |
| Rate limiting on news APIs | Low | Cache results, respect rate limits, multiple sources |

## Security Considerations

- OpenClaw → Bot API secured with shared secret key
- Copy trading URLs validated (no SSRF)
- Max allocation change per suggestion (e.g., max 10% shift per asset)
- AI suggestions logged for audit trail
- Auto-approve disabled by default
