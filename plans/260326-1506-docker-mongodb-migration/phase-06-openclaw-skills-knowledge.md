---
title: "Phase 6: OpenClaw Skills & Knowledge Base"
status: completed
priority: high
---

# Phase 6: OpenClaw Skills & Knowledge Base

## Overview

Setup OpenClaw AI agent from scratch, build skills that use MCP tools, and create knowledge base (RAG via ChromaDB) with auto-generated API docs + custom crypto strategy knowledge.

## Requirements

### OpenClaw Container
- Setup OpenClaw as Docker container
- Connect to MCP server for tool access
- Configure with API keys for LLM provider

### Skills Development
- Rewrite existing skill definitions (`openclaw-skills/`) to use MCP tools
- Build new skills: portfolio analysis, market monitoring, auto-rebalance advisor
- Skills should compose MCP tools into higher-level workflows

### Knowledge Base (RAG)
- ChromaDB as vector store (Docker container)
- Auto-generated knowledge: API endpoint docs, schema descriptions, system architecture
- Custom knowledge: crypto trading strategies, rebalancing best practices, risk management
- Ingestion pipeline: markdown → embeddings → ChromaDB

## Architecture

```
OpenClaw Container
├── Skills (workflow definitions)
│   ├── allocation-advisor — analyze + suggest allocations
│   ├── market-analysis — fetch prices + analyze trends
│   ├── crypto-news — aggregate news + sentiment
│   ├── portfolio-monitor — watch drift + alert
│   └── auto-rebalance — triggered rebalance workflow
├── MCP Connection → MCP Server → Backend API
└── RAG Knowledge → ChromaDB
    ├── API reference (auto-generated)
    ├── System architecture docs
    └── Crypto strategy guides (custom)
```

## Implementation Steps

### OpenClaw Setup
1. Research OpenClaw Docker image / build custom
2. Create openclaw Dockerfile if needed
3. Add to docker-compose.yml with MCP connection
4. Configure LLM provider (API key via .env)

### Skills
5. Rewrite `allocation-advisor` skill to use MCP tools
6. Rewrite `market-analysis` skill
7. Rewrite `crypto-news` skill
8. Create `portfolio-monitor` skill (new)
9. Create `auto-rebalance` skill (new)

### Knowledge Base
10. Add ChromaDB to docker-compose.yml
11. Create knowledge ingestion script
12. Auto-generate API reference docs from backend routes
13. Write custom crypto strategy knowledge files
14. Create embedding pipeline (markdown → ChromaDB)
15. Connect OpenClaw to ChromaDB for RAG queries

## Related Code Files

- Modify: `openclaw-skills/allocation-advisor/SKILL.md`
- Modify: `openclaw-skills/market-analysis/SKILL.md`
- Modify: `openclaw-skills/crypto-news/SKILL.md`
- Create: `openclaw-skills/portfolio-monitor/SKILL.md`
- Create: `openclaw-skills/auto-rebalance/SKILL.md`
- Create: `knowledge/api-reference/` — auto-generated API docs
- Create: `knowledge/strategies/` — custom crypto knowledge
- Create: `scripts/ingest-knowledge.ts` — embedding pipeline
- Modify: `docker-compose.yml` — add openclaw + chromadb services

## Todo List

- [x] Research and setup OpenClaw Docker container
- [x] Configure OpenClaw with MCP server connection
- [x] Rewrite allocation-advisor skill with MCP tools
- [x] Rewrite market-analysis skill with MCP tools
- [x] Rewrite crypto-news skill with MCP tools
- [x] Create portfolio-monitor skill
- [x] Create auto-rebalance skill
- [x] Add ChromaDB to docker-compose.yml
- [x] Auto-generate API reference knowledge
- [x] Write crypto strategy knowledge files
- [x] Create knowledge ingestion pipeline
- [x] Connect OpenClaw to ChromaDB for RAG
- [x] Test end-to-end: OpenClaw → MCP → Backend

## Success Criteria

- [x] OpenClaw container starts and connects to MCP
- [x] All 5 skills execute successfully via MCP tools
- [x] Knowledge base returns relevant context for queries
- [x] End-to-end: OpenClaw can analyze portfolio and suggest rebalance

## Risk Assessment

- OpenClaw may need specific configuration format — research early
- ChromaDB memory usage — set resource limits in Docker
- Knowledge quality affects AI suggestion quality — curate carefully
- LLM API costs for OpenClaw — monitor usage
