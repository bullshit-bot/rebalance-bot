# Deployment Guide

**Last Updated**: 2026-03-29
**Version**: 1.0.1
**Project**: Crypto Rebalance Bot

## Overview

Docker Compose-based deployment for single VPS with optional AI features.

## Prerequisites

**Required**:
- Docker 24.0+ (with Compose v2.20+)
- 8GB RAM minimum (2.5GB with AI features)
- Linux VPS (Ubuntu 22.04+ recommended)
- 10GB disk space

**Not Required** (Docker handles):
- Bun runtime (in backend image)
- Node.js (frontend uses Vite)
- systemd or PM2

## Quick Start

Clone & configure:

```bash
git clone https://github.com/dungngo97/rebalance-bot.git
cd rebalance-bot
cp .env.example .env
```

Edit `.env`:

```bash
# Required
MONGO_PASSWORD=your-strong-password-here
GOCLAW_DB_PASSWORD=your-goclaw-password-here

# GoClaw Telegram Integration (required for notifications)
GOCLAW_URL=http://goclaw:18790
GOCLAW_GATEWAY_TOKEN=your-gateway-token

# Rebalancing & Trading
REBALANCE_THRESHOLD=0.08               # 8% optimal from grid search
MIN_TRADE_USD=10
TREND_FILTER_MA=110                    # Optimal MA period from grid search
TREND_FILTER_COOLDOWN=1                # Days optimal from grid search
BEAR_CASH_PCT=100                      # 100% cash in bear market optimal

# GoClaw AI (optional: for enhanced analytics)
GOCLAW_ENCRYPTION_KEY=your-32-char-encryption-key
ANTHROPIC_API_KEY=your-api-key
XAI_API_KEY=your-xai-api-key
```

Start:

```bash
# Full stack (frontend + backend + mongodb + goclaw + postgres)
docker compose up -d
```

**Verify**:

```bash
docker compose ps
curl http://localhost:3000/health        # Frontend
curl http://localhost/api/health         # Backend
curl http://localhost:8081/health        # GoClaw UI
```

Dashboards:
- Frontend at `http://your-vps-ip:3000`
- GoClaw UI at `http://your-vps-ip:8081`

## Service Configuration

### docker-compose.yml Structure

**8 Services**:

1. **frontend** (nginx)
   - Port: 3000 (HTTP)
   - Memory: 128M limit
   - Builds from `./frontend/Dockerfile`
   - Serves React app via nginx
   - Proxy to backend at `/api`

2. **backend** (Bun)
   - Port: 3001 (internal)
   - Memory: 512M limit, 128M reserved
   - Hono API server
   - Loads config from `.env`
   - Connects to MongoDB

3. **mongodb** (MongoDB 7)
   - Port: 27017 (internal only, blocked by firewall)
   - Memory: 512M limit
   - Volume: `mongodb_data` persists at `/data/db`
   - Auth: `admin:${MONGO_PASSWORD}`

4. **mcp-server** (Node.js)
   - Port: 3100 (internal)
   - Memory: 256M
   - SSE transport mode for Claude integration
   - Wraps backend REST API for MCP clients

5. **goclaw** (Go-based)
   - Port: 18790 (public access)
   - Memory: 1G limit
   - GoClaw AI agent with skills directory
   - Connects to goclaw-postgres
   - Volume: bind-mount to `./goclaw-skills`

6. **goclaw-ui** (Web)
   - Port: 8081 (public access)
   - Memory: 128M limit
   - GoClaw dashboard UI
   - Depends on goclaw service

7. **goclaw-postgres** (PostgreSQL 18 + pgvector)
   - Port: 5432 (internal only)
   - Memory: 256M limit
   - Volume: `goclaw_postgres_data` persists
   - Auth: `goclaw:${GOCLAW_DB_PASSWORD}`

8. **autoheal** (Docker auto-restart)
   - No public port
   - Memory: 32M
   - Auto-restarts unhealthy containers

**Volumes**:

```
mongodb_data:              # MongoDB persistence
goclaw_data:               # GoClaw workspace data
goclaw_postgres_data:      # PostgreSQL persistence
./goclaw-skills:           # Bind mount for AI skills
```

## Environment Variables

### Required

```bash
MONGO_PASSWORD=<secure-password>
GOCLAW_DB_PASSWORD=<secure-password>
```

