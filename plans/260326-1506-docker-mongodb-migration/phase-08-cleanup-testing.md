---
title: "Cleanup & Testing"
status: completed
priority: P2
---

## Overview

Remove all Drizzle/SQLite artifacts, validate full Docker Compose setup end-to-end, update documentation.

## Requirements

- Zero Drizzle/SQLite references remain in codebase
- Full Docker Compose stack works locally and on VPS
- Docs updated with new setup instructions
- All tests pass

## Related Code Files

**Delete:**
- `src/db/schema.ts` — replaced by Mongoose models
- `drizzle.config.ts` — no longer needed
- `data/` directory references — SQLite storage dir

**Modify:**
- `package.json` — remove drizzle-related scripts (`db:push`, `db:studio`, etc.)
- `tsconfig.json` — remove `@db/*` path alias if it pointed to old location
- `README.md` — update setup instructions
- `docs/system-architecture.md` — update DB section
- `docs/deployment-guide.md` — update deploy instructions
- `docs/codebase-summary.md` — update tech stack
- `.env.example` — finalize MongoDB vars

## Implementation Steps

1. **Remove Drizzle artifacts**
   - Delete `src/db/schema.ts`
   - Delete `drizzle.config.ts`
   - Remove drizzle scripts from `package.json`
   - Remove unused deps: `drizzle-orm`, `drizzle-kit`, `@libsql/client`
   - Verify: `grep -r "drizzle" . --include="*.ts" --include="*.json"` returns nothing

2. **Verify Docker Compose**
   - `docker compose build` — all images build
   - `docker compose up -d` — all services start healthy
   - Test frontend at `http://localhost`
   - Test API at `http://localhost/api/health`
   - Test WebSocket at `ws://localhost/ws`
   - Test data persistence: write data, restart, verify data exists

3. **Run full test suite**
   - `bun test ./src/` — all unit + integration tests
   - E2E tests via Playwright (if applicable locally)

4. **Update docs**
   - `README.md`: Docker Compose setup instructions
   - `docs/system-architecture.md`: MongoDB + Docker architecture
   - `docs/deployment-guide.md`: Docker-based deploy
   - `docs/codebase-summary.md`: Tech stack update

5. **Final cleanup**
   - Remove `@libsql/client` from dev deps (only kept for migration script)
   - Update `.gitignore` if needed (remove `data/*.db`, add MongoDB-related)
   - Remove old nginx config references

## Todo List

- [x] Delete `src/db/schema.ts`
- [x] Delete `drizzle.config.ts`
- [x] Remove Drizzle deps and scripts from `package.json`
- [x] Verify zero Drizzle references in codebase
- [x] `docker compose build` succeeds
- [x] `docker compose up -d` — all services healthy
- [x] Frontend loads correctly
- [x] API health check passes
- [x] WebSocket connects
- [x] Data persists across container restarts
- [x] All tests pass (`bun test ./src/`)
- [x] Update `README.md`
- [x] Update `docs/system-architecture.md`
- [x] Update `docs/deployment-guide.md`
- [x] Update `docs/codebase-summary.md`
- [x] Update `.gitignore`

## Success Criteria

- [x] `grep -r "drizzle\|libsql\|sqlite" src/ package.json tsconfig.json` returns nothing
- [x] `docker compose up -d` starts all services healthy
- [x] Full test suite passes
- [x] Documentation reflects new Docker+MongoDB stack
- [x] Frontend, API, WebSocket all functional in Docker

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed Drizzle import | Build fail | Grep entire repo before finalizing |
| Broken path alias | Import errors | Update tsconfig paths |
| Docs out of date | Developer confusion | Update all docs files listed above |
