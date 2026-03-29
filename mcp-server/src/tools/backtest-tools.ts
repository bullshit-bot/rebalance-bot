import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBacktestTools(server: McpServer) {
  server.tool(
    "run_backtest",
    "Run a backtest simulation. startDate/endDate are Unix millisecond timestamps. timeframe: '1h' or '1d'.",
    {
      pairs: z.array(z.string()).describe("Trading pairs to backtest, e.g. ['BTC/USDT', 'ETH/USDT']"),
      allocations: z.array(z.object({
        asset: z.string(),
        targetPct: z.number(),
      })).describe("Target allocation percentages per asset"),
      startDate: z.number().describe("Start date as Unix millisecond timestamp"),
      endDate: z.number().describe("End date as Unix millisecond timestamp"),
      initialBalance: z.number().describe("Initial balance in USD"),
      threshold: z.number().describe("Rebalance threshold percentage (0-100)"),
      feePct: z.number().describe("Fee percentage, e.g. 0.001 for 0.1%"),
      timeframe: z.enum(["1h", "1d"]).describe("Candle timeframe"),
      exchange: z.string().describe("Exchange name, e.g. 'binance'"),
    },
    async ({ pairs, allocations, startDate, endDate, initialBalance, threshold, feePct, timeframe, exchange }) => {
      const result = await apiClient.post("/api/backtest", {
        pairs,
        allocations,
        startDate,
        endDate,
        initialBalance,
        threshold,
        feePct,
        timeframe,
        exchange,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_backtests",
    "List all previously run and saved backtest results",
    {},
    async () => {
      const result = await apiClient.get("/api/backtest/list");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