### Recommended (Strategy Tuning)

```bash
REBALANCE_THRESHOLD=0.08        # 8% drift trigger (optimal from grid search)
TREND_FILTER_MA=110             # 110-day MA period (optimal from search)
TREND_FILTER_COOLDOWN=1         # 1-day cooldown (optimal from search)
BEAR_CASH_PCT=100               # 100% cash during bear (optimal)
MIN_TRADE_USD=10                # Min order size
```

### GoClaw (Required for Telegram Notifications)

```bash
GOCLAW_URL=http://goclaw:18790                    # Default endpoint
GOCLAW_GATEWAY_TOKEN=<secure-token>               # Required for auth
GOCLAW_ENCRYPTION_KEY=<32-char-key>               # Data encryption
ANTHROPIC_API_KEY=                                # Claude API (optional)
XAI_API_KEY=                                      # xAI Grok API (optional)
```

All Telegram notifications now route through GoClaw AI agent. GoClaw formats messages in Vietnamese and handles delivery. See [GoClaw Integration](./system-architecture.md#7-notifier-service) for cron job times.

### Optional

```bash
VITE_API_URL=/api               # Frontend API endpoint (Docker default)
REBALANCE_INTERVAL=300000       # Check interval (ms)
CCXT_RATE_LIMIT=100             # Exchange rate limit
```

### Auto-Set by Docker

```bash
MONGODB_URI=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/rebalance?authSource=admin
BACKEND_API_URL=http://backend:3001       # For mcp-server
MCP_TRANSPORT=sse                        # SSE mode for Claude
MCP_PORT=3100                            # MCP server port
GOCLAW_POSTGRES_DSN=postgres://goclaw:${GOCLAW_DB_PASSWORD}@goclaw-postgres:5432/goclaw
MCP_API_KEY=<backend-api-key>            # X-API-Key header for MCP requests
```

Note: MCP server now sends X-API-Key header on all requests to backend to pass auth middleware.

## Health Checks

Each service includes health checks:

```bash
# Frontend
curl http://localhost:3000/health
# → 200 OK if nginx running

# Backend
curl http://localhost/api/health
# → { "status": "ok", "mongodb": true, "uptime": 123 }

# GoClaw
curl http://localhost:18790/health

# GoClaw UI
curl http://localhost:8081/health

# MongoDB
docker exec rebalance-mongodb mongosh --eval "db.adminCommand('ping')"

# GoClaw PostgreSQL
docker exec rebalance-goclaw-postgres pg_isready -U goclaw
```

## Logs

View logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f mongodb

# Last 50 lines
docker compose logs --tail 50 backend
```

Logs rotate automatically (max 10MB, 3 files per service).

## Persistence

### MongoDB Data

```bash
# Backup
docker exec rebalance-mongodb mongodump --out /backup
docker cp rebalance-mongodb:/backup ./mongodb-backup

# Restore
docker cp ./mongodb-backup rebalance-mongodb:/
docker exec rebalance-mongodb mongorestore /mongodb-backup
```

### GoClaw PostgreSQL Data

```bash
# Backup
docker exec rebalance-goclaw-postgres pg_dump -U goclaw goclaw > ./goclaw-backup.sql

# Restore
docker exec -i rebalance-goclaw-postgres psql -U goclaw goclaw < ./goclaw-backup.sql
```

### GoClaw Skills Data

```bash
# Skills are in ./goclaw-skills directory (bind mount)
# Backup the directory manually or commit to version control
cp -r ./goclaw-skills ./goclaw-skills-backup
```

## Updating

### Pull Latest Code

```bash
git pull origin main
```

### Rebuild Images

```bash
docker compose build --no-cache
docker compose up -d
```

### Database Migrations

Mongoose handles schema migrations automatically on startup.

## Production Recommendations

### Security

1. **Firewall**
   ```bash
   ufw allow 22/tcp      # SSH
   ufw allow 3000/tcp    # Frontend (React)
   ufw allow 8081/tcp    # GoClaw UI
   ufw allow 18790/tcp   # GoClaw Agent
   ufw allow 443/tcp     # For reverse proxy with TLS
   ufw deny 27017/tcp    # Block external MongoDB
   ufw deny 5432/tcp     # Block external PostgreSQL
   ```

2. **SSL/TLS**
   Use nginx reverse proxy (outside Docker):
   ```nginx
   server {
     listen 443 ssl http2;
     server_name your-domain.com;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://localhost;
     }
   }
   ```

3. **Environment Secrets**
   - Store `.env` outside version control
   - Use VPS secret manager or Docker secrets
   - Rotate `MONGO_PASSWORD` periodically

### Monitoring

```bash
# Resource usage
docker stats

