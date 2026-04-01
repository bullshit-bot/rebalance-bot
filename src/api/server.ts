import { authMiddleware } from "@api/middleware/auth-middleware";
import { analyticsRoutes } from "@api/routes/analytics-routes";
import { backtestRoutes } from "@api/routes/backtest-routes";
import { configRoutes } from "@api/routes/config-routes";
import { healthRoutes } from "@api/routes/health-routes";
import { portfolioRoutes } from "@api/routes/portfolio-routes";
import { rebalanceRoutes } from "@api/routes/rebalance-routes";
import { strategyConfigRoutes } from "@api/routes/strategy-config-routes";
import { tradeRoutes } from "@api/routes/trade-routes";
import { handleClose, handleOpen, initWebSocket } from "@api/ws/ws-handler";
import { env } from "@config/app-config";
import { dcaService } from "@dca/dca-service";
import { simpleEarnManager } from "@exchange/simple-earn-manager";
import { priceCache } from "@price/price-cache";
import { strategyManager } from "@rebalancer/strategy-manager";
import { Hono } from "hono";
import { cors } from "hono/cors";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MINUTE = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Evict expired entries every 60s to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000).unref();

/**
 * Simple in-memory rate limiter: max 600 requests per IP per minute.
 * Returns true if the request is allowed, false if rate-limited.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── Hono app ─────────────────────────────────────────────────────────────────

const app = new Hono();

// CORS — permissive by default; restrict origins via reverse proxy in production
app.use("*", cors());

// Rate limiting — applied before auth to limit unauthenticated probing
app.use("/api/*", async (c, next) => {
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return c.json({ error: "Too many requests" }, 429);
  }
  return next();
});

// Auth middleware applied to all /api/* routes except /api/health
app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health") {
    await next();
    return;
  }
  return authMiddleware(c, next);
});

// ─── Route groups ─────────────────────────────────────────────────────────────

app.route("/api/health", healthRoutes);
app.route("/api/portfolio", portfolioRoutes);
app.route("/api/rebalance", rebalanceRoutes);
app.route("/api/trades", tradeRoutes);
app.route("/api/config", configRoutes);
app.route("/api", backtestRoutes);
app.route("/api", analyticsRoutes);
app.route("/api/strategy-config", strategyConfigRoutes);

// ─── Manual DCA trigger ──────────────────────────────────────────────────────

app.post("/api/dca/trigger", async (c) => {
  const orders = await dcaService.executeScheduledDCA();
  return c.json({ triggered: true, orders: orders.length, details: orders });
});

// ─── Earn status ──────────────────────────────────────────────────────────────

app.get("/api/earn/status", async (c) => {
  const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined;
  if (!gs?.simpleEarnEnabled) {
    return c.json({ enabled: false, positions: [], totalValueUsd: 0 });
  }
  try {
    const positions = await simpleEarnManager.getFlexiblePositions();
    const totalValueUsd = positions.reduce((sum, p) => {
      const price = priceCache.getBestPrice(`${p.asset}/USDT`) ?? 0;
      return sum + p.amount * price;
    }, 0);
    const apyMap = await simpleEarnManager.getApyMap();
    return c.json({ enabled: true, positions, totalValueUsd, apyRates: apyMap });
  } catch (err) {
    return c.json({
      enabled: true,
      positions: [],
      totalValueUsd: 0,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ─── Server startup ───────────────────────────────────────────────────────────

/**
 * Starts the HTTP + WebSocket server using Bun.serve().
 *
 * WebSocket upgrade requests to /ws are handled natively by Bun;
 * all other requests are dispatched through Hono.
 * Returns the server instance so callers can call server.stop() on shutdown.
 */
export function startServer(): ReturnType<typeof Bun.serve> {
  // Wire eventBus → WebSocket broadcast bridges before accepting connections
  initWebSocket();

  const server = Bun.serve({
    port: env.API_PORT,

    fetch(req, server) {
      const url = new URL(req.url);

      // Upgrade /ws path to a native Bun WebSocket connection
      if (url.pathname === "/ws") {
        // Require API key as query param: /ws?apiKey=<key>
        const apiKey = url.searchParams.get("apiKey");
        if (apiKey !== env.API_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const upgraded = server.upgrade(req, { data: {} });
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 });
        }
        // Returning undefined signals Bun to proceed with the upgrade
        return undefined;
      }

      return app.fetch(req);
    },

    websocket: {
      open: handleOpen,
      close: handleClose,
      // Server-to-client push only — inbound messages are silently ignored
      message(_ws, _message) {},
    },
  });

  return server;
}

export { app };
