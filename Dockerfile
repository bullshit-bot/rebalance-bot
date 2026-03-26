# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build src/index.ts --outdir dist --target bun

# Stage 3: Production runtime
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Install curl for Docker health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 botgroup && \
    adduser --system --uid 1001 --ingroup botgroup botuser

# Copy built output and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER botuser

EXPOSE 3001

CMD ["bun", "run", "dist/index.js"]
