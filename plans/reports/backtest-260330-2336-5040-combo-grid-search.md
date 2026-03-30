# Grid Search Results — 5040 Combos (Fixed Backtest)

**Date:** 2026-03-30
**Dataset:** 5Y (2021-2026), $1000 initial, $20/day DCA, 0.1% fee
**Pairs:** BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
**Allocations:** BTC 40%, ETH 25%, SOL 20%, BNB 15%

## Backtest Fixes Applied
1. Trade amount double-division (rebalance trades were ≈ 0)
2. Trend filter buffer (was missing, now matches live)
3. DCA fee (was fee-free, now applies feePct)

## Grid Parameters
- MA: 50, 70, 80, 90, 100, 110, 120, 150, 200
- Bear Cash: 70, 80, 90, 100%
- Cooldown: 1, 2, 3, 5, 7 days
- Threshold: 2, 3, 4, 5, 6, 8, 10%
- Buffer: 0, 1, 2, 3%
- Cash Reserve: 0%
- **Total: 9 × 4 × 5 × 7 × 4 = 5040 combos**

## Top 10 Results

| # | Config | Return | Annual | Sharpe | MaxDD | Trades |
|---|--------|--------|--------|--------|-------|--------|
| 1 | MA120/Bear100/CD1/TH10/Buf0 | +286.3% | +31.1% | 2.29 | -39.6% | 172 |
| 2 | MA120/Bear100/CD1/TH4/Buf0 | +281.5% | +30.7% | 2.30 | -38.5% | 258 |
| 3 | MA120/Bear100/CD1/TH8/Buf0 | +281.8% | +30.8% | 2.29 | -39.6% | 175 |
| 4 | MA120/Bear100/CD1/TH3/Buf0 | +276.4% | +30.4% | 2.29 | -39.0% | 325 |
| 5 | MA110/Bear100/CD1/TH10/Buf0 | +274.3% | +30.2% | 2.30 | -39.6% | 188 |
| 6 | MA120/Bear100/CD1/TH2/Buf0 | +275.5% | +30.3% | 2.29 | -39.3% | 463 |
| 7 | MA120/Bear100/CD1/TH6/Buf0 | +277.1% | +30.4% | 2.29 | -39.5% | 195 |
| 8 | MA110/Bear100/CD1/TH4/Buf0 | +268.2% | +29.8% | 2.31 | -38.5% | 273 |
| 9 | MA110/Bear100/CD1/TH8/Buf0 | +271.2% | +30.0% | 2.30 | -39.6% | 191 |
| 10 | MA120/Bear100/CD1/TH5/Buf0 | +271.7% | +30.1% | 2.28 | -38.4% | 219 |

## Key Insights
- **Buffer 0%** dominates top 30 — aggressive bear detection outperforms
- **Cooldown 1d** best — fast reaction to trend changes
- **MA120** slightly better than MA110
- **Bear 100%** unanimous — full cash protection in bear
- **Threshold 10%** highest score but TH4-8 close — less sensitive to this param
- Composite score: 35% Sharpe + 35% normalized return + 30% normalized drawdown

## Applied Config
```
thresholdPct: 10
trendFilterMA: 120
trendFilterCooldownDays: 1
trendFilterBuffer: 0
bearCashPct: 100
cashReservePct: 0
```
