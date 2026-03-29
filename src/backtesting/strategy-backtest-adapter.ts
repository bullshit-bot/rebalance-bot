import type { Allocation } from '@/types/index'
import type { StrategyParams } from '@rebalancer/strategies/strategy-config-types'
import { MeanReversionStrategy } from '@rebalancer/strategies/mean-reversion-strategy'
import { VolAdjustedStrategy } from '@rebalancer/strategies/vol-adjusted-strategy'
import { MomentumWeightedStrategy } from '@rebalancer/strategies/momentum-weighted-strategy'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoldingState {
  amount: number
  valueUsd: number
}

// ─── StrategyBacktestAdapter ──────────────────────────────────────────────────

/**
 * Bridges strategy modules and the backtest simulator.
 *
 * Creates ISOLATED strategy instances per backtest run to prevent singleton
 * state pollution across multiple concurrent or sequential runs.
 *
 * Responsibilities:
 *  - Accumulate per-candle state (drift, vol, price history)
 *  - Dispatch rebalance decisions to the appropriate strategy
 *  - Return effective allocations (momentum-weighted, equal-weight)
 */
export class StrategyBacktestAdapter {
  private readonly meanReversion?: MeanReversionStrategy
  private readonly volAdjusted?: VolAdjustedStrategy
  private readonly momentumWeighted?: MomentumWeightedStrategy

  // Price history per asset (symbol without /USDT suffix) for momentum-weighted
  private readonly priceHistories = new Map<string, number[]>()

  constructor(private readonly params: StrategyParams) {
    if (params.type === 'mean-reversion') {
      this.meanReversion = new MeanReversionStrategy()
    } else if (params.type === 'vol-adjusted') {
      this.volAdjusted = new VolAdjustedStrategy()
    } else if (params.type === 'momentum-weighted') {
      this.momentumWeighted = new MomentumWeightedStrategy()
    }
    // momentum-tilt uses priceHistories for simple momentum scoring (no dedicated class needed)
  }

  // ─── State accumulation ──────────────────────────────────────────────────

  /**
   * Feed candle-level data into strategy internals.
   * Call once per candle iteration, before checking shouldRebalance.
   *
   * @param drifts       - asset (symbol w/o /USDT) → current drift %
   * @param currentVol   - annualised portfolio volatility for this candle
   * @param prices       - pair (with /USDT) → close price for this candle
   */
  updateState(
    drifts: Map<string, number>,
    currentVol: number,
    prices: Record<string, number>,
  ): void {
    const p = this.params

    if (p.type === 'mean-reversion' && this.meanReversion) {
      for (const [asset, drift] of drifts) {
        this.meanReversion.recordDrift(asset, drift, p.lookbackDays)
      }
    }

    if (p.type === 'vol-adjusted' && this.volAdjusted) {
      this.volAdjusted.recordVolatility(currentVol, p.volLookbackDays)
    }

    if (p.type === 'momentum-weighted' || p.type === 'momentum-tilt') {
      // Accumulate close prices per asset (strip /USDT suffix)
      for (const [pair, price] of Object.entries(prices)) {
        const asset = pair.replace('/USDT', '')
        const history = this.priceHistories.get(asset) ?? []
        history.push(price)
        this.priceHistories.set(asset, history)
      }
    }
  }

  // ─── Rebalance decision ──────────────────────────────────────────────────

  /**
   * Decide whether to rebalance given current portfolio state.
   * Falls back to fixed-threshold check when the strategy type has no
   * custom rebalance logic (equal-weight, momentum-tilt, threshold).
   */
  needsRebalance(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    totalValueUsd: number,
    fallbackThreshold: number,
  ): boolean {
    if (totalValueUsd <= 0) return false

    const p = this.params

    if (p.type === 'mean-reversion' && this.meanReversion) {
      // Build drift map for the strategy
      const drifts = this._buildDrifts(holdings, allocations, totalValueUsd)
      return this.meanReversion.shouldRebalance(drifts, p)
    }

    if (p.type === 'vol-adjusted' && this.volAdjusted) {
      const threshold = this.volAdjusted.getDynamicThreshold(p)
      return this._exceedsThreshold(holdings, allocations, totalValueUsd, threshold)
    }

    // momentum-weighted, momentum-tilt, equal-weight, threshold:
    // use threshold from strategy params if available, otherwise fallback
    const threshold = ('thresholdPct' in p && typeof p.thresholdPct === 'number')
      ? p.thresholdPct
      : fallbackThreshold
    return this._exceedsThreshold(holdings, allocations, totalValueUsd, threshold)
  }

