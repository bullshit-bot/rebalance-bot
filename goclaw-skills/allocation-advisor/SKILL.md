---
name: allocation_advisor
description: Analyse portfolio allocations and suggest rebalancing using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 📊
    requires:
      bins:
        - mcporter
---

# Allocation Advisor

Analyse portfolio and suggest allocation changes.

## Workflow

1. Run `mcporter call rebalance-bot.get_portfolio` — fetch current holdings, values, drift.
2. Run `mcporter call rebalance-bot.get_allocations` — get target allocation percentages.
3. Compare current vs target weights. Identify assets with drift > 5%.
4. Present analysis table: Asset, Current%, Target%, Drift%, Action.
7. On user approval, run `mcporter call rebalance-bot.trigger_rebalance`.
