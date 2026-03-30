# Stage 1: Install dependencies (Bun for speed)
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile && bun add protobufjs

# Stage 2: Build (Bun bundler, target Node.js)
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build src/index.ts --outdir dist --target node

# Stage 3: Production runtime (Node.js for full WebSocket support)
FROM node:22-slim AS runner
WORKDIR /app

# Install curl for Docker health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --system --gid 1001 botgroup && \
    useradd --system --uid 1001 --gid botgroup --no-create-home botuser

# Copy built output and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER botuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
