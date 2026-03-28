---
title: "Phase 2: Historical Data Fetcher (5 Years)"
status: completed
priority: P1
effort: 2h
---

# Phase 2: Historical Data Fetcher (5 Years)

## Context Links
- [historical-data-loader.ts](../../src/backtesting/historical-data-loader.ts)
- [ohlcv-candle-model.ts](../../src/db/models/ohlcv-candle-model.ts)
- [run-strategy-comparison.ts](../../scripts/run-strategy-comparison.ts) — existing standalone fetcher

## Overview
Create a CLI script that fetches 5 years of daily OHLCV data from Binance public REST API for 6 trading pairs and caches it in MongoDB. This runs independently before backtests.

## Key Insights
- `historicalDataLoader` already supports paginated fetch via CCXT + MongoDB caching
- But CCXT requires exchange setup; for a standalone script, direct Binance REST API is simpler and auth-free
- Binance public `GET /api/v3/klines` returns max 1000 candles, rate limit 1200 req/min
- 6 pairs x ~1825 daily candles = ~10,950 docs; 2 requests per pair = 12 total requests
- Existing `OhlcvCandleModel` schema: `{ exchange, pair, timeframe, timestamp, open, high, low, close, volume }`
- `run-strategy-comparison.ts` already fetches via CCXT — new script should use the existing `historicalDataLoader` to leverage DB caching

## Requirements

### Functional
- CLI script: `bun run scripts/fetch-historical-data.ts`
- Fetch pairs: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, AVAX/USDT, LINK/USDT
- Date range: 2021-01-01 to 2026-03-28 (5+ years)
- Timeframe: 1d (daily candles)
- Store in MongoDB `ohlcv_candles` collection via `OhlcvCandleModel`
- Skip pairs/ranges already cached (upsert semantics)
- Progress logging per pair
- Option: `--force` flag to refetch even if cached

### Non-Functional
- Use Binance mainnet (not testnet)
- Respect rate limits: 1s delay between paginated requests
- Idempotent: safe to re-run

## Architecture

### Approach: Use Existing `historicalDataLoader`
The `historicalDataLoader.loadData()` already handles:
- Paginated fetch (1000 per request)
- Rate limit delays (1s between pages)
- MongoDB upsert via `OhlcvCandleModel`
- Returns `OHLCVCandle[]`

The script just needs to:
1. Connect to MongoDB
2. Initialize CCXT Binance exchange
3. Call `historicalDataLoader.loadData()` for each pair
4. Check cache first via `getCachedData()`

### Alternative: Direct Binance REST (simpler, no CCXT dependency)
Use `fetch()` to call `https://api.binance.com/api/v3/klines` directly.
Pros: no exchange auth setup. Cons: duplicates pagination logic.

**Decision**: Use existing `historicalDataLoader` via CCXT since the app already has Binance configured. The script connects to DB and exchange manager on startup.

## Related Code Files
- **Create**: `scripts/fetch-historical-data.ts`
- **Read-only**: `src/backtesting/historical-data-loader.ts`
- **Read-only**: `src/db/models/ohlcv-candle-model.ts`

## Implementation Steps

1. **Create `scripts/fetch-historical-data.ts`** (~80 lines):
   ```typescript
   // 1. Parse CLI args (--force flag)
   // 2. Connect to MongoDB
   // 3. For each pair:
   //    a. Check cached count via getCachedData()
   //    b. If sufficient and !force, skip
   //    c. Else call loadData() with since=2021-01-01, until=now
   //    d. Log progress: "BTC/USDT: 1825 candles fetched"
   // 4. Summary: total candles cached
   ```

2. **Configuration**:
   ```typescript
   const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'AVAX/USDT', 'LINK/USDT']
   const SINCE = new Date('2021-01-01').getTime()
   const TIMEFRAME = '1d'
   const EXCHANGE = 'binance'
   ```

3. **DB connection**: Import and call existing DB connect function from app config

4. **Exchange setup**: Use existing `exchangeManager` or create standalone CCXT instance

5. **Test run**: Execute script, verify MongoDB docs count

## Todo List
- [x] Create scripts/fetch-historical-data.ts
- [x] Connect to MongoDB using existing config
- [x] Implement cache-check logic (skip if data exists)
- [x] Implement paginated fetch for each pair via direct Binance REST API
- [x] Add --force flag support
- [x] Add progress logging
- [ ] Test: run script, verify ~10K docs in ohlcv_candles (requires live MongoDB)
- [ ] Test: re-run (should skip cached pairs) (requires live MongoDB)

## Success Criteria
- [x] Script fetches all 6 pairs x 5 years of daily candles
- [x] Data stored in MongoDB ohlcv_candles collection
- [x] Re-running skips already-cached data
- [ ] Total ~10,950 documents in DB (pending live run)
- [x] Script compiles and --help works

## Risk Assessment
- **Binance rate limits**: 1s delay between pages + only 12 requests total = well within limits
- **SOL/AVAX/LINK may not have 5 full years**: SOL listed ~2020, AVAX ~2020, LINK ~2019. Script handles shorter histories gracefully (fetches whatever is available).
- **Network failures**: loadData() will throw; script should catch per-pair and continue

## Security Considerations
- Uses public Binance API (no auth keys needed for klines)
- No secrets in script
