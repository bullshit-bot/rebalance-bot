import type { StrategyParams, StrategyType } from "@rebalancer/strategies/strategy-config-types";
import type { OHLCVCandle } from "./historical-data-loader";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacktestMetrics {
  totalReturnPct: number;
  annualizedReturnPct: number;
  sharpeRatio: number; // risk-adjusted return (0% risk-free rate)
  maxDrawdownPct: number;
  winRate: number; // % of profitable rebalances
  totalTrades: number;
  totalFeesPaid: number;
  avgTradeSize: number;
  volatility: number; // annualized std deviation of daily returns
  /** Total DCA injected during simulation (USD). Only set when dcaAmountUsd > 0. */
  totalDcaInjected?: number;
}

export interface SimulatedTrade {
  timestamp: number;
  pair: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  costUsd: number;
  fee: number;
}

export interface BacktestConfig {
  pairs: string[];
  allocations: import("@/types/index").Allocation[];
  startDate: number; // unix ms
  endDate: number; // unix ms
  initialBalance: number; // USD
  threshold: number; // rebalance threshold % (used when strategyType is 'threshold' or unset)
  feePct: number; // fee per trade, e.g. 0.001 = 0.1%
  timeframe: "1h" | "1d";
  exchange: import("@/types/index").ExchangeName;
  strategyType?: StrategyType; // if omitted, falls back to fixed-threshold behavior
  strategyParams?: StrategyParams; // strategy-specific params; required when strategyType is set
  /** Percentage of portfolio kept as cash reserve (0–100). Default: 0. */
  cashReservePct?: number;
  /** Route pending buys through DCA slices instead of immediate execution. Requires cashReservePct > 0. */
  dcaRebalanceEnabled?: boolean;
  /** DCA amount in USD injected per interval. Default: 0 (disabled). */
  dcaAmountUsd?: number;
  /** DCA injection interval in candles. Default: 1 (every candle). */
  dcaIntervalCandles?: number;
  /** Trend filter: BTC MA period for bull/bear detection. Default: 0 (disabled). */
  trendFilterMaPeriod?: number;
  /** Trend filter: % of portfolio to move to cash in bear mode (0–100). Default: 90. */
  trendFilterBearCashPct?: number;
  /** Trend filter: cooldown in candles before allowing bull→bear or bear→bull flip. Default: 3. */
  trendFilterCooldownCandles?: number;
  /** Trend filter: buffer % below MA before triggering bear. Default: 2. */
  trendFilterBuffer?: number;
  /** Simulate Flexible Earn yield on crypto holdings in bull mode. Default: true. */
  simpleEarnEnabled?: boolean;
  /** Fallback APY for assets not in simpleEarnApyMap (%). Default: 3. */
  simpleEarnApyPct?: number;
  /** Per-asset APY override map, e.g. { "BTC/USDT": 1.0, "ETH/USDT": 2.5 }. */
  simpleEarnApyMap?: Record<string, number>;
  /** Smart DCA: adjust amount based on BTC price vs MA. Default: false. */
  smartDcaEnabled?: boolean;
  /** Smart DCA: multiplier when BTC below MA (buy the dip). Default: 1.5. */
  smartDcaDipMultiplier?: number;
  /** Smart DCA: multiplier when BTC above MA. Default: 0.75. */
  smartDcaHighMultiplier?: number;
}

// ─── MetricsCalculator ───────────────────────────────────────────────────────

/**
 * Computes performance metrics from a backtest equity curve and trade list.
 *
 * All return/volatility figures are percentage-based.
 * Sharpe ratio uses 0% risk-free rate for simplicity.
 */
