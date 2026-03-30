---
name: strategy_manager
description: View, switch, and configure rebalancing strategies using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: ⚙️
    requires:
      bins:
        - mcporter
---

# Strategy Manager

View and manage rebalancing strategy configurations.

## System Knowledge

### Strategy Types
| Type | Description | Key Params |
|------|-------------|------------|
| threshold | Fixed drift % trigger | thresholdPct (default 5) |
| equal-weight | Equal allocation, threshold rebalance | thresholdPct |
| momentum-tilt | Momentum-adjusted allocation | momentumWindowDays (14), momentumWeight (0.5) |
| vol-adjusted | Dynamic threshold scaled by volatility | baseThresholdPct, volLookbackDays, min/maxThresholdPct |
| mean-reversion | Bollinger-band drift tracking | lookbackDays, bandWidthSigma (1.5), minDriftPct (3) |
| momentum-weighted | RSI+MACD composite scoring | rsiPeriod (14), macdFast (12), macdSlow (26), weightFactor (0.4) |

### Global Settings
- `cashReservePct` (0-50%): Portion kept as stablecoins buffer. Default 0.
- `dcaRebalanceEnabled`: Route DCA deposits to most underweight asset, cap rebalance trades to DCA budget.
- `dcaAmountUsd` ($1-$100k): DCA amount per execution. Default $20.
- `hardRebalanceThreshold` (5-50%): Force full rebalance when drift exceeds this.
- `trendFilterEnabled`: Use BTC MA for bull/bear detection.
- `trendFilterMA` (default 100): BTC SMA period.
- `bearCashPct` (30-100%): % to sell to stablecoins in bear. Default 70.
- `trendFilterCooldownDays` (default 3): Anti-whipsaw cooldown.

### Recommended Config (from backtest optimization)
- Strategy: threshold (5%)
- Cash reserve: 10%
- Trend filter: enabled, MA100, Bear 100%, Cooldown 1 day
- DCA rebalance: enabled, amount $20
- Allocation: BTC 40% / ETH 25% / SOL 20% / BNB 15% (crypto-only, excludes stablecoins from denominator)

### API Endpoints
- GET /api/strategy-config — active config + list
- POST /api/strategy-config — create new config
- PUT /api/strategy-config/:name — update config
- POST /api/strategy-config/:name/activate — switch active strategy
- GET /api/strategy-config/presets — built-in presets

## Workflow

1. Run `mcporter call rebalance-bot.get_strategy_config` — current active strategy and global settings.
2. Display: strategy type, key parameters, global settings (cash reserve, trend filter, DCA).
3. If user wants to change strategy:
   - Validate requested strategy type exists.
   - Run `mcporter call rebalance-bot.update_strategy_config` with new settings.
4. If user asks "what's best":
   - Recommend threshold + MA100 trend filter based on backtest data.
   - Show backtest comparison: no filter (+48%) vs MA100 (+150%).
5. If user asks about trend filter status:
   - Check trendFilterEnabled in config.
   - Report: enabled/disabled, MA period, current market state (bull/bear).
6. Safety: warn before switching strategy on live portfolio. Suggest paper trading first.
