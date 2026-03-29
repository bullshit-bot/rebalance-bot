import { SnapshotModel, TradeModel } from "@db/database";
import { portfolioTracker } from "@portfolio/portfolio-tracker";
import { trendFilter } from "@rebalancer/trend-filter";

// ─── MarketSummaryService ─────────────────────────────────────────────────────

/**
 * Generates formatted daily/weekly portfolio summaries in Vietnamese.
 * Aggregates snapshot data, trade activity, drift, and trend info
 * for Telegram notification delivery.
 */
class MarketSummaryService {
  /**
   * Daily digest: portfolio value, allocation breakdown, drift, trend, trades.
   * All text in Vietnamese for Telegram readability.
   */
  async generateDailySummary(): Promise<string> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [portfolioSection, allocationSection, driftSection, trendSection, tradeSection] =
      await Promise.all([
        this.buildPortfolioSection(since),
        this.buildAllocationSection(),
        this.buildDriftSection(),
        this.buildTrendSection(),
        this.buildTradeSection(since),
      ]);

    const date = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    return [
      "📊 <b>Báo Cáo Portfolio Hàng Ngày</b>",
      `<i>${date}</i>`,
      "",
      portfolioSection,
      "",
      allocationSection,
      "",
      driftSection,
      "",
      trendSection,
      "",
      tradeSection,
    ].join("\n");
  }

  /**
   * Legacy method — redirects to new daily summary.
   */
  async generateSummary(): Promise<string> {
    return this.generateDailySummary();
  }

  /**
   * Weekly digest: 7-day P&L, per-asset performance, rebalance history, fees.
   */
  async generateWeeklySummary(): Promise<string> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [weeklyPnl, assetPerf, rebalanceSection, feeSection] = await Promise.all([
      this.buildWeeklyPnlSection(since),
      this.buildAssetPerformanceSection(since),
      this.buildRebalanceHistorySection(since),
      this.buildFeeSummarySection(since),
    ]);

    const date = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    return [
      "📈 <b>Báo Cáo Hiệu Suất Tuần</b>",
      `<i>${date}</i>`,
      "",
      weeklyPnl,
      "",
      assetPerf,
      "",
      rebalanceSection,
      "",
      feeSection,
    ].join("\n");
  }

  // ─── Daily sections ────────────────────────────────────────────────────────

  private async buildPortfolioSection(since: Date): Promise<string> {
    const rows = await SnapshotModel.find({ createdAt: { $gte: since } })
      .select("totalValueUsd createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (rows.length === 0) {
      return "<b>💰 Giá Trị Portfolio:</b> Chưa có dữ liệu 24h qua";
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
      "<b>💰 Giá Trị Portfolio (24h)</b>",
      `Hiện tại: <code>$${endValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</code>`,
      `Thay đổi: <code>${arrow} ${sign}$${Math.abs(changeUsd).toFixed(0)} (${sign}${changePct.toFixed(2)}%)</code>`,
    ].join("\n");
  }

  private async buildAllocationSection(): Promise<string> {
    const portfolio = portfolioTracker.getPortfolio();
    if (!portfolio || portfolio.assets.length === 0) {
      return "<b>📊 Phân Bổ:</b> Chưa có dữ liệu";
    }

    const lines = portfolio.assets
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .map((a) => {
        const val = `$${a.valueUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        return `  ${a.asset}: <code>${val}</code> (${a.currentPct.toFixed(1)}% / ${a.targetPct}%)`;
      });

    return ["<b>📊 Phân Bổ Tài Sản</b>", ...lines].join("\n");
  }

  private async buildDriftSection(): Promise<string> {
    const portfolio = portfolioTracker.getPortfolio();
    if (!portfolio || portfolio.assets.length === 0) {
      return "<b>📐 Drift:</b> N/A";
    }

    const maxDrift = portfolio.assets.reduce((max, a) =>
      Math.abs(a.driftPct) > Math.abs(max.driftPct) ? a : max
    );
    const avgDrift =
      portfolio.assets.reduce((sum, a) => sum + Math.abs(a.driftPct), 0) / portfolio.assets.length;

    const status = Math.abs(maxDrift.driftPct) > 5 ? "⚠️ Cần rebalance" : "✅ Ổn định";

    return [
      "<b>📐 Trạng Thái Drift</b>",
      `Max: <code>${maxDrift.asset} ${maxDrift.driftPct >= 0 ? "+" : ""}${maxDrift.driftPct.toFixed(2)}%</code>`,
      `Trung bình: <code>${avgDrift.toFixed(2)}%</code>`,
      `Đánh giá: ${status}`,
    ].join("\n");
  }

  private async buildTrendSection(): Promise<string> {
    const dataPoints = trendFilter.getDataPoints();
    const isBull = trendFilter.isBullishReadOnly();
    const signal = isBull ? "🟢 BULL" : "🔴 BEAR";
    const dataStatus = dataPoints < 100 ? ` (${dataPoints}/100 điểm dữ liệu)` : "";

    return [
      "<b>📉 Trend Filter</b>",
      `Tín hiệu: ${signal}${dataStatus}`,
    ].join("\n");
  }

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
      return "<b>💱 Giao Dịch (24h):</b> Không có";
    }

    let totalTrades = 0;
    let totalVolumeUsd = 0;

    for (const row of aggResult) {
      totalTrades += row.count as number;
      totalVolumeUsd += row.totalCost as number;
    }

    return [
      "<b>💱 Giao Dịch (24h)</b>",
      `Số lệnh: <code>${totalTrades}</code>`,
      `Khối lượng: <code>$${totalVolumeUsd.toFixed(0)}</code>`,
    ].join("\n");
  }

  // ─── Weekly sections ───────────────────────────────────────────────────────

  private async buildWeeklyPnlSection(since: Date): Promise<string> {
    const rows = await SnapshotModel.find({ createdAt: { $gte: since } })
      .select("totalValueUsd createdAt")
      .sort({ createdAt: 1 })
      .lean();

    if (rows.length < 2) {
      return "<b>💰 P&L Tuần:</b> Chưa đủ dữ liệu";
    }

    const start = rows[0]!.totalValueUsd;
    const end = rows[rows.length - 1]!.totalValueUsd;
    const change = end - start;
    const pct = start > 0 ? (change / start) * 100 : 0;
    const sign = change >= 0 ? "+" : "";
    const arrow = change >= 0 ? "▲" : "▼";

    return [
      "<b>💰 Lợi Nhuận Tuần</b>",
      `Đầu tuần: <code>$${start.toLocaleString("en-US", { maximumFractionDigits: 0 })}</code>`,
      `Cuối tuần: <code>$${end.toLocaleString("en-US", { maximumFractionDigits: 0 })}</code>`,
      `P&L: <code>${arrow} ${sign}$${Math.abs(change).toFixed(0)} (${sign}${pct.toFixed(2)}%)</code>`,
      `Snapshots: <code>${rows.length}</code>`,
    ].join("\n");
  }

  private async buildAssetPerformanceSection(since: Date): Promise<string> {
    // Compare oldest and newest snapshots for per-asset value change
    const oldest = await SnapshotModel.findOne({ createdAt: { $gte: since } })
      .sort({ createdAt: 1 })
      .lean();
    const newest = await SnapshotModel.findOne({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .lean();

    if (!oldest || !newest) {
      return "<b>📊 Hiệu Suất Tài Sản:</b> Chưa đủ dữ liệu";
    }

    // holdings is Record<string, { amount, valueUsd, exchange }>
    const oldHoldings = oldest.holdings as Record<string, { valueUsd: number }>;
    const newHoldings = newest.holdings as Record<string, { valueUsd: number }>;

    const lines: string[] = [];
    for (const [asset, data] of Object.entries(newHoldings)) {
      const oldVal = oldHoldings[asset]?.valueUsd ?? data.valueUsd;
      const change = oldVal > 0 ? ((data.valueUsd - oldVal) / oldVal) * 100 : 0;
      const sign = change >= 0 ? "+" : "";
      lines.push(`  ${asset}: <code>${sign}${change.toFixed(2)}%</code>`);
    }

    return ["<b>📊 Hiệu Suất Từng Tài Sản (7 ngày)</b>", ...lines].join("\n");
  }

  private async buildRebalanceHistorySection(since: Date): Promise<string> {
    // Count distinct rebalance events from trades grouped by executedAt proximity
    const trades = await TradeModel.find({ executedAt: { $gte: since } })
      .select("executedAt costUsd")
      .sort({ executedAt: 1 })
      .lean();

    if (trades.length === 0) {
      return "<b>🔄 Rebalance (7 ngày):</b> Không có";
    }

    // Group trades into rebalance sessions (trades within 60s = 1 session)
    let sessions = 1;
    for (let i = 1; i < trades.length; i++) {
      const prev = new Date(trades[i - 1]!.executedAt).getTime();
      const curr = new Date(trades[i]!.executedAt).getTime();
      if (curr - prev > 60_000) sessions++;
    }

    return [
      "<b>🔄 Lịch Sử Rebalance (7 ngày)</b>",
      `Số lần rebalance: <code>${sessions}</code>`,
      `Tổng lệnh: <code>${trades.length}</code>`,
    ].join("\n");
  }

  private async buildFeeSummarySection(since: Date): Promise<string> {
    const result = await TradeModel.aggregate([
      { $match: { executedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalFees: { $sum: "$feeUsd" },
          totalVolume: { $sum: "$costUsd" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return "<b>💸 Phí Giao Dịch (7 ngày):</b> $0";
    }

    const { totalFees, totalVolume } = result[0];
    const feeRate = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;

    return [
      "<b>💸 Chi Phí Giao Dịch (7 ngày)</b>",
      `Tổng phí: <code>$${(totalFees ?? 0).toFixed(2)}</code>`,
      `Khối lượng: <code>$${(totalVolume ?? 0).toFixed(0)}</code>`,
      `Tỷ lệ phí: <code>${feeRate.toFixed(3)}%</code>`,
    ].join("\n");
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const marketSummaryService = new MarketSummaryService();
