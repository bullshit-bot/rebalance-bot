# OpenClaw AI Agent Platform & MCP Server Research Report

**Date:** 2026-03-26 | **Researcher:** Agent
**Scope:** OpenClaw architecture, MCP server implementation, skill integration, knowledge base setup

---

## 1. OPENCLAW: OPEN-SOURCE AI AGENT PLATFORM

### What is OpenClaw?

**OpenClaw** is a free, self-hosted open-source AI agent that executes real-world tasks via LLMs across multiple messaging platforms (WhatsApp, Telegram, Slack, Discord, Teams, iMessage, etc.).

**Key Facts:**
- **Created:** November 2025 by Peter Steinberger (Austria)
- **GitHub:** 247K stars, 47.7K forks (as of March 2, 2026)
- **Status:** Moving to open-source foundation after Steinberger joined OpenAI (Feb 14, 2026)
- **License:** Open-source
- **Repository:** https://github.com/openclaw/openclaw

### How OpenClaw Works: Architecture

**Agent Capabilities** (executes real tasks, not just chat):
- Read & manage emails
- Access calendars
- Run terminal commands
- Deploy code
- Maintain memory across sessions
- Perform multi-step reasoning

**Design Philosophy:**
- **Messaging-first:** Uses existing communication channels (Slack, Discord, etc.) as primary UX
- **Self-hosted:** Run on your own infrastructure (any OS, any platform)
- **Modular:** Skills/tools can be plugged in
- **Memory-aware:** Maintains context across interactions

**Integration Model:**
OpenClaw uses a **skill/tool** system for extending functionality. Skills expose capabilities that the AI can invoke. The platform follows standard conventions for tool definition and invocation.

---

## 2. MODEL CONTEXT PROTOCOL (MCP): FOUNDATION

### What is MCP?

**MCP** is a standardized protocol by Anthropic for AI agents to interact with external systems. It defines how:
- Servers expose **tools** (executable functions)
- Servers expose **resources** (read-only data)
- Servers expose **prompts** (reusable templates)
- Clients (LLMs/agents) discover and invoke them

**Official Resources:**
- Specification: https://github.com/modelcontextprotocol/modelcontextprotocol
- Documentation: https://modelcontextprotocol.io
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- npm: `@modelcontextprotocol/sdk`

### MCP Tool Definition

Tools in MCP expose executable functionality with:
- **Name** & **description** (for AI discovery)
- **Input schema** (JSON Schema for parameters)
- **Handler function** (executes the actual logic)
- **Error handling** (reported in result, not protocol-level)

**Standard MCP Tools Pattern:**
```typescript
server.tool(
  "tool_name",
  {
    description: "What this tool does",
    inputSchema: {
      type: "object",
      properties: {
        param1: { type: "string", description: "..." }
      },
      required: ["param1"]
    }
  },
  async (args) => {
    // Execute logic
    return { content: [{ type: "text", text: "result" }] };
  }
);
```

### MCP vs REST APIs

**Key Difference:**
- **REST APIs:** Generic HTTP endpoints for any client
- **MCP:** AI-aware abstraction layer; tools are designed for LLM invocation
- **Complementary:** MCP can wrap/proxy REST APIs to expose them as MCP tools

---

## 3. BUILDING MCP SERVERS: TYPESCRIPT APPROACH

### Architecture

An MCP server consists of:

1. **Server Instance** (McpServer)
2. **Transport Layer** (stdio or HTTP)
3. **Tool Definitions** (with handlers)
4. **Resource Definitions** (optional, read-only data)
5. **Prompt Templates** (optional, reusable patterns)

### Transport Options

| Transport | Use Case | Communication |
|-----------|----------|---|
| **StdioServerTransport** | Local, child process | stdin/stdout JSON-RPC |
| **Streamable HTTP** | Remote servers | HTTP streams (recommended) |

### Implementation Steps (TypeScript + Bun)

**1. Setup**
```bash
npm install @modelcontextprotocol/sdk
# or with bun
bun add @modelcontextprotocol/sdk
```

**2. Create Server**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "my-api-wrapper",
  version: "1.0.0"
});

