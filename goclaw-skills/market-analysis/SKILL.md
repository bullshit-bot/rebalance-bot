---
name: market_analysis
description: Analyze recent trades, portfolio performance, and earn yield using MCP tools.
metadata:
  goclaw:
    emoji: 📈
    requires:
      mcp_tools:
        - rb_get_health
        - rb_get_portfolio
        - rb_list_trades
        - rb_get_earn_status
---

# Market Analysis

Examine portfolio state and recent trade activity.

## Workflow

1. Run `rb_get_health` — confirm system operational.
2. Run `rb_get_portfolio` — current holdings, weights, total value.
3. Run `rb_list_trades limit=20` — recent executed trades.
4. If Simple Earn enabled, run `rb_get_earn_status` — report flexible earn positions, APY rates, and total earned yield.
5. Analyze concentration: flag assets > 50% of portfolio.
6. Identify trading patterns from recent trades (buy/sell frequency, volume).
7. Summarize: top holdings, earn yield (if enabled), activity summary, concentration risks, health status, recommendations.
