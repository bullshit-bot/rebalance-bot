# GoClaw Docker Deployment Research Report

**Date:** 2026-03-29
**Scope:** Docker image details, environment configuration, volumes, ports, authentication, database mode, skills format, and deployment architecture.
**Sources:** GitHub (nextlevelbuilder/goclaw), official documentation (docs.goclaw.sh), Docker Hub, GHCR.

---

## Executive Summary

GoClaw is a production-grade replacement for OpenClaw: a multi-tenant AI agent gateway written in Go (~25MB binary, <1s startup). Unlike OpenClaw, GoClaw requires PostgreSQL in Docker deployments (SQLite is no longer available in managed mode). The Docker setup uses modular compose files with 3–4 core services (gateway, postgres, web UI, optional observability). Authentication is token-based (bearer tokens, constant-time comparison). Skills use the standard SKILL.md format (compatible with OpenClaw). MCP servers integrate via mcporter skill (not a built-in). No built-in web UI on port 18790—separate web dashboard at port 3000.

---

## 1. Docker Image & Registry

| Property | Value |
|----------|-------|
| **Image Name** | `ghcr.io/nextlevelbuilder/goclaw:latest` |
| **Registry** | GitHub Container Registry (GHCR) |
| **Base Image** | `alpine:3.22` (two-stage build from `golang:1.26-bookworm`) |
| **Architecture** | Static, CGO-disabled Linux binary (works on amd64, arm64) |
| **Size** | ~25 MB binary, Docker image slightly larger with Alpine base |
| **Startup Time** | <1 second |
| **Non-Root User** | `goclaw:1000` (runs as non-root) |
| **Exposed Port** | 18790 (configurable via `GOCLAW_PORT`) |

