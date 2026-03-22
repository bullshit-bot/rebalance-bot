---
name: allocation-advisor
description: Derives suggested portfolio allocations from current holdings and market analysis, then POSTs to the rebalance bot API
version: 1.0.0
inputs:
  - name: currentAllocations
    type: array
    description: Current target allocations from the bot — [{asset, targetPct}]
  - name: analysis
    type: object
    description: Output from market-analysis skill
  - name: apiBaseUrl
    type: string
    description: Base URL of the rebalance bot API (e.g. "http://localhost:3000")
  - name: apiKey
    type: string
    description: Bearer token for bot API authentication
outputs:
  - name: suggestionId
    type: string
    description: ID of the created suggestion returned by the API
  - name: suggestedAllocations
    type: array
    description: The new allocations that were submitted
---

## Purpose

Compute rebalancing suggestions based on current portfolio weights and market analysis,
then submit them to the rebalance bot for approval or auto-application.

## Steps

1. **Load inputs** — current allocations array and market analysis object.

2. **Compute adjustment deltas** per asset using sentiment and risk:
   - `bullish` + `low` risk    → increase weight by up to +5%
   - `bearish` + `high` risk   → decrease weight by up to -10%
   - `bearish` + `medium` risk → decrease weight by up to -5%
   - `neutral` or no data      → keep current weight unchanged
   - Cap any single asset change at ±10% to respect the bot's `maxAllocationShiftPct`.

3. **Normalise** the adjusted allocations so they sum exactly to 100%:
   - Distribute any remainder proportionally across assets with non-zero weight.
   - Round each value to 2 decimal places.

4. **Build reasoning string** summarising the key drivers:
   - List assets changed and why (e.g. "BTC +3% — bullish sentiment (0.6)").
   - Keep reasoning under 500 characters.

5. **POST to API** — submit to `{apiBaseUrl}/api/ai/suggestion`:

```http
POST /api/ai/suggestion
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "allocations": [{"asset": "BTC", "targetPct": 48}, ...],
  "reasoning": "BTC +3% bullish (0.6). ETH -5% bearish (-0.4, high risk).",
  "sentimentData": { ...full analysis object... }
}
```

6. **Handle response**:
   - `201 Created` → extract and return `{ id, status }`.
   - `422 Unprocessable` → log the error body, do not retry.
   - Other errors → log and surface the HTTP status.

## Constraints

- Never suggest an allocation below 0% or above 80% for any single asset.
- Always submit allocations that sum to exactly 100%.
- Do not call the API if no assets would change (all deltas are 0).

## Error Handling

- If the API is unreachable, log the error and exit gracefully without crashing.
- If normalisation fails (e.g. all weights zero), abort and log a clear error message.
