# Crypto Portfolio Strategies

## Dollar Cost Averaging (DCA)

DCA spreads purchases over time to reduce the impact of volatility.

**How it works**: Buy a fixed dollar amount of an asset at regular intervals regardless of price.

**Bot implementation**: Create a smart order with `type: "dca"`:
- `asset`: target asset symbol
- `totalAmount`: total USD to invest
- `intervals`: number of buy orders
- `intervalMinutes`: time between orders

**Best for**: Long-term accumulation of high-conviction assets (BTC, ETH).

**Avoid when**: Asset is in a confirmed downtrend with no near-term recovery signal.

---

## Grid Trading

Grid trading places buy and sell orders at regular price intervals, profiting from sideways price action.

**How it works**: Define a price range with upper/lower bounds and number of grid levels. The bot fills buy orders as price drops and sell orders as price rises, capturing spread on each oscillation.

**Bot implementation**: Create via `POST /api/grid`:
- `symbol`: trading pair (e.g. `BTC/USDT`)
- `upperPrice` / `lowerPrice`: grid boundaries
- `gridCount`: number of price levels
- `totalInvestment`: total capital to deploy

**Best for**: Range-bound markets, sideways consolidation periods.

**Avoid when**: Strong directional trend — grid gets stuck on one side.

---

## Trailing Stops

Trailing stops lock in profits by selling when price falls a set percentage from its peak.

**How it works**: The stop price trails the asset's highest price by a fixed percentage. Once price drops to the stop level, a market sell executes.

**Bot implementation**: Create via `POST /api/smart-order` with `type: "trailing-stop"`:
- `asset`: asset to protect
- `trailPercent`: distance from peak (e.g. 8 = 8% below peak)
- `quantity`: amount to sell on trigger

**Best for**: Protecting gains after a significant rally.

**Avoid when**: High-volatility assets with frequent 5–10% retracements — triggers premature exits.

---

## Momentum-Based Allocation

Overweight assets showing strong upward momentum and underweight laggards.

**How it works**: Periodically adjust target allocations based on recent price performance. AI suggestions integrate sentiment signals to recommend allocation shifts.

**Bot implementation**: Use `POST /api/ai/suggestion` to submit computed allocations, or review pending suggestions via `GET /api/ai/suggestions?pending=true` and approve via `PUT /api/ai/suggestion/:id/approve`.

**Best for**: Trending markets where relative strength persists.

**Avoid when**: Choppy or mean-reverting conditions — momentum signals are noisy.

---

## Copy Trading

Mirror the trades of a proven external source automatically.

**How it works**: Register a copy source via `POST /api/copy/source`, configure scaling factor, then trigger syncs manually or on a schedule.

**Best for**: Delegating decisions to a trusted signal provider.

**Avoid when**: Source uses extreme leverage or trades assets not available on your exchange.
