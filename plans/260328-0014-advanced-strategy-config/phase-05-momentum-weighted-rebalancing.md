---
title: "Momentum-Weighted Rebalancing"
status: pending
priority: P2
effort: 3h
---

# Phase 5: Momentum-Weighted Rebalancing

## Context Links

- [Research: Advanced Strategies](../reports/researcher-260328-0014-advanced-rebalancing-strategies.md) — Sections 1 & 5
- [Phase 1: Config Backend](./phase-01-strategy-config-backend.md) — depends on config model
- Existing momentum calculator: `src/rebalancer/momentum-calculator.ts` (simple 30d price momentum)
- Strategy manager: `src/rebalancer/strategy-manager.ts`
- Trade calculator: `src/rebalancer/trade-calculator.ts`

## Overview

Enhance the existing `momentum-tilt` strategy with RSI + MACD scoring for each asset. Adjust target weights by up to +/-40% from base allocation based on a composite momentum score. Assets with strong bullish momentum get weight boost; bearish get weight reduction.

**Expected improvement:** 15-30% additional return in trending markets.

**Risk:** Significant underperformance (-20% to -40%) in sideways/choppy markets — must pair with volatility filter.

## Key Insights

- Current `momentum-tilt` uses simple 30d price momentum (price change ratio) and 50/50 blend
- New approach: composite score from RSI (14d) + MACD (12/26) → normalized to [-1, +1]
- Weight adjustment: `effective_target = base_target * (1 + weightFactor * momentumScore)`
  - weightFactor=0.4 means max +/-40% deviation from base
- RSI > 70 = overbought (reduce weight), RSI < 30 = oversold (increase weight for mean-reversion)
- MACD histogram positive = bullish momentum, negative = bearish
- Must renormalize weights to sum to 100% after adjustment

## Requirements

### Functional
- Compute RSI (configurable period, default 14d) per asset from price history
- Compute MACD (configurable fast/slow, default 12/26) per asset from price history
- Composite momentum score: blend RSI signal + MACD signal into [-1, +1] range
- Adjust target allocations: `target *= (1 + weightFactor * score)`, then renormalize
- Parameters: `rsiPeriod` (default 14), `macdFast` (default 12), `macdSlow` (default 26), `weightFactor` (default 0.4)
- Integrate as `momentum-weighted` strategy mode in StrategyManager

### Non-Functional
- Indicator calculation <5ms per asset
- Requires minimum `macdSlow + 1` daily price samples before producing valid signals
- Graceful degradation: if insufficient data, fall back to base allocations

## Architecture

```
price:update → MomentumWeightedStrategy.recordPrice(asset, price)
  → Updates internal price history per asset
  → Computes RSI + MACD on demand when getEffectiveAllocations() called

RebalanceEngine.execute()
  → StrategyManager.getEffectiveAllocations(baseAllocations)
    → if mode === 'momentum-weighted':
      → MomentumWeightedStrategy.getEffectiveAllocations(baseAllocations)
        → For each asset: compute RSI score + MACD score → composite
        → Adjust: target * (1 + weightFactor * composite)
        → Renormalize to 100%
```

## Related Code Files

### Create
- `src/rebalancer/strategies/momentum-weighted-strategy.ts` — RSI + MACD calculation, weight adjustment
- `src/rebalancer/strategies/technical-indicators.ts` — Pure functions: computeRSI(), computeMACD(), computeEMA()

### Modify
- `src/rebalancer/strategy-manager.ts` — add `momentum-weighted` mode, delegate to MomentumWeightedStrategy
- `src/rebalancer/momentum-calculator.ts` — consider deprecating in favor of new strategy (or keep as lightweight fallback for `momentum-tilt`)

### No Deletes

## Implementation Steps

### Step 1: Technical Indicators Module

Create `src/rebalancer/strategies/technical-indicators.ts`:

```typescript
// Pure stateless functions — no side effects, easy to test

/** Exponential Moving Average */
export function computeEMA(prices: number[], period: number): number[]

/** Relative Strength Index (0-100) */
export function computeRSI(prices: number[], period: number): number[]

/** MACD: { macdLine, signalLine, histogram } */
export function computeMACD(
  prices: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod?: number // default 9
): { macdLine: number[], signalLine: number[], histogram: number[] }
```

RSI algorithm:
1. Compute daily gains/losses
2. Average gain/loss over period (first = SMA, subsequent = smoothed)
3. RS = avgGain / avgLoss
4. RSI = 100 - (100 / (1 + RS))

MACD algorithm:
1. Compute fast EMA and slow EMA of prices
2. MACD line = fast EMA - slow EMA
3. Signal line = EMA of MACD line (9 period default)
4. Histogram = MACD line - signal line

