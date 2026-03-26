---
name: auto_rebalance
description: Automated rebalancing with safety checks using mcporter to call rebalance bot MCP tools.
metadata:
  openclaw:
    emoji: ⚖️
    requires:
      bins:
        - mcporter
---

# Auto Rebalance

Full rebalancing cycle with pre-flight safety checks.

## Workflow

1. Run `mcporter call rebalance-bot.get_portfolio` — current holdings, weights, total value.
2. Run `mcporter call rebalance-bot.list_allocations` — target allocations.
3. Compute drift. If max drift < 5%, output "No rebalance needed" and stop.
4. Run `mcporter call rebalance-bot.get_rebalance_history limit=5` — check cooldown.
   - Last rebalance < 4h ago → "Cooldown active", stop.
   - Last rebalance failed → log warning, continue.
5. Safety checks:
   - Portfolio value > 0.
   - No single asset > 80%.
   - Allocations sum to 100% (±0.01).
6. Present proposed trades to user. On approval:
   - Run `mcporter call rebalance-bot.trigger_rebalance`.
7. Wait 10s, run `mcporter call rebalance-bot.get_rebalance_history limit=1` — confirm.
8. Report: assets traded, fees, new weights, or error details.
