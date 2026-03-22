import { equityCurveBuilder } from './equity-curve-builder'
import type { EquityPoint } from './equity-curve-builder'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single point in the drawdown series.
 * drawdownPct is negative (e.g. -0.15 means -15% from peak).
 */
export interface DrawdownPoint {
  timestamp: number
  drawdownPct: number
}

/**
 * Full drawdown analysis result for a given time range.
 * All Pct values are fractional (e.g. -0.20 = -20%).
 */
export interface DrawdownResult {
  /** Largest peak-to-trough decline as a fraction (e.g. -0.25 = -25%) */
  maxDrawdownPct: number
  /** Largest peak-to-trough decline in absolute USD */
  maxDrawdownUsd: number
  /** Portfolio value at the peak of the max drawdown period */
  peakValue: number
  /** Portfolio value at the trough of the max drawdown period */
  troughValue: number
  /** Timestamp (Unix seconds) when the peak occurred */
  peakDate: number
  /** Timestamp (Unix seconds) when the trough occurred */
  troughDate: number
  /** Current drawdown from the most recent all-time high, as a fraction */
  currentDrawdownPct: number
  /** Per-point drawdown series for charting */
  drawdownSeries: DrawdownPoint[]
}

// ─── DrawdownAnalyzer ─────────────────────────────────────────────────────────

/**
 * Computes drawdown metrics from the equity curve stored in the snapshots table.
 * Uses a running-peak algorithm: at each point, drawdown = (value - peak) / peak.
 */
class DrawdownAnalyzer {
  /**
   * Analyzes drawdown for the given Unix-second date range.
   * Returns a zeroed result when fewer than two data points are available.
   *
   * @param from - Start timestamp, Unix epoch seconds (inclusive)
   * @param to   - End timestamp, Unix epoch seconds (inclusive)
   */
  async analyze(from: number, to: number): Promise<DrawdownResult> {
    const curve: EquityPoint[] = await equityCurveBuilder.build(from, to)

    const empty: DrawdownResult = {
      maxDrawdownPct: 0,
      maxDrawdownUsd: 0,
      peakValue: 0,
      troughValue: 0,
      peakDate: 0,
      troughDate: 0,
      currentDrawdownPct: 0,
      drawdownSeries: [],
    }

    if (curve.length < 2) return empty

    // Running state for max-drawdown tracking
    let runningPeak = curve[0]!.valueUsd
    let runningPeakTs = curve[0]!.timestamp

    // State for the worst drawdown window found so far
    let maxDrawdownPct = 0
    let maxDrawdownUsd = 0
    let peakValue = runningPeak
    let troughValue = runningPeak
    let peakDate = runningPeakTs
    let troughDate = runningPeakTs

    // Candidate trough for the current drawdown window
    let candidateTroughValue = runningPeak
    let candidateTroughTs = runningPeakTs

    const drawdownSeries: DrawdownPoint[] = []

    for (const point of curve) {
      // Update running peak when a new high is reached
      if (point.valueUsd > runningPeak) {
        runningPeak = point.valueUsd
        runningPeakTs = point.timestamp
        candidateTroughValue = point.valueUsd
        candidateTroughTs = point.timestamp
      }

      // Track the lowest point since the current peak
      if (point.valueUsd < candidateTroughValue) {
        candidateTroughValue = point.valueUsd
        candidateTroughTs = point.timestamp
      }

      const dd = runningPeak > 0 ? (point.valueUsd - runningPeak) / runningPeak : 0
      drawdownSeries.push({ timestamp: point.timestamp, drawdownPct: dd })

      // Check if this window is the worst drawdown seen so far
      const windowDdPct =
        runningPeak > 0 ? (candidateTroughValue - runningPeak) / runningPeak : 0
      if (windowDdPct < maxDrawdownPct) {
        maxDrawdownPct = windowDdPct
        maxDrawdownUsd = candidateTroughValue - runningPeak
        peakValue = runningPeak
        troughValue = candidateTroughValue
        peakDate = runningPeakTs
        troughDate = candidateTroughTs
      }
    }

    // Current drawdown is the last point's drawdown relative to the all-time peak in range
    const allTimePeak = Math.max(...curve.map((p) => p.valueUsd))
    const lastValue = curve[curve.length - 1]!.valueUsd
    const currentDrawdownPct = allTimePeak > 0 ? (lastValue - allTimePeak) / allTimePeak : 0

    return {
      maxDrawdownPct,
      maxDrawdownUsd,
      peakValue,
      troughValue,
      peakDate,
      troughDate,
      currentDrawdownPct,
      drawdownSeries,
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const drawdownAnalyzer = new DrawdownAnalyzer()

export { DrawdownAnalyzer }
