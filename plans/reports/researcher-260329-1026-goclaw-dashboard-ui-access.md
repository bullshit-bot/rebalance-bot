# GoClaw Dashboard/UI Access - Technical Research

## Executive Summary

The GoClaw dashboard is a **separate service** from the main binary, built as a React SPA served via Nginx. It's accessed at `http://localhost:3000` (configurable) and is deployed via the `docker-compose.selfservice.yml` overlay file.

---

## Key Findings

### 1. Dashboard Architecture

| Component | Details |
|-----------|---------|
| **Type** | Separate service (not built into main binary) |
| **Framework** | React SPA (Single Page Application) |
| **Build Tool** | Vite (TypeScript) |
| **Server** | Nginx 1.27-alpine |
| **Service Name** | `goclaw-ui` |

### 2. Access Details

| Item | Value |
|------|-------|
| **URL** | `http://localhost:3000` (default) |
| **Port (External)** | Configurable via `${GOCLAW_UI_PORT:-3000}` |
| **Port (Container)** | 80 (Nginx internal) |
| **Protocol** | HTTP |

### 3. Docker Configuration

**Service:** `goclaw-ui` (defined in `docker-compose.selfservice.yml`)

```yaml
goclaw-ui:
  image: ghcr.io/nextlevelbuilder/goclaw-web:latest
  ports:
    - "${GOCLAW_UI_PORT:-3000}:80"
  depends_on:
    - goclaw
  networks:
    - goclaw-net
  restart: unless-stopped
  build:
    context: ./ui/web
    dockerfile: Dockerfile
```

### 4. Nginx Configuration

**Listening:** Port 80 inside container

**Key Features:**
- Serves React SPA from `/usr/share/nginx/html`
- SPA routing fallback: `try_files $uri $uri/ /index.html`
- API proxying: `/v1/*` routes to `goclaw:18790` backend
- WebSocket proxying: `/ws` to backend
- Gzip compression enabled
- Asset caching: `/assets/` with 1-year expiration

**Proxy Backend:**
- Backend service: `goclaw` (main binary)
- Backend port: `18790`
- DNS resolver: Docker internal DNS

### 5. Build Process

**Two-Stage Dockerfile:**

1. **Build Stage** (node:22-alpine)
   - Package manager: pnpm 10.28.2
   - Install: `pnpm install --frozen-lockfile`
   - Build: `pnpm build`

2. **Runtime Stage** (nginx:1.27-alpine)
   - Copy assets to `/usr/share/nginx/html`
   - Use custom nginx.conf
   - Expose port 80

### 6. Environment Variables

**Configuration Location:** `ui/web/.env.example`

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_BACKEND_HOST` | `localhost` | Backend hostname |
| `VITE_BACKEND_PORT` | `18790` | Backend port |
| `VITE_WS_URL` | `ws://localhost:18790/ws` | WebSocket endpoint |
| `GOCLAW_UI_PORT` | `3000` | Exposed UI port (docker-compose only) |

### 7. File Structure

```
ui/
├── web/
│   ├── src/                 # React source code
│   ├── public/              # Static assets
│   ├── package.json         # Dependencies
│   ├── vite.config.ts       # Build config
│   ├── tsconfig.json        # TypeScript config
│   ├── components.json      # Component library (shadcn/ui)
│   ├── Dockerfile           # Multi-stage build
│   ├── nginx.conf           # Nginx server config
│   ├── .env.example         # Env vars template
│   ├── pnpm-lock.yaml       # Dependency lock
│   ├── index.html           # Entry point
│   └── .dockerignore        # Build exclusions
├── desktop/                 # Desktop app (separate)
```

### 8. Deployment Requirements

**Overlay Compose Files:**
- `docker-compose.selfservice.yml` — UI service + pre-built images
- `docker-compose.yml` — Base goclaw service
- `docker-compose.postgres.yml` — Database (optional)
- `docker-compose.otel.yml` — Observability (optional)

**Typical Stack:**
```bash
docker-compose -f docker-compose.yml \
               -f docker-compose.selfservice.yml \
               -f docker-compose.postgres.yml \
               up
```

### 9. Health & Monitoring

**Container Health Check:**
- Endpoint: `http://127.0.0.1:80/`
- Interval: 30 seconds
- Timeout: 5 seconds

**Service Dependencies:**
- `goclaw-ui` depends on `goclaw` service
- Restart policy: `unless-stopped`

---

## Technical Details for Integration

### Connection Flow

1. Browser → `http://localhost:3000` (Nginx)
2. Nginx serves React SPA from `/usr/share/nginx/html`
3. React app initializes with env vars:
   - Backend: `localhost:18790`
   - WebSocket: `ws://localhost:18790/ws`
4. Nginx proxies API calls:
   - `/v1/*` → `goclaw:18790/v1/*`
   - `/ws` → `goclaw:18790/ws`

### Customization Points

- Change port: Set `GOCLAW_UI_PORT=8080` before docker-compose up
- Change backend: Modify `VITE_BACKEND_HOST` and `VITE_BACKEND_PORT` in `.env`
- Change routes: Edit nginx.conf in `ui/web/`
- Add features: Modify React code in `ui/web/src/`

---

## Comparison: Desktop vs Web

| Aspect | Web (goclaw-ui) | Desktop (GoClaw Lite) |
|--------|-----------------|----------------------|
| **Tech Stack** | React + Vite + Nginx | Native app |
| **Database** | PostgreSQL (external) | SQLite (embedded) |
| **Port** | 3000 (HTTP) | N/A (local) |
| **Docker Required** | Yes | No |
| **Setup Complexity** | Medium | Low |
| **Real-time Features** | WebSocket | Built-in |

---

## Summary

The GoClaw dashboard is:
- ✅ **Separate service** (not embedded in goclaw binary)
- ✅ **React SPA** built with Vite, served via Nginx
- ✅ **Accessed at** `http://localhost:3000` (default)
- ✅ **Configured via** `docker-compose.selfservice.yml` overlay
- ✅ **Port mapping:** `${GOCLAW_UI_PORT:-3000}:80` (container)
- ✅ **Environment vars:** Backend host/port/WebSocket URL
- ✅ **Integrated via Nginx proxying** to backend at `goclaw:18790`

---

## Unresolved Questions

None — all requested information has been located and verified from official source files.

---

## Sources

- `docker-compose.selfservice.yml` — UI service definition
- `ui/web/Dockerfile` — Build configuration
- `ui/web/nginx.conf` — Server routing
- `ui/web/.env.example` — Environment variables
- GitHub repository: `nextlevelbuilder/goclaw`
- Official docs: docs.goclaw.sh
