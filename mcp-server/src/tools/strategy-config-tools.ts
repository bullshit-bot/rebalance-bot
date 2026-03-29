import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStrategyConfigTools(server: McpServer) {
  server.tool(
    "get_strategy_config",
    "Get the active strategy configuration and list of all saved strategy configs",
    {},
    async () => {
      const result = await apiClient.get("/api/strategy-config");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_strategy_presets",
    "List all built-in strategy presets available to create configs from",
    {},
    async () => {
      const result = await apiClient.get("/api/strategy-config/presets");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "activate_strategy",
    "Switch the active strategy to a named config. Triggers hot-reload of the rebalance engine.",
    {
      name: z.string().describe("Name of the strategy config to activate"),
    },
    async ({ name }) => {
      const result = await apiClient.post(`/api/strategy-config/${name}/activate`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_strategy_config",
    "Update parameters or description of a named strategy config",
    {
      name: z.string().describe("Name of the strategy config to update"),
      params: z.record(z.unknown()).optional().describe("Strategy params object to replace (must include 'type' field matching strategy type)"),
      description: z.string().optional().describe("Updated description for this config"),
      globalSettings: z.record(z.unknown()).optional().describe("Global settings to merge (e.g. driftThreshold, minTradeUsd)"),
    },
    async ({ name, params, description, globalSettings }) => {
      const body: Record<string, unknown> = {};
      if (params !== undefined) body.params = params;
      if (description !== undefined) body.description = description;
      if (globalSettings !== undefined) body.globalSettings = globalSettings;
      const result = await apiClient.put(`/api/strategy-config/${name}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
