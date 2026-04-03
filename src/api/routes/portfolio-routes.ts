import { AllocationModel, CapitalFlowModel, SnapshotModel } from "@db/database";
import { portfolioTracker } from "@portfolio/portfolio-tracker";
import { snapshotService } from "@portfolio/snapshot-service";
import { Hono } from "hono";

const portfolioRoutes = new Hono();

/**
 * Build a portfolio object from the latest DB snapshot when live tracking
 * is unavailable (e.g. no exchange connections configured).
 */
async function buildPortfolioFromSnapshot() {
  const latest = await SnapshotModel.findOne().sort({ createdAt: -1 }).lean();
  if (!latest) return null;

  const holdings = latest.holdings as Record<
    string,
    { amount: number; valueUsd: number; exchange?: string }
  >;
  const targets = await AllocationModel.find().lean();
  const targetMap = new Map(targets.map((t) => [t.asset, t.targetPct]));

  const totalValue = latest.totalValueUsd;
  const assets = Object.entries(holdings).map(([asset, h]) => {
    const currentPct = totalValue > 0 ? (h.valueUsd / totalValue) * 100 : 0;
    const targetPct = targetMap.get(asset) ?? 0;
    return {
      asset,
      amount: h.amount,
      valueUsd: h.valueUsd,
      currentPct: Math.round(currentPct * 10) / 10,
      targetPct,
      driftPct: Math.round((currentPct - targetPct) * 10) / 10,
      exchange: (h.exchange ?? "binance") as "binance" | "okx" | "bybit",
    };
  });

  const createdAt = latest.createdAt instanceof Date ? latest.createdAt.getTime() : Date.now();
  return { totalValueUsd: totalValue, assets, updatedAt: createdAt };
}

/**
 * GET /api/portfolio
 * Returns the current portfolio state.
 * Falls back to latest DB snapshot when live tracker is unavailable.
 */
portfolioRoutes.get("/", async (c) => {
  const portfolio = portfolioTracker.getPortfolio();

  // Aggregate totalInvested from capital flow records
  const [flowAgg] = await CapitalFlowModel.aggregate([
    { $group: { _id: null, total: { $sum: "$amountUsd" } } },
  ]);
  const totalInvested: number = flowAgg?.total ?? 0;

  if (portfolio) return c.json({ ...portfolio, totalInvested });

  // Fallback: build from latest snapshot
  const fallback = await buildPortfolioFromSnapshot();
  if (fallback) return c.json({ ...fallback, totalInvested });

  return c.json({ error: "Portfolio not yet available" }, 503);
});

/**
 * GET /api/portfolio/history?from=&to=
 * Returns snapshots within the given Unix epoch seconds range.
 * Defaults: from = 24h ago, to = now
 */
portfolioRoutes.get("/history", async (c) => {
  const nowSecs = Math.floor(Date.now() / 1_000);
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const from = fromParam ? Number.parseInt(fromParam, 10) : nowSecs - 86_400;
  const to = toParam ? Number.parseInt(toParam, 10) : nowSecs;

  if (isNaN(from) || isNaN(to)) {
    return c.json({ error: "Invalid from/to parameters — expected Unix epoch seconds" }, 400);
  }

  try {
    const snapshots = await snapshotService.getSnapshots(from, to);
    return c.json(snapshots);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/portfolio/capital-flows
 * Returns all capital flow records (deposits + DCA) for history/audit.
 */
portfolioRoutes.get("/capital-flows", async (c) => {
  try {
    const flows = await CapitalFlowModel.find().sort({ createdAt: -1 }).lean();
    return c.json(flows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/portfolio/capital-flows
 * Record a new deposit. Body: { amountUsd: number, note?: string }
 */
portfolioRoutes.post("/capital-flows", async (c) => {
  try {
    const body = await c.req.json();
    const amount = Number(body.amountUsd);
    if (!amount || amount <= 0) {
      return c.json({ error: "amountUsd must be a positive number" }, 400);
    }
    const flow = await CapitalFlowModel.create({
      type: "deposit",
      amountUsd: amount,
      note: body.note || "Manual deposit",
    });
    return c.json(flow, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

export { portfolioRoutes };
