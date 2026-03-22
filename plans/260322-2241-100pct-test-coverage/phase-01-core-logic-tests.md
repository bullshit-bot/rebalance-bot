---
title: "Phase 1: Core Logic Tests"
description: "Tests for exchange, price, portfolio, rebalancer, events, db modules"
status: pending
priority: P1
effort: 6h
tags: [testing, core]
created: 2026-03-22
---

# Phase 1: Core Logic Tests

## Files to Test (13 files)

### Exchange (2 new tests)
- `src/exchange/exchange-factory.test.ts` — createExchange returns valid instance, sandbox mode, unknown exchange throws
- `src/exchange/exchange-manager.test.ts` — initialize connects exchanges, getExchange returns instance, getStatus, shutdown disconnects

### Price (1 new test)
- `src/price/price-aggregator.test.ts` — start subscribes to tickers, emits price:update, stop cleans up, handles exchange error

### Portfolio (2 new tests)
- `src/portfolio/portfolio-tracker.test.ts` — calculates allocation %, detects drift, emits portfolio:update, caches targets 60s
- `src/portfolio/snapshot-service.test.ts` — saveSnapshot writes to DB, getSnapshots returns range

### Rebalancer (4 new tests)
- `src/rebalancer/drift-detector.test.ts` — detects drift > threshold, respects cooldown, emits rebalance:trigger
- `src/rebalancer/rebalance-engine.test.ts` — orchestrates detect→calculate→execute, dry-run mode, handles failure
- `src/rebalancer/momentum-calculator.test.ts` — calculates 30d momentum per asset
- `src/rebalancer/volatility-tracker.test.ts` — calculates 30d rolling annualized volatility
- `src/rebalancer/strategy-manager.test.ts` — switches between 4 strategy modes, dynamic allocations

### Events (1 new test)
- `src/events/event-bus.test.ts` — typed emit/on/off/once, removeAllListeners, listenerCount

### DB (1 new test)
- `src/db/database.test.ts` — connection works, query returns results (use :memory:)

### Executor (1 new test)
- `src/executor/order-executor.test.ts` — limit order flow, timeout→market fallback, retry logic, guard check

## Testing Strategy
- Mock CCXT exchanges (external dependency)
- Mock DB with in-memory libSQL where needed
- Real instances for pure logic (calculator, detector, tracker)
- Use eventBus listeners to verify event emissions

## Todo List
- [ ] exchange-factory.test.ts
- [ ] exchange-manager.test.ts
- [ ] price-aggregator.test.ts
- [ ] portfolio-tracker.test.ts
- [ ] snapshot-service.test.ts
- [ ] drift-detector.test.ts
- [ ] rebalance-engine.test.ts
- [ ] momentum-calculator.test.ts
- [ ] volatility-tracker.test.ts
- [ ] strategy-manager.test.ts
- [ ] event-bus.test.ts
- [ ] database.test.ts
- [ ] order-executor.test.ts
