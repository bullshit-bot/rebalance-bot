import { randomUUID } from "node:crypto";
import { historicalDataLoader } from "@/backtesting/historical-data-loader";
import { executionTracker } from "@/twap-vwap/execution-tracker";
import { sliceScheduler } from "@/twap-vwap/slice-scheduler";
import type { ExchangeName, OrderSide } from "@/types/index";
import { SmartOrderModel } from "@db/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VwapCreateParams {
  exchange: ExchangeName;
  pair: string;
  side: OrderSide;
  totalAmount: number;
  /** Total execution window in milliseconds */
  durationMs: number;
  /** Number of slices to divide the order into */
  slices: number;
  rebalanceId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch recent OHLCV candles and produce a normalised volume profile.
 * Returns an array of `slices` weights that sum to 1.0.
 * Higher-volume periods receive larger weights so execution aligns with
 * natural market liquidity.
 *
 * Falls back to uniform weights when historical data is unavailable.
 */
async function buildVolumeWeights(
  exchange: ExchangeName,
  pair: string,
  slices: number
): Promise<number[]> {
  try {
    // Fetch recent 1-hour candles covering enough history to bucket into slices
    const lookbackMs = Math.max(slices * 3_600_000, 7 * 24 * 3_600_000); // at least 7 days
    const since = Date.now() - lookbackMs;

    let candles = await historicalDataLoader.getCachedData({
      exchange,
      pair,
      timeframe: "1h",
      since,
      until: Date.now(),
    });

    // If cache is empty, attempt live fetch (best-effort — may fail in paper mode)
    if (candles.length === 0) {
      try {
        candles = await historicalDataLoader.loadData({ exchange, pair, timeframe: "1h", since });
      } catch {
        // Fall through to uniform weights
      }
    }

    if (candles.length < slices) {
      return uniformWeights(slices);
    }

    // Bucket candles evenly into `slices` groups, sum volume per bucket
    const bucketSize = Math.floor(candles.length / slices);
    const weights: number[] = [];

    for (let i = 0; i < slices; i++) {
      const start = i * bucketSize;
      const end = i === slices - 1 ? candles.length : start + bucketSize;
      const bucketVol = candles.slice(start, end).reduce((sum: number, c) => sum + c.volume, 0);
      weights.push(bucketVol);
    }

    const totalVol = weights.reduce((s, w) => s + w, 0);
    if (totalVol === 0) return uniformWeights(slices);

    // Normalise so weights sum to 1.0
    return weights.map((w) => w / totalVol);
  } catch (err) {
    console.warn("[VwapEngine] Failed to build volume profile, using uniform weights:", err);
    return uniformWeights(slices);
  }
}

function uniformWeights(slices: number): number[] {
  return Array.from({ length: slices }, () => 1 / slices);
}

// ─── VwapEngine ───────────────────────────────────────────────────────────────

/**
 * Volume-Weighted Average Price execution engine.
 *
 * Splits a large order into `slices` sub-orders whose amounts are proportional
 * to the historical trading volume in each corresponding time bucket.
 * Slices with higher expected volume receive larger allocations, matching the
 * natural liquidity of the market and minimising slippage.
 *
 * When historical data is unavailable, degrades gracefully to uniform sizing
 * (same behaviour as TWAP).
 */
class VwapEngine {
  /**
   * Create and immediately schedule a VWAP order.
   * @returns orderId — use with executionTracker.getProgress() for status.
   */
  async create(params: VwapCreateParams): Promise<string> {
    const { exchange, pair, side, totalAmount, durationMs, slices, rebalanceId } = params;

    if (slices < 1) throw new Error("[VwapEngine] slices must be >= 1");
    if (totalAmount <= 0) throw new Error("[VwapEngine] totalAmount must be > 0");
    if (durationMs <= 0) throw new Error("[VwapEngine] durationMs must be > 0");

    const orderId = randomUUID();
    const intervalMs = Math.floor(durationMs / slices);

    // Build volume-weighted slice amounts
    const weights = await buildVolumeWeights(exchange, pair, slices);
    const sliceList = weights.map((weight, i) => ({
      amount: totalAmount * weight,
      delayMs: i === 0 ? 0 : intervalMs,
    }));

    const config = { slices, intervalMs, weights };

    // Persist to DB before scheduling
    await SmartOrderModel.create({
      _id: orderId,
      type: "vwap",
      exchange,
      pair,
      side,
      totalAmount,
      filledAmount: 0,
      slicesTotal: slices,
      slicesCompleted: 0,
      durationMs,
      status: "active",
      config,
      rebalanceId: rebalanceId ?? null,
    });

    // Register with tracker before slices start firing
    executionTracker.register(orderId, "vwap", totalAmount, slices, durationMs);

    // Hand off to scheduler — non-blocking
    await sliceScheduler.scheduleSlices({ orderId, exchange, pair, side, slices: sliceList });

    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    console.log(
      `[VwapEngine] Created ${orderId}: ${slices} slices (weight range ${(minW * 100).toFixed(1)}%–${(maxW * 100).toFixed(1)}%) over ${durationMs}ms`
    );

    return orderId;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const vwapEngine = new VwapEngine();
export { VwapEngine };
