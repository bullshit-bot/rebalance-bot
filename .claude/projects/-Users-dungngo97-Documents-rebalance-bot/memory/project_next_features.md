---
name: Next features - Cash reserve rebalancing + optimal allocation
description: Need to implement cash-aware rebalancing (USDT reserve), DCA-based rebalancing (buy underweight with DCA instead of sell/buy), and find optimal allocation via backtest
type: project
---

Next implementation priorities:

1. **Cash Reserve Rebalancing** — keep X% in USDT as cash buffer. Deploy cash when assets dip below target. Don't sell to rebalance, use cash instead.
2. **DCA-Based Rebalancing** — route daily DCA funds to most underweight asset instead of proportional split
3. **Optimal Allocation Research** — backtest different BTC/ETH/SOL/BNB ratios with cash reserve to find best risk-adjusted return
4. **Maker Orders** — use limit orders instead of market to reduce fees from 0.1% to 0.02%

**Why:** Current bot rebalances by selling winners + buying losers (expensive). DCA-based + cash reserve approach reduces fees and captures dips better.

**How to apply:** Create plan with phases for each feature. Backtest with cash reserve scenarios. User wants all 4 coins (BTC/ETH/SOL/BNB) + USDT reserve.

**Backtest baseline:** $1K initial + $20/day DCA × 5yr = $37.5K invested → $60.4K with current config (+61.2%)
