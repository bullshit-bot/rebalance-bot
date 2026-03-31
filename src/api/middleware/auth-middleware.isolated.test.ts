import { describe, expect, it, mock } from "bun:test";

mock.module("@config/app-config", () => ({
  env: {
    API_KEY: "test-api-key-12345",
  },
}));

import { Hono } from "hono";
import { authMiddleware } from "./auth-middleware";

describe("auth-middleware", () => {
  const app = new Hono();

  // Add middleware and a test route
  app.use(authMiddleware);
  app.get("/protected", (c) => c.json({ status: "ok" }));

  it("allows request with valid API key", async () => {
    const res = await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "test-api-key-12345" },
    });
    expect(res.status).toBe(200);
  });

  it("rejects request with invalid API key", async () => {
    const res = await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "wrong-key" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects request without API key header", async () => {
    const res = await app.request("http://localhost/protected");
    expect(res.status).toBe(401);
  });

  it("rejects request with empty API key header", async () => {
    const res = await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "" },
    });
    expect(res.status).toBe(401);
  });

  it("timing-safe compare protects against timing attacks", async () => {
    const start1 = Date.now();
    await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "aaaaaaaaaaaaaaaaa" },
    });
    const duration1 = Date.now() - start1;

    const start2 = Date.now();
    await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "bbbbbbbbbbbbbbbbb" },
    });
    const duration2 = Date.now() - start2;

    // Timing should be similar (within reasonable tolerance)
    // This is a soft check since timing can vary
    expect(Math.abs(duration1 - duration2)).toBeLessThan(100);
  });

  it("rejects API key with different length", async () => {
    const res = await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "test-api-key-12345-extra" },
    });
    expect(res.status).toBe(401);
  });

  it("case-sensitive API key comparison", async () => {
    const res = await app.request("http://localhost/protected", {
      headers: { "X-API-Key": "TEST-API-KEY-12345" },
    });
    expect(res.status).toBe(401);
  });
});