# Container restart count
docker compose ps

# Error logs
docker compose logs backend | grep -i error
```

### Backup Strategy

```bash
# Daily MongoDB backup
0 2 * * * docker exec rebalance-mongodb mongodump --out /backups/$(date +\%Y\%m\%d)
```

## Troubleshooting

### Backend fails to connect to MongoDB

```bash
# Check MongoDB status
docker compose ps mongodb

# Check connection string
docker compose logs backend | grep -i mongodb

# Test manually
docker exec rebalance-backend curl http://mongodb:27017
```

**Fix**: Ensure `MONGO_PASSWORD` matches in `.env`

### Frontend showing 502 Bad Gateway

```bash
# Check backend health
docker exec rebalance-backend curl http://localhost:3001/health

# Restart backend
docker compose restart backend
```

### High memory usage

Check resource limits in `docker-compose.yml`. Increase host RAM or reduce limits:

```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 1G  # From 512M if needed
```

### Volume permission issues

```bash
# Fix MongoDB volume ownership
docker exec rebalance-mongodb chown -R mongodb:mongodb /data/db
```

## Scaling Notes

Current setup is single-instance. For horizontal scaling:

1. Use MongoDB Atlas (cloud)
2. Run multiple backend replicas
3. Use load balancer (nginx/HAProxy)
4. Use external Redis for session state

(Future roadmap)

## Uninstall

```bash
# Stop all services
docker compose down

# Remove data volumes (WARNING: deletes all data)
docker compose down -v

# Remove images
docker compose down --rmi all
```

## SSL/HTTPS Roadmap

Currently accessed via IP (no domain). SSL deferred until domain acquired.

**When domain is ready:**
1. Install certbot: `apt install certbot python3-certbot-nginx`
2. Get cert: `certbot --nginx -d your-domain.com`
3. Uncomment HTTPS block in `frontend/nginx.conf`
4. Rebuild frontend: `docker compose build frontend && docker compose up -d frontend`

HTTPS template already in `frontend/nginx.conf` (commented out).

## Automated Database Backup

Daily backup of MongoDB + GoClaw PostgreSQL, 7-day rotation, Telegram notification.

**Setup:**
```bash
# Create backup directory
mkdir -p /opt/rebalance-backups

# Test manually
bash /opt/rebalance-bot/scripts/backup-databases.sh

# Install crontab (3AM daily)
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/rebalance-bot/scripts/backup-databases.sh >> /var/log/rebalance-backup.log 2>&1") | crontab -
```

**Restore:**
```bash
# MongoDB
gunzip -c /opt/rebalance-backups/YYYY-MM-DD/mongodb.archive.gz | \
  docker exec -i rebalance-mongodb mongorestore --archive --gzip \
  --username admin --password $MONGO_PASSWORD --authenticationDatabase admin

# PostgreSQL
gunzip -c /opt/rebalance-backups/YYYY-MM-DD/goclaw-postgres.sql.gz | \
  docker exec -i rebalance-goclaw-postgres psql -U goclaw goclaw
```

## Health Monitoring & Alerting

Every 5 minutes: check containers, memory, API reachability. Alerts via Telegram (no spam — state-based).

**Setup:**
```bash
# Test manually
bash /opt/rebalance-bot/scripts/health-check.sh

# Install crontab (every 5 min)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/rebalance-bot/scripts/health-check.sh >> /var/log/rebalance-health.log 2>&1") | crontab -
```

**Checks performed:**
- Container status (all `rebalance-*` containers must be "Up")
- Memory usage (alert if any container > 90%)
- Backend API (`http://127.0.0.1:3001/api/health`)
- Frontend (`http://127.0.0.1:3000/health`)

## References

- [Docker Compose docs](https://docs.docker.com/compose/)
- [MongoDB in Docker](https://hub.docker.com/_/mongo)
- [Bun runtime](https://bun.sh/)
- [Project Overview](./project-overview-pdr.md)
- [System Architecture](./system-architecture.md)
