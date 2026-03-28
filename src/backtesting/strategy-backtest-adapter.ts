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

    if (p.type === 'momentum-weighted') {
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
    // use fixed-threshold check (allocations may be adjusted in getEffectiveAllocations)
    return this._exceedsThreshold(holdings, allocations, totalValueUsd, fallbackThreshold)
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

  /** Distribute weights equally across all allocations. */
  private _equalWeightAllocations(allocations: Allocation[]): Allocation[] {
    if (allocations.length === 0) return []
    const equalPct = 100 / allocations.length
    return allocations.map((a) => ({ ...a, targetPct: equalPct }))
  }
}
