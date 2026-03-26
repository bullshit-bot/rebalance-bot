import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGridTools(server: McpServer) {
  server.tool(
    "create_grid_bot",
    "Create a new grid trading bot",
    {
      exchange: z.string().describe("Exchange to run the grid bot on"),
      pair: z.string().describe("Trading pair, e.g. BTC/USDT"),
      priceLower: z.number().describe("Lower price boundary for the grid"),
      priceUpper: z.number().describe("Upper price boundary for the grid"),
      gridLevels: z.number().int().positive().describe("Number of grid levels"),
      investment: z.number().describe("Total investment amount in USD"),
      gridType: z.enum(["arithmetic", "geometric"]).describe("Grid spacing type"),
    },
    async ({ exchange, pair, priceLower, priceUpper, gridLevels, investment, gridType }) => {
      const result = await apiClient.post("/api/grid", {
        exchange, pair, priceLower, priceUpper, gridLevels, investment, gridType,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_grid_bots",
    "List all grid trading bots and their current status",
    {},
    async () => {
      const result = await apiClient.get("/api/grid");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "stop_grid_bot",
    "Stop a running grid trading bot by ID",
    {
      id: z.string().describe("Grid bot document ID to stop"),
    },
    async ({ id }) => {
      const result = await apiClient.post(`/api/grid/${id}/stop`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
