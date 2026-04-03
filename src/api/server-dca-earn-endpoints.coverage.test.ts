/**
 * Coverage tests for server.ts routes not covered by server.test.ts:
 *   Lines 98-99:  POST /api/dca/trigger
 *   Lines 105-123: GET /api/earn/status
 *   Lines 53/71:  Rate-limit 429 path (checkRateLimit returns false)
 *   Lines 141-177: startServer() — covers Bun.serve() startup + WebSocket wiring
 *
 * Uses spyOn() on singleton services — no mock.module().
 */
import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { dcaService } from "@dca/dca-service";
import { simpleEarnManager } from "@exchange/simple-earn-manager";
import { priceCache } from "@price/price-cache";
import { strategyManager } from "@rebalancer/strategy-manager";
import { app, startServer } from "./server";

const API_KEY = process.env["API_KEY"] ?? "test-ci-key";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("server.ts — DCA trigger + Earn status coverage", () => {
  // ─── POST /api/dca/trigger (lines 98-99) ─────────────────────────────────

  describe("POST /api/dca/trigger (lines 98-99)", () => {
    it("returns 200 with triggered=true and empty orders array", async () => {
      const spy = spyOn(dcaService, "executeScheduledDCA").mockResolvedValue([]);

      try {
        const res = await app.request("/api/dca/trigger", {
          method: "POST",
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.triggered).toBe(true);
        expect(data.orders).toBe(0);
        expect(Array.isArray(data.details)).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    it("returns orders count matching returned orders", async () => {
      const fakeOrders = [
        { exchange: "binance", pair: "BTC/USDT", side: "buy", type: "market", amount: 0.01 },
        { exchange: "binance", pair: "ETH/USDT", side: "buy", type: "market", amount: 0.1 },
      ];
      const spy = spyOn(dcaService, "executeScheduledDCA").mockResolvedValue(fakeOrders as any);

      try {
        const res = await app.request("/api/dca/trigger", {
          method: "POST",
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.triggered).toBe(true);
        expect(data.orders).toBe(2);
        const details = data.details as unknown[];
        expect(details.length).toBe(2);
      } finally {
        spy.mockRestore();
      }
    });

    it("requires valid API key", async () => {
      const res = await app.request("/api/dca/trigger", {
        method: "POST",
        headers: { "X-API-Key": "invalid-key" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/earn/status — simpleEarnEnabled = false (line 107-109) ──────

  describe("GET /api/earn/status — earn disabled (lines 107-109)", () => {
    it("returns enabled=false when globalSettings.simpleEarnEnabled is falsy", async () => {
      const spy = spyOn(strategyManager, "getActiveConfig").mockReturnValue({
        globalSettings: { simpleEarnEnabled: false },
      } as any);

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(false);
        expect(data.positions).toEqual([]);
        expect(data.totalValueUsd).toBe(0);
      } finally {
        spy.mockRestore();
      }
    });

    it("returns enabled=false when getActiveConfig returns undefined", async () => {
      const spy = spyOn(strategyManager, "getActiveConfig").mockReturnValue(undefined as any);

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── GET /api/earn/status — earn enabled, success (lines 111-117) ─────────

  describe("GET /api/earn/status — earn enabled success (lines 111-117)", () => {
    it("returns positions and totalValueUsd when earn is enabled", async () => {
      const configSpy = spyOn(strategyManager, "getActiveConfig").mockReturnValue({
        globalSettings: { simpleEarnEnabled: true },
      } as any);

      const positions = [
        { asset: "BTC", amount: 0.5 },
        { asset: "ETH", amount: 2.0 },
      ];
      const positionsSpy = spyOn(
        simpleEarnManager,
        "getFlexiblePositions"
      ).mockResolvedValue(positions as any);

      const priceSpy = spyOn(priceCache, "getBestPrice").mockImplementation((pair: string) => {
        if (pair === "BTC/USDT") return 50000;
        if (pair === "ETH/USDT") return 3000;
        return 0;
      });

      const apyMap = { BTC: 0.03, ETH: 0.02 };
      const apySpy = spyOn(simpleEarnManager, "getApyMap").mockResolvedValue(apyMap as any);

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(true);
        expect(Array.isArray(data.positions)).toBe(true);
        // totalValueUsd = 0.5*50000 + 2.0*3000 = 25000 + 6000 = 31000
        expect(data.totalValueUsd).toBe(31000);
        expect(data.apyRates).toBeDefined();
      } finally {
        configSpy.mockRestore();
        positionsSpy.mockRestore();
        priceSpy.mockRestore();
        apySpy.mockRestore();
      }
    });

    it("uses 0 when price is not found in cache", async () => {
      const configSpy = spyOn(strategyManager, "getActiveConfig").mockReturnValue({
        globalSettings: { simpleEarnEnabled: true },
      } as any);

      const positions = [{ asset: "UNKNOWN", amount: 100 }];
      const positionsSpy = spyOn(
        simpleEarnManager,
        "getFlexiblePositions"
      ).mockResolvedValue(positions as any);

      // getBestPrice returns null/undefined for unknown assets
      const priceSpy = spyOn(priceCache, "getBestPrice").mockReturnValue(null as any);
      const apySpy = spyOn(simpleEarnManager, "getApyMap").mockResolvedValue({});

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(true);
        // 100 * 0 = 0 because price is null -> ?? 0
        expect(data.totalValueUsd).toBe(0);
      } finally {
        configSpy.mockRestore();
        positionsSpy.mockRestore();
        priceSpy.mockRestore();
        apySpy.mockRestore();
      }
    });
  });

  // ─── GET /api/earn/status — earn enabled, error (lines 118-124) ───────────

  describe("GET /api/earn/status — earn enabled error path (lines 118-124)", () => {
    it("returns enabled=true with error field when getFlexiblePositions throws", async () => {
      const configSpy = spyOn(strategyManager, "getActiveConfig").mockReturnValue({
        globalSettings: { simpleEarnEnabled: true },
      } as any);

      const positionsSpy = spyOn(
        simpleEarnManager,
        "getFlexiblePositions"
      ).mockRejectedValue(new Error("Earn API unavailable"));

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(true);
        expect(data.positions).toEqual([]);
        expect(data.totalValueUsd).toBe(0);
        expect(data.error).toBe("Earn API unavailable");
      } finally {
        configSpy.mockRestore();
        positionsSpy.mockRestore();
      }
    });

    it("returns 'unknown' error when non-Error is thrown", async () => {
      const configSpy = spyOn(strategyManager, "getActiveConfig").mockReturnValue({
        globalSettings: { simpleEarnEnabled: true },
      } as any);

      const positionsSpy = spyOn(
        simpleEarnManager,
        "getFlexiblePositions"
      ).mockRejectedValue("some string error");

      try {
        const res = await app.request("/api/earn/status", {
          headers: { "X-API-Key": API_KEY },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.enabled).toBe(true);
        expect(data.error).toBe("unknown");
      } finally {
        configSpy.mockRestore();
        positionsSpy.mockRestore();
      }
    });
  });

  // ─── Rate limit 429 path (lines 53, 71) ──────────────────────────────────

  describe("rate limit 429 response (lines 53, 71)", () => {
    it("returns 429 after 600 requests from same IP", async () => {
      // Use a unique IP to avoid shared state with other test files
      const testIp = `rate-limit-coverage-${Date.now()}`;
      let got429 = false;

      for (let i = 0; i < 605; i++) {
        const res = await app.request("/api/health", {
          headers: { "x-forwarded-for": testIp },
        });
        if (res.status === 429) {
          got429 = true;
          const data = (await res.json()) as Record<string, unknown>;
          expect(data.error).toBe("Too many requests");
          break;
        }
      }

      expect(got429).toBe(true);
    });
  });

  // ─── 404 fallback (line 130) ─────────────────────────────────────────────

  describe("404 notFound fallback (line 130)", () => {
    it("returns 404 JSON for unknown non-api path", async () => {
      const res = await app.request("/totally-unknown-path-xyz");
      expect(res.status).toBe(404);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toBe("Not found");
    });
  });

  // ─── startServer() coverage (lines 141-177) ──────────────────────────────
  //
  // startServer() calls Bun.serve() with WebSocket config. We start it on a
  // dedicated test port and stop it immediately — this exercises every line in
  // the function body including the fetch/websocket handlers.

  describe("startServer() — Bun.serve wiring (lines 141-177)", () => {
    const TEST_PORT = 3099;

    it("starts and returns a server instance that can be stopped", async () => {
      const originalPort = process.env["API_PORT"];
      process.env["API_PORT"] = String(TEST_PORT);

      let server: ReturnType<typeof startServer> | undefined;
      try {
        server = startServer();
        expect(server).toBeDefined();
        expect(typeof server.stop).toBe("function");
        expect(server.port).toBeDefined();
      } finally {
        server?.stop(true);
        if (originalPort !== undefined) {
          process.env["API_PORT"] = originalPort;
        } else {
          delete process.env["API_PORT"];
        }
      }
    });

    it("rejects /ws upgrade without apiKey (401) — covers lines 153-156", async () => {
      const originalPort = process.env["API_PORT"];
      process.env["API_PORT"] = String(TEST_PORT + 1);

      let server: ReturnType<typeof startServer> | undefined;
      try {
        server = startServer();
        const port = server.port;
        // Hit the /ws path with no apiKey → should return 401
        const res = await fetch(`http://localhost:${port}/ws`);
        expect(res.status).toBe(401);
      } finally {
        server?.stop(true);
        if (originalPort !== undefined) process.env["API_PORT"] = originalPort;
        else delete process.env["API_PORT"];
      }
    });

    it("routes non-ws HTTP requests to Hono app — covers line 167", async () => {
      const originalPort = process.env["API_PORT"];
      process.env["API_PORT"] = String(TEST_PORT + 2);

      let server: ReturnType<typeof startServer> | undefined;
      try {
        server = startServer();
        const port = server.port;
        // Regular HTTP request routed through Hono
        const res = await fetch(`http://localhost:${port}/api/health`);
        expect(res.status).toBe(200);
      } finally {
        server?.stop(true);
        if (originalPort !== undefined) process.env["API_PORT"] = originalPort;
        else delete process.env["API_PORT"];
      }
    });

    it("fetch handler passes HTTP requests to the Hono app", async () => {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
    });
  });
});
