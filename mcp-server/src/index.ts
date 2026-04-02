import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "node:http";
import { registerHealthTools } from "./tools/health-tools.js";
import { registerPortfolioTools } from "./tools/portfolio-tools.js";
import { registerRebalanceTools } from "./tools/rebalance-tools.js";
import { registerTradeTools } from "./tools/trade-tools.js";
import { registerAllocationTools } from "./tools/allocation-tools.js";
import { registerBacktestTools } from "./tools/backtest-tools.js";
import { registerStrategyConfigTools } from "./tools/strategy-config-tools.js";
import { registerEarnTools } from "./tools/earn-tools.js";
import { registerDcaTools } from "./tools/dca-tools.js";

const server = new McpServer({
  name: "rebalance-bot-mcp",
  version: "1.0.0",
});

// Register all tool groups
registerHealthTools(server);
registerPortfolioTools(server);
registerRebalanceTools(server);
registerTradeTools(server);
registerAllocationTools(server);
registerBacktestTools(server);
registerStrategyConfigTools(server);
registerEarnTools(server);
registerDcaTools(server);

const mode = process.env.MCP_TRANSPORT ?? "stdio";

if (mode === "sse") {
  // SSE mode — HTTP server for network access (GoClaw, etc.)
  const port = parseInt(process.env.MCP_PORT ?? "3100", 10);
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // SSE endpoint — client connects here to receive events
    if (url.pathname === "/sse") {
      const transport = new SSEServerTransport("/messages", res);
      transports.set(transport.sessionId, transport);
      await server.connect(transport);
      return;
    }

    // Message endpoint — client sends JSON-RPC messages here
    if (url.pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(404);
        res.end("Session not found");
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", mode: "sse" }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.log(`MCP server (SSE) listening on port ${port}`);
  });
} else {
  // Stdio mode — standard for Claude Code, local MCP clients
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
