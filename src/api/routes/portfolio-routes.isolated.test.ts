import { describe, expect, it, mock } from "bun:test";

mock.module("@portfolio/portfolio-tracker", () => ({
  portfolioTracker: {
    getPortfolio: () => ({
      totalValueUsd: 10000,
      assets: [{ asset: "BTC", amount: 1, valueUsd: 45000 }],
      updatedAt: Date.now(),
    }),
  },
}));

mock.module("@portfolio/snapshot-service", () => ({
  snapshotService: {
    getSnapshots: async () => [
      { totalValueUsd: 10000, holdings: "{}", createdAt: Math.floor(Date.now() / 1000) },
    ],
  },
}));

mock.module("@db/database", () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => [
            {
              holdings: JSON.stringify({ BTC: { amount: 1, valueUsd: 45000 } }),
              totalValueUsd: 45000,
              createdAt: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      }),
    }),
  },
}));

import { Hono } from "hono";
import { portfolioRoutes } from "./portfolio-routes";

describe("portfolio-routes", () => {
  const app = new Hono();
  app.route("/", portfolioRoutes);

  it("GET / returns portfolio", async () => {
    const res = await app.request("http://localhost/");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalValueUsd).toBeDefined();
  });

  it("GET /history returns snapshots", async () => {
    const res = await app.request("http://localhost/history");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /history with custom time range", async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await app.request(`http://localhost/history?from=${now - 3600}&to=${now}`);
    expect(res.status).toBe(200);
  });

  it("GET /history rejects invalid from parameter", async () => {
    const res = await app.request("http://localhost/history?from=invalid");
    expect(res.status).toBe(400);
  });

  it("GET /history rejects NaN from parameter", async () => {
    const res = await app.request("http://localhost/history?from=NaN");
    expect(res.status).toBe(400);
  });

  it("GET /history rejects invalid to parameter", async () => {
    const res = await app.request("http://localhost/history?to=not-a-number");
    expect(res.status).toBe(400);
  });

  it("GET /history with both from and to", async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await app.request(`http://localhost/history?from=${now - 7200}&to=${now}`);
    expect(res.status).toBe(200);
  });
});
