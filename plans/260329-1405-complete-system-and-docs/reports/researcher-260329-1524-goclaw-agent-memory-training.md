# GoClaw Agent Memory & Knowledge Training Research Report

**Date:** 2026-03-29
**Researcher:** Technical Analyst
**Scope:** GoClaw's agent memory systems, knowledge base training, context injection mechanisms

---

## Executive Summary

GoClaw uses a **four-layer context injection architecture** combining persistent memory (pgvector hybrid search), skill-based knowledge (markdown SKILL.md files), workspace context files, and per-run bootstrap. **Frontmatter IS the primary discovery/control mechanism**, and automatic context file injection happens via workspace structure, NOT via explicit memory-save APIs.

---

## 1. How GoClaw Injects Agent Context (The Four Layers)

### Layer 1: Base System Prompt
- GoClaw's hardcoded base prompt (built into executable)
- No external control; immutable

### Layer 2: Skills Prompt
- Compact list of **available skills** from workspace/managed/bundled directories
- Auto-generated at runtime (filtered by availability of declared requirements)
- **Skills are discovered via SKILL.md frontmatter metadata** (emoji, requires.bins, requires.env, etc.)

### Layer 3: Bootstrap Context Files (Workspace Level)
Core identity files read directly from workspace root:
- **SOUL.md** — Agent personality, principles, decision-making philosophy
- **AGENTS.md** — Descriptions of other agents in the team (auto-generated if ≤15 agents; delegates to search if >15)
- **IDENTITY.md** — Facts about the agent itself (background, capabilities)
- **TOOLS.md** — Tool descriptions and constraints (optional override)
- **USER.md, USER_PREDEFINED.md** — End-user context and preferences
- **BOOTSTRAP.md** — General environment/project setup knowledge

**Injection behavior:** ALL files are read from workspace on every agent run if they exist. No "automatic" flag needed—presence in workspace = automatic injection.

### Layer 4: Per-Run Overrides
- Additional instructions passed directly in API call (session context)
- Highest priority, temporary

---

## 2. Persistent Memory System (Long-Term Learning)

### Architecture
GoClaw memory uses **hybrid search (BM25 + pgvector)** with PostgreSQL backend:

| Component | Details |
|-----------|---------|
| **Storage** | PostgreSQL + pgvector extension (vectors for semantic search) |
| **Search** | BM25 keyword search + cosine distance vector similarity + recency weighting |
| **Weighting** | Default: 50% semantic + 30% keyword + 20% recency |
| **Extraction** | LLM-powered: agent-driven extraction + background async extraction with configurable handoff |
| **Knowledge Graph** | Semantic graph extracts entities/relationships from conversations; recursive traversal (max depth 3) |

### Memory Access Patterns
**For agents:**
- Search memory with: `memory_search("query")` or similar command (hybrid semantic + keyword)
- Reads from: `memory/*.md` and `MEMORY.md` files in workspace

**For humans (admin UI):**
- Dashboard with CRUD operations on memory documents
- Semantic search, chunk details, embedding inspection
- Bulk re-indexing capability

### Key Insight: No Explicit "Save" API
Memory **ingestion is automatic**:
- **Agent conversations** → transcripts → extracted and embedded in pgvector automatically
- **Memory files** (`memory/*.md`, `MEMORY.md`) → indexed on write
- **No explicit API call needed** to "save" knowledge — persistence happens via background processes

---

## 3. Knowledge Files & Frontmatter (How Skills Are Configured)

### SKILL.md Structure
Each skill directory contains:
```
skill-name/
├── SKILL.md          # (REQUIRED) frontmatter + instructions
├── scripts/          # (OPTIONAL) executable code, tools
└── references/       # (OPTIONAL) external doc pointers
```

### Frontmatter Fields (Discovery & Control)
```yaml
---
name: skill_unique_identifier          # Used in agent prompts
description: One-line summary
metadata:
  goclaw:
    emoji: 🔥                          # UI display icon
    requires:
      bins: [binary1, binary2]        # Required executables
      env: [ENV_VAR1, ENV_VAR2]       # Required environment vars
    config:                            # Optional per-skill settings
      param1: default_value
---
# Body: Instructions + examples (under 500 lines recommended)
```

### How Frontmatter Works
1. GoClaw scans `skills/`, `~/.goclaw/skills/`, `<executable>/skills/` on startup
2. Reads frontmatter; checks declared requirements (bins, env vars)
3. **If requirements missing → skill disabled; never injected into context**
4. **If requirements present → skill enabled; name + description injected automatically**
5. On every agent run, skill descriptions are prepended to system prompt

### Priority/Precedence
- Workspace skills (`skills/`) — Priority 300 (highest)
- Managed skills (`~/.goclaw/skills/`) — Priority 200
- Bundled skills (`<executable>/skills/`) — Priority 100 (lowest)

