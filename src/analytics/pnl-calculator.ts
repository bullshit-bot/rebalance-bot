import { TradeModel } from "@db/database";
import type { ITrade } from "@db/database";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Aggregated realized PnL summary across a time range.
 * byPeriod values are the net PnL summed over that rolling window.
 */
export interface PnLSummary {
  totalPnl: number;
  byAsset: Record<string, number>;
  byPeriod: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

/**
 * Unrealized PnL for a single asset position.
 * costBasis is the FIFO-weighted average cost of remaining holdings.
 */
export interface UnrealizedAssetPnL {
  costBasis: number;
  currentValue: number;
  pnl: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the base asset from a trading pair string.
 * e.g. "BTC/USDT" → "BTC"
 */
function baseAsset(pair: string): string {
  return pair.split("/")[0] ?? pair;
}

type TradeRow = Pick<ITrade, "pair" | "side" | "costUsd" | "fee"> & { executedAt: Date };

/**
 * Compute realized PnL for a flat list of trades using a simplified approach:
 * realized PnL = sum(sell proceeds) - sum(buy costs)
 * This is correct for assets that were fully cycled through buys and sells.
 */
function computeRealizedByAsset(rows: TradeRow[]): Record<string, number> {
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    const asset = baseAsset(row.pair);
    const fee = row.fee ?? 0;

    if (!(asset in byAsset)) byAsset[asset] = 0;

    if (row.side === "sell") {
      byAsset[asset] += row.costUsd - fee;
    } else {
      byAsset[asset] -= row.costUsd + fee;
    }
  }

  return byAsset;
}

/** Convert a Date (from Mongoose) to unix epoch seconds for period comparisons. */
function toEpochSec(d: Date): number {
  return Math.floor(new Date(d).getTime() / 1000);
}

// ─── PnLCalculator ───────────────────────────────────────────────────────────

/**
 * Calculates realized and unrealized profit/loss from the trades collection.
 *
 * Realized PnL = sell proceeds - buy costs (including fees) for completed round-trips.
 * Unrealized PnL uses FIFO cost basis from open buy positions vs a supplied current price map.
 */
class PnLCalculator {
  /**
   * Returns realized PnL summary for trades executed within [from, to].
   * When from/to are omitted, all trades are included.
   *
   * @param from - Start timestamp, Unix epoch seconds (inclusive, optional)
   * @param to   - End timestamp, Unix epoch seconds (inclusive, optional)
   */
  async getRealizedPnL(from?: number, to?: number): Promise<PnLSummary> {
    // Build date range filter
    const filter: Record<string, unknown> = {};
    if (from !== undefined || to !== undefined) {
      const range: Record<string, Date> = {};
      if (from !== undefined) range["$gte"] = new Date(from * 1000);
      if (to !== undefined) range["$lte"] = new Date(to * 1000);
      filter["executedAt"] = range;
    }

    const rows = (await TradeModel.find(filter)
      .select("pair side costUsd fee executedAt")
      .lean()) as TradeRow[];

    const byAsset = computeRealizedByAsset(rows);
    const totalPnl = Object.values(byAsset).reduce((sum, v) => sum + v, 0);

    // Compute period-scoped PnL by filtering rows to rolling windows
    const nowSec = Math.floor(Date.now() / 1000);
    const dailyCutoff = nowSec - 86400;
    const weeklyCutoff = nowSec - 7 * 86400;
    const monthlyCutoff = nowSec - 30 * 86400;

    const dailyRows = rows.filter((r) => toEpochSec(r.executedAt) >= dailyCutoff);
    const weeklyRows = rows.filter((r) => toEpochSec(r.executedAt) >= weeklyCutoff);
    const monthlyRows = rows.filter((r) => toEpochSec(r.executedAt) >= monthlyCutoff);

    const sumPnl = (r: TradeRow[]) =>
      Object.values(computeRealizedByAsset(r)).reduce((s, v) => s + v, 0);

    return {
      totalPnl,
      byAsset,
      byPeriod: {
        daily: sumPnl(dailyRows),
        weekly: sumPnl(weeklyRows),
        monthly: sumPnl(monthlyRows),
      },
    };
  }

  /**
   * Returns unrealized PnL for each asset using FIFO cost basis from open buy trades.
   * currentPrices maps asset symbol (e.g. "BTC") to its current USD price.
   *
   * @param currentPrices - Map of asset → current USD price per unit
   */
  async getUnrealizedPnL(
    currentPrices: Record<string, number>
  ): Promise<Record<string, UnrealizedAssetPnL>> {
    // Fetch all trades ordered chronologically for FIFO processing
    const rows = (await TradeModel.find()
      .select("pair side amount price costUsd fee executedAt")
      .sort({ executedAt: 1 })
      .lean()) as Array<
      Pick<ITrade, "pair" | "side" | "amount" | "price" | "costUsd" | "fee"> & { executedAt: Date }
    >;

    // FIFO queue per asset: each entry tracks remaining amount and cost per unit
    const fifoQueues: Record<string, Array<{ amount: number; costPerUnit: number }>> = {};

    for (const row of rows) {
      const asset = baseAsset(row.pair);
      if (!fifoQueues[asset]) fifoQueues[asset] = [];

      const fee = row.fee ?? 0;

      if (row.side === "buy") {
        // Record cost per unit including proportional fee
        const totalCost = row.costUsd + fee;
        fifoQueues[asset].push({
          amount: row.amount,
          costPerUnit: totalCost / row.amount,
        });
      } else {
        // Consume from FIFO queue on sell
        let remaining = row.amount;
        const queue = fifoQueues[asset];
        while (remaining > 0 && queue.length > 0) {
          const lot = queue[0]!;
          if (lot.amount <= remaining) {
            remaining -= lot.amount;
            queue.shift();
          } else {
            lot.amount -= remaining;
            remaining = 0;
          }
        }
      }
    }

    // Build result from remaining FIFO lots
    const result: Record<string, UnrealizedAssetPnL> = {};

    for (const [asset, queue] of Object.entries(fifoQueues)) {
      if (queue.length === 0) continue;

      const currentPrice = currentPrices[asset];
      if (currentPrice === undefined) continue;

      // Weighted average cost basis from remaining lots
      let totalAmount = 0;
      let totalCost = 0;
      for (const lot of queue) {
        totalAmount += lot.amount;
        totalCost += lot.amount * lot.costPerUnit;
      }

      if (totalAmount === 0) continue;

      const currentValue = totalAmount * currentPrice;
      result[asset] = {
        costBasis: totalCost,
        currentValue,
        pnl: currentValue - totalCost,
      };
    }

    return result;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const pnlCalculator = new PnLCalculator();

export { PnLCalculator };
