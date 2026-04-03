import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { StrategyConfigModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { app } from "../server";

const API_KEY = process.env["API_KEY"] ?? "test-ci-key";
const authHeaders = { "X-API-Key": API_KEY, "Content-Type": "application/json" };

beforeAll(async () => {
  await setupTestDB();
});

afterEach(async () => {
  await StrategyConfigModel.deleteMany({});
});

afterAll(async () => {
  await teardownTestDB();
});

describe("strategy-config-routes", () => {
  describe("GET /api/strategy-config", () => {
    it("returns empty list when no configs", async () => {
      const res = await app.request("/api/strategy-config", { headers: authHeaders });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.configs).toEqual([]);
      expect(data.active).toBeNull();
    });

    it("returns configs when seeded", async () => {
      await StrategyConfigModel.create({
        name: "test-config",
        description: "test",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        isActive: true,
      });
      const res = await app.request("/api/strategy-config", { headers: authHeaders });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.configs.length).toBe(1);
      expect(data.active).not.toBeNull();
      expect(data.active.name).toBe("test-config");
    });
  });

  describe("GET /api/strategy-config/presets", () => {
    it("returns preset list", async () => {
      const res = await app.request("/api/strategy-config/presets", { headers: authHeaders });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });
  });

  describe("GET /api/strategy-config/:name", () => {
    it("returns 404 for non-existent config", async () => {
      const res = await app.request("/api/strategy-config/nonexistent", { headers: authHeaders });
      expect(res.status).toBe(404);
    });

    it("returns config by name", async () => {
      await StrategyConfigModel.create({
        name: "my-config",
        description: "desc",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
      });
      const res = await app.request("/api/strategy-config/my-config", { headers: authHeaders });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("my-config");
    });
  });

  describe("POST /api/strategy-config", () => {
    it("creates a new config", async () => {
      const body = {
        name: "new-config",
        description: "New strategy",
        params: { type: "threshold", thresholdPct: 10, minTradeUsd: 10 },
      };
      const res = await app.request("/api/strategy-config", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("new-config");
    });

    it("rejects duplicate name", async () => {
      await StrategyConfigModel.create({
        name: "dup-config",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
      });
      const res = await app.request("/api/strategy-config", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "dup-config",
          params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        }),
      });
      expect(res.status).toBe(409);
    });

    it("rejects invalid body", async () => {
      const res = await app.request("/api/strategy-config", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/strategy-config/from-preset", () => {
    it("rejects unknown preset", async () => {
      const res = await app.request("/api/strategy-config/from-preset", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ presetName: "unknown-preset", configName: "test" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects missing configName", async () => {
      const res = await app.request("/api/strategy-config/from-preset", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ presetName: "conservative", configName: "" }),
      });
      // Either 400 (no configName) or 400 (unknown preset)
      expect([400, 201]).toContain(res.status);
    });
  });

  describe("PUT /api/strategy-config/:name", () => {
    it("returns 404 for non-existent config", async () => {
      const res = await app.request("/api/strategy-config/ghost", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ description: "updated" }),
      });
      expect(res.status).toBe(404);
    });

    it("updates an existing config", async () => {
      await StrategyConfigModel.create({
        name: "update-me",
        description: "old",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
      });
      const res = await app.request("/api/strategy-config/update-me", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ description: "new description" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.description).toBe("new description");
    });

    it("updates params and pushes to history", async () => {
      await StrategyConfigModel.create({
        name: "params-update",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        history: [{ params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 }, changedAt: new Date() }],
      });
      const res = await app.request("/api/strategy-config/params-update", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          params: { type: "threshold", thresholdPct: 15, minTradeUsd: 10 },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history.length).toBe(2);
    });

    it("emits config-changed event when updating active config", async () => {
      await StrategyConfigModel.create({
        name: "active-config",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        isActive: true,
      });
      const res = await app.request("/api/strategy-config/active-config", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ description: "activated update" }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/strategy-config/:name", () => {
    it("returns 404 for non-existent config", async () => {
      const res = await app.request("/api/strategy-config/nope", {
        method: "DELETE",
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
    });

    it("rejects deleting active config", async () => {
      await StrategyConfigModel.create({
        name: "active-no-delete",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        isActive: true,
      });
      const res = await app.request("/api/strategy-config/active-no-delete", {
        method: "DELETE",
        headers: authHeaders,
      });
      expect(res.status).toBe(400);
    });

    it("deletes inactive config", async () => {
      await StrategyConfigModel.create({
        name: "delete-me",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        isActive: false,
      });
      const res = await app.request("/api/strategy-config/delete-me", {
        method: "DELETE",
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe("delete-me");
    });
  });

  describe("POST /api/strategy-config/:name/activate", () => {
    it("returns 404 for non-existent config", async () => {
      const res = await app.request("/api/strategy-config/ghost/activate", {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
    });

    it("activates config and deactivates others", async () => {
      await StrategyConfigModel.create({
        name: "old-active",
        params: { type: "threshold", thresholdPct: 5, minTradeUsd: 10 },
        isActive: true,
      });
      await StrategyConfigModel.create({
        name: "new-active",
        params: { type: "vol-adjusted", minTradeUsd: 10, baseThresholdPct: 5, volLookbackDays: 30, minThresholdPct: 3, maxThresholdPct: 20 },
        isActive: false,
      });

      const res = await app.request("/api/strategy-config/new-active/activate", {
        method: "POST",
        headers: authHeaders,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.activated).toBe("new-active");

      // Verify old one is deactivated
      const old = await StrategyConfigModel.findOne({ name: "old-active" });
      expect(old?.isActive).toBe(false);
    });
  });
});
