# Deployment Guide

**Last Updated**: 2026-03-26
**Version**: 1.0.0
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

# Optional but recommended
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
REBALANCE_THRESHOLD=0.05
MIN_TRADE_USD=10
PAPER_TRADING=true
```

Start:

```bash
# Basic stack (frontend + backend + mongodb)
docker compose up -d

# Full stack with AI features
docker compose --profile full up -d
```

**Verify**:

```bash
docker compose ps
curl http://localhost/health      # Frontend
curl http://localhost/api/health  # Backend
```

Frontend at `http://your-vps-ip:80`

## Service Configuration

### docker-compose.yml Structure

**6 Services**:

1. **frontend** (nginx)
   - Port: 80 (HTTP)
   - Memory: 128M limit
   - Builds from `./frontend/Dockerfile`
   - Serves React app via nginx
   - Proxy to backend at `/api`

2. **backend** (Bun)
   - Port: 3001 (internal, routed via frontend)
   - Memory: 512M limit, 128M reserved
   - Hono API server
   - Loads config from `.env`
   - Connects to MongoDB

3. **mongodb** (MongoDB 7)
   - Port: 27017 (internal)
   - Memory: 512M limit
   - Volume: `mongodb_data` persists at `/data/db`
   - Auth: `admin:${MONGO_PASSWORD}`

4. **mcp-server** (Optional)
   - Internal port (no public exposure)
   - Wraps backend REST API for MCP clients
   - Memory: 256M

5. **openclaw** (Profile: full)
   - OpenClaw AI agent
   - Requires chromadb
   - Memory: 256M

6. **chromadb** (Profile: full)
   - Vector knowledge base
   - Volume: `chromadb_data`
   - Memory: 512M

**Volumes**:

```
mongodb_data:        # MongoDB persistence
chromadb_data:       # ChromaDB persistence
```

## Environment Variables

### Required

```bash
MONGO_PASSWORD=<secure-password>
```

### Recommended

```bash
TELEGRAM_BOT_TOKEN=<your-bot-token>
REBALANCE_THRESHOLD=0.05        # 5% drift trigger
MIN_TRADE_USD=10                # Min order size
PAPER_TRADING=true              # Safe default
```

### Optional

```bash
VITE_API_URL=/api               # Frontend API endpoint (Docker default)
REBALANCE_INTERVAL=300000       # Check interval (ms)
CCXT_RATE_LIMIT=100             # Exchange rate limit
```

### Auto-Set by Docker

```bash
MONGODB_URI=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/rebalance?authSource=admin
BACKEND_API_URL=http://backend:3001  # For mcp-server
CHROMADB_URL=http://chromadb:8000    # For openclaw
```

## Health Checks

Each service includes health checks:

```bash
# Frontend
curl http://localhost/health
# → 200 OK if nginx running

# Backend
curl http://localhost/api/health
# → { "status": "ok", "mongodb": true, "uptime": 123 }

# MongoDB
docker exec rebalance-mongodb mongosh --eval "db.adminCommand('ping')"
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

### ChromaDB Data (if using AI features)

```bash
# Backup
docker cp rebalance-chromadb:/chroma/chroma ./chromadb-backup

# Restore
docker cp ./chromadb-backup rebalance-chromadb:/chroma/chroma
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
   ufw allow 80/tcp      # Frontend HTTP
   ufw allow 443/tcp     # For reverse proxy with TLS
   ufw deny 27017/tcp    # Block external MongoDB access
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

## References

- [Docker Compose docs](https://docs.docker.com/compose/)
- [MongoDB in Docker](https://hub.docker.com/_/mongo)
- [Bun runtime](https://bun.sh/)
- [Project Overview](./project-overview-pdr.md)
- [System Architecture](./system-architecture.md)
