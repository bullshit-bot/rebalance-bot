---
name: portfolio_monitor
description: Monitor portfolio drift and alert on significant deviations using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 👁️
    requires:
      mcp_tools:
        - rb_get_health
        - rb_get_strategy_config
        - rb_get_portfolio
        - rb_list_allocations
        - rb_list_trades
---

# Portfolio Monitor

Observe portfolio drift and surface alerts.

## Workflow

1. Run `rb_get_health` — verify connectivity, confirm price feed is active (REST polling, 10s interval).
2. Run `rb_get_strategy_config` — check strategy config, trend filter, cash reserve, DCA settings.
3. Run `rb_get_portfolio` — current holdings, weights, total value.
4. Run `rb_get_allocations` — target percentages (crypto-only if DCA enabled).
5. Compute drift per asset: `drift = current% - target%`.
   - **DCA allocations**: Exclude stablecoins from denominator. Compute % vs crypto portion only.
6. Classify: Critical (>15%), Warning (>8%), Info (>3%), OK (<3%).
7. **Trend filter status**: If trendFilterEnabled:
   - Report current market state (bull/bear based on BTC vs MA period).
   - In bear mode: flag if portfolio is NOT at bearCashPct target (e.g., 100% stablecoins).
   - In bull mode: check drift normally.
8. **Cash reserve check**: If cashReservePct > 0, verify stablecoin balance meets target.
9. **DCA budget check**: If dcaRebalanceEnabled, note dcaAmountUsd limit ($20 default, configurable).
10. Run `rb_list_trades limit=5` — check if recent rebalance already occurred.
11. Output monitoring report: health, price feed status, market state, drift table with severity, cash/DCA status, recommended action.
