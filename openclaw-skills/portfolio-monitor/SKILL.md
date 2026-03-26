---
name: portfolio-monitor
description: Monitors portfolio drift and system health, alerting when allocations deviate significantly from targets
tools:
  - get_portfolio
  - list_allocations
  - list_trades
  - get_health
---

# Portfolio Monitor

## Purpose

Continuously observe portfolio state against target allocations, detect significant drift, and surface alerts when the portfolio requires attention. Does not trigger rebalancing — monitoring and alerting only.

## Workflow

1. Call `get_health` to verify system connectivity and bot status. If unhealthy, report the issue and stop.
2. Call `get_portfolio` to fetch current holdings, weights, and total portfolio value.
3. Call `list_allocations` to retrieve target allocation percentages per asset.
4. For each asset, compute drift: `drift = currentWeight - targetWeight`.
5. Classify alerts by severity:
   - **Critical** — drift > 15% or < -15%
   - **Warning** — drift > 8% or < -8%
   - **Info** — drift > 3% or < -3%
   - **OK** — within ±3% of target
6. Call `list_trades` to check recent activity — if a rebalance trade occurred in the last hour, downgrade alert severity by one level.
7. Output a monitoring report:
   - System health status
   - Per-asset drift table with severity
   - Total portfolio value
   - Recommended action: rebalance, watch, or no action needed

## MCP Tools Used

- `get_portfolio` — fetches live holdings, current weights, and total portfolio value
- `list_allocations` — retrieves configured target allocation percentages per asset
- `list_trades` — checks recent trade history to determine if rebalancing is already in progress
- `get_health` — verifies system health, exchange connectivity, and bot operational status