Workspace skills **override** bundled/managed versions with same name.

---

## 4. Agent Context Files (Workspace Bootstrap)

### Automatic Context Injection: YES
- **When:** Every agent run
- **How:** GoClaw reads workspace root for standard markdown files (SOUL.md, AGENTS.md, IDENTITY.md, etc.)
- **No explicit registration needed** — presence in workspace = automatic injection
- **No frontmatter required** for these files (frontmatter optional; used for metadata)

### Special Case: AGENTS.md Auto-Generation
- **≤15 target agents:** Auto-generated AGENTS.md is injected directly into context
- **>15 target agents:** Agents use `delegate_search` (hybrid search) instead of injecting full list
- System prevents context bloat by switching to search-based discovery

### Context File Limits
- Each file has soft size limits (typically <50KB recommended)
- GoClaw auto-compacts agent context when exceeding ~85% token capacity
- Compaction preserves memory state but summarizes old messages

---

## 5. Memory Search vs Context Files vs Frontmatter

| Mechanism | Purpose | Persistence | Update Mechanism | Discovery |
|-----------|---------|-------------|------------------|-----------|
| **Frontmatter** | Skill metadata & requirements | Until skill file is changed | Manual file edit | Automatic scan at startup |
| **Context Files** (SOUL.md, etc.) | Agent identity & environment | Persistent (workspace file) | Manual file edit | Automatic injection on run |
| **Memory Search** | Long-term learned facts, conversations | PostgreSQL + pgvector | Auto-extract from agent runs + manual ingest | Hybrid BM25 + semantic query |
| **Skills** (SKILL.md body) | Domain knowledge + instructions | Persistent (workspace file) | Manual file edit | Automatic injection in prompt |

**Summary:** Frontmatter controls *availability*; context files control *identity*; memory search preserves *learnings*.

---

## 6. Workspace/System Directory Structure (For Context)

```
workspace/
├── SOUL.md              # Injected: agent personality
├── IDENTITY.md          # Injected: agent facts
├── AGENTS.md            # Injected: team members (auto-gen or search-based)
├── TOOLS.md             # Injected: tool overrides
├── BOOTSTRAP.md         # Injected: environment setup
├── USER.md              # Injected: user context
├── USER_PREDEFINED.md   # Injected: predefined user data
├── MEMORY.md            # Indexed: long-term memory search
├── memory/              # Dir: indexed memory files
│   ├── decisions.md     # Indexed
│   ├── learnings.md     # Indexed
│   └── ...
├── skills/              # Skills directory
│   ├── skill-name/
│   │   └── SKILL.md     # With frontmatter (metadata + requirements)
│   └── ...
├── .env                 # Encrypted in PostgreSQL (NOT in workspace)
└── ...
```

**Key point:** No special `ws/system/` directory needed. Workspace root IS the system directory.

---

## 7. How Agent Training Actually Works in GoClaw

GoClaw does NOT have explicit "training" in the ML sense. Instead:

### Phase 1: Initial Context (Startup)
1. Load workspace SOUL.md, IDENTITY.md, BOOTSTRAP.md
2. Load skill list (enabled skills from frontmatter)
3. Load AGENTS.md (or setup search)
4. Assemble system prompt from all four layers

### Phase 2: Learning (Per Conversation)
1. Agent converses; responses/decisions recorded in transcript
2. LLM extracts facts/decisions/preferences in background
3. Embeddings generated via pgvector
4. Stored in memory table with hybrid indexes (BM25 + cosine)

### Phase 3: Recall (Next Conversation)
1. User asks question
2. Agent searches memory with: `memory_search("query")`
3. Hybrid search returns top-K results (BM25 + semantic ranked)
4. Results injected into new conversation context
5. Agent reasons over retrieved facts

### To "Train" an Agent:
1. **Add domain knowledge:** Write/update SKILL.md in workspace/skills/
2. **Add identity:** Update SOUL.md, IDENTITY.md, BOOTSTRAP.md
3. **Add learned facts:** Agents auto-extract to memory; OR manually add .md files to `memory/` directory
4. **Add user context:** Write to USER.md or USER_PREDEFINED.md
5. **No restart needed** — all changes reflected on next agent run (except skill bin dependencies, which require restart)

---

## 8. Key Questions: Answered