  // ─── Effective allocations ───────────────────────────────────────────────

  /**
   * Return the allocations to use for the upcoming rebalance.
   * For momentum-weighted: returns momentum-adjusted weights.
   * For equal-weight: returns evenly distributed weights.
   * For all other types: returns base allocations unchanged.
   */
  getEffectiveAllocations(baseAllocations: Allocation[]): Allocation[] {
    const p = this.params

    if (p.type === 'momentum-weighted' && this.momentumWeighted) {
      return this.momentumWeighted.getAdjustedAllocations(baseAllocations, this.priceHistories, p)
    }

    if (p.type === 'equal-weight') {
      return this._equalWeightAllocations(baseAllocations)
    }

    if (p.type === 'momentum-tilt') {
      return this._momentumTiltAllocations(baseAllocations)
    }

    return baseAllocations
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /** Build asset → drift map from current holdings vs. targets. */
  private _buildDrifts(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    totalValueUsd: number,
  ): Map<string, number> {
    const drifts = new Map<string, number>()
    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const currentPct = totalValueUsd > 0
        ? ((holdings[pair]?.valueUsd ?? 0) / totalValueUsd) * 100
        : 0
      drifts.set(alloc.asset, currentPct - alloc.targetPct)
    }
    return drifts
  }

  /** Returns true if any asset exceeds `threshold` drift from its target. */
  private _exceedsThreshold(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    totalValueUsd: number,
    threshold: number,
  ): boolean {
    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const currentPct = ((holdings[pair]?.valueUsd ?? 0) / totalValueUsd) * 100
      if (Math.abs(currentPct - alloc.targetPct) >= threshold) return true
    }
    return false
  }

  /**
   * Tilt allocations toward assets with positive momentum.
   * Uses simple return over momentumWindowDays as the signal.
   * momentumWeight controls how much to shift (0=no tilt, 1=full tilt).
   */
  private _momentumTiltAllocations(allocations: Allocation[]): Allocation[] {
    const p = this.params
    const windowDays = ('momentumWindowDays' in p && typeof p.momentumWindowDays === 'number')
      ? p.momentumWindowDays : 14
    const weight = ('momentumWeight' in p && typeof p.momentumWeight === 'number')
      ? p.momentumWeight : 0.3

    // Calculate momentum score per asset (simple % return over window)
    const scores = new Map<string, number>()
    for (const alloc of allocations) {
      const history = this.priceHistories.get(alloc.asset)
      if (!history || history.length < windowDays + 1) {
        scores.set(alloc.asset, 0)
        continue
      }
      const recent = history[history.length - 1]!
      const past = history[history.length - 1 - windowDays]!
      scores.set(alloc.asset, past > 0 ? (recent - past) / past : 0)
    }

    // Tilt: shift weight from underperformers to outperformers
    const avgScore = [...scores.values()].reduce((s, v) => s + v, 0) / scores.size
    const adjusted = allocations.map((a) => {
      const score = scores.get(a.asset) ?? 0
      const tilt = (score - avgScore) * weight * 100 // convert to percentage points
      return { ...a, targetPct: Math.max(1, a.targetPct + tilt) } // min 1% to avoid zero
    })

    // Normalise to 100%
    const total = adjusted.reduce((s, a) => s + a.targetPct, 0)
    return adjusted.map((a) => ({ ...a, targetPct: (a.targetPct / total) * 100 }))
  }

  /** Distribute weights equally across all allocations. */
  private _equalWeightAllocations(allocations: Allocation[]): Allocation[] {
    if (allocations.length === 0) return []
    const equalPct = 100 / allocations.length
    return allocations.map((a) => ({ ...a, targetPct: equalPct }))
  }
}
