---
title: "Docker Infrastructure"
status: completed
priority: P1
---

## Overview

Set up 4-service Docker Compose: frontend (nginx+static), backend (Bun), MongoDB, OpenClaw. Replace host nginx/systemd deployment.

## Context Links

- [Docker Research Report](../reports/researcher-260326-1512-docker-multi-service.md)
- Current Dockerfile: `Dockerfile`
- Current compose: `docker-compose.yml`

## Requirements

**Functional:**
- nginx serves frontend static + proxies `/api` and `/ws` to backend
- Backend connects to MongoDB via internal DNS
- MongoDB data persists via named volume
- OpenClaw accesses backend via `http://backend:3001`
- Health checks on all services with `service_healthy` dependencies

**Non-functional:**
- Resource limits (memory) on all services
- Log rotation on all services
- Non-root users where possible

## Architecture

```
Host :80 → nginx container
  ├── / → static frontend files (multi-stage built into nginx image)
  ├── /api → proxy_pass http://backend:3001
  └── /ws → proxy_pass http://backend:3001 (WebSocket upgrade)

backend:3001 → mongodb:27017 (internal network)
openclaw → http://backend:3001 (internal network)
```

## Related Code Files

**Modify:**
- `Dockerfile` — update for MongoDB connection (remove SQLite data dir)
- `docker-compose.yml` — full rewrite (4 services)

**Create:**
- `frontend/Dockerfile` — multi-stage: build React + serve via nginx
- `frontend/nginx.conf` — nginx config for frontend+proxy
- `.env.example` — update with MongoDB vars

**Delete (Phase 6):**
- None in this phase

## Implementation Steps

1. Create `frontend/Dockerfile`
   - Stage 1: `oven/bun:1` — install deps + build frontend (`VITE_API_URL=/api bun run build`)
   - Stage 2: `nginx:alpine` — copy `dist/` to `/usr/share/nginx/html`, copy nginx.conf

2. Create `frontend/nginx.conf`
   - Serve `/` from static files with SPA fallback (`try_files $uri /index.html`)
   - Proxy `/api` to `http://backend:3001`
   - Proxy `/ws` to `http://backend:3001` with WebSocket upgrade headers

3. Update `Dockerfile` (backend)
   - Remove `mkdir data` and SQLite data dir setup
   - Keep multi-stage Bun build
   - Remove health check (compose handles it)
   - Install `curl` in slim image for health check

4. Rewrite `docker-compose.yml`
   ```yaml
   services:
     frontend:
       build: ./frontend
       ports: ["80:80"]
       depends_on:
         backend: { condition: service_healthy }
       # ... health check, logging, resources

     backend:
       build: .
       env_file: .env
       depends_on:
         mongodb: { condition: service_healthy }
       # ... health check, logging, resources
       # No port exposure (nginx proxies)

     mongodb:
       image: mongo:7
       environment:
         MONGO_INITDB_ROOT_USERNAME: admin
         MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
       volumes:
         - mongodb_data:/data/db
       # ... health check

     openclaw:
       build: ./openclaw-skills
       environment:
         BACKEND_API_URL: http://backend:3001
       depends_on:
         backend: { condition: service_healthy }
       profiles: [full]  # optional, only when needed

   networks:
     app-network:
       driver: bridge

   volumes:
     mongodb_data:
   ```

5. Update `.env.example`
   - Add `MONGO_PASSWORD`, `MONGODB_URI`
   - Remove `DATABASE_URL`, `DATABASE_AUTH_TOKEN`

## Todo List

- [x] Create `frontend/Dockerfile` (multi-stage: build + nginx)
- [x] Create `frontend/nginx.conf` (static + proxy + WebSocket)
- [x] Update backend `Dockerfile` (remove SQLite, add curl)
- [x] Rewrite `docker-compose.yml` (4 services)
- [x] Update `.env.example` with MongoDB variables
- [x] Test `docker compose build` succeeds
- [x] Test `docker compose up` — all services healthy
- [x] Test frontend accessible at `http://localhost`
- [x] Test `/api/health` proxied correctly
- [x] Test WebSocket connection via `/ws`

## Success Criteria

- [x] `docker compose up -d` starts all 4 services
- [x] `docker compose ps` shows all services healthy
- [x] Frontend loads at `http://localhost`
- [x] API responds at `http://localhost/api/health`
- [x] WebSocket connects at `ws://localhost/ws`
- [x] MongoDB data persists across `docker compose down && docker compose up`
- [x] No ports exposed except 80 (and 27017 for dev debugging)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| nginx config errors | Frontend unreachable | Test with `nginx -t` in container |
| MongoDB connection timeout | Backend crash loop | Health check with `service_healthy` ensures order |
| OpenClaw not ready | Non-blocking | Use `profiles: [full]` — optional service |
| Port conflicts on VPS | Deploy fails | Document port requirements |

## Security Considerations

- MongoDB credentials via env vars, never hardcoded
- Non-root user in backend container
- Internal network — only nginx exposes port 80
- No MongoDB port exposed in production compose
