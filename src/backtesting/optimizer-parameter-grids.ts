import type { StrategyType } from '@rebalancer/strategies/strategy-config-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParamCombination {
  strategyType: StrategyType
  strategyParams: Record<string, unknown>
  label: string
}

// ─── Grid generators ──────────────────────────────────────────────────────────

/**
 * Generates threshold strategy combos.
 * Varies: thresholdPct [2, 3, 5, 8, 10, 15] = 6 combos
 */
function thresholdGrid(): ParamCombination[] {
  return [2, 3, 5, 8, 10, 15].map((t) => ({
    strategyType: 'threshold' as StrategyType,
    strategyParams: { type: 'threshold', thresholdPct: t, minTradeUsd: 10 },
    label: `threshold-${t}%`,
  }))
}

/**
 * Generates equal-weight strategy combos.
 * Varies: thresholdPct [2, 3, 5, 8, 10, 15] = 6 combos
 */
function equalWeightGrid(): ParamCombination[] {
  return [2, 3, 5, 8, 10, 15].map((t) => ({
    strategyType: 'equal-weight' as StrategyType,
    strategyParams: { type: 'equal-weight', thresholdPct: t, minTradeUsd: 10 },
    label: `ew-${t}%`,
  }))
}

/**
 * Generates mean-reversion combos.
 * lookbackDays [14, 30, 60] × bandWidthSigma [1, 1.5, 2] × minDriftPct [2, 3, 5] = 27 combos
 */
function meanReversionGrid(): ParamCombination[] {
  const combos: ParamCombination[] = []
  for (const lb of [14, 30, 60]) {
    for (const bw of [1, 1.5, 2]) {
      for (const md of [2, 3, 5]) {
        combos.push({
          strategyType: 'mean-reversion' as StrategyType,
          strategyParams: { type: 'mean-reversion', lookbackDays: lb, bandWidthSigma: bw, minDriftPct: md, minTradeUsd: 10 },
          label: `mr-${lb}d-${bw}σ-${md}%`,
        })
      }
    }
  }
  return combos
}

/**
 * Generates vol-adjusted combos.
 * baseThresholdPct [3, 5, 8] × volLookbackDays [14, 30] × minThresholdPct [2, 3] × maxThresholdPct [15, 20] = 24 combos
 */
function volAdjustedGrid(): ParamCombination[] {
  const combos: ParamCombination[] = []
  for (const base of [3, 5, 8]) {
    for (const vlb of [14, 30]) {
      for (const min of [2, 3]) {
        for (const max of [15, 20]) {
          combos.push({
            strategyType: 'vol-adjusted' as StrategyType,
            strategyParams: { type: 'vol-adjusted', baseThresholdPct: base, volLookbackDays: vlb, minThresholdPct: min, maxThresholdPct: max, minTradeUsd: 10 },
            label: `va-${base}%-${vlb}d-min${min}-max${max}`,
          })
        }
      }
    }
  }
  return combos
}

/**
 * Generates momentum-weighted combos.
 * rsiPeriod [7, 14] × macdSets [12/26, 8/21] × weightFactor [0.2, 0.4] = 8 combos
 */
function momentumWeightedGrid(): ParamCombination[] {
  const combos: ParamCombination[] = []
  for (const rsi of [7, 14]) {
    for (const [fast, slow] of [[12, 26], [8, 21]]) {
      for (const wf of [0.2, 0.4]) {
        combos.push({
          strategyType: 'momentum-weighted' as StrategyType,
          strategyParams: { type: 'momentum-weighted', rsiPeriod: rsi, macdFast: fast, macdSlow: slow, weightFactor: wf, minTradeUsd: 10 },
          label: `mw-rsi${rsi}-${fast}/${slow}-w${wf}`,
        })
      }
    }
  }
  return combos
}

/**
 * Generates momentum-tilt combos.
 * thresholdPct [3, 5, 8] × momentumWindowDays [7, 14, 30] × momentumWeight [0.3, 0.5, 0.7] = 27 combos
 */
function momentumTiltGrid(): ParamCombination[] {
  const combos: ParamCombination[] = []
  for (const t of [3, 5, 8]) {
    for (const w of [7, 14, 30]) {
      for (const mw of [0.3, 0.5, 0.7]) {
        combos.push({
          strategyType: 'momentum-tilt' as StrategyType,
          strategyParams: { type: 'momentum-tilt', thresholdPct: t, momentumWindowDays: w, momentumWeight: mw, minTradeUsd: 10 },
          label: `mt-${t}%-${w}d-${mw}wt`,
        })
      }
    }
  }
  return combos
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all parameter combinations across every strategy type.
 * Total: 6 + 6 + 27 + 24 + 8 + 27 = 98 combos
 *
 * @param strategyTypes - optional filter; if omitted returns all strategies
 */
export function generateParameterGrid(strategyTypes?: StrategyType[]): ParamCombination[] {
  const all: ParamCombination[] = [
    ...thresholdGrid(),
    ...equalWeightGrid(),
    ...meanReversionGrid(),
    ...volAdjustedGrid(),
    ...momentumWeightedGrid(),
    ...momentumTiltGrid(),
  ]

  if (!strategyTypes || strategyTypes.length === 0) return all
  return all.filter((c) => strategyTypes.includes(c.strategyType))
}
