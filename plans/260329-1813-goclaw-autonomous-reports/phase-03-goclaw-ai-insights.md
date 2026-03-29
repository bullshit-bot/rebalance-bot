---
title: "GoClaw AI Scheduled Insights"
status: completed
priority: P1
effort: 2h
---

## Context

GoClaw has skills (market_analysis, allocation_advisor, crypto_news) and 28 MCP tools but nobody triggers them. Need to schedule GoClaw to periodically generate AI-powered insights and send to Telegram.

## Overview

Create a backend service that triggers GoClaw conversations on schedule. GoClaw uses its MCP tools to gather portfolio data, runs AI analysis, and sends insights to Telegram.

## Architecture

```
Backend Cron (every 12h)
  → HTTP POST to GoClaw API (port 18790)
  → GoClaw runs market_analysis skill
  → GoClaw calls MCP tools (get_portfolio, get_strategy_config, list_trades)
  → GoClaw generates AI analysis via Claude/XAI
  → Backend receives response → sends to Telegram
```

## Research Needed

- GoClaw API endpoint for triggering conversations programmatically
- How to pass a prompt to GoClaw and get response back
- Whether GoClaw can send Telegram messages directly or needs backend relay

## Related Code Files

- Create: `src/ai/goclaw-insight-service.ts` — HTTP client to trigger GoClaw
- Modify: `src/scheduler/cron-scheduler.ts` — add 12h cron for AI insights
- Read: `docker-compose.yml` — GoClaw service config (port 18790)
- Read: `goclaw-skills/market_analysis/SKILL.md` — skill prompt format

## Implementation Steps

1. Research GoClaw API:
   - Check GoClaw docs/API for conversation trigger endpoint
   - Test with curl from VPS: `curl http://goclaw:18790/api/...`
   - Determine request/response format
2. Create `goclaw-insight-service.ts`:
   - HTTP client to GoClaw internal API
   - Prompt template: "Analyze current portfolio using get_portfolio and list_trades tools. Provide: market conditions assessment, allocation efficiency, risk flags, action recommendations. Keep response under 500 words."
   - Parse GoClaw response, format for Telegram
   - Fallback: if GoClaw unreachable, skip silently (not critical)
3. Add cron job: `0 */12 * * *` (every 12h — 08:00 + 20:00 VN)
4. Wire to Telegram via existing `telegramNotifier.sendMessage()`

## Todo

- [ ] Research GoClaw API endpoint for triggering conversations
- [ ] Create goclaw-insight-service.ts with HTTP client
- [ ] Create prompt template for market analysis
- [ ] Add 12h cron job to scheduler
- [ ] Handle GoClaw unavailable gracefully
- [ ] Test end-to-end: cron → GoClaw → Telegram

## Success Criteria

- AI insights arrive twice daily via Telegram
- Insights are actionable (not generic platitudes)
- System degrades gracefully if GoClaw is down

## Risk

- GoClaw API may not support programmatic conversation triggers → fallback: use Anthropic API directly with same MCP data
- AI responses may be too long for Telegram → truncate or split messages
