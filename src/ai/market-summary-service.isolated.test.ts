import { describe, expect, it, mock } from "bun:test";

// ─── Mock Mongoose models used by MarketSummaryService ────────────────────────
// The service uses SnapshotModel and TradeModel directly from @db/database.
// We stub the chainable Mongoose query API and aggregate.

const mockSnapshots = [
  { totalValueUsd: 10000, createdAt: new Date(Date.now() - 86_400_000) },
  { totalValueUsd: 11000, createdAt: new Date() },
];

const mockTradeAgg = [
  { _id: { side: "buy" }, count: 10, totalCost: 50000 },
  { _id: { side: "sell" }, count: 5, totalCost: 15000 },
];

const makeLeaner = (data: unknown[]) => ({
  lean: async () => data,
});

const makeFindChain = (data: unknown[]) => ({
  select: () => ({
    sort: () => makeLeaner(data),
  }),
});

const makeFindOneChain = (data: unknown) => ({
  sort: () => ({
    lean: async () => data,
  }),
});

mock.module("@db/database", () => ({
  SnapshotModel: {
    find: () => makeFindChain(mockSnapshots),
    findOne: () => makeFindOneChain(mockSnapshots[0]),
  },
  TradeModel: {
    aggregate: async () => mockTradeAgg,
    find: () => makeFindChain([]),
  },
}));

// Mock portfolio tracker — return null (no live portfolio in unit tests)
mock.module("@portfolio/portfolio-tracker", () => ({
  portfolioTracker: {
    getPortfolio: () => null,
  },
}));

// Mock trend filter
mock.module("@rebalancer/trend-filter", () => ({
  trendFilter: {
    getDataPoints: () => 50,
    isBullishReadOnly: () => true,
  },
}));

import { marketSummaryService } from "./market-summary-service";

describe("market-summary-service", () => {
  it("generates daily summary without throwing", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("generateSummary() redirects to generateDailySummary()", async () => {
    const summary = await marketSummaryService.generateSummary();
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("summary includes Vietnamese portfolio header", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("Báo Cáo Portfolio Hàng Ngày");
  });

  it("summary includes portfolio value section (Giá Trị)", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("Giá Trị Portfolio");
  });

  it("summary includes trade section (Giao Dịch)", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("Giao Dịch");
  });

  it("summary includes daily header with emoji", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("Hàng Ngày");
  });

  it("summary contains dollar sign for portfolio values", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("$");
  });

  it("summary shows change indicator (▲ or ▼)", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toMatch(/▲|▼/);
  });

  it("summary aggregates trade counts — contains numeric digit", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toMatch(/\d+/);
  });

  it("summary uses HTML bold formatting", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("<b>");
    expect(summary).toContain("</b>");
  });

  it("summary uses HTML code formatting", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("<code>");
  });

  it("summary includes trend section", async () => {
    const summary = await marketSummaryService.generateDailySummary();
    expect(summary).toContain("Trend");
  });
});
