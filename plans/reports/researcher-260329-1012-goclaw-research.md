# GoClaw Research Report

**Date:** 2026-03-29
**Scope:** Feature comparison with OpenClaw, deployment, system requirements, capabilities

---

## 1. What is GoClaw? What Does It Do?

**GoClaw** is a multi-agent AI gateway platform written in Go that orchestrates AI agents across 20+ LLM providers and 7 messaging channels. It's a production-ready rewrite of OpenClaw with:

- **Core purpose:** Deploy, manage, and coordinate teams of AI agents with inter-agent delegation, task boards, and shared context.
- **Architecture:** Single Go binary (~25MB standalone, ~50MB Docker) with zero runtime dependencies (except PostgreSQL for multi-user deployments).
- **Key capabilities:**
  - Multi-agent orchestration with task boards and mailboxes
  - 40+ built-in tools (web search, code execution, file management, database queries, browser automation)
  - Transcript search with persistent memory (PostgreSQL + pgvector)
  - MCP server integration (stdio, SSE, streamable-HTTP)
  - Custom skills system (markdown-based, no code required)
  - 7 messaging channels (Telegram, Discord, Slack, Zalo, Mattermost, etc.)

---

## 2. GoClaw vs OpenClaw Comparison

| Dimension | OpenClaw | GoClaw |
|-----------|----------|--------|
| **Language** | Python/JavaScript | Go |
| **Architecture** | Monolithic | Multi-tenant, modular |
| **Security** | Standard | 5-layer security + tool sandboxing + content injection wrapping |
| **Concurrency** | Async (JS) | Native Go goroutines |
| **Deployment** | Docker/Kubernetes | Single binary or Docker |
| **Desktop Version** | No | Yes (GoClaw Lite—native app, no PostgreSQL/Docker required) |
| **Compatibility** | N/A | Can run alongside OpenClaw; unified session transcript search |
| **Maturity** | Original | Feature parity + improvements |
| **Multi-tenancy** | Not primary | Per-user workspaces, encrypted API keys (AES-256-GCM) |

**Key advantage:** GoClaw is production-ready alternative with better security, scalability, and enterprise features. Can run alongside OpenClaw without conflicts.

---

## 3. System Requirements

### Minimum Requirements
- **CPU:** 1 vCPU
- **RAM:** 2 GB (build), 2 GB (runtime minimum), 8 GB recommended for 24/7 production
- **Storage:** ~25 MB binary (standalone) or ~50 MB (Docker image)
- **Go:** 1.26+ (for source builds)

### Required Services (Multi-user/Production)
- **PostgreSQL 18** with pgvector extension (multi-tenant support, session storage)
- **Docker & Docker Compose v2** (for containerized deployment)
- **VPS with KVM virtualization** (if deploying on cloud VPS)

### Desktop/Standalone (GoClaw Lite)
- **Native binary only** — no PostgreSQL, Docker, or additional dependencies required
- Minimal hardware (modern laptop/desktop)

---

## 4. Docker Deployment

### Quick Start
```bash
./prepare-env.sh  # Configure environment
make up           # Build, start services, run migrations
```

### Container Specs
- **Build:** Two-stage Dockerfile (golang:1.26-bookworm builder + alpine:3.22 runtime)
- **Port:** 18790 (web dashboard)
- **Runtime user:** goclaw (UID 1000, non-root)
- **Network:** Docker Compose creates network + PostgreSQL container
- **Database:** Automatic migrations on startup

### Build Requirements
- **Minimum 2 GB RAM** during build (pnpm install can fail on 1 GB, exit 137)
- Docker Desktop or Docker Engine with Compose v2

---

## 5. Web UI / Control UI

**Yes.** GoClaw includes a **web dashboard** at `http://localhost:3000` for:
- Agent management and configuration
- Session/transcript browsing
- Task board management
- Skill installation/configuration
- API key management (encrypted storage)
- Team/workspace setup

Unlike OpenClaw, GoClaw Lite (desktop version) is also available as a native app without needing the web interface.

---

## 6. MCP (Model Context Protocol) Support

**Yes, full support.**

