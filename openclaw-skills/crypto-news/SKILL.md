---
name: crypto-news-aggregator
description: Aggregates crypto news from multiple RSS sources for tracked assets and summarises top headlines
version: 1.0.0
inputs:
  - name: assets
    type: array
    description: List of asset symbols to filter news for (e.g. ["BTC", "ETH", "SOL", "BNB"])
    default: ["BTC", "ETH", "SOL", "BNB"]
outputs:
  - name: headlines
    type: array
    description: Top 5 filtered, summarised headlines as structured JSON
---

## Purpose

Fetch, filter, and summarise the latest crypto news relevant to tracked portfolio assets.

## Steps

1. **Fetch RSS feeds** from the following sources in parallel:
   - CoinDesk: `https://www.coindesk.com/arc/outboundfeeds/rss/`
   - CoinTelegraph: `https://cointelegraph.com/rss`

2. **Parse items** — extract `title`, `link`, `pubDate`, and `description` from each item.

3. **Filter** — keep only items where the title or description contains at least one of the tracked asset symbols (case-insensitive). Match full symbols only (e.g. "BTC" not "BTCUSDT").

4. **Deduplicate** — remove items with identical titles.

5. **Sort** by `pubDate` descending.

6. **Select top 5** items from the filtered, sorted list.

7. **Summarise** each item: trim description to ≤ 100 characters, append "..." if truncated.

8. **Output** structured JSON array:

```json
[
  {
    "asset": "BTC",
    "title": "Headline text",
    "summary": "Short description...",
    "url": "https://...",
    "publishedAt": "2024-01-15T08:00:00Z"
  }
]
```

## Error Handling

- If a feed fails to fetch, log a warning and continue with available feeds.
- If no articles match the filter, return an empty array.
- Never throw on partial failure — always return whatever was collected.
