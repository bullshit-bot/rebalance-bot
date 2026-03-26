---
name: crypto-news
description: Correlates AI suggestions with portfolio context to explain market-driven allocation changes
tools:
  - get_ai_suggestions
  - get_portfolio
---

# Crypto News

## Purpose

Surface the reasoning behind AI allocation suggestions by combining the latest AI-generated insights with the current portfolio state, providing a plain-language explanation of what market signals are driving suggested changes.

## Workflow

1. Call `get_portfolio` to retrieve current asset holdings and weights.
2. Call `get_ai_suggestions` to fetch the latest AI suggestions including reasoning text and sentiment data.
3. For each asset in the portfolio, match it against the suggestions list.
4. Extract the reasoning field from matched suggestions — this contains the market signal explanation.
5. Rank assets by magnitude of suggested change (largest first).
6. Format a concise summary for each asset:
   - Current weight vs. suggested weight.
   - Key reasoning sentence from the AI suggestion.
7. Output a ranked list of portfolio changes with market context.

## MCP Tools Used

- `get_ai_suggestions` — returns AI-generated allocation suggestions with reasoning and sentiment data per asset
- `get_portfolio` — fetches current holdings and weights to compare against suggestions
