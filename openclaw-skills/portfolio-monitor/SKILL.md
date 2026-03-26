---
name: portfolio_monitor
description: Monitor portfolio drift and alert on significant deviations using mcporter to call rebalance bot MCP tools.
metadata:
  openclaw:
    emoji: 👁️
    requires:
      bins:
        - mcporter
---

# Portfolio Monitor

Observe portfolio drift and surface alerts.

## Workflow

1. Run `mcporter call rebalance-bot.get_health` — verify connectivity. Stop if unhealthy.
2. Run `mcporter call rebalance-bot.get_portfolio` — current holdings, weights, total value.
3. Run `mcporter call rebalance-bot.list_allocations` — target percentages.
4. Compute drift per asset: `drift = current% - target%`.
5. Classify: Critical (>15%), Warning (>8%), Info (>3%), OK (<3%).
6. Run `mcporter call rebalance-bot.list_trades limit=5` — check if recent rebalance already occurred.
7. Output monitoring report: health, drift table with severity, recommended action.
