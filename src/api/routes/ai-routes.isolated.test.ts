import { describe, expect, it, mock } from "bun:test";

mock.module("@/ai/ai-suggestion-handler", () => ({
  aiSuggestionHandler: {
    handleSuggestion: async () => ({ id: "sugg-1", status: "pending" }),
    getPending: async () => [{ id: "sugg-1" }],
    getAll: async () => [{ id: "sugg-1" }],
    approve: async () => {},
    reject: async () => {},
  },
}));

mock.module("@/ai/ai-config", () => ({
  aiConfig: {
    autoApprove: false,
    maxAllocationShiftPct: 10,
    enabled: true,
  },
}));

mock.module("@/ai/market-summary-service", () => ({
  marketSummaryService: {
    generateSummary: async () => "Market summary text",
  },
}));

import { Hono } from "hono";
import { aiRoutes } from "./ai-routes";

describe("ai-routes", () => {
  const app = new Hono();
  app.route("/", aiRoutes);

  it("POST /ai/suggestion creates suggestion", async () => {
    const res = await app.request("http://localhost/ai/suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocations: [{ asset: "BTC", targetPct: 100 }],
        reasoning: "Market conditions",
      }),
    });
    expect(res.status).toBe(201);
  });

  it("POST /ai/suggestion rejects empty allocations", async () => {
    const res = await app.request("http://localhost/ai/suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocations: [],
        reasoning: "Market conditions",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /ai/suggestions lists all suggestions", async () => {
    const res = await app.request("http://localhost/ai/suggestions");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /ai/suggestions with status filter", async () => {
    const res = await app.request("http://localhost/ai/suggestions?status=pending");
    expect(res.status).toBe(200);
  });

  it("PUT /ai/suggestion/:id/approve approves suggestion", async () => {
    const res = await app.request("http://localhost/ai/suggestion/sugg-1/approve", {
      method: "PUT",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("PUT /ai/suggestion/:id/reject rejects suggestion", async () => {
    const res = await app.request("http://localhost/ai/suggestion/sugg-1/reject", {
      method: "PUT",
    });
    expect(res.status).toBe(200);
  });

  it("PUT /ai/config updates config", async () => {
    const res = await app.request("http://localhost/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.autoApprove).toBe(true);
  });

  it("PUT /ai/config rejects invalid maxShiftPct", async () => {
    const res = await app.request("http://localhost/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxShiftPct: -5 }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /ai/summary returns market summary", async () => {
    const res = await app.request("http://localhost/ai/summary");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
  });

  it("POST /ai/suggestion with sentimentData", async () => {
    const res = await app.request("http://localhost/ai/suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocations: [{ asset: "BTC", targetPct: 100 }],
        reasoning: "Market conditions",
        sentimentData: { bullish: true },
      }),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /ai/suggestion/:id/approve with bad ID", async () => {
    const res = await app.request("http://localhost/ai/suggestion/invalid-id/approve", {
      method: "PUT",
    });
    expect([200, 422]).toContain(res.status);
  });
});
