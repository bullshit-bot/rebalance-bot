---
title: "Crypto Rebalance Bot - Full Feature"
description: "Self-hosted crypto rebalance bot with ALL features: rebalance, DCA, backtesting, grid trading, copy trading, AI intelligence, portfolio analytics"
status: completed
priority: P1
effort: 120h
branch: main
tags: [crypto, trading-bot, backend, fullstack, ai]
created: 2026-03-22
---

# Crypto Rebalance Bot - Full Feature Implementation Plan

## Overview

Build a self-hosted, fully-automated crypto rebalance bot that combines ALL features from top platforms (3Commas, Pionex, Shrimpy, Freqtrade) into one personal bot. No subscription fees, full control.

**Target**: 14/14 features — no other bot has all of them.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun 1.2+ |
| API | Hono v4 |
| Real-time | Bun native WebSocket |
| Exchange | CCXT Pro |
| Database | libSQL + Drizzle ORM |
| Validation | Zod |
| Notifications | grammy (Telegram) |
| AI | OpenClaw |
| Linter | Biome |
| Deploy | Docker (oven/bun) |

## Research

- [Infrastructure Research](../reports/research-260322-1802-crypto-rebalance-bot-infra.md)
- [OpenClaw Research](../reports/research-260322-1802-openclaw.md)

## Phases

| # | Phase | Status | Effort | Priority | Link |
|---|-------|--------|--------|----------|------|
| 1 | Core Engine | ✅ Completed | 40h | P1 | [phase-01](./phase-01-core-engine.md) |
| 2 | Intelligence & Analytics | ✅ Completed | 30h | P1 | [phase-02](./phase-02-intelligence-analytics.md) |
| 3 | Advanced Execution | ✅ Completed | 25h | P2 | [phase-03](./phase-03-advanced-execution.md) |
| 4 | Social & AI | ✅ Completed | 25h | P2 | [phase-04](./phase-04-social-ai.md) |

## Dependencies

- Binance/OKX/Bybit API keys (trade-only, no withdrawal)
- Telegram Bot Token
- VPS 8GB RAM / 80GB SSD (already available)
- OpenClaw instance (Phase 4)

## Architecture

```
React Frontend ←→ Hono REST + Bun WebSocket
                        ↓
              ┌─────────────────────┐
              │    Service Layer    │
              │                     │
              │  Exchange Manager   │ ← CCXT Pro (Binance/OKX/Bybit)
              │  Portfolio Tracker  │
              │  Rebalance Engine   │
              │  Backtesting Engine │
              │  Grid Trading Bot   │
              │  Copy Trading Sync  │
              │  Order Executor     │
              │  TWAP/VWAP Engine   │
              │  Notifier           │ → Telegram
              │  AI Intelligence    │ ← OpenClaw
              └─────────┬───────────┘
                        ↓
                 libSQL + Drizzle
```
