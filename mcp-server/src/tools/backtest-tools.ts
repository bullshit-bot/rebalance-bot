import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBacktestTools(server: McpServer) {
  server.tool(
    "run_backtest",
    "Run a backtest simulation for a given strategy and date range",
    {
      strategy: z.string().describe("Strategy name to backtest"),
      startDate: z.string().describe("Start date in ISO format (YYYY-MM-DD)"),
      endDate: z.string().describe("End date in ISO format (YYYY-MM-DD)"),
      capital: z.number().describe("Initial capital in USD"),
    },
    async ({ strategy, startDate, endDate, capital }) => {
      const result = await apiClient.post("/api/backtest", {
        strategy,
        startDate,
        endDate,
        capital,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_backtests",
    "List all previously run backtests",
    {},
    async () => {
      const result = await apiClient.get("/api/backtests");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
