---
title: "CI/CD Update"
status: completed
priority: P2
---

## Overview

Update GitHub Actions workflows: backend tests need MongoDB service container, deploy workflow uses `docker compose` instead of systemd+nginx.

## Context Links

- `.github/workflows/deploy.yml` — current deploy (SSH + systemd)
- `.github/workflows/test-backend.yml` — current tests (SQLite)
- `.github/workflows/test-e2e.yml` — current e2e (SQLite)

## Requirements

- Backend tests run with MongoDB service container in CI
- E2E tests run with MongoDB service container
- Deploy workflow: SSH → `docker compose pull/build && docker compose up -d`
- Remove bun/systemd/nginx setup from deploy script

## Related Code Files

**Modify:**
- `.github/workflows/test-backend.yml`
- `.github/workflows/test-e2e.yml`
- `.github/workflows/deploy.yml`

## Implementation Steps

1. **Update `test-backend.yml`**
   - Add MongoDB service container:
     ```yaml
     services:
       mongodb:
         image: mongo:7
         ports: ['27017:27017']
         options: >-
           --health-cmd "mongosh --eval 'db.adminCommand({ping:1})'"
           --health-interval 10s
           --health-timeout 5s
           --health-retries 3
     ```
   - Update env vars:
     - Remove `DATABASE_URL`
     - Add `MONGODB_URI: mongodb://localhost:27017/rebalance-test`
   - Remove `mkdir -p data && bun run scripts/seed-dev-data.ts`
   - Add MongoDB seed step: `bun run scripts/seed-dev-data.ts` (updated script)

2. **Update `test-e2e.yml`**
   - Same MongoDB service container addition
   - Same env var changes
   - Update seed script path

3. **Rewrite `deploy.yml`**
   - Remove bun install, build, systemd, nginx setup
   - New deploy script:
     ```bash
     cd /opt/rebalance-bot
     git fetch origin main && git reset --hard origin/main
     docker compose build
     docker compose up -d
     docker compose ps  # verify health
     ```
   - Prerequisites: Docker + Docker Compose installed on VPS
   - Keep `.env` management (already on VPS)

## Todo List

- [x] Add MongoDB service container to `test-backend.yml`
- [x] Update env vars in `test-backend.yml` (remove SQLite, add MongoDB)
- [x] Add MongoDB service container to `test-e2e.yml`
- [x] Update env vars in `test-e2e.yml`
- [x] Rewrite `deploy.yml` to use `docker compose`
- [x] Ensure VPS has Docker installed (document prerequisite)
- [x] Test CI pipeline passes with MongoDB
- [x] Test deploy workflow succeeds

## Success Criteria

- [x] `test-backend.yml` runs all tests with MongoDB service container
- [x] `test-e2e.yml` runs with MongoDB
- [x] `deploy.yml` deploys via `docker compose up -d`
- [x] No references to SQLite, systemd, or host nginx in workflows
- [x] CI passes on all 3 workflows

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| MongoDB service container slow | CI timeout | Health check ensures readiness |
| VPS missing Docker | Deploy fails | Add Docker install step or document prerequisite |
| `.env` file on VPS stale | Missing MONGODB_URI | Deploy script checks for required vars |
| Seed script changes | CI fails | Update seed script in Phase 3 |

## Security Considerations

- No MongoDB auth needed in CI (localhost, ephemeral)
- VPS `.env` must include `MONGO_PASSWORD` for production
- SSH keys and deploy secrets unchanged
