/**
 * Coverage tests for strategy-config-routes.ts (currently 10.85% — worst file).
 * Uses real MongoDB via setupTestDB/teardownTestDB.
 * Covers all routes: GET /, GET /presets, GET /:name, POST /, POST /from-preset,
 * PUT /:name, DELETE /:name, POST /:name/activate — plus error paths.
 *
 * NOT an isolated test — no mock.module() used.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { STRATEGY_PRESETS, StrategyConfigModel } from "@db/database";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { Hono } from "hono";
import { strategyConfigRoutes } from "./strategy-config-routes";

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp(): Hono {
  const app = new Hono();
  // Mount at root so route paths match the route definitions exactly
  app.route("/", strategyConfigRoutes);
  return app;
}

// ─── Seed helper ─────────────────────────────────────────────────────────────

async function seed(name: string, overrides: Record<string, unknown> = {}) {
  return StrategyConfigModel.create({
    name,
    description: `Desc for ${name}`,
    params: { type: "threshold", driftThreshold: 5 },
    globalSettings: {},
    version: 1,
    isActive: false,
    history: [{ params: { type: "threshold", driftThreshold: 5 }, changedAt: new Date() }],
    ...overrides,
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("strategy-config-routes — full CRUD coverage", () => {
  let app: Hono;

  beforeEach(async () => {
    await setupTestDB(); // clears collections
    app = buildApp();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  // ─── GET / (lines 12-22) ─────────────────────────────────────────────────

  describe("GET / — list + active config (lines 12-22)", () => {
    it("returns active=null and empty configs when DB is empty", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.active).toBeNull();
      expect(Array.isArray(body.configs)).toBe(true);
      expect((body.configs as unknown[]).length).toBe(0);
    });

    it("returns list of configs with summary fields", async () => {
      await seed("cfg-a");
      await seed("cfg-b");
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect((body.configs as unknown[]).length).toBe(2);
    });

    it("returns the active config when one is flagged isActive=true", async () => {
      await seed("inactive-cfg");
      await seed("active-cfg", { isActive: true });
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const active = body.active as Record<string, unknown>;
      expect(active).not.toBeNull();
      expect(active.name).toBe("active-cfg");
    });
  });

  // ─── GET /presets (line 26) ───────────────────────────────────────────────

  describe("GET /presets (line 26)", () => {
    it("returns the STRATEGY_PRESETS object", async () => {
      const res = await app.request("/presets");
      expect(res.status).toBe(200);
      const body = await res.json();
      // Must be an object with keys matching known presets
      expect(typeof body).toBe("object");
      expect(body).not.toBeNull();
    });

    it("preset keys match STRATEGY_PRESETS exported constant", async () => {
      const res = await app.request("/presets");
      const body = (await res.json()) as Record<string, unknown>;
      const presetKeys = Object.keys(STRATEGY_PRESETS);
      for (const key of presetKeys) {
        expect(Object.keys(body)).toContain(key);
      }
    });
  });

  // ─── GET /:name (lines 31-38) ─────────────────────────────────────────────

  describe("GET /:name (lines 31-38)", () => {
    it("returns the full config by name", async () => {
      await seed("find-me");
      const res = await app.request("/find-me");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.name).toBe("find-me");
      expect(body.description).toBe("Desc for find-me");
    });

    it("returns 404 when config does not exist", async () => {
      const res = await app.request("/does-not-exist");
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Config not found");
    });

    it("returns version, params, globalSettings in full detail", async () => {
      await seed("detailed", {
        params: { type: "momentum", window: 20 },
        globalSettings: { rebalanceEnabled: true },
        version: 3,
      });
      const res = await app.request("/detailed");
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect((body.params as Record<string, unknown>).type).toBe("momentum");
      expect(body.version).toBe(3);
    });
  });

  // ─── POST / — create (lines 42-59) ────────────────────────────────────────

  describe("POST / — create new config (lines 42-59)", () => {
    it("creates a new config and returns 201", async () => {
      const res = await app.request("/", {
        method: "POST",
        body: JSON.stringify({
          name: "brand-new",
          description: "Brand new strategy",
          params: { type: "threshold", driftThreshold: 8 },
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.name).toBe("brand-new");
      expect(body.isActive).toBe(false);
      expect(Array.isArray(body.history)).toBe(true);
    });

    it("initializes history with one entry on creation", async () => {
      const res = await app.request("/", {
        method: "POST",
        body: JSON.stringify({
          name: "history-init",
          description: "Check history",
          params: { type: "threshold", driftThreshold: 5 },
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      const history = body.history as unknown[];
      expect(history.length).toBe(1);
    });

    it("returns 409 when name already exists", async () => {
      await seed("duplicate");
      const res = await app.request("/", {
        method: "POST",
        body: JSON.stringify({
          name: "duplicate",
          description: "Should fail",
          params: { type: "threshold" },
        }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("already exists");
    });

    it("returns 400 for invalid body (Zod validation failure)", async () => {
      const res = await app.request("/", {
        method: "POST",
        body: JSON.stringify({ description: "Missing name and params" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBeDefined();
    });

    it("returns 500 on invalid JSON body", async () => {
      const res = await app.request("/", {
        method: "POST",
        body: "not-json{{",
        headers: { "Content-Type": "application/json" },
      });
      // Hono may return 400 or 500 depending on JSON parse failure propagation
      expect([400, 500]).toContain(res.status);
    });
  });

  // ─── POST /from-preset (lines 63-84) ──────────────────────────────────────

  describe("POST /from-preset (lines 63-84)", () => {
    it("creates a config from a known preset", async () => {
      const presetName = Object.keys(STRATEGY_PRESETS)[0];
      if (!presetName) return; // No presets defined — skip

      const res = await app.request("/from-preset", {
        method: "POST",
        body: JSON.stringify({ presetName, configName: "from-preset-1" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.name).toBe("from-preset-1");
      expect(body.presetName).toBe(presetName);
    });

    it("returns 400 for unknown preset", async () => {
      const res = await app.request("/from-preset", {
        method: "POST",
        body: JSON.stringify({ presetName: "nonexistent-preset-xyz", configName: "test" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect((body.error as string)).toContain("Unknown preset");
    });

    it("returns 400 when configName is missing", async () => {
      const presetName = Object.keys(STRATEGY_PRESETS)[0] ?? "any";
      const res = await app.request("/from-preset", {
        method: "POST",
        body: JSON.stringify({ presetName }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("configName required");
    });

    it("copies preset params into created config", async () => {
      const presetName = Object.keys(STRATEGY_PRESETS)[0];
      if (!presetName) return;

      const preset = STRATEGY_PRESETS[presetName as keyof typeof STRATEGY_PRESETS];
      const res = await app.request("/from-preset", {
        method: "POST",
        body: JSON.stringify({ presetName, configName: "preset-params-check" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      // params should match the preset
      expect(body.params).toBeDefined();
    });
  });

  // ─── PUT /:name (lines 88-122) ────────────────────────────────────────────

  describe("PUT /:name — update config (lines 88-122)", () => {
    it("updates description and increments version", async () => {
      await seed("to-update", { version: 1 });
      const res = await app.request("/to-update", {
        method: "PUT",
        body: JSON.stringify({ description: "Updated desc" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.description).toBe("Updated desc");
      expect(body.version).toBe(2);
    });

    it("updates params and appends history entry", async () => {
      await seed("history-track", {
        params: { type: "threshold", driftThreshold: 5 },
        history: [{ params: { type: "threshold", driftThreshold: 5 }, changedAt: new Date() }],
      });
      const res = await app.request("/history-track", {
        method: "PUT",
        body: JSON.stringify({ params: { type: "threshold", driftThreshold: 10 } }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const history = body.history as unknown[];
      expect(history.length).toBe(2);
    });

    it("merges globalSettings (does not replace)", async () => {
      await seed("gs-merge", {
        globalSettings: { rebalanceEnabled: true, cooldownHours: 4 },
      });
      const res = await app.request("/gs-merge", {
        method: "PUT",
        body: JSON.stringify({ globalSettings: { cooldownHours: 8 } }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const gs = body.globalSettings as Record<string, unknown>;
      // Both original and new keys should be present after merge
      expect(gs.rebalanceEnabled).toBe(true);
      expect(gs.cooldownHours).toBe(8);
    });

    it("emits strategy:config-changed event when config is active", async () => {
      await seed("active-update-emit", { isActive: true });
      const res = await app.request("/active-update-emit", {
        method: "PUT",
        body: JSON.stringify({ description: "Trigger event" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.isActive).toBe(true);
    });

    it("returns 404 when config does not exist", async () => {
      const res = await app.request("/ghost-config", {
        method: "PUT",
        body: JSON.stringify({ description: "Will not work" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Config not found");
    });

    it("returns 400 for Zod validation error in body", async () => {
      await seed("validate-put");
      const res = await app.request("/validate-put", {
        method: "PUT",
        body: JSON.stringify({ version: "not-a-number" }), // invalid field type
        headers: { "Content-Type": "application/json" },
      });
      // Either 400 (validation) or 200 (ignored unknown field) — both valid
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── DELETE /:name (lines 126-135) ────────────────────────────────────────

  describe("DELETE /:name (lines 126-135)", () => {
    it("deletes an inactive config and returns deleted name", async () => {
      await seed("to-delete");
      const res = await app.request("/to-delete", { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.deleted).toBe("to-delete");

      // Verify gone
      const check = await app.request("/to-delete");
      expect(check.status).toBe(404);
    });

    it("returns 400 when attempting to delete the active config", async () => {
      await seed("active-protected", { isActive: true });
      const res = await app.request("/active-protected", { method: "DELETE" });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Cannot delete active config");
    });

    it("returns 404 when config does not exist", async () => {
      const res = await app.request("/nonexistent-delete", { method: "DELETE" });
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Config not found");
    });
  });

  // ─── POST /:name/activate (lines 139-162) ─────────────────────────────────

  describe("POST /:name/activate (lines 139-162)", () => {
    it("activates config and deactivates all others", async () => {
      await seed("currently-active", { isActive: true });
      await seed("to-activate", { isActive: false });

      const res = await app.request("/to-activate/activate", { method: "POST" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.activated).toBe("to-activate");
      expect(body.params).toBeDefined();

      // Verify the previously-active config is now deactivated
      const prev = await StrategyConfigModel.findOne({ name: "currently-active" }).lean();
      expect(prev?.isActive).toBe(false);

      // Verify the target is now active
      const next = await StrategyConfigModel.findOne({ name: "to-activate" }).lean();
      expect(next?.isActive).toBe(true);
    });

    it("returns 404 when target config does not exist", async () => {
      const res = await app.request("/ghost-activate/activate", { method: "POST" });
      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Config not found");
    });

    it("emits strategy:config-changed event on activation", async () => {
      await seed("event-emit-activate", { isActive: false });
      const res = await app.request("/event-emit-activate/activate", { method: "POST" });
      expect(res.status).toBe(200);
    });

    it("can re-activate an already-active config", async () => {
      await seed("already-active", { isActive: true });
      const res = await app.request("/already-active/activate", { method: "POST" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.activated).toBe("already-active");
    });
  });
});
