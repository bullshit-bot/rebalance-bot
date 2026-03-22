---
name: market-analysis
description: Analyses market sentiment, trend direction, and risk per asset from aggregated news and price data
version: 1.0.0
inputs:
  - name: headlines
    type: array
    description: Output from crypto-news-aggregator skill
  - name: assets
    type: array
    description: Asset symbols to analyse (e.g. ["BTC", "ETH", "SOL", "BNB"])
outputs:
  - name: analysis
    type: object
    description: Per-asset sentiment score, trend direction, and risk level
---

## Purpose

Produce a structured per-asset market analysis from news headlines and recent context.
Output feeds directly into the allocation-advisor skill.

## Steps

1. **Group headlines by asset** using the `asset` field from the input array.

2. **Score sentiment** for each asset on a scale of -1.0 to +1.0:
   - Parse headline titles and summaries for positive/negative signal words.
   - Positive signals: "rally", "surge", "bullish", "breakout", "adoption", "approval", "gain", "high".
   - Negative signals: "crash", "drop", "bearish", "hack", "ban", "lawsuit", "loss", "low", "fear".
   - Score = (positive_count - negative_count) / max(total_signals, 1), clamped to [-1, 1].
   - Assets with no headlines receive a neutral score of 0.

3. **Determine trend direction** per asset:
   - `bullish`  — sentiment > 0.2
   - `bearish`  — sentiment < -0.2
   - `neutral`  — otherwise

4. **Assess risk level** per asset:
   - `high`    — sentiment < -0.5 or headlines contain "hack", "ban", "lawsuit", "SEC"
   - `medium`  — sentiment between -0.5 and -0.1
   - `low`     — sentiment >= -0.1

5. **Output** structured JSON object:

```json
{
  "analysedAt": "2024-01-15T08:05:00Z",
  "assets": {
    "BTC": {
      "sentiment": 0.6,
      "trend": "bullish",
      "risk": "low",
      "headlineCount": 3
    },
    "ETH": {
      "sentiment": -0.3,
      "trend": "bearish",
      "risk": "medium",
      "headlineCount": 1
    }
  }
}
```

## Error Handling

- If input headlines array is empty, return neutral analysis for all requested assets.
- Never omit an asset from output — always include every asset in the `assets` map.
