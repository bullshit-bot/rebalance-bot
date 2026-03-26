---
name: Docker Compose Multi-Service Architecture Research
description: Best practices and architecture recommendation for frontend, backend, MongoDB, and OpenClaw services
type: research
date: 2026-03-26
---

# Docker Compose Multi-Service Best Practices

## Executive Summary

**Recommended Architecture:** Separate nginx container as reverse proxy (not bundled with frontend). Frontend runs as static build in its own container, nginx proxies both frontend assets and backend API calls. MongoDB with named volume for persistence. Services communicate via Docker's user-defined bridge network.

---

## Architecture Decision: Frontend + Nginx

**Recommendation: Separate nginx container**

**Why:** Separation of concerns. Frontend (build artifact) and proxy (request routing) serve different purposes. Nginx can be updated independently, scale separately if needed, and is standard industry practice.

**Pattern:**
```
┌─────────────────────────────────────────────┐
│ nginx:latest (port 80/443)                  │
│ - Serves static frontend (/)                │
│ - Proxies /api to backend                   │
│ - Serves assets efficiently                 │
└─────────────────────────────────────────────┘
        ↓                           ↓
┌──────────────────┐    ┌──────────────────────┐
│ frontend:build   │    │ backend:3001         │
│ (static files)   │    │ (Bun + Hono)         │
└──────────────────┘    └──────────────────────┘
        ↓                           ↓
   (pre-built)          ┌──────────────────────┐
                        │ mongodb:8            │
                        │ (port 27017)         │
                        └──────────────────────┘
```

---

## Docker Compose v2 Best Practices (2026)

1. **Omit `version` field** — Docker Compose v2+ uses versioning automatically. The version field is legacy.
2. **Use profiles** — Group services logically (e.g., `profile: dev`, `profile: prod`) to run only what you need.
3. **Single docker-compose.yml** — Use `docker-compose.override.yml` only for dev/local overrides, not separate files.
4. **Leverage BuildKit** — Compose v2 delegates to Docker Bake for better caching and multi-platform builds.

---

## Service-by-Service Configuration

### Frontend Service
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  # No exposed ports — served through nginx
  volumes:
    - ./frontend/dist:/app/dist  # For dev hot reload (optional)
  depends_on:
    backend:
      condition: service_healthy
```

- Build Vite app → generates `/dist` folder
- Nginx serves this folder as root (/)
- No port exposure needed (nginx handles requests)

### Nginx Reverse Proxy
```yaml
nginx:
  image: nginx:latest
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - ./certs:/etc/nginx/certs:ro  # For HTTPS
  depends_on:
    - backend
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/health"]
    interval: 10s
    timeout: 5s
    retries: 3
