import type { WSMessage } from "@/types/index";
import { eventBus } from "@events/event-bus";
import { exchangeManager } from "@exchange/exchange-manager";
import { portfolioTracker } from "@portfolio/portfolio-tracker";
import { priceCache } from "@price/price-cache";
import type { ServerWebSocket } from "bun";

// ─── Client registry ──────────────────────────────────────────────────────────

const clients: Set<ServerWebSocket<unknown>> = new Set();

// ─── Price update throttle ────────────────────────────────────────────────────

/** Timestamp of the last price broadcast — used to throttle to max 1/second */
let lastPriceBroadcast = 0;

// ─── Broadcast ────────────────────────────────────────────────────────────────

/**
 * Serializes a WSMessage and sends it to every connected client.
 * Silently removes clients that have become unresponsive.
 */
function broadcast(message: WSMessage): void {
  const payload = JSON.stringify(message);

  for (const ws of clients) {
    try {
      ws.send(payload);
    } catch {
      clients.delete(ws);
    }
  }
}

// ─── Connection handlers ──────────────────────────────────────────────────────

/** Called by Bun when a new WebSocket connection is established. */
function handleOpen(ws: ServerWebSocket<unknown>): void {
  clients.add(ws);
  console.info("[WS] Client connected — total=%d", clients.size);

  // Push current state immediately so the client doesn't wait for the next event
  const portfolio = portfolioTracker.getPortfolio();
  if (portfolio) {
    ws.send(JSON.stringify({ type: "portfolio", data: portfolio } satisfies WSMessage));
  }

  const prices = priceCache.getAll();
  if (Object.keys(prices).length > 0) {
    ws.send(JSON.stringify({ type: "prices", data: prices } satisfies WSMessage));
  }

  ws.send(
    JSON.stringify({
      type: "exchange:status",
      data: exchangeManager.getStatus(),
    } satisfies WSMessage)
  );
}

/** Called by Bun when a WebSocket connection is closed. */
function handleClose(ws: ServerWebSocket<unknown>): void {
  clients.delete(ws);
  console.info("[WS] Client disconnected — total=%d", clients.size);
}

// ─── Event subscriptions ──────────────────────────────────────────────────────

/**
 * Subscribes to eventBus events and relays them as WSMessages to all clients.
 * Call once at server startup — idempotency is NOT enforced, so avoid calling twice.
 */
function initWebSocket(): void {
  // price:update — throttled to max 1 broadcast per second
  eventBus.on("price:update", () => {
    const now = Date.now();
    if (now - lastPriceBroadcast < 1_000) return;
    lastPriceBroadcast = now;
    broadcast({ type: "prices", data: priceCache.getAll() });
  });

  eventBus.on("portfolio:update", (data) => {
    broadcast({ type: "portfolio", data });
  });

  eventBus.on("rebalance:started", (data) => {
    broadcast({
      type: "rebalance:started",
      data: { id: data.id, trigger: data.trigger },
    });
  });

  eventBus.on("rebalance:completed", (data) => {
    broadcast({ type: "rebalance:completed", data });
  });

  eventBus.on("trade:executed", (data) => {
    broadcast({ type: "trade:executed", data });
  });

  eventBus.on("trailing-stop:triggered", (data) => {
    broadcast({
      type: "trailing-stop:triggered",
      data: { asset: data.asset, price: data.price, stopPrice: data.stopPrice },
    });
  });

  eventBus.on("exchange:connected", () => {
    broadcast({ type: "exchange:status", data: exchangeManager.getStatus() });
  });

  eventBus.on("exchange:disconnected", () => {
    broadcast({ type: "exchange:status", data: exchangeManager.getStatus() });
  });

  console.info("[WS] Event subscriptions initialised");
}

export { initWebSocket, handleOpen, handleClose, broadcast };
