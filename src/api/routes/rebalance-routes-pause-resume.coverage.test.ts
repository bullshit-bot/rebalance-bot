/**
 * Coverage tests for rebalance-routes.ts
 * Targets uncovered lines:
 *   12-17: POST / success path (rebalanceEngine.execute returns event)
 *   36-37: GET /preview non-portfolio error -> 500
 *   63-65: POST /pause -> driftDetector.stop + rebalanceEngine.stop
 *   70-72: POST /resume -> driftDetector.start + rebalanceEngine.start
 *
 * Uses spyOn() to control service behavior without mock.module().
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { driftDetector } from "@rebalancer/drift-detector";
import { rebalanceEngine } from "@rebalancer/rebalance-engine";
import { Hono } from "hono";
import { rebalanceRoutes } from "./rebalance-routes";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("rebalance-routes coverage — pause/resume/success", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/rebalance", rebalanceRoutes);
  });

  // ─── POST / success path (lines 12-17) ─────────────────────────────────────

  describe("POST /rebalance — success path (lines 14-15)", () => {
    it("returns 201 with rebalance event on success", async () => {
      const fakeEvent = {
        id: "rebal-test-1",
        trigger: "manual",
        trades: [],
        totalFeesUsd: 0,
        startedAt: new Date(),
        completedAt: new Date(),
      };

      const executeSpy = spyOn(rebalanceEngine, "execute").mockResolvedValue(fakeEvent as any);

      try {
        const res = await app.request("/rebalance", { method: "POST" });
        expect(res.status).toBe(201);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.id).toBe("rebal-test-1");
        expect(data.trigger).toBe("manual");
        expect(Array.isArray(data.trades)).toBe(true);
      } finally {
        executeSpy.mockRestore();
      }
    });

    it("returns 500 with error message when execute throws Error", async () => {
      const executeSpy = spyOn(rebalanceEngine, "execute").mockRejectedValue(
        new Error("Execute failed")
      );

      try {
        const res = await app.request("/rebalance", { method: "POST" });
        expect(res.status).toBe(500);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data).toHaveProperty("error");
        expect(data.error).toBe("Execute failed");
      } finally {
        executeSpy.mockRestore();
      }
    });

    it("returns 500 with stringified error when execute throws non-Error", async () => {
      const executeSpy = spyOn(rebalanceEngine, "execute").mockRejectedValue("plain string error");

      try {
        const res = await app.request("/rebalance", { method: "POST" });
        expect(res.status).toBe(500);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data).toHaveProperty("error");
        expect(data.error).toBe("plain string error");
      } finally {
        executeSpy.mockRestore();
      }
    });
  });

  // ─── GET /preview non-portfolio error -> 500 (lines 36-37) ─────────────────

  describe("GET /rebalance/preview — non-portfolio error path (lines 36-37)", () => {
    it("returns 500 for errors not about portfolio availability", async () => {
      const previewSpy = spyOn(rebalanceEngine, "preview").mockRejectedValue(
        new Error("Strategy config not found")
      );

      try {
        const res = await app.request("/rebalance/preview");
        expect(res.status).toBe(500);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data).toHaveProperty("error");
        expect(data.error).toBe("Strategy config not found");
      } finally {
        previewSpy.mockRestore();
      }
    });

    it("returns 200 empty preview for Portfolio not yet available error", async () => {
      const previewSpy = spyOn(rebalanceEngine, "preview").mockRejectedValue(
        new Error("Portfolio not yet available — no snapshots found")
      );

      try {
        const res = await app.request("/rebalance/preview");
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.trades).toEqual([]);
        expect(data.portfolio).toBeNull();
      } finally {
        previewSpy.mockRestore();
      }
    });

    it("returns 200 with preview data on success", async () => {
      const previewSpy = spyOn(rebalanceEngine, "preview").mockResolvedValue({
        trades: [{ asset: "BTC", side: "buy", amount: 0.01 }],
        portfolio: { totalValueUsd: 5000 },
      } as any);

      try {
        const res = await app.request("/rebalance/preview");
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(Array.isArray(data.trades)).toBe(true);
        expect((data.trades as unknown[]).length).toBe(1);
      } finally {
        previewSpy.mockRestore();
      }
    });
  });

  // ─── POST /pause (lines 63-65) ──────────────────────────────────────────────

  describe("POST /rebalance/pause (lines 63-65)", () => {
    it("returns 200 with status=paused", async () => {
      const stopEngineSpy = spyOn(rebalanceEngine, "stop").mockImplementation(() => {});
      const stopDetectorSpy = spyOn(driftDetector, "stop").mockImplementation(() => {});

      try {
        const res = await app.request("/rebalance/pause", { method: "POST" });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.status).toBe("paused");
      } finally {
        stopEngineSpy.mockRestore();
        stopDetectorSpy.mockRestore();
      }
    });

    it("calls driftDetector.stop and rebalanceEngine.stop", async () => {
      let engineStopped = false;
      let detectorStopped = false;

      const stopEngineSpy = spyOn(rebalanceEngine, "stop").mockImplementation(() => {
        engineStopped = true;
      });
      const stopDetectorSpy = spyOn(driftDetector, "stop").mockImplementation(() => {
        detectorStopped = true;
      });

      try {
        await app.request("/rebalance/pause", { method: "POST" });
        expect(engineStopped).toBe(true);
        expect(detectorStopped).toBe(true);
      } finally {
        stopEngineSpy.mockRestore();
        stopDetectorSpy.mockRestore();
      }
    });

    it("returns JSON content-type", async () => {
      const stopEngineSpy = spyOn(rebalanceEngine, "stop").mockImplementation(() => {});
      const stopDetectorSpy = spyOn(driftDetector, "stop").mockImplementation(() => {});

      try {
        const res = await app.request("/rebalance/pause", { method: "POST" });
        expect(res.headers.get("content-type")).toContain("application/json");
      } finally {
        stopEngineSpy.mockRestore();
        stopDetectorSpy.mockRestore();
      }
    });
  });

  // ─── POST /resume (lines 70-72) ─────────────────────────────────────────────

  describe("POST /rebalance/resume (lines 70-72)", () => {
    it("returns 200 with status=running", async () => {
      const startEngineSpy = spyOn(rebalanceEngine, "start").mockImplementation(() => {});
      const startDetectorSpy = spyOn(driftDetector, "start").mockImplementation(() => {});

      try {
        const res = await app.request("/rebalance/resume", { method: "POST" });
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.status).toBe("running");
      } finally {
        startEngineSpy.mockRestore();
        startDetectorSpy.mockRestore();
      }
    });

    it("calls driftDetector.start and rebalanceEngine.start", async () => {
      let engineStarted = false;
      let detectorStarted = false;

      const startEngineSpy = spyOn(rebalanceEngine, "start").mockImplementation(() => {
        engineStarted = true;
      });
      const startDetectorSpy = spyOn(driftDetector, "start").mockImplementation(() => {
        detectorStarted = true;
      });

      try {
        await app.request("/rebalance/resume", { method: "POST" });
        expect(engineStarted).toBe(true);
        expect(detectorStarted).toBe(true);
      } finally {
        startEngineSpy.mockRestore();
        startDetectorSpy.mockRestore();
      }
    });

    it("returns JSON content-type", async () => {
      const startEngineSpy = spyOn(rebalanceEngine, "start").mockImplementation(() => {});
      const startDetectorSpy = spyOn(driftDetector, "start").mockImplementation(() => {});

      try {
        const res = await app.request("/rebalance/resume", { method: "POST" });
        expect(res.headers.get("content-type")).toContain("application/json");
      } finally {
        startEngineSpy.mockRestore();
        startDetectorSpy.mockRestore();
      }
    });
  });

  // ─── GET /rebalance/history (DB path) ──────────────────────────────────────

  describe("GET /rebalance/history — with real DB (lines 53-57)", () => {
    it("returns 200 with empty array when no records exist", async () => {
      const res = await app.request("/rebalance/history");
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("returns 400 for limit=0", async () => {
      const res = await app.request("/rebalance/history?limit=0");
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toContain("limit must be an integer between 1 and 200");
    });

    it("returns 400 for limit=201", async () => {
      const res = await app.request("/rebalance/history?limit=201");
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toContain("limit must be an integer between 1 and 200");
    });

    it("returns 400 for non-numeric limit", async () => {
      const res = await app.request("/rebalance/history?limit=notanumber");
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toContain("limit must be an integer between 1 and 200");
    });
  });
});
