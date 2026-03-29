---
name: portfolio_monitor
description: Monitor portfolio drift and alert on significant deviations using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 👁️
    requires:
      bins:
        - mcporter
---

# Portfolio Monitor

Observe portfolio drift and surface alerts.

## Workflow

1. Run `mcporter call rebalance-bot.get_health` — verify connectivity. Stop if unhealthy.
2. Run `mcporter call rebalance-bot.get_config` — check strategy config, trend filter, cash reserve.
3. Run `mcporter call rebalance-bot.get_portfolio` — current holdings, weights, total value.
4. Run `mcporter call rebalance-bot.list_allocations` — target percentages.
5. Compute drift per asset: `drift = current% - target%`.
6. Classify: Critical (>15%), Warning (>8%), Info (>3%), OK (<3%).
7. **Trend filter status**: If trendFilterEnabled:
   - Report current market state (bull/bear based on BTC vs MA100).
   - In bear mode: flag if portfolio is NOT mostly cash (should be ~90% USDT).
   - In bull mode: check drift normally.
8. **Cash reserve check**: If cashReservePct > 0, verify USDT balance meets target.
9. Run `mcporter call rebalance-bot.list_trades limit=5` — check if recent rebalance already occurred.
10. Output monitoring report: health, market state, drift table with severity, cash reserve status, recommended action.