| Question | Answer |
|----------|--------|
| **Does GoClaw read agent_context_files automatically?** | Yes. SOUL.md, IDENTITY.md, AGENTS.md, BOOTSTRAP.md are auto-injected if present in workspace. No explicit registration needed. |
| **Is frontmatter the only way to inject persistent knowledge?** | No. Frontmatter controls skill *discovery*. Context files control *identity*. Memory search preserves *learned facts*. All three work together. |
| **Is there a "memory save" or "knowledge ingest" API?** | No explicit API. Ingestion is automatic: agent conversations auto-extract + background embedding, and you can manually add .md files to `memory/` directory. |
| **How does memory_search work?** | Hybrid: BM25 (keyword) + pgvector (semantic cosine) + recency weighting. Results ranked and returned to agent context. |
| **What populates memory_search?** | Agent transcripts (auto-extracted) + memory/*.md files (auto-indexed) + MEMORY.md (auto-indexed). No separate training needed. |
| **Can we use workspace/ws/system/ for context?** | No. Workspace root IS the system directory. Use `SOUL.md`, `IDENTITY.md`, etc. directly in workspace root. |

---

## 9. Architectural Trade-offs & Adoption Notes

### Strengths
- **Automatic context injection** — No config needed; presence = activation
- **Hybrid memory search** — Combines semantic (understanding) + keyword (precision)
- **Low operational overhead** — No explicit API calls for memory ingestion
- **Hot-reload support** — Changes to files reflected on next run (no restart for most changes)
- **Scales gracefully** — Agents >15 switch from full AGENTS.md injection to search-based discovery

### Limitations
- **Context window still finite** — Even with auto-compaction, large agent teams need memory search
- **Memory extraction timing** — Configurable handoff can cause duplication; requires tuning for large-scale systems
- **No explicit "version control" for learned facts** — Memory graph extraction is LLM-driven; quality depends on extraction quality
- **Frontmatter changes require skill reindex** — Binary requirement changes need GoClaw restart

### Adoption Risk: LOW
- GoClaw is production-ready (Go binary, PostgreSQL backend, security hardened)
- Markdown-based context files are human-editable and version-controllable
- Skill discovery is deterministic (automatic + logged)
- Memory search degradation is graceful (falls back to keyword if vector unavailable)

---

## 10. Practical Implementation Path for Rebalance Bot

### Use Case: Custom GoClaw Skills for Portfolio Agent
1. **Create workspace structure:**
   ```
   workspace/
   ├── SOUL.md              → Agent personality (portfolio strategist)
   ├── IDENTITY.md          → Agent facts (crypto bot, backtesting capability)
   ├── BOOTSTRAP.md         → System architecture (from goclaw-skills/system-overview/SKILL.md)
   ├── skills/
   │   ├── portfolio-monitor/SKILL.md
   │   ├── backtest-analyzer/SKILL.md
   │   ├── allocation-advisor/SKILL.md
   │   └── ...
   └── memory/
       ├── strategy-decisions.md    → Store past allocation decisions
       ├── market-learnings.md      → Market patterns observed
       └── risk-incidents.md        → Past issues & mitigations
   ```

2. **Skill frontmatter example** (portfolio-monitor):
   ```yaml
   ---
   name: portfolio_monitor
   description: Monitor drift, trend state, cash reserve
   metadata:
     goclaw:
       emoji: 📊
       requires:
         bins: [mcporter]    # Requires this binary in PATH
   ---
   # Body: Instructions, examples, MCP tool descriptions
   ```

3. **Memory ingestion:** Let agents auto-extract learnings; OR manually add decision logs to `memory/strategy-decisions.md`.

4. **Search example:** `memory_search("What allocations worked best in bear markets?")` → hybrid search returns relevant decisions + metadata.

---

## Unresolved Questions

1. **Extraction quality metrics** — How is LLM-driven memory extraction validated? No metrics/dashboard mentioned for extraction accuracy.
2. **Memory conflict resolution** — If agent-extracted fact conflicts with manually-added MEMORY.md entry, which wins?
3. **Vector embedding model** — Which embedding model does pgvector use by default? (Likely OpenAI or Anthropic, but not explicitly stated.)
4. **Skill search precedence** — If two skills have overlapping capability, which is preferred? (Workspace priority mentioned, but tiebreaker unclear.)
5. **Performance at scale** — Hybrid search latency with 100K+ memory entries? Benchmarks not found.

---

## Sources

- [GitHub - nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw)
- [GoClaw Documentation: Core Concepts](https://goclaw.org/docs/concepts/)
- [GoClaw Documentation: About GoClaw](https://goclaw.org/docs/readme/)
- [GoClaw Docs — Enterprise AI Agent Platform](https://docs.goclaw.sh/docs/)
- [Memory - OpenClaw](https://docs.openclaw.ai/concepts/memory)
- [Agent Workspace - OpenClaw](https://docs.openclaw.ai/concepts/agent-workspace)
- [GoClaw Research Report (Prior, 2026-03-29)](../researcher-260329-1012-goclaw-research.md)
