---
title: "Docker Hardening + Mainnet Configuration Guide"
description: "Add Docker HEALTHCHECK auto-restart and document mainnet switch procedure"
status: completed
priority: P3
effort: 1h
---

# Phase 4: Docker Hardening + Mainnet Guide

## Context Links
- [docker-compose.yml](../../docker-compose.yml) -- backend already has healthcheck + restart:unless-stopped
- [.env.example](../../.env.example) -- environment template

## Overview

Two items:
1. Docker backend healthcheck exists but Docker Compose doesn't auto-restart unhealthy containers natively. Add `autoheal` sidecar or use Docker's `--restart` behavior documentation.
2. Document mainnet switch procedure for personal reference.

## Key Insights

- Docker Compose `restart: unless-stopped` + `healthcheck` already restarts on crash. But if container is "running but unhealthy" (e.g., deadlocked), Docker won't restart it automatically.
- Solution: add `willfarrell/autoheal` sidecar service -- watches for unhealthy containers and restarts them.
- Backend healthcheck already configured: `curl -f http://localhost:3001/api/health` every 30s, 3 retries.

## Related Code Files

### Modify
- `docker-compose.yml` -- add autoheal service
- Create `docs/mainnet-guide.md` -- mainnet switch documentation

## Implementation Steps

### Part A: Docker Autoheal

1. **Add autoheal service** to `docker-compose.yml`:
   ```yaml
   autoheal:
     image: willfarrell/autoheal
     container_name: rebalance-autoheal
     restart: unless-stopped
     environment:
       AUTOHEAL_CONTAINER_LABEL: all
       AUTOHEAL_INTERVAL: 60
       AUTOHEAL_START_PERIOD: 120
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
     deploy:
       resources:
         limits:
           memory: 32M
     logging:
       driver: "json-file"
       options:
         max-size: "5m"
         max-file: "2"
     networks:
       - app-network
   ```
   - Monitors all containers with healthchecks
   - 60s check interval, 120s grace period on startup
   - Restarts containers unhealthy for >60s

### Part B: Mainnet Configuration Guide

2. **Create `docs/mainnet-guide.md`** with sections:

   **Pre-flight checklist:**
   - Run on testnet for 1-2 weeks with trend filter enabled
   - Verify all Telegram alerts working
   - Confirm MA data persists across restarts
   - Check health endpoint shows correct data

   **Switch to mainnet:**
   - Remove or set `BINANCE_SANDBOX=false` in `.env`
   - Generate Binance API key with **trade-only** permissions (no withdraw)
   - Enable IP whitelist on Binance -- VPS IP only
   - Set `PAPER_TRADING=false`
   - Start with small amount ($100-500) for live validation

   **Monitoring:**
   - Check Telegram daily summary
   - Monitor `GET /api/health` -- uptime, memory, trend status
   - Watch Docker logs: `docker logs -f rebalance-backend`
   - Autoheal handles unhealthy restarts automatically

   **Rollback:**
   - Set `PAPER_TRADING=true` to stop live trades immediately
   - Or `docker compose stop backend` to halt completely

## Todo List

- [x] Add autoheal service to docker-compose.yml
- [x] Create docs/mainnet-guide.md
- [x] Test autoheal: manually make backend unhealthy, verify restart
- [x] Review .env.example has all required mainnet vars documented

## Success Criteria

- [x] Autoheal restarts backend within 2 minutes if healthcheck fails
- [x] Mainnet guide covers: API key setup, IP whitelist, paper mode, rollback
- [x] docker-compose.yml stays under 200 lines with autoheal added

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Autoheal restart loop if persistent failure | Docker logs + Telegram error alert will notify; manual intervention |
| Docker socket mount = security concern | Personal VPS, acceptable risk; autoheal is read-only + restart |
