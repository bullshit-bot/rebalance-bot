---
title: "Phase 5: MCP Server"
status: completed
priority: high
---

# Phase 5: MCP Server

## Overview

Build a TypeScript MCP (Model Context Protocol) server that wraps all backend REST API endpoints as MCP tools. Runs as a Docker container accessible by OpenClaw.

## Requirements

- MCP server using `@modelcontextprotocol/sdk` (TypeScript)
- Wrap all 11 API route groups as MCP tools
- Run as Docker container on internal network
- Communicate with backend via `http://backend:3001`
- Expose tools for AI agent consumption

## Architecture

```
OpenClaw → MCP Server → Backend API (http://backend:3001)
                ↓
         MCP Tools:
         - get_portfolio
         - get_health
         - trigger_rebalance
         - list_trades
         - manage_allocations (CRUD)
         - get_analytics
         - run_backtest
         - manage_grid_bots (CRUD)
         - manage_smart_orders (CRUD)
         - get_ai_suggestions
         - manage_copy_trading
         - get_alerts
         - get_logs
         - get_config / update_config
```

## API Endpoints to Map

| Route Group | MCP Tools |
|-------------|-----------|
| Health | `get_health` |
| Portfolio | `get_portfolio` |
| Rebalance | `trigger_rebalance`, `get_rebalance_history` |
| Trades | `list_trades` |
| Config | `get_config`, `update_config` |
| Allocations | `list_allocations`, `create_allocation`, `update_allocation`, `delete_allocation` |
| Backtest | `run_backtest`, `list_backtests` |
| Analytics | `get_analytics` |
| Smart Orders | `create_smart_order`, `list_smart_orders`, `cancel_smart_order` |
| Grid | `create_grid_bot`, `list_grid_bots`, `stop_grid_bot` |
| AI | `get_ai_suggestions`, `approve_suggestion`, `reject_suggestion` |
| Copy Trading | `list_copy_sources`, `create_copy_source`, `delete_copy_source` |
| Alerts | `list_alerts` |
| Logs | `get_logs` |

## Implementation Steps

1. Create `mcp-server/` directory at project root
2. Init package.json with `@modelcontextprotocol/sdk`, `zod`
3. Create MCP server entry point with StdioServerTransport
4. Implement tool handlers that proxy to backend REST API
5. Add Zod schemas for tool input validation
6. Create `mcp-server/Dockerfile`
7. Add mcp-server service to docker-compose.yml
8. Test each tool against running backend

## Related Code Files

- Create: `mcp-server/src/index.ts` — MCP server entry
- Create: `mcp-server/src/tools/` — tool handlers per route group
- Create: `mcp-server/src/api-client.ts` — HTTP client for backend
- Create: `mcp-server/Dockerfile`
- Modify: `docker-compose.yml` — add mcp-server service

## Todo List

- [x] Create mcp-server directory structure
- [x] Init package.json with MCP SDK deps
- [x] Implement API client for backend communication
- [x] Implement health & portfolio tools
- [x] Implement rebalance & trades tools
- [x] Implement allocations CRUD tools
- [x] Implement backtest & analytics tools
- [x] Implement grid & smart orders tools
- [x] Implement AI suggestions & copy trading tools
- [x] Implement alerts & logs tools
- [x] Add Zod input validation schemas
- [x] Create Dockerfile for MCP server
- [x] Add to docker-compose.yml
- [x] Test all tools against backend

## Success Criteria

- [x] All 25+ MCP tools respond correctly
- [x] MCP server starts in Docker container
- [x] OpenClaw can discover and call tools
- [x] Error handling for backend unavailability

## Risk Assessment

- MCP SDK may have breaking changes — pin version
- Tool count is high (25+) — organize by module to keep maintainable
