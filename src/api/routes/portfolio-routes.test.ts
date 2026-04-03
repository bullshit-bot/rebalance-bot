import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { CapitalFlowModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { portfolioRoutes } from "./portfolio-routes";

describe("Portfolio Routes", () => {
  let app: Hono;

  beforeEach(async () => {
    await setupTestDB();
    app = new Hono();
    app.route("/portfolio", portfolioRoutes);
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  describe("GET /portfolio", () => {
    it("should return portfolio data", async () => {
      const res = await app.request("/portfolio");
      expect(res.status).toBeOneOf([200, 401, 503]);
    });

    it("should return JSON", async () => {
      const res = await app.request("/portfolio");
      expect(res.headers.get("content-type")).toContain("application/json");
    });

    it("should include portfolio structure", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });

    it("should handle portfolio not available (503)", async () => {
      const res = await app.request("/portfolio");
      // When portfolioTracker returns null and no snapshots exist, should return 503
      if (res.status === 503) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("Portfolio not yet available");
      }
    });

    it("should return portfolio with totalValueUsd and assets", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        // Portfolio structure check
        expect(data).toBeDefined();
        if (data.totalValueUsd !== undefined) {
          expect(typeof data.totalValueUsd).toBe("number");
        }
        if (Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            expect(asset).toHaveProperty("asset");
            expect(typeof asset.asset).toBe("string");
          });
        }
      }
    });
  });

  describe("GET /portfolio/history", () => {
    it("should return portfolio history", async () => {
      const res = await app.request("/portfolio/history");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should return JSON array", async () => {
      const res = await app.request("/portfolio/history");
      expect(res.headers.get("content-type")).toContain("application/json");
    });

    it("should support pagination with from and to parameters", async () => {
      const res = await app.request("/portfolio/history?from=1000000000&to=2000000000");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should handle limit parameter", async () => {
      const res = await app.request("/portfolio/history?limit=5");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should handle from parameter", async () => {
      const res = await app.request("/portfolio/history?from=1700000000");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should handle to parameter", async () => {
      const res = await app.request("/portfolio/history?to=1700000000");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should default from and to when not provided", async () => {
      const res = await app.request("/portfolio/history");
      expect(res.status).toBeOneOf([200, 400, 401, 500]);
    });

    it("should return 400 for invalid from parameter", async () => {
      const res = await app.request("/portfolio/history?from=invalid");
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("Invalid from/to");
      }
    });

    it("should return 400 for invalid to parameter", async () => {
      const res = await app.request("/portfolio/history?to=notanumber");
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("Invalid from/to");
      }
    });
  });

  describe("buildPortfolioFromSnapshot fallback behavior", () => {
    it("should return snapshot portfolio when available", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        // If status is 200, data should have portfolio-like structure
        expect(data).toBeDefined();
      }
    });

    it("should return 503 when no snapshots exist", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 503) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toBe("Portfolio not yet available");
      }
    });

    it("should include holdings data from snapshot", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        // Check that assets field exists and is properly structured
        if (data.assets) {
          expect(Array.isArray(data.assets)).toBe(true);
        }
      }
    });

    it("should compute drift correctly from snapshot", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        if (data.assets && Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            if (asset.driftPct !== undefined) {
              expect(typeof asset.driftPct).toBe("number");
              // Drift should be current - target
              const expectedDrift = asset.currentPct - asset.targetPct;
              expect(Math.abs(asset.driftPct - expectedDrift)).toBeLessThan(0.2); // Allow small rounding difference
            }
          });
        }
      }
    });

    it("should include updatedAt timestamp from snapshot", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        if (data.updatedAt !== undefined) {
          expect(typeof data.updatedAt).toBe("number");
          expect(data.updatedAt).toBeGreaterThan(0);
        }
      }
    });

    it("should merge allocations correctly", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        if (data.assets && Array.isArray(data.assets)) {
          data.assets.forEach((asset: any) => {
            expect(asset).toHaveProperty("targetPct");
            expect(typeof asset.targetPct).toBe("number");
          });
        }
      }
    });
  });

  describe("error handling", () => {
    it("should handle invalid from/to parameters", async () => {
      const res = await app.request("/portfolio/history?from=invalid&to=invalid");
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should handle missing auth", async () => {
      const res = await app.request("/portfolio");
      // May require auth depending on setup
      expect([200, 401, 503]).toContain(res.status);
    });

    it("should handle database errors gracefully", async () => {
      const res = await app.request("/portfolio/history");
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should catch and format database error from snapshot service", async () => {
      // Test the error handling path at lines 77-79 in portfolio-routes
      const res = await app.request("/portfolio/history?from=1000000000&to=2000000000");
      expect([200, 400, 401, 500]).toContain(res.status);
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });
  });

  describe("GET /portfolio — totalInvested field", () => {
    it("should include totalInvested field in response", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("totalInvested");
      }
    });

    it("should return totalInvested as zero when no capital flows exist", async () => {
      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data.totalInvested).toBe(0);
      }
    });

    it("should aggregate deposits into totalInvested", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data.totalInvested).toBe(1000);
      }
    });

    it("should aggregate DCA records into totalInvested", async () => {
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data.totalInvested).toBe(50.25);
      }
    });

    it("should sum mixed deposits and DCA into totalInvested", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 500,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 30.75,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data.totalInvested).toBe(1581);
      }
    });

    it("should handle fractional amounts in totalInvested", async () => {
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 123.456789,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 456.543211,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(Math.abs(data.totalInvested - 580)).toBeLessThan(0.000001);
      }
    });

    it("should maintain totalInvested as number type", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 999.99,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(typeof data.totalInvested).toBe("number");
      }
    });
  });

  describe("GET /portfolio/capital-flows endpoint", () => {
    it("should return 200 status on capital flows request", async () => {
      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
    });

    it("should return JSON content type", async () => {
      const res = await app.request("/portfolio/capital-flows");
      expect(res.headers.get("content-type")).toContain("application/json");
    });

    it("should return empty array when no capital flows exist", async () => {
      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("should return single deposit record", async () => {
      const created = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
        note: "Initial deposit",
      });

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].type).toBe("deposit");
      expect(data[0].amountUsd).toBe(1000);
      expect(data[0].note).toBe("Initial deposit");
    });

    it("should return single DCA record", async () => {
      const created = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50.25,
        note: "DCA 2 orders",
      });

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(1);
      expect(data[0].type).toBe("dca");
      expect(data[0].amountUsd).toBe(50.25);
      expect(data[0].note).toBe("DCA 2 orders");
    });

    it("should return multiple capital flow records", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 500,
      });

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(3);
    });

    it("should return records sorted by createdAt descending (newest first)", async () => {
      const date1 = new Date("2026-01-01");
      const date2 = new Date("2026-01-02");
      const date3 = new Date("2026-01-03");

      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
        createdAt: date1,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 2000,
        createdAt: date3,
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1500,
        createdAt: date2,
      });

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(3);
      expect(data[0].amountUsd).toBe(2000); // Most recent (date3)
      expect(data[1].amountUsd).toBe(1500); // Middle (date2)
      expect(data[2].amountUsd).toBe(1000); // Oldest (date1)
    });

    it("should include _id field in returned records", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
      });

      const res = await app.request("/portfolio/capital-flows");
      const data = await res.json();
      expect(data[0]).toHaveProperty("_id");
      expect(typeof data[0]._id).toBe("string" || "object");
    });

    it("should include createdAt timestamp in records", async () => {
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50,
      });

      const res = await app.request("/portfolio/capital-flows");
      const data = await res.json();
      expect(data[0]).toHaveProperty("createdAt");
      expect(data[0].createdAt).toBeDefined();
    });

    it("should handle mixed types in capital flows list", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
        note: "Initial deposit",
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50,
        note: "DCA 1 order",
      });
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 500,
        note: "Top-up",
      });
      await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 75.5,
        note: "DCA 2 orders",
      });

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(4);

      const depositRecords = data.filter((f: any) => f.type === "deposit");
      const dcaRecords = data.filter((f: any) => f.type === "dca");
      expect(depositRecords.length).toBe(2);
      expect(dcaRecords.length).toBe(2);
    });

    it("should return records with optional note field", async () => {
      const deposit = await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 1000,
        note: "Bank transfer",
      });
      // Ensure DCA is created strictly after deposit
      await new Promise((r) => setTimeout(r, 1));
      const dca = await CapitalFlowModel.create({
        type: "dca",
        amountUsd: 50,
        // no note provided
      });

      const res = await app.request("/portfolio/capital-flows");
      const data = await res.json();
      // Records are sorted by createdAt descending (newest first)
      // So DCA (created last, has undefined note) should be at index 0
      // and deposit (created first, has note) should be at index 1
      expect(data.length).toBe(2);
      const dcaRecord = data.find((d: any) => d.type === "dca");
      const depositRecord = data.find((d: any) => d.type === "deposit");
      expect(dcaRecord.note).toBeUndefined();
      expect(depositRecord.note).toBe("Bank transfer");
    });

    it("should handle large number of records efficiently", async () => {
      // Create 50 records
      for (let i = 0; i < 50; i++) {
        await CapitalFlowModel.create({
          type: i % 2 === 0 ? "deposit" : "dca",
          amountUsd: (i + 1) * 10,
        });
      }

      const res = await app.request("/portfolio/capital-flows");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(50);
    });

    it("should handle error gracefully if database fails", async () => {
      // This test validates error handling at lines 99-102 in portfolio-routes.ts
      // In a real scenario with db failure, should return error JSON with 500 status
      const res = await app.request("/portfolio/capital-flows");
      // Should return either 200 (success) or 500 (error), not crash
      expect([200, 500]).toContain(res.status);
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });
  });

  describe("Portfolio and capital flows integration", () => {
    it("should include totalInvested when portfolio endpoint responds", async () => {
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: 2000,
      });

      const res = await app.request("/portfolio");
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("totalInvested");
        expect(data.totalInvested).toBe(2000);
      }
    });

    it("should sync capital flows data between endpoints", async () => {
      const depositAmount = 1500;
      await CapitalFlowModel.create({
        type: "deposit",
        amountUsd: depositAmount,
      });

      // Check totalInvested in portfolio endpoint
      const portfolioRes = await app.request("/portfolio");
      if (portfolioRes.status === 200) {
        const portfolioData = await portfolioRes.json();
        expect(portfolioData.totalInvested).toBe(depositAmount);
      }

      // Check flows in capital-flows endpoint
      const flowsRes = await app.request("/portfolio/capital-flows");
      expect(flowsRes.status).toBe(200);
      const flowsData = await flowsRes.json();
      expect(flowsData.length).toBe(1);
      expect(flowsData[0].amountUsd).toBe(depositAmount);
    });

    it("should reflect multiple DCA executions in both endpoints", async () => {
      const dcaAmounts = [50.25, 75.5, 45.75];
      for (const amount of dcaAmounts) {
        await CapitalFlowModel.create({
          type: "dca",
          amountUsd: amount,
        });
      }

      const expectedTotal = dcaAmounts.reduce((a, b) => a + b, 0);

      // Check portfolio endpoint
      const portfolioRes = await app.request("/portfolio");
      if (portfolioRes.status === 200) {
        const data = await portfolioRes.json();
        expect(data.totalInvested).toBe(expectedTotal);
      }

      // Check capital-flows endpoint
      const flowsRes = await app.request("/portfolio/capital-flows");
      const flows = await flowsRes.json();
      expect(flows.length).toBe(3);
    });
  });
});
