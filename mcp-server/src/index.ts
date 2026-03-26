import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerHealthTools } from "./tools/health-tools.js";
import { registerPortfolioTools } from "./tools/portfolio-tools.js";
import { registerRebalanceTools } from "./tools/rebalance-tools.js";
import { registerTradeTools } from "./tools/trade-tools.js";
import { registerAllocationTools } from "./tools/allocation-tools.js";
import { registerBacktestTools } from "./tools/backtest-tools.js";
import { registerConfigTools } from "./tools/config-tools.js";
import { registerGridTools } from "./tools/grid-tools.js";
import { registerSmartOrderTools } from "./tools/smart-order-tools.js";
import { registerAiTools } from "./tools/ai-tools.js";
import { registerCopyTradingTools } from "./tools/copy-trading-tools.js";

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
registerConfigTools(server);
registerGridTools(server);
registerSmartOrderTools(server);
registerAiTools(server);
registerCopyTradingTools(server);

// Start with stdio transport (standard for MCP servers)
const transport = new StdioServerTransport();
await server.connect(transport);
