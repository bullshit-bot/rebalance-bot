---
name: allocation_advisor
description: Analyze portfolio allocations, earn positions, and suggest rebalancing using MCP tools.
metadata:
  goclaw:
    emoji: 📊
    requires:
      mcp_tools:
        - rb_get_portfolio
        - rb_list_allocations
        - rb_trigger_rebalance
        - rb_get_earn_status
---

# Allocation Advisor

Analyze portfolio allocations, Simple Earn positions, and suggest rebalancing.

## Workflow

1. Run `rb_get_portfolio` — fetch current holdings, values, drift.
2. Run `rb_list_allocations` — get target allocation percentages (crypto-only if DCA enabled).
3. Compare current vs target weights. Identify assets with drift > 5%.
4. If Simple Earn enabled, run `rb_get_earn_status` — report flexible earn positions and their APY.
5. Present analysis: Current%, Target%, Drift%, Action. If enabled, include earn positions with yields.
6. On user approval, run `rb_trigger_rebalance`.
