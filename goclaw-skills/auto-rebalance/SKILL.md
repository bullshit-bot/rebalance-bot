---
name: auto_rebalance
description: Automated rebalancing with safety checks using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: ⚖️
    requires:
      mcp_tools:
        - rb_get_strategy_config
        - rb_get_portfolio
        - rb_list_allocations
        - rb_get_rebalance_history
        - rb_trigger_rebalance
---

# Auto Rebalance

Full rebalancing cycle with pre-flight safety checks.

## Workflow

1. Run `rb_get_strategy_config` — check strategy config, trend filter status.
2. Run `rb_get_portfolio` — current holdings, weights, total value.
3. Run `rb_get_allocations` — target allocations (crypto-only percentages).
4. **Trend filter check**: If trendFilterEnabled=true, check market state.
   - Bear mode (BTC < MA period) → "Bear market detected. Portfolio should be cash override %. Skip drift rebalance."
   - Bull mode → proceed normally.
5. Compute drift. If max drift < threshold (default 5%), output "No rebalance needed" and stop.
   - Threshold strategy uses standard rebalance threshold
   - Drift triggers full portfolio rebalance (no DCA budget cap)
6. Run `rb_get_rebalance_history limit=5` — check cooldown.
   - Last rebalance < 4h ago → "Cooldown active", stop.
   - Last rebalance failed → log warning, continue.
7. Safety checks:
   - Portfolio value > 0.
   - No single asset > 80%.
   - Allocations sum to 100% (±0.01).
   - Cash reserve respected (cashReservePct of portfolio stays as stablecoins).
8. Present proposed trades to user. On approval:
   - Run `rb_trigger_rebalance`.
   - Rebalance engine does full portfolio rebalance (independent of DCA)
9. Wait 10s, run `rb_get_rebalance_history limit=1` — confirm.
10. Report: assets traded, fees, new weights, trend filter state, or error details.

## Note on DCA Independence

DCA cron jobs and rebalance engine are fully separate systems:
- **Rebalance**: Triggered by drift > threshold, executes full portfolio rebalancing
- **DCA**: Scheduled daily (07:00 VN), deposits `dcaAmountUsd` to most underweight asset
- Both systems respect trend filter bear/bull state
- Neither caps the other's trading
