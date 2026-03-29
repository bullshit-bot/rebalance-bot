---
name: Production readiness checklist
description: Items needed before going live with real money on mainnet. Personal use only, not commercial.
type: project
---

Bot is feature-complete but needs reliability hardening before mainnet.

**Priority items for next sessions:**
1. Persist trend filter MA data to MongoDB (critical — restart loses 100 days of data)
2. Telegram alerts for: bot crash, bear/bull signal, rebalance execute, daily summary
3. Bear-specific rebalance: engine handles `trend-filter-bear` trigger → target bearCashPct
4. E2E tests pass in CI
5. Run testnet 1-2 weeks monitoring stability
6. Mainnet API keys + IP whitelist

**User context:** Personal use only, not commercial. Running on 8GB VPS.