**Source:** [GitHub Dockerfile](https://github.com/nextlevelbuilder/goclaw/blob/main/Dockerfile) and README.

---

## 2. Environment Variables

### Core Gateway Configuration

| Variable | Default | Purpose | Notes |
|----------|---------|---------|-------|
| `GOCLAW_HOST` | `0.0.0.0` | Server bind address | Set to `127.0.0.1` for local-only, `0.0.0.0` for network access |
| `GOCLAW_PORT` | `18790` | Server listen port | Expose this port in docker-compose |
| `GOCLAW_CONFIG` | `/app/data/config.json` | Path to config file (JSON5 format) | Loaded on startup; can be overridden by env vars |
| `GOCLAW_GATEWAY_TOKEN` | (auto-generated) | Bearer token for API authentication | **Must be set or auto-generated; read from .env.local or env** |
| `GOCLAW_ENCRYPTION_KEY` | (auto-generated) | Encryption key for stored secrets (AES-256-GCM) | **Must be set or auto-generated; read from .env.local or env** |

### Directory/Path Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GOCLAW_SKILLS_DIR` | `/app/data/skills` | Directory containing user-installed skills |
| `GOCLAW_WORKSPACE` | `/app/workspace` | Workspace for agents (sessions, transcripts, memories) |
| `GOCLAW_MIGRATIONS` | `/app/migrations` | Built-in SQL migration files (read-only) |
| `GOCLAW_SKILLS_STORE` | `/app/data/skills-store` | Managed skills uploaded via API/dashboard (PostgreSQL-backed metadata) |

### Database Configuration

| Variable | Default | Purpose | Required in Docker? |
|----------|---------|---------|---------------------|
| `GOCLAW_POSTGRES_DSN` | (none) | PostgreSQL connection string: `postgres://user:pass@host:5432/dbname?sslmode=disable` | **Yes** — DSN read from env only (not config.json) |
| `POSTGRES_USER` | `goclaw` | PostgreSQL username | Yes (docker-compose.postgres.yml) |
| `POSTGRES_PASSWORD` | `goclaw` | PostgreSQL password | **Yes — set strong value in production** |
| `POSTGRES_DB` | `goclaw` | PostgreSQL database name | Yes (docker-compose.postgres.yml) |

### Quick-Start & Auto-Onboarding

| Variable | Value | Purpose |
|----------|-------|---------|
| `GOCLAW_QUICK_START` | `1` | Generate default config.json with random password; auto-onboard without interactive prompts |
| `GOCLAW_<PROVIDER>_API_KEY` | (e.g., `GOCLAW_ANTHROPIC_API_KEY`) | Auto-detect LLM provider and configure without setup wizard; examples: `GOCLAW_ANTHROPIC_API_KEY`, `GOCLAW_OPENAI_API_KEY` |

### Optional Features (Build-Time & Runtime)

| Variable | Type | Purpose | Docker Compose File |
|----------|------|---------|---------------------|
| `ENABLE_OTEL` | Build arg | Enable OpenTelemetry tracing (Jaeger compatible) | `docker-compose.otel.yml` |
| `ENABLE_TSNET` | Build arg | Enable Tailscale networking for private tunneling | `docker-compose.tailscale.yml` |
| `ENABLE_SANDBOX` | Build arg | Enable Docker sandbox (install `docker` CLI in image) | `docker-compose.sandbox.yml` |
| `ENABLE_FULL_SKILLS` | Build arg | Pre-install Python, Node.js, document processors | Dockerfile build args |
| `ENABLE_CLAUDE_CLI` | Build arg | Install Claude Code CLI | Dockerfile build args |
| `WITH_BROWSER=1` | Runtime env | Enable headless browser (Chromium) for web automation | `docker-compose.browser.yml` |
| `GOCLAW_TRACE_VERBOSE` | `1` | Enable verbose tracing for debugging | docker-compose.yml |

**Sources:**
- [.env.example](https://github.com/nextlevelbuilder/goclaw) — official env var reference
- [docker-compose.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.yml) — environment sections
- [README](https://github.com/nextlevelbuilder/goclaw/blob/main/README.md) — quick-start flags

---

## 3. Volumes & Mount Points

### Default Mount Structure (Docker Compose)

```yaml
volumes:
  goclaw-data:          # Persists /app/data (config, skills, skills-store)
  goclaw-workspace:     # Persists /app/workspace (sessions, transcripts, memories)
  postgres-data:        # Persists /var/lib/postgresql (database files)
```

### Per-Service Mounts

**GoClaw Gateway Service:**
```
goclaw-data:      /app/data              # config.json, user skills, managed skills metadata
goclaw-workspace: /app/workspace         # Agent sessions, transcripts, vector graphs
/tmp:             /tmp (noexec,nosuid)   # Temp files, 256m limit, security hardening
```

**PostgreSQL Service:**
```
postgres-data:    /var/lib/postgresql    # All database files
```

**GoClaw Web UI (goclaw-ui):**
```
(none)             # Stateless; reads config via network from gateway
```

### Directory Purposes

| Path | Contents | Writeable | Mounted Volume |
|------|----------|-----------|-----------------|
| `/app/data/config.json` | Main gateway config (JSON5 format, no secrets) | Yes (on first run) | `goclaw-data` |
| `/app/data/skills/` | User-installed skills (SKILL.md + scripts) | Yes (via API or manual) | `goclaw-data` |
| `/app/data/skills-store/` | Managed skills uploaded via dashboard (metadata in PG, files on disk) | Yes (via API) | `goclaw-data` |
| `/app/workspace/` | Agent execution context (sessions, transcripts, memory graphs) | Yes (during execution) | `goclaw-workspace` |
| `/app/migrations/` | Built-in SQL migration files | No (read-only, bundled in image) | N/A |
| `/var/lib/postgresql/` | PostgreSQL PGDATA | Yes | `postgres-data` |

**Key:** GoClaw stores skill *metadata* in PostgreSQL; skill *files* are on-disk in `/app/data/skills/` and `/app/data/skills-store/`. This differs from OpenClaw, which stored skills entirely in file system.

---

## 4. Ports & Network Access

| Service | Port | Protocol | Purpose | Externally Exposed? |
|---------|------|----------|---------|---------------------|
| **goclaw** | 18790 | HTTP/WebSocket | Gateway API, agent communication, health checks | **Yes (via docker-compose mapping)** |
| **goclaw-ui** | 3000 | HTTP | Web dashboard (UI for config, viewing agents/sessions) | **Yes (via docker-compose mapping)** |
| **postgres** | 5432 | TCP | PostgreSQL database (internal network only) | **No (localhost:5432 for testing only)** |
| **jaeger** (optional) | 16686 | HTTP | OpenTelemetry tracing UI (if ENABLE_OTEL=1) | **Yes (if enabled)** |

### Network Mode

- Default: Docker bridge network `goclaw-net` shared by all services
- Service discovery: `postgres:5432` (container hostname resolves via Docker DNS)
- Gateway DSN in docker-compose: `postgres://goclaw:$POSTGRES_PASSWORD@postgres:5432/goclaw?sslmode=disable`

### Health Checks

```bash
curl http://localhost:18790/health        # Gateway health (returns 200)
pg_isready -h postgres -U goclaw          # PostgreSQL health (default: 5-second intervals, 10 retries)
```

---

## 5. Database Mode: PostgreSQL Required (No SQLite in Docker)

### Current Architecture (GoClaw Server Edition)

**PostgreSQL is mandatory** in all current Docker deployments. The GOCLAW_MODE environment variable (which previously allowed SQLite mode) is **deprecated**.

| Feature | GoClaw Server (Docker) | GoClaw Lite (Desktop) |
|---------|------------------------|----------------------|
| **Database** | PostgreSQL 18 (required) | SQLite with vector extensions |
| **Multi-Tenancy** | Full (per-user isolation) | No (single local user) |
| **Agents** | Unlimited | Max 5 agents |
| **Teams** | Unlimited | Max 1 team |
| **Channels** | All 7 supported | Limited |
| **Standalone** | No (requires Postgres container) | Yes |

### PostgreSQL Setup Details

**Image:** `pgvector/pgvector:pg18` — PostgreSQL 18 with pgvector extension pre-installed (vector embeddings, similarity search).

**Credentials (docker-compose.postgres.yml):**
```yaml
POSTGRES_USER: goclaw
POSTGRES_PASSWORD: goclaw         # CHANGE THIS IN PRODUCTION
POSTGRES_DB: goclaw
```

**Health Check:**
```yaml
pg_isready -h localhost -U goclaw
```

**Auto-Migrations:**
GoClaw automatically runs SQL migrations on startup (first container run). Migration files are baked into the image at `/app/migrations/`. The database schema includes:
- Users, teams, agents, sessions
- Transcripts (transcript_items)
- Vector embeddings (pgvector) for memory graph
- Provider credentials (AES-256-GCM encrypted)
- Channel configurations

**Persistence:**
PostgreSQL data persists in the `postgres-data` named volume. To reset DB: `docker compose down -v postgres-data`.

---

## 6. Configuration File Format & Location

### File Paths & Names

| Context | Config Location | Format | Secrets? |
|---------|-----------------|--------|----------|
| **Docker** | `/app/data/config.json` | JSON5 (superset of JSON) | No — env vars only |
| **Binary** | `./config.json` or `~/.goclaw/config.json` | JSON5 | No — .env.local file holds secrets |
| **Environment** | Set via `GOCLAW_CONFIG` env var | (path reference) | — |

### config.json Schema (Partial Example)

While no official `.json5` example is published in the GitHub repo, the config structure includes:

```json5
{
  "gateway": {
    "host": "0.0.0.0",
    "port": 18790,
    "token": "skipped—read from env"  // GOCLAW_GATEWAY_TOKEN instead
  },
  "providers": {
    "anthropic": {
      "enabled": true,
      "api_key": "skipped—env only"    // GOCLAW_ANTHROPIC_API_KEY instead
    },
    "openai": {
      "enabled": false,
      "api_key": "skipped—env only"    // GOCLAW_OPENAI_API_KEY instead
    }
  },
  "database": {
    "dsn": "skipped—GOCLAW_POSTGRES_DSN env only"
  },
  "channels": {
    "slack": {
      "enabled": false
      // Configure via Web UI after startup
    },
    "telegram": {
      "enabled": false
    }
  },
  "skills": {
    "directories": [
      "/app/data/skills",
      "/app/data/skills-store"
    ]
  }
}
```

**Key Points:**
- All *secrets* (tokens, API keys, DB passwords) are **read from environment variables only**, not from config.json
- config.json is auto-generated on first run if it doesn't exist (use `GOCLAW_QUICK_START=1` for defaults)
- Environment variables **override** config.json values
- Validation: `goclaw config validate` (CLI command)

**Sources:**
- [GitHub setup process](https://github.com/nextlevelbuilder/goclaw/blob/main/README.md)
- [Config management rules from docs](https://docs.goclaw.sh)

---

## 7. MCP Server Connection & Configuration

### No Built-In MCP Server Mode

GoClaw **does not include a built-in MCP server**. MCP integration happens via the **mcporter skill** (a separate Claude Code skill that calls MCP servers HTTP endpoints).

### mcporter Integration (Skill-Based)

**mcporter** is deployed as a GoClaw skill that:
1. Lists, configures, and authenticates MCP servers
2. Calls MCP server tools via HTTP or stdio
3. Supports server configuration file management (`mcporter.json` by default)
4. Works with OAuth, API keys, and custom auth

**Equivalent to OpenClaw's mcporter.json behavior:**
In OpenClaw, `~/.openclaw/mcporter.json` held MCP server registry. In GoClaw, equivalent config lives in the mcporter skill directory at:
```
/app/data/skills/mcporter/config/mcporter.json
```

**No direct equivalent to mcporter.json at the gateway level.** Instead:
- Install mcporter skill: Add to `/app/data/skills/mcporter/`
- Configure servers: Edit skill's local config (or via mcporter CLI commands)
- Gateway calls servers: Via the mcporter skill tool (not native)

### Workflow Example

```bash
# Inside goclaw container or via skill execution:
mcporter list                                    # List registered servers
mcporter auth linear                             # OAuth for Linear server
mcporter call linear.list_issues team=ENG       # Call MCP tool
mcporter config add --name my-server --url http://my-server:3000
```

**Sources:**
- [mcporter skill documentation](https://github.com/openclaw/skills/blob/main/skills/steipete/mcporter/SKILL.md)
- [MCPorter tool overview](https://mcpmarket.com/tools/skills/mcporter-1)

---

## 8. Skill Format & Compatibility

### SKILL.md Standard

GoClaw **fully supports** the SKILL.md format (Anthropic's open standard from December 2025), making skills **compatible with OpenClaw**.

### Directory Structure

```
/app/data/skills/
├── my-skill/
│   ├── SKILL.md                    # Required: skill manifest
│   ├── script.py                   # Optional: implementation
│   ├── config.toml                 # Optional: skill config
│   └── README.md                   # Optional: documentation
├── mcporter/
│   ├── SKILL.md
│   ├── config/
│   │   └── mcporter.json           # MCP server registry
│   └── bin/
│       └── mcporter                # Binary or symlink
└── another-skill/
    └── SKILL.md
```

### SKILL.md Frontmatter (Required)

```markdown
---
name: my-skill
description: Brief description (max 1024 chars)
license: MIT                         # Optional
compatibility: goclaw,claude-code   # Optional
metadata:                            # Optional: free-form key-value
  author: Your Name
  version: 1.0
---

# Skill Implementation
...
```

### Validation

```bash
goclaw skills validate my-skill     # Validates SKILL.md format
```

### Name Rules (Strict)

- 1–64 characters, lowercase alphanumeric with single hyphens
- No leading/trailing hyphens, no consecutive hyphens
- Must match directory name
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Example: `my-python-script`, `data-processor`, `linear-integration`

### Skill Discovery & Installation

GoClaw scans skill directories in order:
1. `/app/workspace/skills/` (workspace override)
2. `/app/data/skills/` (user-installed)
3. `/app/skills/` (bundled in image)

**Installation methods:**
- Manual: Copy skill directory to `/app/data/skills/<skill-name>/`
- API: Upload via dashboard
- Git: `goclaw skills install <git-repo-url>`

**Ignored:** `node_modules/`, `.git/`, `__pycache__/`, `.gitignore`, `.dockerignore`.

### Differences from OpenClaw

| Aspect | OpenClaw | GoClaw |
|--------|----------|--------|
| **Format** | SKILL.md (+ shell/bash scripts) | SKILL.md (+ any language: Python, Go, Node, Rust, etc.) |
| **Metadata Store** | File system only | File system + PostgreSQL (managed skills via API) |
| **Validation** | Basic | `goclaw skills validate` CLI command |
| **Distribution** | Manual git clone | API upload + git install + manual |

**Sources:**
- [SKILL.md spec](https://agentskills.io/specification)
- [GoClaw docs](https://docs.goclaw.sh)
- [DeepWiki: GoClaw Getting Started](https://deepwiki.com/nextlevelbuilder/goclaw/2-getting-started)

---

## 9. Web UI & Dashboard Access

### GoClaw Web UI Service

**Separate container** (not part of gateway port 18790):

| Property | Value |
|----------|-------|
| **Service Name** | `goclaw-ui` |
| **Image** | `ghcr.io/nextlevelbuilder/goclaw-web:latest` |
| **Port** | 3000 (exposed to host) |
| **Protocol** | HTTP (no HTTPS in docker-compose; use reverse proxy in production) |
| **URL** | `http://localhost:3000` |
| **Functionality** | Web dashboard for: viewing agents, sessions, transcripts, configuring channels, managing teams, uploading skills |

### No Web UI on Port 18790

Port 18790 is **API-only** (HTTP + WebSocket for agent communication). It does **not** serve a web UI.

### Dashboard Features

- **Home:** Overview of agents, active sessions, recent transcripts
- **Agents:** Create, view, edit agent configurations
- **Sessions:** Browse past and ongoing agent sessions
- **Transcripts:** Search transcripts with vector search (powered by pgvector)
- **Teams:** Manage team members, permissions, shared task boards
- **Channels:** Configure Slack, Discord, Telegram, WhatsApp, etc.
- **Skills:** Upload and manage skills (managed mode)
- **Providers:** Configure LLM providers and API keys
- **Settings:** Gateway token, encryption key, advanced options

### Architecture

- UI communicates with gateway via HTTP (within Docker network or via exposed port)
- No special authentication required for web UI in default setup (add reverse proxy + OAuth in production)
- Websocket connections upgrade for real-time agent status updates

**Sources:**
- [docker-compose.selfservice.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.selfservice.yml)
- [GoClaw README: Dashboard](https://github.com/nextlevelbuilder/goclaw/blob/main/README.md)

---

## 10. Authentication & Token Management

### Bearer Token Authentication

GoClaw uses **bearer token authentication** (optional but recommended):

| Aspect | Details |
|--------|---------|
| **Type** | HTTP Bearer token (`Authorization: Bearer <TOKEN>`) |
| **Generation** | Auto-generated on first startup (random 32+ char string) |
| **Storage** | Read from `GOCLAW_GATEWAY_TOKEN` env var or `.env.local` |
| **Application** | All HTTP endpoints (GET, POST, WebSocket upgrades) |
| **Comparison** | Constant-time comparison (prevents timing attacks) |
| **Scope** | Gateway-wide; applies to all agents, channels, and APIs |

### Token Generation & Rotation

**On First Run (Docker):**
```bash
# docker-compose.yml runs prepare-env.sh which:
# 1. Generates GOCLAW_GATEWAY_TOKEN (random, 32+ chars)
# 2. Generates GOCLAW_ENCRYPTION_KEY (AES-256 key)
# 3. Saves to .env.local (local file, not in git)
```

**Manual Generation:**
```bash
# In binary mode:
goclaw doctor --generate-gateway-token  # Writes to config file

# In Docker, set in .env or docker-compose.yml:
GOCLAW_GATEWAY_TOKEN=my-custom-token-here
```

### Encryption Key (AES-256-GCM)

Separate from gateway token; encrypts stored secrets (API keys, channel credentials):

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **Usage** | Encrypt provider API keys, channel tokens in database |
| **Set Via** | `GOCLAW_ENCRYPTION_KEY` env var |
| **Generation** | Auto (prepare-env.sh) or manual |
| **Rotation** | Not supported without data loss (re-encrypt DB needed) |

### Provider API Keys

LLM provider keys (Anthropic, OpenAI, etc.) are:
- Encrypted with `GOCLAW_ENCRYPTION_KEY` before storage in PostgreSQL
- Never logged or exposed in logs
- Set via:
  1. Environment variables at startup: `GOCLAW_ANTHROPIC_API_KEY=sk-...`
  2. Web UI after startup (encrypted on submission)
  3. config.json (discouraged; use env vars instead)

### Multi-Tenant Isolation

Each user/team has:
- Separate workspace (`/app/workspace/<user-id>/`)
- Encrypted API keys (user-specific)
- Separate agent namespaces
- No cross-user data access

**Sources:**
- [Security documentation](https://docs.openclaw.ai/gateway/security)
- [GoClaw README: Quick Start](https://github.com/nextlevelbuilder/goclaw/blob/main/README.md)

---

## 11. Docker Compose Setup Files

### Recommended Stack

Combine these compose files in order:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.postgres.yml \
  -f docker-compose.selfservice.yml \
  up -d --build
```

### Available Overlay Files

| File | Purpose | Services Added | Trigger |
|------|---------|-----------------|---------|
| `docker-compose.yml` | Core gateway | `goclaw` | Always |
| `docker-compose.postgres.yml` | Database | `postgres` | Always (for server edition) |
| `docker-compose.selfservice.yml` | Web UI | `goclaw-ui` | Always recommended |
| `docker-compose.browser.yml` | Headless browser | `browser`, `browser-host` | `WITH_BROWSER=1` |
| `docker-compose.otel.yml` | Tracing (Jaeger) | `jaeger`, `otel-collector` | `WITH_OTEL=1` |
| `docker-compose.sandbox.yml` | Docker sandbox | `sandbox` (socket mount) | `WITH_SANDBOX=1` |
| `docker-compose.tailscale.yml` | Tailscale VPN | Modifies services | `WITH_TAILSCALE=1` |
| `docker-compose.upgrade.yml` | DB migrations | `goclaw-migrate` (one-shot) | Emergency manual runs |
| `docker-compose.redis.yml` | Redis cache | `redis` | `WITH_REDIS=1` |

### Makefile Convenience

```bash
make build              # Build images only
make up                 # Build + compose up -d (honors WITH_* flags)
make down               # Stop all services
make logs               # Tail logs from all services
make clean              # Remove volumes (full reset)
```

**Example with features:**
```bash
make up WITH_BROWSER=1 WITH_OTEL=1
```

**Sources:**
- [Main docker-compose.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.yml)
- [Makefile](https://github.com/nextlevelbuilder/goclaw)

---

## 12. Build Arguments for Custom Images

When building the Docker image locally, pass build args:

```bash
docker build \
  --build-arg ENABLE_OTEL=1 \
  --build-arg ENABLE_SANDBOX=1 \
  --build-arg ENABLE_FULL_SKILLS=1 \
  --build-arg ENABLE_CLAUDE_CLI=1 \
  -t goclaw:custom .
```

| Arg | Effect | Image Size Impact |
|-----|--------|-------------------|
| `ENABLE_OTEL` | Add OpenTelemetry tracing | +2–3 MB |
| `ENABLE_TSNET` | Add Tailscale networking | +5–8 MB |
| `ENABLE_SANDBOX` | Install Docker CLI | +50 MB |
| `ENABLE_FULL_SKILLS` | Python + Node.js + deps | +150–200 MB |
| `ENABLE_CLAUDE_CLI` | Install Claude CLI tool | +50 MB |
| `VERSION` | Set app version (for metadata) | None |

**Base image:** `alpine:3.22` (minimal security footprint).

---

## 13. Comparison: GoClaw vs. OpenClaw (Docker Context)

| Aspect | OpenClaw | GoClaw |
|--------|----------|--------|
| **Language** | TypeScript (Node.js) | Go |
| **Binary** | ~200 MB Node.js + deps | ~25 MB static Go binary |
| **Startup** | 3–5 seconds | <1 second |
| **Database** | SQLite (default) or PostgreSQL | PostgreSQL (mandatory) |
| **Multi-Tenancy** | No (single-user) | Yes (per-user in PostgreSQL) |
| **Gateway Port** | 18789 | 18790 |
| **Web UI Port** | 18789 (embedded) | 3000 (separate service) |
| **Docker Registry** | Various | ghcr.io/nextlevelbuilder/goclaw |
| **mcporter Integration** | mcporter.json file | mcporter skill (API-driven) |
| **Skills Format** | SKILL.md + bash scripts | SKILL.md + any language |
| **Secrets Management** | config.json stores tokens | Env vars + .env.local only |
| **Token Auth** | Optional | Optional but recommended |
| **MCP Servers** | mcporter.json (file-based) | mcporter skill (HTTP-based) |
| **Production Ready** | Moderate | High (5-layer security) |

---

## 14. Key Deployment Decisions

### 1. PostgreSQL is Mandatory (No Offline Mode)

Unlike OpenClaw, GoClaw **cannot run in SQLite standalone mode**. Always include `docker-compose.postgres.yml` in Docker deployments.

**Implication:** If you need offline mode, consider GoClaw Lite (desktop edition with SQLite) instead.

### 2. Separate Web UI Service

Port 18790 is gateway API only. Web UI requires a second service (`goclaw-ui` on port 3000).

**Implication:** You cannot access gateway UI via `http://localhost:18790`. Always add `docker-compose.selfservice.yml`.

### 3. Secrets in Environment, Not Config

Never store API keys, tokens, or passwords in `config.json`. Use environment variables or `.env.local`.

**Implication:** Set `GOCLAW_GATEWAY_TOKEN` and `GOCLAW_ENCRYPTION_KEY` before first run. Use `prepare-env.sh` script provided in the repo.

### 4. Skills Are File + Database Hybrid

User-installed skills live on disk (`/app/data/skills/`); managed skills (uploaded via API) have metadata in PostgreSQL.

**Implication:** Backup both `/app/data/skills/` volume and PostgreSQL database. Skills are not portable across databases without script.

### 5. Token Comparison is Constant-Time

GoClaw prevents timing attacks by using constant-time token comparison.

**Implication:** Gateway token security is strong; no known bypasses. Regenerate tokens on compromise (restart with new `GOCLAW_GATEWAY_TOKEN`).

### 6. No Built-In OpenTelemetry (Optional)

Observability requires `WITH_OTEL=1` or `docker-compose.otel.yml`. Default has minimal tracing.

**Implication:** For production monitoring, enable OpenTelemetry overlay and configure external OTLP endpoint.

---

## 15. Unresolved Questions

1. **config.json full schema:** No official JSON schema is published. Recommend inspecting generated config after first run or checking GitHub issues for examples.

2. **Skills API endpoint:** Exact endpoint for uploading skills via HTTP not documented in searched sources. Recommend checking `/api/skills` endpoint or swagger docs on running gateway.

3. **Channel credential encryption:** How are Slack, Discord tokens encrypted at rest? Assumed AES-256-GCM but not explicitly confirmed.

4. **Persistent agent state:** Are agent memory graphs persisted in PostgreSQL? Assumed yes (pgvector) but not confirmed in sources.

5. **Scaling beyond single container:** Is there a multi-container/load-balanced deployment guide? Searched sources mention single-container Docker setup only.

6. **Migration from OpenClaw:** Is there a data migration path (OpenClaw DB → GoClaw)? Not found in sources; may require custom scripts.

7. **Dockerfile ENTRYPOINT logic:** Line about "Windows compatibility issues (CRLF, broken symlinks)" — specific issues not detailed. Recommend reviewing Dockerfile for edge cases.

---

## 16. Recommended Docker Compose Template (Skeleton)

```yaml
version: '3.8'

services:
  goclaw:
    image: ghcr.io/nextlevelbuilder/goclaw:latest
    container_name: goclaw-gateway
    ports:
      - "18790:18790"
    environment:
      GOCLAW_HOST: 0.0.0.0
      GOCLAW_PORT: 18790
      GOCLAW_CONFIG: /app/data/config.json
      GOCLAW_GATEWAY_TOKEN: ${GOCLAW_GATEWAY_TOKEN}
      GOCLAW_ENCRYPTION_KEY: ${GOCLAW_ENCRYPTION_KEY}
      GOCLAW_POSTGRES_DSN: postgres://goclaw:${POSTGRES_PASSWORD}@postgres:5432/goclaw?sslmode=disable
      GOCLAW_QUICK_START: 1  # Remove after first run
      GOCLAW_ANTHROPIC_API_KEY: ${GOCLAW_ANTHROPIC_API_KEY}
    volumes:
      - goclaw-data:/app/data
      - goclaw-workspace:/app/workspace
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - goclaw-net
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - SETUID
      - SETGID
      - CHOWN

  postgres:
    image: pgvector/pgvector:pg18
    container_name: goclaw-postgres
    environment:
      POSTGRES_USER: goclaw
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: goclaw
    volumes:
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U goclaw"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - goclaw-net

  goclaw-ui:
    image: ghcr.io/nextlevelbuilder/goclaw-web:latest
    container_name: goclaw-web
    ports:
      - "3000:3000"
    depends_on:
      - goclaw
    restart: unless-stopped
    networks:
      - goclaw-net

volumes:
  goclaw-data:
  goclaw-workspace:
  postgres-data:

networks:
  goclaw-net:
    driver: bridge
```

---

## Summary Table: Quick Reference

| Question | Answer |
|----------|--------|
| **Docker Image?** | `ghcr.io/nextlevelbuilder/goclaw:latest` |
| **Environment Variables (Core)?** | `GOCLAW_HOST`, `GOCLAW_PORT`, `GOCLAW_GATEWAY_TOKEN`, `GOCLAW_ENCRYPTION_KEY`, `GOCLAW_POSTGRES_DSN` |
| **Volumes?** | `goclaw-data:/app/data`, `goclaw-workspace:/app/workspace`, `postgres-data:/var/lib/postgresql` |
| **Ports?** | Gateway: 18790, Web UI: 3000, PostgreSQL: 5432 (internal) |
| **Database?** | PostgreSQL 18 (required; no SQLite option) |
| **Config Format?** | JSON5 (config.json); secrets via env vars |
| **Config Location?** | `/app/data/config.json` |
| **MCP Server Integration?** | Via mcporter skill (not built-in) |
| **Skill Format?** | SKILL.md (standard, compatible with OpenClaw) |
| **Skills Directory?** | `/app/data/skills/` (file system) + PostgreSQL metadata |
| **Web UI?** | Separate service (goclaw-ui on port 3000) |
| **Token Auth?** | Bearer token (constant-time comparison) |

---

## Sources

- [GitHub: nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw)
- [GitHub: goclaw docker-compose.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.yml)
- [GitHub: goclaw docker-compose.postgres.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.postgres.yml)
- [GitHub: goclaw docker-compose.selfservice.yml](https://github.com/nextlevelbuilder/goclaw/blob/main/docker-compose.selfservice.yml)
- [GitHub: goclaw Dockerfile](https://github.com/nextlevelbuilder/goclaw/blob/main/Dockerfile)
- [GitHub: goclaw README.md](https://github.com/nextlevelbuilder/goclaw/blob/main/README.md)
- [GoClaw Official Docs](https://docs.goclaw.sh)
- [MCPorter Skill Documentation](https://github.com/openclaw/skills/blob/main/skills/steipete/mcporter/SKILL.md)
- [SKILL.md Specification](https://agentskills.io/specification)
- [OpenClaw Security Documentation](https://docs.openclaw.ai/gateway/security)