### Step 2: MomentumWeightedStrategy Module

Create `src/rebalancer/strategies/momentum-weighted-strategy.ts`:

```typescript
class MomentumWeightedStrategy {
  private priceHistory: Map<string, number[]> = new Map()
  private lastDayBucket: Map<string, number> = new Map()

  // Config
  private rsiPeriod = 14
  private macdFast = 12
  private macdSlow = 26
  private weightFactor = 0.4

  // Record daily close price per asset
  recordPrice(asset: string, price: number): void

  // Compute composite momentum score for an asset: [-1, +1]
  getMomentumScore(asset: string): number {
    // RSI score: normalize RSI to [-1, +1]
    //   RSI > 70 → positive (sell signal, reduce weight)
    //   RSI < 30 → negative (buy signal, increase weight)
    //   Actually for momentum: RSI 50-100 = bullish (+), RSI 0-50 = bearish (-)
    //   rsiScore = (rsi - 50) / 50  → range [-1, +1]

    // MACD score: normalize histogram
    //   histogram > 0 = bullish, < 0 = bearish
    //   Normalize by dividing by recent price to get relative magnitude
    //   macdScore = clamp(histogram / (price * 0.01), -1, 1)

    // Composite = (rsiScore + macdScore) / 2 → range [-1, +1]
  }

  // Adjust allocations based on momentum scores
  getEffectiveAllocations(baseAllocations: Allocation[]): Allocation[] {
    // For each asset: target *= (1 + weightFactor * score)
    // Renormalize to 100%
    // If insufficient data for any asset, use base allocation for that asset
  }

  applyConfig(params: MomentumWeightedParams): void
  getAllScores(): Record<string, { rsi: number, macd: number, composite: number }>
}
```

### Step 3: Integrate with StrategyManager

Update `src/rebalancer/strategy-manager.ts`:
- Add `'momentum-weighted'` to StrategyMode union
- Import and instantiate MomentumWeightedStrategy
- In `getEffectiveAllocations()`: add case for `momentum-weighted`
- In `applyConfig()`: delegate to MomentumWeightedStrategy for params
- Feed price updates: on `price:update` events, call `momentumWeighted.recordPrice()`

### Step 4: Add to Env Config

In `src/config/app-config.ts`:
- Add `'momentum-weighted'` to STRATEGY_MODE enum

### Step 5: Tests

Unit tests for `technical-indicators.ts`:
- EMA converges to known values for simple series
- RSI = 50 for flat prices, >70 for strong uptrend, <30 for strong downtrend
- MACD histogram positive during uptrend, negative during downtrend
- Edge cases: insufficient data returns empty arrays

Unit tests for `momentum-weighted-strategy.ts`:
- Bullish asset gets weight boost (score > 0 → target increases)
- Bearish asset gets weight reduction (score < 0 → target decreases)
- Weights renormalize to 100% after adjustment
- weightFactor=0 returns base allocations unchanged
- Insufficient price data falls back to base allocations

## Todo List

- [ ] Create `src/rebalancer/strategies/technical-indicators.ts` (EMA, RSI, MACD)
- [ ] Create `src/rebalancer/strategies/momentum-weighted-strategy.ts`
- [ ] Add `momentum-weighted` to StrategyMode type
- [ ] Integrate MomentumWeightedStrategy into StrategyManager
- [ ] Feed price updates to strategy via EventBus listener
- [ ] Add `momentum-weighted` to env STRATEGY_MODE enum
- [ ] Write unit tests for technical indicators
- [ ] Write unit tests for MomentumWeightedStrategy
- [ ] Update StrategyManager tests for new mode

## Success Criteria

- [ ] RSI and MACD compute correctly against known test vectors
- [ ] Composite momentum score in [-1, +1] range
- [ ] Bullish assets get weight boost proportional to score * weightFactor
- [ ] Total allocation sums to 100% after adjustment
- [ ] Graceful fallback to base allocations when insufficient data
- [ ] Strategy loads params from DB config (via Phase 1)
- [ ] weightFactor=0 produces no deviation from base

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Whipsaw in choppy markets | High — frequent false signals | Consider adding volatility filter: only apply momentum when vol > threshold |
| RSI/MACD divergence (conflicting signals) | Medium | Composite score averages both; extreme divergence caps at +/-0.5 |
| Insufficient price history on cold start | Low | Require macdSlow + 1 samples; fall back to base allocations until then |
| Overfitting to recent momentum | Medium | weightFactor caps max deviation at +/-40%; user can reduce further |

## Security Considerations

- No external data dependencies — uses internal price data from exchange feed
- Config params validated by Zod schema (Phase 1)
- Weight adjustment bounded by weightFactor — cannot produce negative allocations
