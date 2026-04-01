---
title: "Binance Simple Earn Flexible Integration"
description: "Auto-subscribe idle coins to Flexible Earn for yield; auto-redeem before selling"
status: completed
priority: P2
effort: 6h
branch: main
tags: [earn, yield, binance, dca, rebalance]
created: 2026-04-01
---

# Binance Simple Earn Flexible Integration

## Problem
Coins sit idle 97% of the time (172 trades over 5 years). Flexible Earn offers 0.5-6% APY with instant redemption — free yield on idle capital.

## Architecture Decision
- New `src/exchange/simple-earn-manager.ts` — all Earn API calls isolated here
- Portfolio tracker aggregates Spot + Earn balances for drift calculation
- Earn is opt-in via `simpleEarnEnabled` in GlobalSettings
- Redeem-before-sell pattern in RebalanceEngine; subscribe-after-buy in DCAService

## Data Flow
```
DCA buy completes → SimpleEarnManager.subscribeAll() → funds move Spot→Earn
Drift detected → SimpleEarnManager.redeemForRebalance() → funds move Earn→Spot → trades execute
Portfolio poll → fetchBalance() + getFlexiblePositions() → combined totals → drift calc
```

## Phase Table

| # | Phase | Status |
|---|-------|--------|
| 1 | [SimpleEarnManager + Portfolio Balance](./phase-01-earn-manager-and-portfolio.md) | ✅ Completed |
| 2 | [Auto-Subscribe & Auto-Redeem Integration](./phase-02-auto-subscribe-redeem.md) | ✅ Completed |
| 3 | [Config, Toggle & Monitoring](./phase-03-config-toggle-monitoring.md) | ✅ Completed |

## Key Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Redemption delay under stress | Low | High | Poll settlement with 30s timeout; fallback to Spot-only trade |
| CCXT implicit methods unavailable | Low | Medium | Verify at startup; fallback to direct REST |
| Earn balance missing from drift calc | Medium | High | Always aggregate Spot+Earn; unit test coverage |
| Testnet Earn endpoints unavailable | High | Low | Mock in unit tests; small-amount mainnet for integration |

## Rollback
Each phase is additive. Disable via `simpleEarnEnabled: false` — bot reverts to Spot-only behavior. No DB migrations needed.

## Dependencies
- CCXT version must support `sapiPostSimpleEarnFlexibleSubscribe` (verify at startup)
- Binance API key needs Earn permissions enabled