```

**Nginx Configuration Example:**
```nginx
server {
    listen 80;
    server_name _;

    # Frontend static files
    location / {
        root /app/frontend/dist;
        try_files $uri $uri/ /index.html;  # SPA routing
    }

    # Backend API proxy
    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backend (Bun + Hono)
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  environment:
    - MONGODB_URI=mongodb://mongo:27017/rebalance
    - NODE_ENV=development
  depends_on:
    mongodb:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 10s
    timeout: 5s
    retries: 3
  # No port exposed to host (nginx proxies it)
  networks:
    - app-network
```

### MongoDB
```yaml
mongodb:
  image: mongo:8
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
  ports:
    - "27017:27017"  # Only expose for dev/debugging
  volumes:
    - mongodb_data:/data/db
    - mongodb_config:/data/configdb
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 3
  networks:
    - app-network
```

**Key:** Health check uses `mongosh` (modern MongoDB shell). Use named volume `mongodb_data` for persistence.

### OpenClaw (AI Agent Service)
```yaml
openclaw:
  build:
    context: ./openclaw
    dockerfile: Dockerfile
  environment:
    - BACKEND_API_URL=http://backend:3001
  depends_on:
    backend:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
  networks:
    - app-network
```

**Important:** OpenClaw calls backend via internal DNS name (`http://backend:3001`), not exposed ports.

---

## Docker Networking

**Best Practice: User-Defined Bridge Network**

```yaml
networks:
  app-network:
    driver: bridge
```

**Why:** Enables DNS-based service discovery. Services reference each other by container name:
- `backend` resolves to backend container's IP
- `mongodb` resolves to MongoDB container's IP
- Isolated from default bridge (more secure)

All services on same network can communicate without port exposure.

---

## Volume Management

```yaml
volumes:
  mongodb_data:
    driver: local
  mongodb_config:
    driver: local
```

**Key Points:**
- Named volumes persist data across container restarts
- Data survives `docker-compose down`
- Use `docker volume rm` only to explicitly delete
- For development: bind mount (`./data:/data/db`) if you need file-system access

---

## Environment Variables & Secrets

**Development (.env file):**
```env
MONGO_PASSWORD=dev-password-123
VITE_API_URL=http://localhost/api
BACKEND_LOG_LEVEL=debug
```

**Production Secrets (Docker Secrets):**
```yaml
secrets:
  mongo_password:
    file: ./secrets/mongo_password.txt

services:
  mongodb:
    secrets:
      - mongo_password
    environment:
      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_password
```

**Critical:** Never hardcode secrets. Use `.env` for dev, Docker Secrets for production.

---

## Health Checks & Startup Ordering

**Pattern:**
```yaml
services:
  mongodb:
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 3

  backend:
    depends_on:
      mongodb:
        condition: service_healthy  # Waits for health check, not just container start
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  nginx:
    depends_on:
      backend:
        condition: service_healthy
```

**Key:** `condition: service_healthy` waits for the service to actually be ready, not just running. Without this, services can start before dependencies are operational.

---

## Production vs Development Patterns

**Development:**
- Bind mount code for hot reload: `volumes: ["./src:/app/src"]`
- Expose all ports for debugging
- Use `.env` with plaintext values
- No restart policy or resource limits

**Production:**
```yaml
services:
  backend:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

**In Production:**
- No bind mounts
- Images baked with code (no volumes)
- Restart policies enabled
- Resource limits enforced
- Centralized logging
- Secrets stored in secret manager (Vault, AWS Secrets Manager)
- No unnecessary ports exposed

---

## Complete docker-compose.yml Template

```yaml
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/app/frontend/dist:ro
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/rebalance?authSource=admin
      NODE_ENV: ${NODE_ENV:-development}
    depends_on:
      mongodb:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

  mongodb:
    image: mongo:8
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

  openclaw:
    build:
      context: ./openclaw
      dockerfile: Dockerfile
    environment:
      BACKEND_API_URL: http://backend:3001
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  mongodb_data:
  mongodb_config:
```

---

## Key Takeaways

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Frontend container | Separate, static build only | Nginx handles routing; clean separation |
| Nginx | Separate container, reverse proxy | Single entry point; proxy both frontend + API |
| MongoDB image | `mongo:8` (official) | Latest stable; supports `mongosh` health checks |
| Data persistence | Named volume `mongodb_data` | Survives container restarts; managed by Docker |
| Networking | User-defined bridge network | DNS resolution between services; isolated |
| Health checks | All services; `depends_on: condition: service_healthy` | Ensures actual readiness; prevents race conditions |
| Environment variables | `.env` for dev; Docker Secrets for prod | Secure secret management; no hardcoding |
| OpenClaw → Backend | `http://backend:3001` (internal DNS) | No port exposure needed; bridge network DNS resolution |

---

## Unresolved Questions

1. **OpenClaw service port:** What port does OpenClaw listen on? (Assumed 8000; adjust health check if different.)
2. **Frontend build artifact location:** Is Vite output at `./frontend/dist`? If different path, update nginx root directive.
3. **SSL/TLS in production:** Should nginx handle HTTPS? If yes, mount certs and add port 443 binding + server block.
4. **MongoDB authentication:** Should backend connection string include auth? Example: `mongodb://admin:password@mongodb:27017/rebalance?authSource=admin`
5. **Logging aggregation:** Any centralized logging requirement for production (ELK, Splunk, etc.)?

---

## Sources

- [Docker Compose: The Complete Guide for 2026 | DevToolbox Blog](https://devtoolbox.dedyn.io/blog/docker-compose-complete-guide)
- [Docker Compose | Docker Docs](https://docs.docker.com/compose/)
- [Configure nginx as a reverse proxy with Docker Compose | Medium](https://jonathanantoine.medium.com/configure-nginx-as-a-reverse-proxy-to-another-container-in-a-docker-compose-network-9c8f0c2865cd)
- [How to use Nginx with Docker Compose effectively | geshan.com.np](https://geshan.com.np/blog/2024/03/nginx-docker-compose/)
- [Docker Compose Health Checks: An Easy-to-follow Guide | Last9](https://last9.io/blog/docker-compose-health-checks/)
- [Docker Compose depends_on with Health Checks | OneUptime](https://oneuptime.com/blog/post/2026-01-16-docker-compose-depends-on-healthcheck/view)
- [MongoDB Docker Compose: Quick Setup Guide | Upgrad](https://www.upgrad.com/blog/how-to-use-mongodb-docker/)
- [Bridge network driver | Docker Docs](https://docs.docker.com/engine/network/drivers/bridge/)
- [Docker Networking Deep Dive | DEV Community](https://dev.to/caffinecoder54/docker-networking-deep-dive-understanding-bridge-host-and-overlay-networks-1kdc)
- [Secrets in Compose | Docker Docs](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Set environment variables | Docker Docs](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