class MetricsCalculator {
  /**
   * Derives daily-resolution returns from an equity curve (which may be
   * higher-frequency), then computes all metrics.
   *
   * @param totalDcaInjected - total USD injected via DCA during simulation.
   *   When provided, totalReturnPct uses (final - totalInvested) / totalInvested
   *   where totalInvested = config.initialBalance + totalDcaInjected.
   */
  calculate(
    equityCurve: { timestamp: number; value: number }[],
    trades: SimulatedTrade[],
    config: BacktestConfig,
    totalDcaInjected = 0
  ): BacktestMetrics {
    if (equityCurve.length < 2) {
      return this._zeroMetrics(trades, config);
    }

    const final = equityCurve[equityCurve.length - 1]!.value;

    // ── Total return (accounts for DCA injections as additional cost basis) ──
    // When DCA is disabled, totalDcaInjected=0 and this equals (final - initialBalance) / initialBalance
    const totalInvested = config.initialBalance + totalDcaInjected;
    const totalReturnPct = ((final - totalInvested) / totalInvested) * 100;

    // ── Duration in days ─────────────────────────────────────────────────────
    const msPerDay = 86_400_000;
    const durationDays =
      (equityCurve[equityCurve.length - 1]!.timestamp - equityCurve[0]!.timestamp) / msPerDay;
    const safeDays = Math.max(durationDays, 1);

    // ── Annualized return (CAGR) ──────────────────────────────────────────────
    const annualizedReturnPct = (Math.pow(1 + totalReturnPct / 100, 365 / safeDays) - 1) * 100;

    // ── Daily returns from equity curve ──────────────────────────────────────
    const dailyReturns = this._toDailyReturns(equityCurve);

    // ── Volatility (annualized stddev of daily returns) ───────────────────────
    const volatility = this._stddev(dailyReturns) * Math.sqrt(365) * 100;

    // ── Sharpe ratio (0% risk-free) ───────────────────────────────────────────
    const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / (dailyReturns.length || 1);
    const dailyStddev = this._stddev(dailyReturns);
    const sharpeRatio = dailyStddev === 0 ? 0 : (avgDailyReturn / dailyStddev) * Math.sqrt(365);

    // ── Max drawdown ──────────────────────────────────────────────────────────
    const maxDrawdownPct = this._maxDrawdown(equityCurve);

    // ── Trade statistics ──────────────────────────────────────────────────────
    const totalFeesPaid = trades.reduce((s, t) => s + t.fee, 0);
    const avgTradeSize =
      trades.length > 0 ? trades.reduce((s, t) => s + t.costUsd, 0) / trades.length : 0;

    // ── Win rate: rebalance batches where portfolio value increased afterwards ──
    const winRate = this._calcWinRate(equityCurve, trades);

    const metrics: BacktestMetrics = {
      totalReturnPct,
      annualizedReturnPct,
      sharpeRatio,
      maxDrawdownPct,
      winRate,
      totalTrades: trades.length,
      totalFeesPaid,
      avgTradeSize,
      volatility,
    };
    if (totalDcaInjected > 0) metrics.totalDcaInjected = totalDcaInjected;
    return metrics;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Buckets the equity curve into calendar days and computes fractional
   * daily returns, e.g. [0.012, -0.003, ...].
   */
  private _toDailyReturns(equityCurve: { timestamp: number; value: number }[]): number[] {
    // Group by calendar day (UTC midnight bucket)
    const msPerDay = 86_400_000;
    const buckets = new Map<number, number>();

    for (const point of equityCurve) {
      const day = Math.floor(point.timestamp / msPerDay) * msPerDay;
      // Keep the last value for each day
      buckets.set(day, point.value);
    }

    const sortedDays = Array.from(buckets.keys()).sort((a, b) => a - b);
    if (sortedDays.length < 2) return [];

    const returns: number[] = [];
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = buckets.get(sortedDays[i - 1]!)!;
      const curr = buckets.get(sortedDays[i]!)!;
      if (prev !== 0) returns.push((curr - prev) / prev);
    }

    return returns;
  }

  /** Population standard deviation. */
  private _stddev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Computes maximum drawdown as a positive percentage.
   * Tracks a running peak and measures the deepest trough below it.
   */
  private _maxDrawdown(equityCurve: { timestamp: number; value: number }[]): number {
    let peak = equityCurve[0]!.value;
    let maxDD = 0;

    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const dd = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    }

    return maxDD;
  }

  /**
   * Approximates win rate by finding timestamps where trades fired and
   * checking whether the equity curve's value 1 data point later is higher.
   *
   * Groups trades into rebalance batches (same millisecond), counts each
   * batch as a win if portfolio gained in the subsequent equity point.
   */
  private _calcWinRate(
    equityCurve: { timestamp: number; value: number }[],
    trades: SimulatedTrade[]
  ): number {
    if (trades.length === 0) return 0;

    // Unique rebalance timestamps
    const rebalanceTimes = [...new Set(trades.map((t) => t.timestamp))].sort((a, b) => a - b);

    let wins = 0;

    for (const ts of rebalanceTimes) {
      // Find equity curve index at or just after this rebalance
      const idx = equityCurve.findIndex((p) => p.timestamp >= ts);
      if (idx < 0 || idx + 1 >= equityCurve.length) continue;

      const before = equityCurve[idx]!.value;
      const after = equityCurve[idx + 1]!.value;

      if (after > before) wins++;
    }

    return rebalanceTimes.length > 0 ? (wins / rebalanceTimes.length) * 100 : 0;
  }

  /** Returns all-zero metrics when insufficient data is available. */
  private _zeroMetrics(trades: SimulatedTrade[], _config: BacktestConfig): BacktestMetrics {
    return {
      totalReturnPct: 0,
      annualizedReturnPct: 0,
      sharpeRatio: 0,
      maxDrawdownPct: 0,
      winRate: 0,
      totalTrades: trades.length,
      totalFeesPaid: trades.reduce((s, t) => s + t.fee, 0),
      avgTradeSize:
        trades.length > 0 ? trades.reduce((s, t) => s + t.costUsd, 0) / trades.length : 0,
      volatility: 0,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const metricsCalculator = new MetricsCalculator();

// Re-export the class for testing
export { MetricsCalculator };

// Suppress unused-import warning — OHLCVCandle is used by benchmark-comparator
// which imports from this file. Keep it available for type consumers.
export type { OHLCVCandle, StrategyType, StrategyParams };
