import { TradeModel } from "@db/database";

// ─── Domain types ─────────────────────────────────────────────────────────────

/**
 * A discrete acquisition lot used for FIFO cost basis tracking.
 * `remaining` tracks how much of the original `amount` is unconsumed.
 */
interface TaxLot {
  asset: string;
  acquiredAt: number; // unix epoch seconds
  amount: number; // original acquired quantity
  remaining: number; // quantity not yet matched against a sell
  costBasisUsd: number; // total USD cost for the original `amount`
  costPerUnit: number; // USD per unit
}

interface TaxableEvent {
  date: number; // unix epoch seconds of the sell
  asset: string;
  action: "sell";
  amount: number;
  proceedsUsd: number;
  costBasisUsd: number;
  gainLossUsd: number;
  holdingPeriodDays: number;
  isShortTerm: boolean; // true when holdingPeriodDays < 365
}

interface TaxReport {
  year: number;
  totalRealizedGain: number;
  totalRealizedLoss: number;
  netGainLoss: number;
  shortTermGain: number;
  longTermGain: number;
  events: TaxableEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECONDS_PER_DAY = 86_400;
const SHORT_TERM_DAYS = 365;

// Koinly CSV header
const CSV_HEADER =
  "Date,Sent Amount,Sent Currency,Received Amount,Received Currency," +
  "Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency," +
  "Label,Description,TxHash";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the base asset from a trading pair string like "BTC/USDT".
 * Falls back to the raw pair when no "/" is present.
 */
function extractAsset(pair: string): string {
  const slash = pair.indexOf("/");
  return slash !== -1 ? pair.slice(0, slash) : pair;
}

/** Format a unix-epoch-second timestamp as an ISO-8601 datetime string. */
function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}

/** Year boundaries as unix epoch milliseconds. */
function yearBoundsMs(year: number): { startMs: number; endMs: number } {
  const startMs = new Date(year, 0, 1).getTime();
  const endMs = new Date(year + 1, 0, 1).getTime();
  return { startMs, endMs };
}

/** Convert a Date (from Mongoose) to unix epoch seconds. */
function toEpochSec(d: Date): number {
  return Math.floor(new Date(d).getTime() / 1000);
}

// ─── Lean trade shape used internally ────────────────────────────────────────

interface TradeLean {
  pair: string;
  side: string;
  amount: number;
  price: number;
  costUsd: number;
  fee: number | null;
  executedAt: Date;
}

// ─── TaxReporter ──────────────────────────────────────────────────────────────

class TaxReporter {
  /**
   * Generate a FIFO-based tax report for all trades in `year`.
   *
   * Strategy:
   *  1. Load ALL buy trades up to end-of-year (needed for FIFO lot history).
   *  2. Load ALL sell trades within the year.
   *  3. Build per-asset lot queues from buys.
   *  4. Match each sell against the oldest available lots.
   */
  async generateReport(year: number): Promise<TaxReport> {
    const { startMs, endMs } = yearBoundsMs(year);

    // Fetch all buys up to end of year — needed for complete FIFO history
    const allBuys = (await TradeModel.find({
      side: "buy",
      executedAt: { $gte: new Date(0), $lt: new Date(endMs) },
    })
      .sort({ executedAt: 1 })
      .lean()) as unknown as TradeLean[];

    // Fetch sells within the target year only
    const yearSells = (await TradeModel.find({
      side: "sell",
      executedAt: { $gte: new Date(startMs), $lt: new Date(endMs) },
    })
      .sort({ executedAt: 1 })
      .lean()) as unknown as TradeLean[];

    // Build per-asset lot maps from buy history
    const lotsByAsset = this.buildCostBasisLots(allBuys);

    // Match sells to lots using FIFO
    const events = this.matchSellsToLots(yearSells, lotsByAsset);

    // Aggregate report metrics
    let totalRealizedGain = 0;
    let totalRealizedLoss = 0;
    let shortTermGain = 0;
    let longTermGain = 0;

    for (const ev of events) {
      if (ev.gainLossUsd >= 0) {
        totalRealizedGain += ev.gainLossUsd;
        if (ev.isShortTerm) {
          shortTermGain += ev.gainLossUsd;
        } else {
          longTermGain += ev.gainLossUsd;
        }
      } else {
        totalRealizedLoss += ev.gainLossUsd; // negative value
      }
    }

    return {
      year,
      totalRealizedGain,
      totalRealizedLoss,
      netGainLoss: totalRealizedGain + totalRealizedLoss,
      shortTermGain,
      longTermGain,
      events,
    };
  }

