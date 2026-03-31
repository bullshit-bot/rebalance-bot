import { RebalanceModel } from "@db/database";
import { driftDetector } from "@rebalancer/drift-detector";
import { rebalanceEngine } from "@rebalancer/rebalance-engine";
import { Hono } from "hono";

const rebalanceRoutes = new Hono();

/**
 * POST /api/rebalance
 * Triggers a manual rebalance cycle.
 */
rebalanceRoutes.post("/", async (c) => {
  try {
    const event = await rebalanceEngine.execute("manual");
    return c.json(event, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/rebalance/preview
 * Dry-run: returns trades that would be generated without executing them.
 * Returns empty trades array when portfolio is unavailable (no exchange connections).
 */
rebalanceRoutes.get("/preview", async (c) => {
  try {
    const result = await rebalanceEngine.preview();
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Return empty preview instead of 500 when portfolio unavailable
    if (message.includes("Portfolio not yet available")) {
      return c.json({ trades: [], portfolio: null });
    }
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/rebalance/history?limit=20
 * Returns past rebalance records ordered by most recent first.
 */
rebalanceRoutes.get("/history", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  if (isNaN(limit) || limit < 1 || limit > 200) {
    return c.json({ error: "limit must be an integer between 1 and 200" }, 400);
  }

  try {
    const rows = await RebalanceModel.find().sort({ startedAt: -1 }).limit(limit).lean();
    return c.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

/** POST /api/rebalance/pause — stop drift detector + rebalance engine */
rebalanceRoutes.post("/pause", (c) => {
  driftDetector.stop();
  rebalanceEngine.stop();
  return c.json({ status: "paused" });
});

/** POST /api/rebalance/resume — restart drift detector + rebalance engine */
rebalanceRoutes.post("/resume", (c) => {
  driftDetector.start();
  rebalanceEngine.start();
  return c.json({ status: "running" });
});

export { rebalanceRoutes };
