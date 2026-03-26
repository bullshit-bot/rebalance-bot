---
title: "Dockerize System, MongoDB Migration & OpenClaw AI Integration"
description: "Full Docker Compose (6 services) + Drizzle→Mongoose migration + MCP server + OpenClaw AI agent"
status: completed
priority: P1
effort: 30h
branch: main
tags: [docker, mongodb, migration, mcp, openclaw, ai]
created: 2026-03-26
---

# Dockerize System, MongoDB Migration & OpenClaw AI Integration

## Goal

Full Docker Compose setup (6 services) + SQLite→MongoDB migration + MCP server + OpenClaw AI agent with knowledge base.

## Current State

- Backend: Bun + Hono + Drizzle/SQLite (14 tables, 48 files import db)
- Frontend: React/Vite served by host nginx
- Deploy: GitHub Actions → SSH → systemd + nginx on VPS
- Docker: single-service Dockerfile (backend only)
- OpenClaw: skill definition files only (SKILL.md), not connected

## Target State

- 6-service Docker Compose: frontend(nginx), backend(bun), mongodb, mcp-server, openclaw, chromadb
- Mongoose ODM with 14 document schemas
- MCP server wrapping all REST API endpoints as MCP tools
- OpenClaw AI agent with skills + knowledge base (RAG via ChromaDB)
- Docker Compose-based deploy on VPS

## Decisions

- **OpenClaw**: Always included as container, setup from scratch
- **MCP**: Full API proxy — all REST endpoints exposed as MCP tools
- **Knowledge**: Auto-generated API docs + custom crypto strategy knowledge (RAG)
- **MongoDB auth**: ENV-based (MONGO_INITDB_ROOT_USERNAME/PASSWORD)
- **Deploy**: `docker compose up -d` on VPS via SSH
- **Data**: Fresh start, no SQLite migration needed

## Phase Table

| # | Phase | Status |
|---|-------|--------|
| 1 | [Docker Infrastructure](phase-01-docker-infrastructure.md) | ✅ Completed |
| 2 | [MongoDB Schema Migration](phase-02-mongodb-schema-migration.md) | ✅ Completed |
| 3 | [Backend Query Migration](phase-03-backend-query-migration.md) | ✅ Completed |
| 4 | [MongoDB Seed Script](phase-04-data-migration-script.md) | ✅ Completed |
| 5 | [MCP Server](phase-05-mcp-server.md) | ✅ Completed |
| 6 | [OpenClaw Skills & Knowledge Base](phase-06-openclaw-skills-knowledge.md) | ✅ Completed |
| 7 | [CI/CD Update](phase-07-cicd-update.md) | ✅ Completed |
| 8 | [Cleanup & Testing](phase-08-cleanup-testing.md) | ✅ Completed |

## Key Dependencies

- Phase 2 depends on Phase 1 (MongoDB must be running)
- Phase 3 depends on Phase 2 (schemas must exist)
- Phase 4 depends on Phase 2 (schemas for seed script)
- Phase 5 depends on Phase 1 (Docker network for MCP container)
- Phase 6 depends on Phase 5 (MCP server must exist for skills)
- Phase 7 depends on Phases 1+3+5 (Docker + queries + MCP ready)
- Phase 8 depends on all previous phases

## Research Reports

- [MongoDB ODM Comparison](../reports/researcher-260326-1512-mongodb-odm-comparison.md)
- [Docker Multi-Service Architecture](../reports/researcher-260326-1512-docker-multi-service.md)
- [OpenClaw & MCP Research](../reports/researcher-260326-1535-openclaw-mcp-research.md)

## Risk Summary

- **48 files** need query migration — largest effort, highest risk
- MCP server must accurately map all API endpoints — incomplete mapping = broken AI
- OpenClaw setup from scratch — may need custom Dockerfile
- Knowledge base quality directly affects AI suggestion accuracy
