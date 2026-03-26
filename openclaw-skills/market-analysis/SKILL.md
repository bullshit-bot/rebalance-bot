---
name: market-analysis
description: Analyses portfolio composition, recent trade history, and system health to surface actionable market insights
tools:
  - get_portfolio
  - list_trades
  - get_health
---

# Market Analysis

## Purpose

Examine the current portfolio state alongside recent trade activity and system health to identify trends, performance patterns, and risk signals.

## Workflow

1. Call `get_health` to confirm the system is operational before proceeding.
2. Call `get_portfolio` to retrieve current holdings, asset weights, total value, and unrealised P&L.
3. Call `list_trades` to fetch recent executed trades — review direction (buy/sell), asset, size, and timestamp.
4. Analyse portfolio concentration: flag assets exceeding 50% of portfolio value.
5. Identify trading patterns from recent trades:
   - Frequent buys of a single asset may indicate momentum or drift correction.
   - Frequent sells may indicate stop-loss triggers or rebalancing.
6. Cross-reference portfolio weights with recent trade direction to infer current positioning.
7. Summarise findings: top holdings, recent activity summary, concentration risks, and health status.

## MCP Tools Used

- `get_portfolio` — fetches current holdings, weights, total portfolio value, and per-asset P&L
- `list_trades` — retrieves recent executed trades with asset, side, size, price, and timestamp
- `get_health` — checks system health status including exchange connectivity and bot state
