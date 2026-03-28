import { randomUUID } from 'node:crypto'
import { BacktestResultModel } from '@db/database'
import type { Allocation, ExchangeName, Portfolio, PortfolioAsset } from '@/types/index'
import { calculateTrades } from '@rebalancer/trade-calculator'
import { historicalDataLoader } from './historical-data-loader'
import type { OHLCVCandle } from './historical-data-loader'
import { metricsCalculator } from './metrics-calculator'
import type { BacktestConfig, BacktestMetrics, SimulatedTrade } from './metrics-calculator'
import { benchmarkComparator } from './benchmark-comparator'
import type { BenchmarkResult } from './benchmark-comparator'
import { StrategyBacktestAdapter } from './strategy-backtest-adapter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacktestResult {
  id: string
  config: BacktestConfig
  metrics: BacktestMetrics
  trades: SimulatedTrade[]
  equityCurve: { timestamp: number; value: number }[]
  finalPortfolio: Record<string, { amount: number; valueUsd: number }>
  benchmark: BenchmarkResult
}

/** Per-asset holding tracked during simulation. */
interface HoldingState {
  amount: number    // base asset quantity
  valueUsd: number  // current USD value
}

// ─── BacktestSimulator ────────────────────────────────────────────────────────

/**
 * Runs a full portfolio-rebalancing backtest over historical OHLCV data.
 *
 * Algorithm per candle:
 *  1. Update current prices from candle close.
 *  2. Compute current allocation % for every asset.
 *  3. If the maximum drift from any target exceeds `config.threshold`, trigger
 *     a rebalance: compute trades via calculateTrades, apply them, deduct fees.
 *  4. Record an equity curve data point.
 *
 * After simulation: compute metrics, run benchmark comparison, persist to DB.
 */
