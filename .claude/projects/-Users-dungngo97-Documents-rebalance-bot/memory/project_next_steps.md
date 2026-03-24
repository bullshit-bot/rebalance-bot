---
name: project-next-steps
description: Next steps after backend completion — frontend pages needed, API integration pending
type: project
---

Backend 4 phases DONE (61 files, 8,828 LOC, 114 tests). Next:

**Frontend — user doing on Lovable:**
- Login page (API key auth)
- 7 new pages: backtesting, analytics, tax, grid trading, smart orders, copy trading, AI suggestions
- Lovable prompt saved in conversation — user will paste when tokens reset

**After Lovable UI done — Claude does:**
- Replace mockData.ts with real API calls (useQuery + fetch)
- WebSocket connection for real-time price/portfolio/trade updates
- Auth middleware (X-API-Key header)
- Connect all 17 pages to backend API endpoints

**Why:** Lovable handles visual design better. Claude handles API integration + state management.
**How to apply:** When user returns with Lovable output, focus on API wiring, not UI redesign.
