import { describe, expect, it, mock } from "bun:test";

mock.module("@grid/grid-bot-manager", () => ({
  gridBotManager: {
    create: async () => "bot-123",
    listBots: async () => [
      {
        id: "bot-1",
        exchange: "binance",
        pair: "BTC/USDT",
        gridType: "normal",
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        status: "active",
        createdAt: Date.now(),
      },
    ],
    getBot: async () => ({
      id: "bot-1",
      exchange: "binance",
      pair: "BTC/USDT",
      gridType: "normal",
      priceLower: 40000,
      priceUpper: 50000,
      gridLevels: 10,
      investment: 1000,
      status: "active",
      createdAt: Date.now(),
    }),
    stop: async () => ({ totalProfit: 100, totalTrades: 50 }),
  },
}));

mock.module("@grid/grid-pnl-tracker", () => ({
  gridPnLTracker: {
    getPnL: () => ({ realized: 100, unrealized: 50, total: 150, tradeCount: 50 }),
    loadFromDb: async () => {},
  },
}));

import { Hono } from "hono";
import { gridRoutes } from "./grid-routes";

describe("grid-routes", () => {
  const app = new Hono();
  app.route("/", gridRoutes);

  it("POST /grid creates grid bot", async () => {
    const res = await app.request("http://localhost/grid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchange: "binance",
        pair: "BTC/USDT",
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 10,
        investment: 1000,
        gridType: "normal",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.botId).toBe("bot-123");
  });

  it("POST /grid rejects invalid gridLevels", async () => {
    const res = await app.request("http://localhost/grid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchange: "binance",
        pair: "BTC/USDT",
        priceLower: 40000,
        priceUpper: 50000,
        gridLevels: 1,
        investment: 1000,
        gridType: "normal",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /grid rejects priceLower >= priceUpper", async () => {
    const res = await app.request("http://localhost/grid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchange: "binance",
        pair: "BTC/USDT",
        priceLower: 50000,
        priceUpper: 40000,
        gridLevels: 10,
        investment: 1000,
        gridType: "normal",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /grid/list returns all bots", async () => {
    const res = await app.request("http://localhost/grid/list");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /grid/:id returns bot details", async () => {
    const res = await app.request("http://localhost/grid/bot-1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("bot-1");
    expect(data.pnl).toBeDefined();
  });

  it("PUT /grid/:id/stop stops bot", async () => {
    const res = await app.request("http://localhost/grid/bot-1/stop", {
      method: "PUT",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("stopped");
  });
});
