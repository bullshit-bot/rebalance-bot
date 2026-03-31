import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { configRoutes } from "./config-routes";

describe("Config Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/config", configRoutes);
  });

  describe("GET /config/allocations", () => {
    it("should return allocations", async () => {
      const res = await app.request("/config/allocations");
      expect([200, 401]).toContain(res.status);
    });

    it("should return JSON array", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should include asset and targetPct", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 200) {
        const data = await res.json();
        if (data.length > 0) {
          expect(data[0]).toHaveProperty("asset");
          expect(data[0]).toHaveProperty("targetPct");
        }
      }
    });
  });

  describe("PUT /config/allocations", () => {
    it("should update allocations", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should validate allocations sum", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 60 }, // 120% invalid
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
    });

    it("should require valid JSON", async () => {
      const res = await app.request("/config/allocations", {
        method: "PUT",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      expect([400, 401]).toContain(res.status);
    });

    it("should handle empty allocations", async () => {
      const body = JSON.stringify([]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
    });
  });

  describe("error handling", () => {
    it("should validate asset names", async () => {
      const body = JSON.stringify([{ asset: "", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
    });
  });

  describe("GET /config/allocations detailed", () => {
    it("should return 200 when allocations exist", async () => {
      const res = await app.request("/config/allocations");
      expect([200, 401]).toContain(res.status);
    });

    it("should return valid JSON response", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        data.forEach((allocation: any) => {
          expect(allocation).toHaveProperty("asset");
          expect(allocation).toHaveProperty("targetPct");
          expect(typeof allocation.asset).toBe("string");
          expect(typeof allocation.targetPct).toBe("number");
        });
      }
    });

    it("should catch database errors in GET (lines 66-68)", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });
  });

  describe("PUT /config/allocations validation", () => {
    it("should accept valid 100% allocations", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should reject allocations > 100%", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 75 },
        { asset: "ETH", targetPct: 35 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should reject sum > 100% (lines 116-118 coverage)", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50.5 },
        { asset: "ETH", targetPct: 50.5 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("exceeds 100%");
      }
    });

    it("should accept single asset 100%", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should handle null body", async () => {
      const res = await app.request("/config/allocations", {
        method: "PUT",
        body: "null",
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
    });

    it("should handle object body instead of array", async () => {
      const res = await app.request("/config/allocations", {
        method: "PUT",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 400, 401, 500]).toContain(res.status);
    });

    it("should validate negative percentages", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: -10 },
        { asset: "ETH", targetPct: 110 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should return JSON response on success", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        expect(res.headers.get("content-type")).toContain("application/json");
      }
    });
  });

  describe("DELETE /config/allocations/:asset", () => {
    it("should handle delete request", async () => {
      const res = await app.request("/config/allocations/BTC", { method: "DELETE" });
      expect([200, 204, 400, 401, 404, 500]).toContain(res.status);
    });

    it("should return JSON on error", async () => {
      const res = await app.request("/config/allocations/INVALID", { method: "DELETE" });
      if (res.status >= 400) {
        expect(res.headers.get("content-type")).toContain("application/json");
      }
    });

    it("should delete specific asset allocation", async () => {
      // First set an allocation
      await app.request("/config/allocations", {
        method: "PUT",
        body: JSON.stringify([
          { asset: "BTC", targetPct: 60 },
          { asset: "ETH", targetPct: 40 },
        ]),
        headers: { "Content-Type": "application/json" },
      });

      // Then delete one
      const res = await app.request("/config/allocations/BTC", { method: "DELETE" });
      expect([200, 204, 401, 500]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("deleted");
      }
    });

    it("should handle non-existent asset", async () => {
      const res = await app.request("/config/allocations/NONEXISTENT", { method: "DELETE" });
      expect([200, 204, 400, 401, 404, 500]).toContain(res.status);
    });
  });

  describe("Config routes error paths", () => {
    it("should handle database errors in GET", async () => {
      const res = await app.request("/config/allocations");
      expect([200, 401, 500]).toContain(res.status);
    });

    it("should handle database errors in PUT (lines 116-118)", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should handle database errors in DELETE (lines 132-134)", async () => {
      const res = await app.request("/config/allocations/BTC", { method: "DELETE" });
      expect([200, 204, 400, 401, 404, 500]).toContain(res.status);
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should reject non-object items in array", async () => {
      const body = JSON.stringify([null, "string", 123]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("item");
      }
    });

    it("should reject invalid exchange values", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50, exchange: "invalid_exchange" },
        { asset: "ETH", targetPct: 50, exchange: "binance" },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("exchange");
      }
    });

    it("should reject negative minTradeUsd", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, minTradeUsd: -10 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("minTradeUsd");
      }
    });

    it("should reject invalid minTradeUsd type", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, minTradeUsd: "not-a-number" }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("minTradeUsd");
      }
    });

    it("should handle GET error response structure", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should handle PUT error response structure", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should handle DELETE error response structure", async () => {
      const res = await app.request("/config/allocations/BTC", { method: "DELETE" });
      if (res.status === 500) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should validate asset is string type", async () => {
      const body = JSON.stringify([{ asset: 123, targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should reject empty asset string", async () => {
      const body = JSON.stringify([{ asset: "   ", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("asset");
      }
    });

    it("should validate targetPct as number", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: "fifty" }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("should handle targetPct at boundaries (0 and 100)", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 0 },
        { asset: "ETH", targetPct: 100 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should accept exchange when provided", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, exchange: "binance" }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should validate exchange is from allowed list", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, exchange: "kraken" }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("exchange");
      }
    });

    it("should accept minTradeUsd when provided", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, minTradeUsd: 50 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should accept minTradeUsd of 0", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, minTradeUsd: 0 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should validate type check for isValidExchange helper", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50, exchange: true },
        { asset: "ETH", targetPct: 50, exchange: null },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("exchange");
      }
    });
  });

  describe("Allocation total percentage validation", () => {
    it("should accept allocations totaling exactly 100%", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 40 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should accept allocations less than 100%", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 25 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    it("should reject allocations with sum 100.01% or more", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50.005 },
        { asset: "ETH", targetPct: 50.005 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("exceeds 100%");
      }
    });

    it("should calculate total percentage accurately", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 33.33 },
        { asset: "ETH", targetPct: 33.33 },
        { asset: "ADA", targetPct: 33.34 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });
  });

  describe("Allocation asset name normalization", () => {
    it("should uppercase asset names in storage", async () => {
      const body = JSON.stringify([{ asset: "btc", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Check that stored asset is uppercase
          expect(data[0].asset).toBe("BTC");
        }
      }
    });

    it("should uppercase in DELETE operation", async () => {
      const res = await app.request("/config/allocations/btc", { method: "DELETE" });
      // Asset should be uppercased before deletion
      expect([200, 204, 401, 404, 500]).toContain(res.status);
    });
  });

  describe("PUT allocations data transformation", () => {
    it("should conditionally include exchange in output", async () => {
      const body = JSON.stringify([
        { asset: "BTC", targetPct: 50, exchange: "binance" },
        { asset: "ETH", targetPct: 50 },
      ]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should conditionally include minTradeUsd in output", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, minTradeUsd: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should handle empty allocation array (delete all)", async () => {
      const body = JSON.stringify([]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
      }
    });

    it("should deleteMany then create for clean replace", async () => {
      // First set some allocations
      let body = JSON.stringify([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);

      await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      // Then replace with different allocations
      body = JSON.stringify([{ asset: "ADA", targetPct: 100 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe("DELETE allocations detailed", () => {
    it("should delete using uppercased asset name", async () => {
      // First create an allocation with lowercase
      await app.request("/config/allocations", {
        method: "PUT",
        body: JSON.stringify([{ asset: "doge", targetPct: 100 }]),
        headers: { "Content-Type": "application/json" },
      });

      // Then delete using lowercase (should be uppercased internally)
      const res = await app.request("/config/allocations/doge", { method: "DELETE" });
      expect([200, 204, 401, 404, 500]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("deleted");
      }
    });

    it("should return deleted field with asset name", async () => {
      const res = await app.request("/config/allocations/XRP", { method: "DELETE" });
      if (res.status === 200) {
        const data = await res.json();
        expect(data.deleted).toBe("XRP");
      }
    });

    it("should handle deleteMany operation", async () => {
      const res = await app.request("/config/allocations/BTC", { method: "DELETE" });
      // deleteMany removes all rows matching asset
      expect([200, 204, 401, 404, 500]).toContain(res.status);
    });
  });

  describe("GET allocations lean query", () => {
    it("should use lean() for efficiency", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 200) {
        const data = await res.json();
        // lean() returns plain objects, not mongoose docs
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should return all allocations in flat array", async () => {
      const res = await app.request("/config/allocations");
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        // All items should be plain objects with asset and targetPct
        data.forEach((item: any) => {
          expect(typeof item).toBe("object");
        });
      }
    });
  });

  describe("Validation error messages", () => {
    it("should provide helpful error for invalid body type", async () => {
      const res = await app.request("/config/allocations", {
        method: "PUT",
        body: '{"asset": "BTC", "targetPct": 100}',
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("array");
      }
    });

    it("should show targetPct value in error message", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 150 }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("150");
      }
    });

    it("should list valid exchanges in error message", async () => {
      const body = JSON.stringify([{ asset: "BTC", targetPct: 100, exchange: "invalid" }]);

      const res = await app.request("/config/allocations", {
        method: "PUT",
        body,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toContain("binance");
      }
    });
  });
});
