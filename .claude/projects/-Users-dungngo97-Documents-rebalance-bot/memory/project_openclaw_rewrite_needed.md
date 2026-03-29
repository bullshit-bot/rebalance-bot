---
name: OpenClaw Phase 6 needs rewrite
description: Phase 6 OpenClaw integration used fake Python container instead of real OpenClaw (Node.js npm package). Needs research + rewrite.
type: project
---

Phase 6 (OpenClaw Skills & Knowledge Base) needs rewrite. Current implementation is a placeholder Python container, not real OpenClaw.

**Why:** OpenClaw is a real Node.js app (`npm install -g openclaw@latest`) with Docker support, skills platform, and 20+ messaging channel integrations. Our implementation created a fake Python HTTP server with static SKILL.md files.

**How to apply:** Next session should research OpenClaw's actual Docker setup, MCP integration, skills config format, and rewrite the openclaw-skills/ directory + docker-compose.yml openclaw service. Also remove the fake ChromaDB integration until we confirm OpenClaw's RAG approach.

**Key facts:**
- Real OpenClaw: https://github.com/openclaw/openclaw
- Runtime: Node 24+ or Node 22.16+
- Install: `npm install -g openclaw@latest` → `openclaw onboard --install-daemon`
- Has Docker: Dockerfile + docker-compose.yml in their repo
- Skills: bundled, managed, workspace skills + ClawHub registry
- Channels: WhatsApp, Telegram, Slack, Discord, Signal, etc.
