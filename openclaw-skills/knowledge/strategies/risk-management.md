# Risk Management

## Position Sizing

Limit single-asset exposure to protect against concentrated losses.

| Risk Level | Max Single Asset | Recommended |
|------------|-----------------|-------------|
| Conservative | 30% | BTC/ETH only above 25% |
| Moderate | 50% | No single alt above 30% |
| Aggressive | 70% | Requires active monitoring |

**Rule**: Never allocate more than 80% to a single asset. The bot enforces this as a hard limit when applying AI suggestions.

## Circuit Breakers

Circuit breakers halt automated trading when abnormal conditions are detected:

- **Price circuit breaker**: stops trading if an asset moves >30% in 1 hour
- **Loss circuit breaker**: halts all orders if portfolio value drops >15% in 24 hours
- **API error circuit breaker**: pauses exchange operations after 3 consecutive failures

When a circuit breaker trips, the bot enters safe mode — no new orders are placed until manually reset via `POST /api/config`.

## Daily Loss Limits

Configure a maximum daily loss tolerance to prevent runaway losses:

- Set `dailyLossLimit` as a percentage of portfolio value (e.g. 5%)
- Bot tracks P&L from midnight UTC
- When daily loss exceeds limit, all automated strategies pause
- Resume by resetting the limit via config API or next calendar day

## Stop Losses

Trailing stops protect individual positions:

- Configured per smart order (`POST /api/smart-order` with `type: "trailing-stop"`)
- Trail percentage: how far price can fall from peak before triggering sell
- Once triggered, the position is fully liquidated at market price

## Minimum Trade Size

The bot enforces a minimum order value of **$10 USD** to avoid dust trades that waste fees without meaningful portfolio impact. Trades below this threshold are skipped and logged.

## Diversification

- Maintain at least 3 assets to reduce single-asset risk
- Avoid high correlation between holdings (e.g. multiple BTC derivatives)
- Stable coins (USDT, USDC) can act as a buffer — allocate 5–20% as dry powder
