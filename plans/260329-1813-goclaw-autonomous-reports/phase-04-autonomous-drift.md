---
title: "Autonomous Drift Response"
status: completed
priority: P1
effort: 2h
---

## Context

Currently drift detection emits `rebalance:trigger` → engine executes blindly. User wants GoClaw to analyze WHY drift happened, decide if rebalance makes sense, execute if yes, and report action to Telegram.

## Overview

Wire GoClaw into the drift → rebalance pipeline as an intelligent decision layer. When drift exceeds threshold, GoClaw analyzes context (market trend, recent trades, drift cause) and either auto-rebalances or skips with reasoning.

## Architecture

```
DriftDetector emits rebalance:trigger
  → GoClaw Autonomous Handler intercepts
  → GoClaw gathers context via MCP tools:
      - get_portfolio (current state)
      - get_strategy_config (active strategy)
      - list_trades (recent activity)
  → AI decides: rebalance now? skip? adjust allocation?
  → If rebalance: trigger_rebalance via MCP
  → Report decision + reasoning to Telegram
```

## Related Code Files

- Create: `src/ai/goclaw-drift-handler.ts` — autonomous drift response
- Modify: `src/rebalancer/drift-detector.ts` — option to route through GoClaw before rebalance
- Modify: `src/scheduler/cron-scheduler.ts` — if additional scheduling needed
- Read: `src/rebalancer/rebalance-engine.ts` — current rebalance flow

## Implementation Steps

1. Create `goclaw-drift-handler.ts`:
   - Listen to `rebalance:trigger` events (or be called by drift-detector)
   - Gather context: portfolio state, strategy config, recent trades, trend filter
   - Call GoClaw API with analysis prompt:
     "Portfolio drift detected: [asset] at [drift]%. Current trend: [bull/bear]. Recent trades: [count] in 24h. Should we rebalance now? Consider: market conditions, recent activity, transaction costs. Respond with: REBALANCE or SKIP, and brief reasoning."
   - Parse GoClaw decision
   - If REBALANCE: call `trigger_rebalance` MCP tool or emit event
   - If SKIP: log reasoning
   - Send decision report to Telegram
2. Add config flag: `GOCLAW_AUTONOMOUS_ENABLED=true` in env
3. Modify drift-detector to route through GoClaw handler when enabled
4. Fallback: if GoClaw unreachable, fall back to normal auto-rebalance

## Todo

- [ ] Create goclaw-drift-handler.ts
- [ ] Add GOCLAW_AUTONOMOUS_ENABLED env config
- [ ] Wire into drift-detector with fallback
- [ ] Create decision prompt template
- [ ] Send decision report to Telegram
- [ ] Test: drift trigger → GoClaw analysis → rebalance/skip → Telegram report

## Success Criteria

- Drift triggers GoClaw analysis before rebalancing
- GoClaw makes intelligent skip/rebalance decisions
- Every decision reported to Telegram with reasoning
- Fallback works if GoClaw is down (normal rebalance continues)

## Risk

- GoClaw response latency may delay rebalance (market moves) → set 30s timeout
- AI may be too conservative (always skip) or too aggressive → tune prompt + review decisions in first week
- Depends on Phase 3 GoClaw API integration working
