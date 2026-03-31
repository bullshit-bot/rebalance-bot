import { TradeModel } from "@db/database";
import type { ITrade } from "@db/database";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Aggregated fee summary across a time range.
 * All fee values are in USD.
 * byPeriod contains rolling totals relative to now.
 */
export interface FeeSummary {
  totalFeesUsd: number;
  byExchange: Record<string, number>;
  byAsset: Record<string, number>;
  byPeriod: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the base asset from a trading pair string.
 * e.g. "BTC/USDT" → "BTC"
 */
function baseAsset(pair: string): string {
  return pair.split("/")[0] ?? pair;
}

type FeeRow = Pick<ITrade, "exchange" | "pair" | "fee" | "feeCurrency" | "price"> & {
  executedAt: Date;
};

/**
 * Aggregate fee rows into total, byExchange, and byAsset maps.
 * Fees stored in the trades collection are already in USD (costUsd basis).
 * When feeCurrency is a crypto asset, the fee column still reflects the
 * USD-equivalent cost because the executor records it that way.
 */
function aggregateFees(rows: FeeRow[]): {
  total: number;
  byExchange: Record<string, number>;
  byAsset: Record<string, number>;
} {
  let total = 0;
  const byExchange: Record<string, number> = {};
  const byAsset: Record<string, number> = {};

  for (const row of rows) {
    const feeUsd = row.fee ?? 0;
    if (feeUsd === 0) continue;

    total += feeUsd;

    // Group by exchange
    byExchange[row.exchange] = (byExchange[row.exchange] ?? 0) + feeUsd;

    // Group by base asset of the trading pair
    const asset = baseAsset(row.pair);
    byAsset[asset] = (byAsset[asset] ?? 0) + feeUsd;
  }

  return { total, byExchange, byAsset };
}

/** Convert a Date (from Mongoose) to unix epoch seconds for period comparisons. */
function toEpochSec(d: Date): number {
  return Math.floor(new Date(d).getTime() / 1000);
}

// ─── FeeTracker ───────────────────────────────────────────────────────────────

/**
 * Queries the trades collection to aggregate fee data by exchange, asset, and period.
 * All monetary values are in USD.
 */
class FeeTracker {
  /**
   * Returns a fee summary for trades executed within [from, to].
   * When from/to are omitted, all trades are included.
   *
   * @param from - Start timestamp, Unix epoch seconds (inclusive, optional)
   * @param to   - End timestamp, Unix epoch seconds (inclusive, optional)
   */
  async getFees(from?: number, to?: number): Promise<FeeSummary> {
    const filter: Record<string, unknown> = {};
    if (from !== undefined || to !== undefined) {
      const range: Record<string, Date> = {};
      if (from !== undefined) range["$gte"] = new Date(from * 1000);
      if (to !== undefined) range["$lte"] = new Date(to * 1000);
      filter["executedAt"] = range;
    }

    const rows = (await TradeModel.find(filter)
      .select("exchange pair fee feeCurrency price executedAt")
      .lean()) as FeeRow[];

    const { total, byExchange, byAsset } = aggregateFees(rows);

    // Compute rolling period totals relative to current time
    const nowSec = Math.floor(Date.now() / 1000);
    const dailyCutoff = nowSec - 86400;
    const weeklyCutoff = nowSec - 7 * 86400;
    const monthlyCutoff = nowSec - 30 * 86400;

    const { total: daily } = aggregateFees(
      rows.filter((r) => toEpochSec(r.executedAt) >= dailyCutoff)
    );
    const { total: weekly } = aggregateFees(
      rows.filter((r) => toEpochSec(r.executedAt) >= weeklyCutoff)
    );
    const { total: monthly } = aggregateFees(
      rows.filter((r) => toEpochSec(r.executedAt) >= monthlyCutoff)
    );

    return {
      totalFeesUsd: total,
      byExchange,
      byAsset,
      byPeriod: { daily, weekly, monthly },
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const feeTracker = new FeeTracker();

export { FeeTracker };
