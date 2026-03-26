# Rebalancing Guide

## What Is Rebalancing

Rebalancing restores a portfolio to its target allocation by selling over-weight assets and buying under-weight ones. The bot automates this process across multiple exchanges.

## Threshold-Based Rebalancing

The bot uses a **drift threshold** to decide when to rebalance. A rebalance triggers when any asset deviates from its target by more than the configured threshold.

- **Default threshold**: 5% absolute drift (e.g. target 40% BTC, current 46% → drift = +6%, triggers rebalance)
- **Configurable** via `POST /api/config` with `rebalanceThreshold` field
- **Cooldown period**: prevents over-trading by enforcing a minimum interval between rebalances

## Drift Detection

Drift is computed per asset:

```
drift = currentWeight - targetWeight
```

Where `currentWeight = assetValue / totalPortfolioValue`.

The bot monitors drift continuously. When `abs(drift) > threshold` for any asset, it queues a rebalance.

## When to Rebalance

**Rebalance when:**
- Any asset drifts more than 5–10% from target
- After large market moves (>20% price swing in one asset)
- After significant deposits or withdrawals
- AI suggestions recommend allocation changes

**Do not rebalance when:**
- Portfolio is in cooldown (recent rebalance completed)
- Market is highly volatile (spread/slippage costs exceed drift benefit)
- Total portfolio value is below minimum trade size

## Execution

1. Compute required trades to reach target weights
2. Execute sells first (free up base currency)
3. Execute buys with freed capital
4. Verify final weights match targets within tolerance

## Fees and Slippage

Each trade incurs exchange fees (typically 0.1%). For small portfolios, frequent rebalancing erodes returns. Set a higher threshold (8–10%) if trading costs are significant.