  /**
   * Export the year's taxable events as a Koinly-compatible CSV string.
   * Each row represents a single lot-level disposal (sells may produce
   * multiple rows when they span more than one cost-basis lot).
   */
  async exportCSV(year: number): Promise<string> {
    const report = await this.generateReport(year);
    const rows: string[] = [CSV_HEADER];

    for (const ev of report.events) {
      const dateStr = formatDate(ev.date);
      const description =
        `${ev.isShortTerm ? "Short" : "Long"}-term disposal ` +
        `(${ev.holdingPeriodDays}d) gain/loss: ${ev.gainLossUsd.toFixed(2)} USD`;

      // Koinly sell row: sent = crypto sold, received = USD proceeds
      rows.push(
        [
          dateStr, // Date
          ev.amount.toFixed(8), // Sent Amount (crypto)
          ev.asset, // Sent Currency
          ev.proceedsUsd.toFixed(2), // Received Amount (USD)
          "USD", // Received Currency
          "", // Fee Amount (fees already in costUsd)
          "", // Fee Currency
          ev.proceedsUsd.toFixed(2), // Net Worth Amount
          "USD", // Net Worth Currency
          "realized gain", // Label
          description, // Description
          "", // TxHash
        ].join(",")
      );
    }

    return rows.join("\n");
  }

  /**
   * Build per-asset FIFO lot queues from a sorted list of buy trades.
   * Returns a Map keyed by asset symbol.
   * Each queue is ordered oldest-first so FIFO consumption is a simple shift().
   */
  private buildCostBasisLots(buys: TradeLean[]): Map<string, TaxLot[]> {
    const lotMap = new Map<string, TaxLot[]>();

    for (const trade of buys) {
      const asset = extractAsset(trade.pair);
      if (!lotMap.has(asset)) {
        lotMap.set(asset, []);
      }

      const acquiredAt = toEpochSec(trade.executedAt);
      const costPerUnit = trade.amount > 0 ? trade.costUsd / trade.amount : 0;

      lotMap.get(asset)!.push({
        asset,
        acquiredAt,
        amount: trade.amount,
        remaining: trade.amount,
        costBasisUsd: trade.costUsd,
        costPerUnit,
      });
    }

    return lotMap;
  }

  /**
   * Match sell trades against FIFO lots, producing one TaxableEvent per
   * lot consumed (a single sell may split across several lots).
   *
   * Partial lot consumption: when a sell only partially depletes a lot,
   * `lot.remaining` is decremented and the lot stays in the queue for the
   * next sell.
   */
  private matchSellsToLots(sells: TradeLean[], lotsByAsset: Map<string, TaxLot[]>): TaxableEvent[] {
    const events: TaxableEvent[] = [];

    for (const sell of sells) {
      const asset = extractAsset(sell.pair);
      const lots = lotsByAsset.get(asset) ?? [];
      const sellEpoch = toEpochSec(sell.executedAt);

      // Price per unit received for this sell
      const sellPricePerUnit = sell.amount > 0 ? sell.costUsd / sell.amount : 0;

      let remainingToMatch = sell.amount;
      let lotIndex = 0;

      while (remainingToMatch > 1e-10 && lotIndex < lots.length) {
        const lot = lots[lotIndex]!;

        // Skip fully consumed lots
        if (lot.remaining <= 1e-10) {
          lotIndex++;
          continue;
        }

        // Determine how much of this lot is consumed by the current sell
        const consumed = Math.min(remainingToMatch, lot.remaining);
        const proceeds = consumed * sellPricePerUnit;
        const costBasis = consumed * lot.costPerUnit;
        const gainLoss = proceeds - costBasis;

        const holdingDays = Math.floor((sellEpoch - lot.acquiredAt) / SECONDS_PER_DAY);

        events.push({
          date: sellEpoch,
          asset,
          action: "sell",
          amount: consumed,
          proceedsUsd: proceeds,
          costBasisUsd: costBasis,
          gainLossUsd: gainLoss,
          holdingPeriodDays: holdingDays,
          isShortTerm: holdingDays < SHORT_TERM_DAYS,
        });

        // Deduct consumed amount from lot
        lot.remaining -= consumed;
        remainingToMatch -= consumed;

        if (lot.remaining <= 1e-10) {
          lotIndex++;
        }
      }

      // If there are still unmatched sell units, no buy lots cover them.
      // This can happen with pre-existing balances. Record with zero cost basis.
      if (remainingToMatch > 1e-10) {
        const proceeds = remainingToMatch * sellPricePerUnit;
        events.push({
          date: sellEpoch,
          asset,
          action: "sell",
          amount: remainingToMatch,
          proceedsUsd: proceeds,
          costBasisUsd: 0,
          gainLossUsd: proceeds,
          holdingPeriodDays: 0,
          isShortTerm: true,
        });
      }
    }

    return events;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const taxReporter = new TaxReporter();
export type { TaxLot, TaxableEvent, TaxReport };
