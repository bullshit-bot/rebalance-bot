/**
 * Coverage tests for portfolio-routes.ts
 * Targets line 78-80: error catch in GET /history when snapshotService throws.
 */
import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { AllocationModel, SnapshotModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { snapshotService } from "@portfolio/snapshot-service";
import { Hono } from "hono";
import { portfolioRoutes } from "./portfolio-routes";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("portfolio-routes coverage", () => {
  let app: Hono;

  beforeAll(() => {
    app = new Hono();
    app.route("/portfolio", portfolioRoutes);
  });

  describe("GET /portfolio/history error path (lines 78-80)", () => {
    it("returns 500 when snapshotService.getSnapshots throws", async () => {
      const spy = spyOn(snapshotService, "getSnapshots").mockImplementation(async () => {
        throw new Error("DB unavailable");
      });

      try {
        const res = await app.request("/portfolio/history");
        expect(res.status).toBe(500);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
        expect((data.error as string).length).toBeGreaterThan(0);
      } finally {
        spy.mockRestore();
      }
    });

    it("returns 500 with non-Error thrown object", async () => {
      const spy = spyOn(snapshotService, "getSnapshots").mockImplementation(async () => {
        throw "string error";
      });

      try {
        const res = await app.request("/portfolio/history");
        expect(res.status).toBe(500);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data).toHaveProperty("error");
        expect(data.error).toBe("string error");
      } finally {
        spy.mockRestore();
      }
    });
  });

  // Note: snapshot fallback tests (buildPortfolioFromSnapshot) are in
  // portfolio-routes.isolated.test.ts because they require deleteMany
  // which races with parallel tests in the main suite.

  describe("GET /portfolio/history validation", () => {
    it("returns 400 for non-numeric from", async () => {
      const res = await app.request("/portfolio/history?from=abc");
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toContain("Invalid from/to");
    });

    it("returns 400 for non-numeric to", async () => {
      const res = await app.request("/portfolio/history?to=xyz");
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.error).toContain("Invalid from/to");
    });
  });
});
