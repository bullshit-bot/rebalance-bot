import { db } from "@/db/database";
import { snapshots, trades } from "@/db/schema";
import { gte, sql } from "drizzle-orm";

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
    const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // unix epoch, 24h ago

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
  private async buildPortfolioSection(since: number): Promise<string> {
    const rows = await db
      .select({
        totalValueUsd: snapshots.totalValueUsd,
        createdAt: snapshots.createdAt,
      })
      .from(snapshots)
      .where(gte(snapshots.createdAt, since))
      .orderBy(snapshots.createdAt);

    if (rows.length === 0) {
      return "<b>Portfolio:</b> No snapshot data in the last 24h";
    }

    const oldest = rows[0];
    const newest = rows[rows.length - 1];
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
   */
  private async buildTradeSection(since: number): Promise<string> {
    const rows = await db
      .select({
        side: trades.side,
        costUsd: trades.costUsd,
        isPaper: trades.isPaper,
        // Aggregate counts via raw sql to avoid N+1
        count: sql<number>`count(*)`.as("count"),
        totalCost: sql<number>`sum(cost_usd)`.as("total_cost"),
      })
      .from(trades)
      .where(gte(trades.executedAt, since))
      .groupBy(trades.side, trades.isPaper);

    if (rows.length === 0) {
      return "<b>Trades (24h):</b> No trades executed";
    }

    let totalTrades = 0;
    let totalVolumeUsd = 0;
    let liveCount = 0;
    let paperCount = 0;

    for (const row of rows) {
      totalTrades += Number(row.count);
      totalVolumeUsd += Number(row.totalCost);
      if (row.isPaper === 1) {
        paperCount += Number(row.count);
      } else {
        liveCount += Number(row.count);
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
