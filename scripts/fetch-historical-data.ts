/**
 * Fetch 5 years of daily OHLCV data from Binance public API and store in MongoDB.
 *
 * Usage:
 *   bun run scripts/fetch-historical-data.ts [options]
 *
 * Options:
 *   --pairs  Comma-separated trading pairs  (default: BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,AVAX/USDT,LINK/USDT)
 *   --years  Number of years to fetch       (default: 5)
 *   --force  Refetch even if cached data exists
 *   --help   Show this help message
 *
 * Environment:
 *   MONGODB_URI  MongoDB connection string (default: mongodb://localhost:27017/rebalance)
 *
 * Data stored in MongoDB `ohlcv_candles` collection via OhlcvCandleModel.
 */
import { connectDB, disconnectDB } from '../src/db/connection'
import { OhlcvCandleModel } from '../src/db/models'

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'AVAX/USDT', 'LINK/USDT']
const DEFAULT_YEARS = 5
const EXCHANGE = 'binance'
const TIMEFRAME = '1d'
const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'
const FETCH_LIMIT = 1000
const REQUEST_DELAY_MS = 100  // 100ms between requests — well within 1200 req/min limit

// ─── CLI Arg Parsing ──────────────────────────────────────────────────────────

function parseArgs(): { pairs: string[]; years: number; force: boolean } {
  const args = process.argv.slice(2)

  if (args.includes('--help')) {
    console.log(`
fetch-historical-data — fetch daily OHLCV from Binance into MongoDB

Usage:
  bun run scripts/fetch-historical-data.ts [options]

Options:
  --pairs <p1,p2,...>  Trading pairs to fetch (default: BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,AVAX/USDT,LINK/USDT)
  --years <n>          Years of history to fetch (default: 5)
  --force              Refetch data even if already cached
  --help               Show this message

Environment:
  MONGODB_URI          MongoDB connection string
                       (default: mongodb://localhost:27017/rebalance)

Examples:
  bun run scripts/fetch-historical-data.ts
  bun run scripts/fetch-historical-data.ts --pairs BTC/USDT,ETH/USDT --years 3
  bun run scripts/fetch-historical-data.ts --force
`.trim())
    process.exit(0)
  }

  let pairs = DEFAULT_PAIRS
  let years = DEFAULT_YEARS
  let force = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--pairs' && args[i + 1]) {
      pairs = args[++i]!.split(',').map(p => p.trim()).filter(Boolean)
    } else if (arg === '--years' && args[i + 1]) {
      const n = parseInt(args[++i]!, 10)
      if (!isNaN(n) && n > 0) years = n
    } else if (arg === '--force') {
      force = true
    }
  }

  return { pairs, years, force }
}

// ─── Binance REST fetcher ─────────────────────────────────────────────────────

interface BinanceKline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Fetch one page of klines from Binance public REST API.
 * Returns empty array when no data available (e.g. pair not yet listed).
 */