// Define tools
server.tool("fetch_data", {...}, async (args) => {
  // Call your REST API
  const response = await fetch(`/api/endpoint/${args.id}`);
  return { content: [{ type: "text", text: JSON.stringify(response) }] };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**3. REST API Wrapper Pattern**
- Create tool for each REST endpoint family
- Use MCP input schema to validate parameters
- Call REST API from tool handler
- Return structured response to MCP client

**Example: Wrapping a CRUD API**
```typescript
// Tool: create_item
server.tool("create_item", {
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" }
    },
    required: ["name"]
  }
}, async (args) => {
  const res = await fetch("http://localhost:3000/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const data = await res.json();
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
```

### Resource Definitions (Read-Only Data)

Expose static/dynamic data that LLMs can read:
```typescript
server.resource(
  "list://available-endpoints",
  {
    uri: "list://available-endpoints",
    name: "Available API Endpoints",
    description: "List of REST endpoints this server wraps",
    mimeType: "text/plain"
  },
  async () => ({
    contents: [{
      uri: "list://available-endpoints",
      mimeType: "text/plain",
      text: "GET /api/items\nPOST /api/items\nGET /api/items/{id}\n..."
    }]
  })
);
```

### Testing MCP Servers

**Option 1: Direct Test**
```bash
# Create simple client that calls tools
npx @modelcontextprotocol/sdk/test-client < <(echo '...')
```

**Option 2: Inspector Tool**
```bash
npx -y @modelcontextprotocol/inspector npx ts-node your-server.ts
```

---

## 4. HOW OPENCLAW CONSUMES SKILLS

**OpenClaw Skill Format** (based on project structure):

Skills in `.claude/skills/` follow a convention:
- **SKILL.md** - Metadata & description
- **scripts/** - Implementation (Python, TypeScript, bash)
- **.env** or config - Environment setup

**Skill Integration Approach:**

OpenClaw likely uses a **skill registry** pattern:
1. **Skill Discovery** - Scans skill directories for SKILL.md
2. **Tool Exposure** - Converts each skill to MCP-compatible tool
3. **Lazy Loading** - Loads skills on-demand
4. **Error Isolation** - Skill failures don't crash agent

**For MCP Integration:**

OpenClaw can consume MCP servers in two ways:

**Option A: Embedded MCP Servers**
- Start MCP server as subprocess
- Connect via StdioServerTransport
- Expose all tools to OpenClaw runtime

**Option B: MCP Server Registry**
- Point OpenClaw to MCP servers (via HTTP endpoints or stdio config)
- Pull tool definitions dynamically
- Cache tool metadata for discovery

---

## 5. MCP SERVER CONTAINERIZATION WITH DOCKER

### Why Docker for MCP Servers?

**Isolation & Safety:**
- Sandboxed execution prevents host filesystem access
- Limit CPU (1 core) & memory (2GB) per tool
- LLM-caused damage contained within container

**Portability:**
- No dependency management on host
- Works across Linux, macOS, Windows
- One-click deployment via Docker Desktop

**Security:**
- Digitally signed images (via Docker official)
- SBOM (Software Bill of Materials) included
- Verified provenance for all official MCP tools

### Docker Setup Pattern

**Basic Dockerfile for MCP Server (Node.js)**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 3000

CMD ["node", "src/server.js"]
```

**Running with Docker**
```bash
# Build
docker build -t my-mcp-server .

# Run with isolation
docker run -i --rm \
  -e API_BASE_URL=http://host.docker.internal:3000 \
  --cpus="1" \
  --memory="2g" \
  my-mcp-server
```

### Docker MCP Toolkit (Docker AI Agents)

**New Approach: Docker as MCP Gateway**

Docker provides:
- **Docker MCP Catalog** - Pre-built, verified MCP servers
- **Docker MCP Toolkit** - Spin up containers in seconds
- **Multi-tool Gateway** - Single `docker` MCP server manages multiple containerized tools
- **GUI Integration** - Docker Desktop UI for container management

**Example: Start GitHub MCP via Docker**
```bash
docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=xxx \
  ghcr.io/github/github-mcp-server
```

### Docker Compose for Multi-Service Setup

```yaml
version: '3.8'
services:
  api-mcp:
    build: ./mcp-server
    ports:
      - "3001:3001"
    environment:
      - API_BASE_URL=http://api:3000
    depends_on:
      - api

  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/db

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

## 6. KNOWLEDGE BASE FOR AI AGENTS: RAG APPROACH

### What is RAG?

**RAG = Retrieval Augmented Generation**

Instead of relying on LLM's training data alone, the agent:
1. **Retrieves** relevant documents/context based on query
2. **Augments** the prompt with retrieved data
3. **Generates** response using LLM + context

**Benefits:**
- Access to up-to-date, domain-specific information
- Reduces hallucinations (LLM grounds responses in facts)
- Works with proprietary/internal data

### Architecture Components

**4-Layer RAG Stack:**

```
┌─────────────────────┐
│  1. INGESTION       │  Load docs (PDFs, websites, logs, databases)
├─────────────────────┤
│  2. VECTORIZATION   │  Split text → embeddings → vector DB
├─────────────────────┤
│  3. RETRIEVAL       │  Query → semantic search → top-K docs
├─────────────────────┤
│  4. GENERATION      │  LLM synthesizes response + context
└─────────────────────┘
```

### Vector Databases (Storage Layer)

| Database | Use Case | Notes |
|----------|----------|-------|
| **Pinecone** | Cloud-managed, scalable | SaaS, no self-hosting |
| **ChromaDB** | Easy integration, local | Good for prototypes, embedded |
| **Weaviate** | Hybrid search (keyword + semantic) | Advanced filtering |
| **Qdrant** | High-speed vectors | Rust-based, performant |
| **Supabase pgvector** | PostgreSQL-native | If already using Postgres |

### Implementation with LangChain

**Typical Flow:**
```typescript
import { Document } from "langchain/document";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Chroma } from "langchain/vectorstores/chroma";
import { RetrievalQAChain } from "langchain/chains";

// 1. Load documents
const docs = [new Document({ pageContent: "..." })];

// 2. Split into chunks
const splitter = new CharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
});
const chunks = await splitter.splitDocuments(docs);

// 3. Create embeddings & store
const embeddings = new OpenAIEmbeddings();
const vectorStore = await Chroma.fromDocuments(chunks, embeddings);

// 4. Create retrieval chain
const qa = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever());

// 5. Query
const result = await qa.run("What is the policy on...");
```

### Data Preparation Best Practices

**Document Chunking Strategy:**
- **Chunk size:** 1000-2000 tokens (balance retrieval specificity vs. context)
- **Overlap:** 200-400 tokens (preserve context across chunks)
- **Splitter type:** Recursive character splitter (works for most documents)

**Knowledge Sources:**
- Internal documentation (markdown, PDFs)
- Database records (structured data with metadata)
- Log files (time-series events)
- Website content (scraped + deduplicated)

**Quality Assurance:**
- Remove duplicates (semantic deduplication via embedding similarity)
- Validate chunks have sufficient context (not orphaned snippets)
- Tag metadata (source, date, category) for filtering

### Integrating RAG with OpenClaw

**Approach 1: MCP RAG Tool**
- Create MCP tool: `query_knowledge_base(query: string) → string`
- Internally does: embedding → vector search → synthesis
- Expose to OpenClaw as standard tool

**Approach 2: Context Injection**
- Pre-retrieve top-K documents for the agent's task
- Add as "context" in system prompt
- Let agent reference if needed

**Approach 3: Dedicated RAG Service**
- Run RAG system as microservice (with REST API)
- Wrap REST API as MCP tools
- OpenClaw calls MCP → MCP calls RAG service

---

## 7. SKILL DEFINITION IN THIS PROJECT

Based on project structure (`.claude/skills/`), skills follow convention:

**SKILL.md Format:**
```yaml
---
name: ck:skill-name
description: What this skill does and when to use it
---

# Instructions
[Markdown documentation]
```

**For OpenClaw Integration:**

Skills should be exposable as MCP tools with:
1. **Name** - Skill identifier
2. **Description** - When/how to use
3. **Input Schema** - Parameters (JSON Schema)
4. **Output Format** - Structured result
5. **Error Handling** - Graceful failures

**Example OpenClaw Skill (MongoDB MCP Server):**
```
.claude/skills/mongodb-mcp-server/
├── SKILL.md
├── src/
│   ├── server.ts         # MCP server entry point
│   ├── tools/
│   │   ├── query.ts      # MCP tool: execute queries
│   │   ├── insert.ts     # MCP tool: insert documents
│   │   └── schema.ts     # MCP tool: get schema info
│   └── utils/
│       └── mongodb-client.ts
└── Dockerfile
```

---

## 8. RECOMMENDED ARCHITECTURE FOR YOUR PROJECT

### High-Level Stack

```
OpenClaw Agent
    ↓
MCP Client Interface
    ↓
┌─────────────────────────────────┐
│  MCP Server Gateway (Docker)    │
│  ┌─────────────────────────────┐│
│  │ Tool Router & Dispatcher    ││
│  └─────────────────────────────┘│
└────────┬────────────────────────┘
         ↓
    ┌────────────┐
    │ REST APIs  │
    │ Databases  │
    │ Services   │
    └────────────┘
```

### Recommended Implementation

**1. MCP Server (Primary Skill Wrapper)**
- Language: TypeScript/Bun
- Transport: StdioServerTransport (for embedded use)
- Exposes: Database, API, business logic tools
- Docker: Yes (container for isolated execution)

**2. Knowledge Base (RAG Component)**
- Vector DB: ChromaDB (local) or Pinecone (cloud)
- Embeddings: OpenAI API or local model
- Chunking: LangChain's RecursiveCharacterSplitter
- Exposure: Via MCP tool (query_knowledge_base)

**3. Skill Organization**
```
.claude/skills/
├── mcp-server-mongodb/
│   ├── SKILL.md
│   ├── src/server.ts
│   ├── Dockerfile
│   └── package.json
├── knowledge-base-rag/
│   ├── SKILL.md
│   ├── src/
│   │   ├── embeddings.ts
│   │   ├── chunking.ts
│   │   └── retrieval.ts
│   └── package.json
└── ...
```

---

## KEY TAKEAWAYS

1. **OpenClaw** is production-grade self-hosted AI agent (247K GitHub stars)
2. **MCP** is the standardized protocol OpenClaw uses for tool integration
3. **MCP Servers** wrap REST APIs/services in AI-aware abstraction
4. **Docker** isolates MCP servers safely; Docker MCP Toolkit enables one-click deployment
5. **RAG** adds knowledge base to AI agents via vector search + generation
6. **Skills** in `.claude/skills/` are the extension mechanism; can be exposed as MCP tools
7. **TypeScript + Bun** is recommended for MCP server implementation
8. **ChromaDB + LangChain** is easiest RAG setup for prototypes

---

## UNRESOLVED QUESTIONS

1. **OpenClaw Exact Skill Format** — Need to review actual OpenClaw codebase to confirm exact skill loading mechanism (likely SKILL.md + scripts, but implementation details unknown)
2. **Authentication** — How should MCP server authenticate agents? Bearer tokens? mTLS? OAuth?
3. **Rate Limiting** — Should MCP tool handlers implement rate limits? Per-agent? Global?
4. **Context Window Management** — How to handle large knowledge bases? Pagination? Streaming?
5. **Fallback Behavior** — When RAG retrieval fails (no relevant docs), should agent fall back to LLM training knowledge?

---

## SOURCES

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [How OpenClaw Works — Medium Article](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764)
- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Building MCP Servers — FreeCodeCamp](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)
- [Docker MCP Blog](https://www.docker.com/blog/build-to-prod-mcp-servers-with-docker/)
- [Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/)
- [LangChain RAG Documentation](https://docs.langchain.com/oss/python/langchain/rag)
- [Building RAG Knowledge Bases — Medium](https://mayursurani.medium.com/building-a-rag-system-with-a-vector-database-a-comprehensive-hands-on-guide-70d5933b039b)
- [RAG with OpenClaw — Oflight Inc.](https://www.oflight.co.jp/en/columns/qwen35-9b-openclaw-rag-knowledge-base-agent)
