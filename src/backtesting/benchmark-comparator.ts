import type { OHLCVCandle } from "./historical-data-loader";
import { metricsCalculator } from "./metrics-calculator";
import type { BacktestConfig, BacktestMetrics, SimulatedTrade } from "./metrics-calculator";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  strategy: BenchmarkStats;
  buyAndHold: BenchmarkStats;
  /** strategy returnPct minus buy-and-hold returnPct */
  outperformancePct: number;
}

interface BenchmarkStats {
  finalValue: number;
  returnPct: number;
  sharpe: number;
  maxDrawdown: number;
}

/** Minimal slice of BacktestResult needed by the comparator. */
export interface BacktestResultSlice {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: SimulatedTrade[];
  equityCurve: { timestamp: number; value: number }[];
}

// ─── BenchmarkComparator ──────────────────────────────────────────────────────

/**
 * Compares the rebalancing strategy against a passive buy-and-hold baseline.
 *
 * Buy-and-hold logic:
 *  - At startDate, allocate initialBalance across all pairs according to
 *    target allocations (same weights as the strategy).
 *  - Hold until endDate without any rebalancing.
 *  - Build a daily equity curve using close prices.
 *  - Run the same metrics calculator to produce comparable statistics.
 */
class BenchmarkComparator {
  compare(
    backtestResult: BacktestResultSlice,
    ohlcvData: Record<string, OHLCVCandle[]>
  ): BenchmarkResult {
    const { config, metrics, equityCurve } = backtestResult;

    // ── Strategy stats (from pre-computed metrics) ────────────────────────────
    const strategyFinalValue =
      equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.value : config.initialBalance;

    const strategy: BenchmarkStats = {
      finalValue: strategyFinalValue,
      returnPct: metrics.totalReturnPct,
      sharpe: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdownPct,
    };

    // ── Build buy-and-hold equity curve ───────────────────────────────────────
    const holdCurve = this._buildHoldCurve(config, ohlcvData);

    const holdMetrics =
      holdCurve.length >= 2
        ? metricsCalculator.calculate(holdCurve, [] as SimulatedTrade[], config)
        : null;

    const holdFinalValue =
      holdCurve.length > 0 ? holdCurve[holdCurve.length - 1]!.value : config.initialBalance;

    const buyAndHold: BenchmarkStats = {
      finalValue: holdFinalValue,
      returnPct: holdMetrics?.totalReturnPct ?? 0,
      sharpe: holdMetrics?.sharpeRatio ?? 0,
      maxDrawdown: holdMetrics?.maxDrawdownPct ?? 0,
    };

    return {
      strategy,
      buyAndHold,
      outperformancePct: strategy.returnPct - buyAndHold.returnPct,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Builds an equity curve for a buy-and-hold portfolio.
   *
   * Steps:
   *  1. Intersect all candle arrays to find a common timestamp axis.
   *  2. At the first timestamp, calculate initial holdings: for each pair
   *     allocate (targetPct / 100) * initialBalance worth of the asset at
   *     the open price of the first candle.
   *  3. At every subsequent timestamp, revalue holdings using close prices.
   */
  private _buildHoldCurve(
    config: BacktestConfig,
    ohlcvData: Record<string, OHLCVCandle[]>
  ): { timestamp: number; value: number }[] {
    // Build per-pair lookup: timestamp → close price
    const priceMaps: Map<number, number>[] = [];
    const pairKeys: string[] = [];

    for (const pair of config.pairs) {
      const candles = ohlcvData[pair];
      if (!candles || candles.length === 0) continue;
      const map = new Map<number, number>();
      for (const c of candles) map.set(c.timestamp, c.close);
      priceMaps.push(map);
      pairKeys.push(pair);
    }

    if (pairKeys.length === 0) return [];

    // Common timestamp set (intersection across all pairs)
    let commonTimestamps = new Set(priceMaps[0]!.keys());
    for (let i = 1; i < priceMaps.length; i++) {
      const next = priceMaps[i]!;
      commonTimestamps = new Set([...commonTimestamps].filter((ts) => next.has(ts)));
    }

    const sortedTs = [...commonTimestamps].sort((a, b) => a - b);
    if (sortedTs.length === 0) return [];

    // Initial holdings: buy at first candle's open price
    // Use close of first candle as a proxy when open isn't available in OHLCVCandle
    const firstTs = sortedTs[0]!;
    const holdings: Record<string, number> = {}; // pair → asset amount

    for (let i = 0; i < pairKeys.length; i++) {
      const pair = pairKeys[i]!;
      const alloc = config.allocations.find((a) => `${a.asset}/USDT` === pair);
      const targetPct = alloc?.targetPct ?? 100 / pairKeys.length;
      const usdAlloc = (targetPct / 100) * config.initialBalance;

      const firstPrice = priceMaps[i]!.get(firstTs);
      if (firstPrice && firstPrice > 0) {
        holdings[pair] = usdAlloc / firstPrice;
      }
    }

    // Build equity curve: revalue holdings at each timestamp
    const curve: { timestamp: number; value: number }[] = [];

    for (const ts of sortedTs) {
      let totalValue = 0;
      for (let i = 0; i < pairKeys.length; i++) {
        const pair = pairKeys[i]!;
        const price = priceMaps[i]!.get(ts) ?? 0;
        totalValue += (holdings[pair] ?? 0) * price;
      }
      curve.push({ timestamp: ts, value: totalValue });
    }

    return curve;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const benchmarkComparator = new BenchmarkComparator();
export { BenchmarkComparator };
