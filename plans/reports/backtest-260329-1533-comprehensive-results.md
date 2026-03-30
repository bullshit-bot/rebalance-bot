---
title: Comprehensive Backtest Results
description: Full backtest analysis across all strategies, allocations, and timeframes
type: backtest-report
created: 2026-03-29
---

# Comprehensive Backtest Results — 2026-03-29

## Test Parameters
- Initial: $1,000 | DCA: $20/day | Fee: 0.1% | Timeframe: 1d | Exchange: Binance
- Assets: BTC, ETH, BNB, SOL (paired with USDT)
- Data: 2021-03-30 to 2026-03-29 (5Y) and 2020-08-11 to 2026-03-29 (6Y)

## Asset Prices (5Y period)
| Asset | Start | End | Change |
|-------|-------|-----|--------|
| BTC | $58,747 | $66,700 | +14% |
| ETH | $1,840 | $2,006 | +9% |
| BNB | $311 | $615 | +97% |
| SOL | $19 | $83 | +333% |

---

## Part 1: Basic Strategies (BTC 40/ETH 30/BNB 15/SOL 15)

| Strategy | Invested | Final | Profit | Return | Max DD |
|----------|----------|-------|--------|--------|--------|
| Rebalance + DCA (no filter) | $37,500 | $58,136 | +$20,636 | +55.0% | -59.4% |
| Buy & Hold + DCA | $37,500 | $52,532 | +$15,032 | +40.1% | -65.4% |
| Buy & Hold (no DCA) | $1,000 | $1,724 | +$724 | +72.4% | -85.7% |

**Takeaway:** Rebalancing outperforms hold+DCA by +$5,604 (+10.7%). DCA is main profit driver.

---

## Part 2: Trend Filter Scenarios (same allocation)

| Strategy | Invested | Final | Profit | Return | Max DD |
|----------|----------|-------|--------|--------|--------|
| No filter (baseline) | $37,500 | $55,409 | +$17,909 | +47.8% | -62.5% |
| MA100 + 70% cash | $37,500 | $86,103 | +$48,603 | +129.6% | -36.9% |
| MA200 + 80% cash | $37,500 | $77,646 | +$40,146 | +107.1% | -36.9% |
| MA200 + 70% cash | $37,500 | $76,406 | +$38,906 | +103.7% | -36.9% |
| MA200 + DCA 2x bear | $51,580 | $107,164 | +$55,584 | +107.8% | -36.9% |
| MA200 + DCA 3x bear | $65,660 | $138,072 | +$72,412 | +110.3% | -36.9% |

**Takeaway:** MA100 trend filter = best return. All filters 2-3x better than no filter.

---

## Part 3: Grid Search Optimizer (4800 combinations)

### Parameters Tested
- MA periods: 50, 100, 150, 200
- Bear cash %: 50, 60, 70, 80, 90
- Bull cash %: 0, 5, 10, 15, 20
- DCA multipliers: 1, 2, 3, 5
- Rebalance thresholds: 3, 5, 7, 10%
- Allocations: 8 sets (BTC+ETH >= 60%)

### TOP 5 — Same Investment ($37.5k)

| # | Allocation | MA | Bear | Thr | Final | Profit | Return | Max DD |
|---|------------|-----|------|-----|-------|--------|--------|--------|
| 1 | BTC35/ETH30/BNB15/SOL20 | 100 | 90% | 7% | $106,731 | +$69,231 | +184.6% | -38.4% |
| 2 | BTC35/ETH30/BNB15/SOL20 | 150 | 90% | 3% | $106,725 | +$69,225 | +184.6% | -39.6% |
| 3 | BTC35/ETH25/BNB20/SOL20 | 100 | 90% | 10% | $106,108 | +$68,608 | +183.0% | -41.2% |
| 4 | BTC40/ETH25/BNB15/SOL20 | 150 | 90% | 3% | $105,439 | +$67,939 | +181.2% | -38.9% |
| 5 | BTC40/ETH25/BNB15/SOL20 | 100 | 90% | 7% | $105,193 | +$67,693 | +180.5% | -39.7% |