class BacktestSimulator {
  async run(config: BacktestConfig): Promise<BacktestResult> {
    // ── 1. Load OHLCV data for all pairs ──────────────────────────────────────
    const ohlcvData = await this._loadAllPairs(config)

    // ── 2. Build a merged, chronological candle timeline ──────────────────────
    const timeline = this._buildTimeline(ohlcvData)
    if (timeline.length === 0) {
      throw new Error('[BacktestSimulator] No candle data found for the given config')
    }

    // ── 3. Initialise virtual portfolio ───────────────────────────────────────
    // Buy at the close price of the very first candle per target allocation.
    const firstPrices = this._pricesAtTimestamp(ohlcvData, timeline[0]!)
    const holdings = this._initHoldings(config, firstPrices)

    // Create strategy adapter when a non-default strategy is configured
    const adapter = config.strategyType && config.strategyType !== 'threshold' && config.strategyParams
      ? new StrategyBacktestAdapter(config.strategyParams)
      : null

    // Rolling window of recent daily returns for per-candle volatility estimate
    const recentReturns: number[] = []
    let prevTotalValue: number | null = null

    const trades: SimulatedTrade[] = []
    const equityCurve: { timestamp: number; value: number }[] = []

    // ── 4. Iterate through candles ────────────────────────────────────────────
    for (const ts of timeline) {
      const prices = this._pricesAtTimestamp(ohlcvData, ts)

      // Update USD values from current close prices
      for (const [pair, state] of Object.entries(holdings)) {
        const price = prices[pair]
        if (price !== undefined) state.valueUsd = state.amount * price
      }

      const totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0)

      // Maintain rolling return window for volatility calculation
      if (prevTotalValue !== null && prevTotalValue > 0) {
        recentReturns.push((totalValueUsd - prevTotalValue) / prevTotalValue)
        // Keep a 30-sample window (≈30 candles)
        if (recentReturns.length > 30) recentReturns.shift()
      }
      prevTotalValue = totalValueUsd

      // Compute current annualised volatility from recent returns
      const currentVol = this._annualisedVol(recentReturns)

      // Feed strategy state and check rebalance trigger
      let shouldRebalance: boolean
      let effectiveAllocations: Allocation[] = config.allocations

      if (adapter) {
        // Build drifts map (asset → drift %) for state update
        const drifts = new Map<string, number>()
        for (const alloc of config.allocations) {
          const pair = `${alloc.asset}/USDT`
          const currentPct = totalValueUsd > 0
            ? ((holdings[pair]?.valueUsd ?? 0) / totalValueUsd) * 100
            : 0
          drifts.set(alloc.asset, currentPct - alloc.targetPct)
        }

        adapter.updateState(drifts, currentVol, prices)
        shouldRebalance = adapter.needsRebalance(
          holdings,
          config.allocations,
          totalValueUsd,
          config.threshold,
        )
        if (shouldRebalance) {
          effectiveAllocations = adapter.getEffectiveAllocations(config.allocations)
        }
      } else {
        shouldRebalance = this._needsRebalance(
          holdings,
          config.allocations,
          totalValueUsd,
          config.threshold,
        )
      }

      if (shouldRebalance) {
        const rebalanceTrades = this._simulateRebalance(
          holdings,
          config,
          prices,
          totalValueUsd,
          ts,
          effectiveAllocations,
        )
        trades.push(...rebalanceTrades)
      }

      // Record equity after any rebalance
      const equity = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0)
      equityCurve.push({ timestamp: ts, value: equity })
    }

    // ── 5. Build final portfolio snapshot ────────────────────────────────────
    const finalPortfolio: Record<string, { amount: number; valueUsd: number }> = {}
    for (const [pair, state] of Object.entries(holdings)) {
      finalPortfolio[pair] = { amount: state.amount, valueUsd: state.valueUsd }
    }

    // ── 6. Compute metrics ────────────────────────────────────────────────────
    const metrics = metricsCalculator.calculate(equityCurve, trades, config)

    // ── 7. Benchmark comparison ───────────────────────────────────────────────
    const benchmark = benchmarkComparator.compare(
      { config, metrics, trades, equityCurve },
      ohlcvData,
    )

    const id = randomUUID()
    const result: BacktestResult = { id, config, metrics, trades, equityCurve, finalPortfolio, benchmark }

    // ── 8. Persist to DB ──────────────────────────────────────────────────────
    await this._persist(result)

    return result
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Loads OHLCV candles for every pair via getCachedData first; falls back to
   * loadData (exchange fetch + DB write) when cache is empty.
   */
  private async _loadAllPairs(config: BacktestConfig): Promise<Record<string, OHLCVCandle[]>> {
    const result: Record<string, OHLCVCandle[]> = {}

    for (const pair of config.pairs) {
      let candles = await historicalDataLoader.getCachedData({
        exchange: config.exchange,
        pair,
        timeframe: config.timeframe,
        since: config.startDate,
        until: config.endDate,
      })

      if (candles.length === 0) {
        candles = await historicalDataLoader.loadData({
          exchange: config.exchange,
          pair,
          timeframe: config.timeframe,
          since: config.startDate,
          until: config.endDate,
        })
      }

      // Filter to requested date range
      result[pair] = candles.filter(
        (c) => c.timestamp >= config.startDate && c.timestamp <= config.endDate,
      )
    }

    return result
  }

  /**
   * Merges all per-pair timestamps into a single sorted, deduplicated timeline.
   * Only timestamps where ALL pairs have a candle are included (inner join).
   */
  private _buildTimeline(ohlcvData: Record<string, OHLCVCandle[]>): number[] {
    const pairs = Object.keys(ohlcvData)
    if (pairs.length === 0) return []

    // Start with timestamps from first pair, intersect with the rest
    let common = new Set(ohlcvData[pairs[0]!]!.map((c) => c.timestamp))

    for (let i = 1; i < pairs.length; i++) {
      const pairTs = new Set(ohlcvData[pairs[i]!]!.map((c) => c.timestamp))
      common = new Set([...common].filter((ts) => pairTs.has(ts)))
    }

    return [...common].sort((a, b) => a - b)
  }

  /** Extracts a pair → close-price map for a given timestamp. */
  private _pricesAtTimestamp(
    ohlcvData: Record<string, OHLCVCandle[]>,
    ts: number,
  ): Record<string, number> {
    const prices: Record<string, number> = {}
    for (const [pair, candles] of Object.entries(ohlcvData)) {
      const candle = candles.find((c) => c.timestamp === ts)
      if (candle) prices[pair] = candle.close
    }
    return prices
  }

  /**
   * Initialises holdings by buying each target asset at its first available
   * price, proportional to target allocation weights.
   */
  private _initHoldings(
    config: BacktestConfig,
    prices: Record<string, number>,
  ): Record<string, HoldingState> {
    const holdings: Record<string, HoldingState> = {}

    for (const alloc of config.allocations) {
      const pair = `${alloc.asset}/USDT`
      const price = prices[pair]
      if (!price || price <= 0) continue

      const usdAlloc = (alloc.targetPct / 100) * config.initialBalance
      holdings[pair] = {
        amount: usdAlloc / price,
        valueUsd: usdAlloc,
      }
    }

    return holdings
  }

  /**
   * Computes annualised volatility from a window of fractional returns.
   * Returns 0 when fewer than 2 samples are available.
   */
  private _annualisedVol(returns: number[]): number {
    if (returns.length < 2) return 0
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
    return Math.sqrt(variance) * Math.sqrt(365)
  }

  /**
   * Returns true when any asset drifts more than `threshold` percentage points
   * from its target allocation.
   */
  private _needsRebalance(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    totalValueUsd: number,
    threshold: number,
  ): boolean {
    if (totalValueUsd <= 0) return false

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`
      const currentUsd = holdings[pair]?.valueUsd ?? 0
      const currentPct = (currentUsd / totalValueUsd) * 100
      const drift = Math.abs(currentPct - alloc.targetPct)
      if (drift >= threshold) return true
    }

    return false
  }

  /**
   * Simulates a rebalance:
   *  1. Builds a Portfolio snapshot from current holdings.
   *  2. Runs calculateTrades to determine required trades.
   *  3. Applies each trade (adjusting amounts), deducting fees.
   *  4. Returns SimulatedTrade records for audit trail.
   *
   * @param effectiveAllocations - targets to use; defaults to config.allocations
   *                               (overridden by momentum-weighted / equal-weight)
   */
  private _simulateRebalance(
    holdings: Record<string, HoldingState>,
    config: BacktestConfig,
    prices: Record<string, number>,
    totalValueUsd: number,
    ts: number,
    effectiveAllocations: Allocation[] = config.allocations,
  ): SimulatedTrade[] {
    // Build Portfolio shape expected by calculateTrades
    const portfolio: Portfolio = {
      totalValueUsd,
      updatedAt: ts,
      assets: effectiveAllocations
        .map((alloc): PortfolioAsset | null => {
          const pair = `${alloc.asset}/USDT`
          const holding = holdings[pair]
          const price = prices[pair]
          if (!holding || !price) return null

          const currentPct = totalValueUsd > 0 ? (holding.valueUsd / totalValueUsd) * 100 : 0
          return {
            asset: alloc.asset,
            amount: holding.amount,
            valueUsd: holding.valueUsd,
            currentPct,
            targetPct: alloc.targetPct,
            driftPct: currentPct - alloc.targetPct,
            exchange: (alloc.exchange ?? config.exchange) as ExchangeName,
          }
        })
        .filter((a): a is PortfolioAsset => a !== null),
    }

    const orders = calculateTrades(portfolio, effectiveAllocations, prices)
    const simTrades: SimulatedTrade[] = []

    for (const order of orders) {
      const price = prices[order.pair]
      if (!price || price <= 0) continue

      // order.amount is in USD
      const costUsd = order.amount
      const assetAmount = costUsd / price
      const fee = costUsd * config.feePct

      // Apply trade to holdings
      const holding = holdings[order.pair]
      if (order.side === 'buy') {
        if (holding) {
          holding.amount += assetAmount
          holding.valueUsd += costUsd - fee
        } else {
          holdings[order.pair] = {
            amount: assetAmount,
            valueUsd: costUsd - fee,
          }
        }
      } else {
        // sell
        if (holding) {
          holding.amount = Math.max(0, holding.amount - assetAmount)
          holding.valueUsd = Math.max(0, holding.valueUsd - costUsd)
        }
      }

      simTrades.push({
        timestamp: ts,
        pair: order.pair,
        side: order.side,
        amount: assetAmount,
        price,
        costUsd,
        fee,
      })
    }

    return simTrades
  }

  /** Serialises and persists a completed backtest result to the DB. */
  private async _persist(result: BacktestResult): Promise<void> {
    try {
      await BacktestResultModel.create({
        _id: result.id,
        config: result.config as unknown as Record<string, unknown>,
        metrics: result.metrics as unknown as Record<string, unknown>,
        trades: result.trades as unknown as Record<string, unknown>[],
        benchmark: result.benchmark as unknown as Record<string, unknown>,
      })
    } catch (err) {
      // Non-fatal: log but don't crash the simulation
      console.error('[BacktestSimulator] Failed to persist result:', err)
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const backtestSimulator = new BacktestSimulator()
export { BacktestSimulator }

// Re-export types consumed downstream
export type { BacktestConfig, BacktestMetrics, SimulatedTrade, BenchmarkResult }