async function fetchBinanceKlines(
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<BinanceKline[]> {
  const url = new URL(BINANCE_KLINES_URL)
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', TIMEFRAME)
  url.searchParams.set('startTime', String(startTime))
  url.searchParams.set('endTime', String(endTime))
  url.searchParams.set('limit', String(FETCH_LIMIT))

  const res = await fetch(url.toString())

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Binance API error ${res.status}: ${body}`)
  }

  // Response: [[openTime, open, high, low, close, volume, closeTime, ...], ...]
  const raw = (await res.json()) as (string | number)[][]

  return raw.map((c) => ({
    timestamp: c[0] as number,
    open: parseFloat(c[1] as string),
    high: parseFloat(c[2] as string),
    low: parseFloat(c[3] as string),
    close: parseFloat(c[4] as string),
    volume: parseFloat(c[5] as string),
  }))
}

// ─── MongoDB upsert ───────────────────────────────────────────────────────────

async function upsertCandles(pair: string, candles: BinanceKline[]): Promise<void> {
  if (candles.length === 0) return

  const ops = candles.map((c) => ({
    updateOne: {
      filter: { exchange: EXCHANGE, pair, timeframe: TIMEFRAME, timestamp: c.timestamp },
      update: {
        $setOnInsert: {
          exchange: EXCHANGE,
          pair,
          timeframe: TIMEFRAME,
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        },
      },
      upsert: true,
    },
  }))

  await OhlcvCandleModel.bulkWrite(ops, { ordered: false })
}

// ─── Pair fetcher (paginated) ─────────────────────────────────────────────────

async function fetchPair(
  pair: string,
  startTime: number,
  endTime: number,
  force: boolean,
): Promise<number> {
  // Convert pair format: BTC/USDT → BTCUSDT
  const symbol = pair.replace('/', '')

  // Check existing cached count unless force mode
  if (!force) {
    const cachedCount = await OhlcvCandleModel.countDocuments({
      exchange: EXCHANGE,
      pair,
      timeframe: TIMEFRAME,
      timestamp: { $gte: startTime, $lte: endTime },
    })

    // Expected daily candles = date range in days. Allow 5% tolerance for weekends/holidays.
    const expectedDays = Math.floor((endTime - startTime) / 86_400_000)
    const minExpected = Math.floor(expectedDays * 0.9)

    if (cachedCount >= minExpected) {
      console.log(`[${pair}] Skipping — ${cachedCount} candles already cached (expected ~${expectedDays})`)
      return cachedCount
    }

    if (cachedCount > 0) {
      console.log(`[${pair}] Partial cache (${cachedCount}/${expectedDays}), refetching...`)
    }
  } else {
    console.log(`[${pair}] Force mode — refetching all data`)
  }

  let cursor = startTime
  let totalFetched = 0
  let pageCount = 0

  while (cursor < endTime) {
    const batch = await fetchBinanceKlines(symbol, cursor, endTime)

    if (batch.length === 0) {
      // No data at this point (pair not yet listed or end of data)
      break
    }

    await upsertCandles(pair, batch)
    totalFetched += batch.length
    pageCount++

    const lastTs = batch[batch.length - 1]!.timestamp
    console.log(`[${pair}] Fetched ${batch.length} candles (${totalFetched} total, page ${pageCount})`)

    // Advance cursor past last candle
    cursor = lastTs + 1

    // Stop if we got fewer than limit (last page)
    if (batch.length < FETCH_LIMIT) break

    // Rate limit between paginated requests
    await sleep(REQUEST_DELAY_MS)
  }

  return totalFetched
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { pairs, years, force } = parseArgs()

  const endTime = Date.now()
  const startTime = endTime - years * 365 * 86_400_000

  console.log('='.repeat(60))
  console.log('  FETCH HISTORICAL OHLCV DATA — Binance Public API')
  console.log('='.repeat(60))
  console.log(`Pairs:    ${pairs.join(', ')}`)
  console.log(`Range:    ${new Date(startTime).toISOString().slice(0, 10)} → ${new Date(endTime).toISOString().slice(0, 10)}`)
  console.log(`Years:    ${years}`)
  console.log(`Force:    ${force}`)
  console.log(`Exchange: ${EXCHANGE}`)
  console.log('')

  await connectDB()
  console.log('Connected to MongoDB\n')

  const totals: Record<string, number> = {}
  let grandTotal = 0

  for (const pair of pairs) {
    try {
      const count = await fetchPair(pair, startTime, endTime, force)
      totals[pair] = count
      grandTotal += count
    } catch (err) {
      console.error(`[${pair}] ERROR: ${(err as Error).message}`)
      totals[pair] = 0
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('  SUMMARY')
  console.log('='.repeat(60))
  for (const [pair, count] of Object.entries(totals)) {
    console.log(`  ${pair.padEnd(12)} ${count} candles`)
  }
  console.log(`  ${'TOTAL'.padEnd(12)} ${grandTotal} candles`)
  console.log('='.repeat(60))

  await disconnectDB()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
