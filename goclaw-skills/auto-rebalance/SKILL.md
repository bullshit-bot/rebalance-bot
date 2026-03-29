---
name: auto_rebalance
description: Automated rebalancing with safety checks using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: ⚖️
    requires:
      bins:
        - mcporter
---

# Auto Rebalance

Full rebalancing cycle with pre-flight safety checks.

## Workflow

1. Run `mcporter call rebalance-bot.get_strategy_config` — check strategy config, trend filter status.
2. Run `mcporter call rebalance-bot.get_portfolio` — current holdings, weights, total value.
3. Run `mcporter call rebalance-bot.get_allocations` — target allocations.
4. **Trend filter check**: If trendFilterEnabled=true, check market state.
   - Bear mode (BTC < MA100) → "Bear market detected. Portfolio should be 90% cash. Skip rebalance."
   - Bull mode → proceed normally.
5. Compute drift. If max drift < threshold (default 5%), output "No rebalance needed" and stop.
   - If dcaRebalanceEnabled, use hardRebalanceThreshold (default 15%) instead.
6. Run `mcporter call rebalance-bot.get_rebalance_history limit=5` — check cooldown.
   - Last rebalance < 4h ago → "Cooldown active", stop.
   - Last rebalance failed → log warning, continue.
7. Safety checks:
   - Portfolio value > 0.
   - No single asset > 80%.
   - Allocations sum to 100% (±0.01).
   - Cash reserve respected (cashReservePct of portfolio stays as USDT).
8. Present proposed trades to user. On approval:
   - Run `mcporter call rebalance-bot.trigger_rebalance`.
9. Wait 10s, run `mcporter call rebalance-bot.get_rebalance_history limit=1` — confirm.
10. Report: assets traded, fees, new weights, trend filter state, or error details.