### Best Risk-Adjusted
BTC40/ETH25/BNB15/SOL20 | MA50 | Bear90% | Bull0% | Thr3%
- Return/MaxDD ratio: 6.17 (highest)
- Drawdown only -28.2%

---

## Part 4: Comprehensive Scenarios (13 tests)

| # | Scenario | Period | Invested | Final | Profit | Return | Annual | Max DD |
|---|----------|--------|----------|-------|--------|--------|--------|--------|
| 1 | Baseline (no filter) | 5Y | $37,500 | $55,430 | +$17,930 | +47.8% | 8.1% | -62.5% |
| 2 | MA100 filter | 5Y | $37,500 | $93,733 | +$56,233 | +150.0% | 20.1% | -34.7% |
| 3 | MA100 + DCA 2x bear | 5Y | $54,080 | $136,301 | +$82,221 | +152.0% | 20.3% | -34.7% |
| 4 | MA100 + DCA 3x bear | 5Y | $70,660 | $178,911 | +$108,251 | +153.2% | 20.4% | -34.7% |
| 5 | MA100 + SOL 20% | 5Y | $37,500 | $98,725 | +$61,225 | +163.3% | 21.3% | -33.7% |
| 6 | MA100 + SOL 30% | 5Y | $37,500 | $111,080 | +$73,580 | +196.2% | 24.2% | -33.9% |
| 7 | MA100 + Lump sum bear | 5Y | $37,500 | $82,832 | +$45,332 | +120.9% | 17.2% | -30.5% |
| 8 | MA100+DCA3x+SOL20% | 5Y | $70,660 | $187,759 | +$117,099 | +165.7% | 21.6% | -33.7% |
| 9 | ALL COMBINED | 5Y | $54,080 | $131,922 | +$77,842 | +143.9% | 19.5% | -31.8% |
| 10 | Baseline (no filter) | 6Y | $42,120 | $127,973 | +$85,853 | +203.8% | 21.8% | -87.2% |
| 11 | MA100 filter | 6Y | $42,120 | $356,660 | +$314,540 | +746.8% | 46.1% | -32.7% |
| 12 | MA100+DCA3x+SOL20% | 6Y | $77,600 | $518,990 | +$441,390 | +568.8% | 40.1% | -33.7% |
| 13 | ALL COMBINED | 6Y | $59,860 | $366,708 | +$306,848 | +512.6% | 37.9% | -34.0% |

---

## Part 5: USDT Reserve Impact

| USDT Reserve | Final | Profit | Return | Max DD | Risk-Adj |
|-------------|-------|--------|--------|--------|----------|
| 0% (all-in) | $300,419 | +$190,839 | +174.2% | -28.2% | 6.17 |
| 5% | $288,096 | +$178,516 | +162.9% | -26.6% | 6.13 |
| 10% | $275,161 | +$165,581 | +151.1% | -24.7% | 6.12 |
| 15% | $262,789 | +$153,209 | +139.8% | -23.0% | 6.09 |
| 20% | $250,850 | +$141,270 | +128.9% | -21.0% | 6.14 |

**Takeaway:** Risk-adjusted nearly identical. 10% USDT = good balance.

---

## Recommended Production Config

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Allocation | BTC 40% / ETH 25% / BNB 15% / SOL 20% | Blue-chip heavy, SOL for upside |
| Strategy | threshold 5% | Simple, proven |
| Trend filter | MA100, Bear 90% cash | 3x return improvement |
| Cooldown | 3 days | Anti-whipsaw |
| Cash reserve | 10% USDT | Buffer for opportunities |
| DCA | $20/day, 2x during bear | Accumulate at lower prices |
| Expected | ~20%/year, max DD ~34% | |

## Caveats
- All results are in-sample (same 5Y data). Walk-forward validation needed.
- SOL-heavy allocations win partly due to hindsight (SOL +333%).
- Slippage not modeled (real trades may cost +0.1-0.3% extra).
- 2021-2026 includes only 1 full bull-bear cycle.
- Past performance does not guarantee future results.
