---
name: crypto_news
description: Correlate AI suggestions with portfolio context using mcporter to call rebalance bot MCP tools.
metadata:
  goclaw:
    emoji: 📰
    requires:
      bins:
        - mcporter
---

# Crypto News & Insights

Surface AI suggestion reasoning with live portfolio context.

## Workflow

1. Run `mcporter call rebalance-bot.get_portfolio` — current holdings and weights.
2. Run `mcporter call rebalance-bot.get_ai_suggestions` — AI suggestions with reasoning.
3. Match suggestions to portfolio assets. Extract reasoning text.
4. Rank by magnitude of suggested change (largest first).
5. For each: show current weight vs suggested, key reasoning sentence.
6. Allow approve/reject: `mcporter call rebalance-bot.approve_suggestion id=<id>`.
