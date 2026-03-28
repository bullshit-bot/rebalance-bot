---
title: "Telegram Alerts for Critical Events"
description: "Add bear/bull signal, daily summary, and bot restart alerts to TelegramNotifier"
status: completed
priority: P1
effort: 1.5h
---

# Phase 2: Telegram Alerts

## Context Links
- [telegram-notifier.ts](../../src/notifier/telegram-notifier.ts) -- existing notifier, handles 7 events
- [event-bus.ts](../../src/events/event-bus.ts) -- typed EventEmitter
- [trend-filter.ts](../../src/rebalancer/trend-filter.ts) -- bull/bear state

## Overview

TelegramNotifier exists and works. Currently handles: trade:executed, rebalance:completed, drift:warning, trailing-stop:triggered, exchange:connected/disconnected, error. Missing critical alerts for mainnet:

1. **Bear/bull signal change** -- must know when trend filter flips
2. **Daily portfolio summary** -- scheduled digest with balances + P&L
3. **Bot startup/restart** -- know when bot reboots (implies crash or deploy)

## Key Insights

- `rebalance:completed` alert already exists -- no work needed there
- Bear/bull flip: TrendFilter has no event emission. Two approaches:
  - (A) Add event emission to TrendFilter when state changes -- cleanest
  - (B) Check in drift-detector loop and emit -- already runs periodically
  - **Choose (A)**: TrendFilter owns the state, should own the event
- Daily summary: use `node-cron` or `setInterval` with 24h period. Bot already uses event-driven arch -- add a daily cron that emits `daily:summary`
- Bot startup alert: send message in `TelegramNotifier.start()` after subscribing to events

## Related Code Files

### Modify
- `src/rebalancer/trend-filter.ts` -- emit `trend:changed` event when bull/bear flips
- `src/notifier/telegram-notifier.ts` -- subscribe to `trend:changed`, `daily:summary`; send startup message
- `src/events/event-bus.ts` -- add `trend:changed` and `daily:summary` event types (if typed)

### Possibly create
- `src/scheduler/daily-summary-job.ts` -- cron job that gathers portfolio data and emits `daily:summary` (only if scheduler doesn't exist yet)

## Implementation Steps

1. **Add trend change detection to TrendFilter**:
   - Track `private lastBullish: boolean | null = null` (null = unknown/first run)
   - In `isBullish()` or in `recordPrice()` after adding a new day: check if bull/bear state changed
   - If changed: `eventBus.emit('trend:changed', { bullish, price, ma })`
   - Only emit on actual flip (not every call)

2. **Add event types** to event-bus if typed:
   - `'trend:changed'` with `{ bullish: boolean; price: number; ma: number | null }`
   - `'daily:summary'` with portfolio data shape

3. **Subscribe in TelegramNotifier.start()**:
   - `trend:changed` -- format: "BULL/BEAR signal: BTC $X vs MA100 $Y"
   - `daily:summary` -- format: total value, top holdings, 24h change, trend status
   - Send startup message: "Bot started at {time}, version {pkg.version}"

4. **Create daily summary scheduler**:
   - Simple `setInterval(24h)` or use existing cron infrastructure
   - Gather: `portfolioTracker.getPortfolio()`, trend status, last rebalance time
   - Emit `daily:summary` event -- notifier picks it up
   - Run at configurable time (default 08:00 UTC)

5. **Startup notification**:
   - At end of `TelegramNotifier.start()`, send: "Bot started. Trend: BULL/BEAR. Portfolio: $X. Data points: N"

## Todo List

- [x] Add trend flip detection + event emission in TrendFilter
- [x] Add `trend:changed` event type to event-bus
- [x] Subscribe TelegramNotifier to `trend:changed`
- [x] Create daily summary scheduler (setInterval or cron)
- [x] Format and send daily portfolio summary
- [x] Send bot startup notification in `start()`
- [x] Test: simulate trend flip, verify Telegram message

## Success Criteria

- [x] Bot startup sends Telegram message with portfolio value + trend status
- [x] Bear/bull signal flip sends immediate Telegram alert
- [x] Daily summary arrives once per day with portfolio overview
- [x] Throttle prevents spam (5-min cooldown per event type preserved)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Trend flip spam near MA boundary | TrendFilter buffer (2%) already handles this; only emit on actual state change |
| Daily summary fails if portfolio not loaded | Guard with null check, send "Portfolio unavailable" instead |
| setInterval drift over days | Acceptable for personal bot; can upgrade to node-cron later if needed |
