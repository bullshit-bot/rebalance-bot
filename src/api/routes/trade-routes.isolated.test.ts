import { describe, expect, it, mock } from "bun:test";

mock.module("@db/database", () => {
  const tradeRow = {
    id: "trade-1",
    pair: "BTC/USDT",
    side: "buy",
    amount: 1,
    price: 45000,
    exchange: "binance",
    executedAt: Date.now(),
    rebalanceId: "rebal-1",
  };
  // Returns a thenable query builder so callers can either `await` it or chain `.where()`
  const makeQueryBuilder = (rows: (typeof tradeRow)[]) => {
    const qb = {
      then: (resolve: (v: typeof rows) => void) => Promise.resolve(rows).then(resolve),
      where: () => Promise.resolve(rows),
      limit: () => makeQueryBuilder(rows),
      orderBy: () => makeQueryBuilder(rows),
    };
    return qb;
  };
  return {
    db: {
      select: () => ({
        from: () => makeQueryBuilder([tradeRow]),
      }),
    },
  };
});

import { Hono } from "hono";
import { tradeRoutes } from "./trade-routes";

describe("trade-routes", () => {
  const app = new Hono();
  app.route("/", tradeRoutes);

  it("GET /trades returns trades", async () => {
    const res = await app.request("http://localhost/");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /trades with limit returns limited trades", async () => {
    const res = await app.request("http://localhost/?limit=10");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /trades with rebalanceId filters by rebalanceId", async () => {
    const res = await app.request("http://localhost/?rebalanceId=rebal-1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /trades rejects invalid limit", async () => {
    const res = await app.request("http://localhost/?limit=invalid");
    expect(res.status).toBe(400);
  });

  it("GET /trades rejects limit > 500", async () => {
    const res = await app.request("http://localhost/?limit=600");
    expect(res.status).toBe(400);
  });

  it("GET /trades rejects limit = 0", async () => {
    const res = await app.request("http://localhost/?limit=0");
    expect(res.status).toBe(400);
  });

  it("GET /trades with limit and rebalanceId", async () => {
    const res = await app.request("http://localhost/?limit=20&rebalanceId=rebal-1");
    expect(res.status).toBe(200);
  });
});
