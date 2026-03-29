---
name: market_analysis
description: Analyse recent trades and portfolio performance using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 📈
    requires:
      mcp_tools:
        - rb_get_health
        - rb_get_portfolio
        - rb_list_trades
---

# Market Analysis

Examine portfolio state and recent trade activity.

## Workflow

1. Run `rb_get_health` — confirm system operational.
2. Run `rb_get_portfolio` — current holdings, weights, total value.
3. Run `rb_list_trades limit=20` — recent executed trades.
4. Analyse concentration: flag assets > 50% of portfolio.
5. Identify trading patterns from recent trades (buy/sell frequency, volume).
6. Summarise: top holdings, activity summary, concentration risks, health status.