### Implementation
- **Role:** GoClaw acts as an MCP server with 66 tools covering agents, sessions, and configuration
- **Bridge:** Connects external MCP servers to agent tool registries
- **Protocol support:** stdio, SSE, and streamable-HTTP
- **Tool naming:** Tools registered as `{prefix}__{tool_name}` (default prefix: `mcp_{server_name}`)

### Health & Reliability
- Health checks every 30 seconds via ping
- Auto-reconnect on failure: up to 10 retries with exponential backoff (2s initial, 60s max)
- Log keys: `mcp.server.connected`, `mcp.server.connect_failed`, `mcp.server.health_failed`

### Use Case
Enables integration with external MCP servers (Claude Code, custom tools, third-party services) as native agent tools.

---

## 7. Custom Skills Support

**Yes. Markdown-based, extensible system.**

### How It Works
- Skills are **markdown files** with domain knowledge + instructions
- **No code required** — skills inject context into LLM prompts
- Skills leverage **40+ built-in native tools** (bash, file ops, web search, code execution, etc.)
- **Cannot register new tools** — only enhance existing ones via prompting

### Skill Directories (Precedence)
1. **Workspace** (`skills/`) — Priority 300
2. **Managed** (`~/.goclaw/skills/`) — Priority 200
3. **Bundled** (`<executable>/skills/`) — Priority 100

### Features
- **Requirements declaration:** Specify required binaries, env vars
- **Auto-filtering:** Skills disabled if dependencies unavailable
- **Config fields:** Optional custom per-skill configuration
- **Tool:** `find-skills` command for discovery, install, validate, test, update, remove

### Repository
Community skills available via GitHub (e.g., `devclaw-skills` repo for specialized agent capabilities).

---

## 8. Supported LLM Providers

**20+ providers** including:

| Tier 1 (Primary) | Tier 2 (Supported) |
|------------------|-------------------|
| **Anthropic** (with prompt caching: 90% cost reduction) | Ollama |
| **OpenAI** | Cohere |
| **Google/Gemini** | Mistral |
| **Groq** | DeepSeek |
| **xAI** | And more |

### Notable Features
- **Anthropic prompt caching:** Native support with significant cost savings
- **Fallback support:** Can chain multiple providers for redundancy
- **API key management:** Encrypted per-workspace storage (AES-256-GCM)

---

## Unresolved Questions

1. **Exact provider count:** Search results cite "20+" and "13+" — unclear if updated recently
2. **Claude Code CLI bridge:** PR #61 mentions "Claude CLI as LLM provider with MCP bridge" — status/release status unclear
3. **Custom tool registration:** Can MCP servers add *entirely new* tools, or only enhance existing ones?
4. **Pricing/licensing:** Open-source model not explicitly stated in searches (assumed Apache/MIT but unverified)
5. **Production SLAs:** Uptime guarantees, performance benchmarks under load not documented
6. **Migration path from OpenClaw:** Step-by-step migration guide not found

---

## Recommendation for Rebalance Bot Context

**GoClaw is production-ready if:**
- You need **multi-tenant isolation** with encrypted API keys
- You value **Go's concurrency** for high-throughput agent coordination
- You want **single-binary deployment** without runtime dependencies
- You need **MCP integration** for Claude Code or external tools

**Stick with OpenClaw if:**
- You're already deployed and satisfied
- You need Python-specific customizations
- The ecosystem/community knowledge base matters (OpenClaw is more established)

**GoClaw advantages over OpenClaw:**
- Better security (5-layer, sandboxing)
- Smaller binary + faster startup
- Desktop app option (GoClaw Lite)
- Better multi-tenancy
- Native Go concurrency (better for horizontal scaling)

---

## Sources

- [GitHub - nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw)
- [Oreate AI Blog: Beyond OpenClaw](https://www.oreateai.com/blog/beyond-openclaw-goclaw-picoclaw-and-zeroclaw-chart-new-territories-in-open-source-ai-assistants-84429cf15665b9f1e00c8d02aa2553ff)
- [GoClaw MCP Server - PulseMCP](https://www.pulsemcp.com/servers/nextlevelbuilder-goclaw)
- [GoClaw Installation Docs](https://goclaw.org/docs/installation/)
- [GitHub - devclaw-skills](https://github.com/jholhewres/devclaw-skills)
- [GoClaw Enterprise Platform](https://goclaw.sh/en/)
