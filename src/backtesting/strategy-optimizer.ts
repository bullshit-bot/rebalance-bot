import { backtestSimulator } from './backtest-simulator'
import type { BacktestConfig } from './backtest-simulator'
import { generateParameterGrid } from './optimizer-parameter-grids'
import type { StrategyType } from '@rebalancer/strategies/strategy-config-types'
import type { Allocation } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptimizationBaseConfig {
  exchange: string
  pairs: string[]
  timeframe: '1h' | '1d'
  startDate: number
  endDate: number
  initialBalance: number
  allocations: Allocation[]
  feePct: number
}

export interface OptimizationRequest extends OptimizationBaseConfig {
  /** Filter to specific strategy types; omit for all */
  strategyTypes?: StrategyType[]
  /** Number of top results to return (default 20) */
  topN?: number
}

export interface OptimizationResultItem {
  rank: number
  label: string
  strategyType: string
  params: Record<string, unknown>
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  totalTrades: number
  compositeScore: number
}

export interface OptimizationResult {
  results: OptimizationResultItem[]
  bestStrategy: string
  totalCombinations: number
  ranCombinations: number
  skippedCombinations: number
  elapsedMs: number
}

// ─── StrategyOptimizer ────────────────────────────────────────────────────────

/**
 * Grid-search optimizer: runs backtests across all parameter combinations for
 * each strategy type, ranks results by composite score, and returns the top N.
 *
 * Composite score: 0.4 × Sharpe + 0.3 × normalisedReturn + 0.3 × (1 - drawdown/100)
 * Runs sequentially to avoid MongoDB write contention.
 */
class StrategyOptimizer {
  async optimize(
    request: OptimizationRequest,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<OptimizationResult> {
    const { strategyTypes, topN = 20, ...baseConfig } = request
    const grid = generateParameterGrid(strategyTypes)
    const total = grid.length
    const startMs = Date.now()

    const results: OptimizationResultItem[] = []
    let skipped = 0

    for (let i = 0; i < grid.length; i++) {
      const combo = grid[i]!
      onProgress?.(i, total)

      try {
        // Build a full BacktestConfig for this combo
        const config: BacktestConfig = {
          ...baseConfig,
          exchange: baseConfig.exchange as import('@/types/index').ExchangeName,
          threshold: 5, // fallback threshold; strategies use their own params
          strategyType: combo.strategyType,
          strategyParams: combo.strategyParams as import('@rebalancer/strategies/strategy-config-types').StrategyParams,
        }

        const result = await backtestSimulator.run(config)
        const m = result.metrics

        results.push({
          rank: 0, // assigned after sorting
          label: combo.label,
          strategyType: combo.strategyType,
          params: combo.strategyParams,
          totalReturn: m.totalReturnPct,
          sharpeRatio: m.sharpeRatio,
          maxDrawdown: m.maxDrawdownPct,
          totalTrades: m.totalTrades,
          compositeScore: 0, // computed below
        })
      } catch (err) {
        skipped++
        console.warn(
          `[Optimizer] ${combo.label} failed:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    onProgress?.(total, total)

    // Compute composite scores and assign ranks
    const maxReturn = Math.max(...results.map((r) => r.totalReturn), 1)
    for (const r of results) {
      const normReturn = Math.max(0, r.totalReturn) / maxReturn
      const normDD = 1 - Math.min(Math.abs(r.maxDrawdown), 100) / 100
      r.compositeScore = 0.4 * r.sharpeRatio + 0.3 * normReturn + 0.3 * normDD
    }

    // Sort descending by composite score
    results.sort((a, b) => b.compositeScore - a.compositeScore)

    // Assign ranks (1-based)
    results.forEach((r, idx) => {
      r.rank = idx + 1
    })

    const topResults = results.slice(0, topN)

    return {
      results: topResults,
      bestStrategy: topResults[0]?.label ?? 'none',
      totalCombinations: total,
      ranCombinations: results.length,
      skippedCombinations: skipped,
      elapsedMs: Date.now() - startMs,
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const strategyOptimizer = new StrategyOptimizer()
export { StrategyOptimizer }
