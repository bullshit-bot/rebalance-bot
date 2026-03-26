import { SnapshotModel, TradeModel } from "@db/database";

// ─── MarketSummaryService ─────────────────────────────────────────────────────

/**
 * Generates a human-readable daily portfolio summary.
 * Aggregates last-24h snapshot data and trade activity into a text report
 * suitable for Telegram or other notification channels.
 */
class MarketSummaryService {
  /**
   * Generates a formatted daily summary string from the last 24 hours of data.
   * Queries snapshots for portfolio value change and trades for activity volume.
   */
  async generateSummary(): Promise<string> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

    const [portfolioSection, tradeSection] = await Promise.all([
      this.buildPortfolioSection(since),
      this.buildTradeSection(since),
    ]);

    const date = new Date().toUTCString();
    return [
      "📊 <b>Daily Portfolio Summary</b>",
      `<i>${date}</i>`,
      "",
      portfolioSection,
      "",
      tradeSection,
    ].join("\n");
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Builds the portfolio value change section from snapshots.
   * Compares the oldest and newest snapshot within the last 24h.
   */
  private async buildPortfolioSection(since: Date): Promise<string> {
    const rows = await SnapshotModel.find({ createdAt: { $gte: since } })
      .select("totalValueUsd createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (rows.length === 0) {
      return "<b>Portfolio:</b> No snapshot data in the last 24h";
    }

    const oldest = rows[0]!;
    const newest = rows[rows.length - 1]!;
    const startValue = oldest.totalValueUsd;
    const endValue = newest.totalValueUsd;
    const changeUsd = endValue - startValue;
    const changePct = startValue > 0 ? (changeUsd / startValue) * 100 : 0;
    const arrow = changeUsd >= 0 ? "▲" : "▼";
    const sign = changeUsd >= 0 ? "+" : "";

    return [
      "<b>Portfolio Value (24h)</b>",
      `Start: <code>$${startValue.toFixed(2)}</code>`,
      `End:   <code>$${endValue.toFixed(2)}</code>`,
      `Change: <code>${arrow} ${sign}$${changeUsd.toFixed(2)} (${sign}${changePct.toFixed(2)}%)</code>`,
      `Snapshots captured: <code>${rows.length}</code>`,
    ].join("\n");
  }

  /**
   * Builds the trade activity section from trades within the last 24h.
   * Uses MongoDB aggregation for count and total volume instead of raw sql.
   */
  private async buildTradeSection(since: Date): Promise<string> {
    const aggResult = await TradeModel.aggregate([
      { $match: { executedAt: { $gte: since } } },
      {
        $group: {
          _id: { side: "$side", isPaper: "$isPaper" },
          count: { $sum: 1 },
          totalCost: { $sum: "$costUsd" },
        },
      },
    ]);

    if (aggResult.length === 0) {
      return "<b>Trades (24h):</b> No trades executed";
    }

    let totalTrades = 0;
    let totalVolumeUsd = 0;
    let liveCount = 0;
    let paperCount = 0;

    for (const row of aggResult) {
      totalTrades += row.count as number;
      totalVolumeUsd += row.totalCost as number;
      if (row._id.isPaper === true) {
        paperCount += row.count as number;
      } else {
        liveCount += row.count as number;
      }
    }

    return [
      "<b>Trades (24h)</b>",
      `Total: <code>${totalTrades}</code> (Live: <code>${liveCount}</code>, Paper: <code>${paperCount}</code>)`,
      `Volume: <code>$${totalVolumeUsd.toFixed(2)}</code>`,
    ].join("\n");
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const marketSummaryService = new MarketSummaryService();
