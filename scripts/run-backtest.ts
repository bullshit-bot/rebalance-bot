/**
 * Backtest script: 5-year rebalance strategy vs buy-and-hold
 * Uses Binance public OHLCV data (no API key needed)
 *
 * Usage: bun run scripts/run-backtest.ts
 */
import ccxt from 'ccxt'

// ─── Config ──────────────────────────────────────────────────────────────────
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
const ALLOCATIONS = [
  { asset: 'BTC', targetPct: 0.40 },
  { asset: 'ETH', targetPct: 0.30 },
  { asset: 'SOL', targetPct: 0.15 },
  { asset: 'BNB', targetPct: 0.15 },
]
const INITIAL_BALANCE = 10_000 // $10,000
const REBALANCE_THRESHOLD = 5  // 5% drift triggers rebalance
const FEE_PCT = 0.001          // 0.1% per trade (Binance spot)
const TIMEFRAME = '1d'         // daily candles
const YEARS = 5

// ─── Fetch OHLCV ─────────────────────────────────────────────────────────────
async function fetchOHLCV(exchange: ccxt.Exchange, pair: string, since: number): Promise<number[][]> {
  console.log(`  Fetching ${pair}...`)
  const allCandles: number[][] = []
  let cursor = since
  const now = Date.now()

  while (cursor < now) {
    const candles = await exchange.fetchOHLCV(pair, TIMEFRAME, cursor, 1000)
    if (candles.length === 0) break
    allCandles.push(...candles)
    cursor = (candles[candles.length - 1]?.[0] ?? now) + 86400000
    await new Promise(r => setTimeout(r, 200)) // rate limit
  }

  return allCandles
}

// ─── Simulation ──────────────────────────────────────────────────────────────
interface Portfolio {
  [asset: string]: number // amount held
}

function simulate(
  priceData: Map<string, Map<number, number>>, // pair -> timestamp -> close price
  timestamps: number[],
) {
  // Initialize portfolio: buy at first day's prices
  const portfolio: Portfolio = {}
  const firstPrices: Record<string, number> = {}
  let cash = 0

  for (const alloc of ALLOCATIONS) {
    const pair = `${alloc.asset}/USDT`
    const price = priceData.get(pair)?.get(timestamps[0]!)
    if (!price) throw new Error(`No price for ${pair} at start`)
    firstPrices[alloc.asset] = price
    const usdAmount = INITIAL_BALANCE * alloc.targetPct
    portfolio[alloc.asset] = usdAmount / price
  }

  // Buy-and-hold comparison
  const holdPortfolio: Portfolio = { ...portfolio }

  let totalTrades = 0
  let totalFees = 0
  let rebalanceCount = 0
  const equityCurve: { date: string; rebalance: number; hold: number }[] = []

  for (const ts of timestamps) {
    // Calculate current values
    let totalValue = cash
    let holdValue = 0
    const currentAlloc: Record<string, number> = {}

    for (const alloc of ALLOCATIONS) {
      const pair = `${alloc.asset}/USDT`
      const price = priceData.get(pair)?.get(ts)
      if (!price) continue
      const value = portfolio[alloc.asset]! * price
      totalValue += value
      holdValue += holdPortfolio[alloc.asset]! * price
    }

    // Calculate allocation percentages
    for (const alloc of ALLOCATIONS) {
      const pair = `${alloc.asset}/USDT`
      const price = priceData.get(pair)?.get(ts) ?? 0
      currentAlloc[alloc.asset] = (portfolio[alloc.asset]! * price) / totalValue
    }

    // Check drift
    let maxDrift = 0
    for (const alloc of ALLOCATIONS) {
      const drift = Math.abs((currentAlloc[alloc.asset] ?? 0) - alloc.targetPct) * 100
      if (drift > maxDrift) maxDrift = drift
    }

    // Rebalance if needed
    if (maxDrift > REBALANCE_THRESHOLD) {
      rebalanceCount++
      for (const alloc of ALLOCATIONS) {
        const pair = `${alloc.asset}/USDT`
        const price = priceData.get(pair)?.get(ts)
        if (!price) continue

        const currentValue = portfolio[alloc.asset]! * price
        const targetValue = totalValue * alloc.targetPct
        const diff = targetValue - currentValue

        if (Math.abs(diff) > 10) { // min $10 trade
          const fee = Math.abs(diff) * FEE_PCT
          totalFees += fee
          totalTrades++

          if (diff > 0) {
            // Buy
            portfolio[alloc.asset] = portfolio[alloc.asset]! + (diff - fee) / price
          } else {
            // Sell
            portfolio[alloc.asset] = portfolio[alloc.asset]! + (diff + fee) / price
          }
        }
      }
    }

    // Record equity curve (weekly)
    const date = new Date(ts)
    if (date.getDay() === 0) { // Sunday
      equityCurve.push({
        date: date.toISOString().slice(0, 10),
        rebalance: Math.round(totalValue),
        hold: Math.round(holdValue),
      })
    }
  }

  // Final values
  const lastTs = timestamps[timestamps.length - 1]!
  let finalRebalance = cash
  let finalHold = 0
  for (const alloc of ALLOCATIONS) {
    const pair = `${alloc.asset}/USDT`
    const price = priceData.get(pair)?.get(lastTs) ?? 0
    finalRebalance += portfolio[alloc.asset]! * price
    finalHold += holdPortfolio[alloc.asset]! * price
  }

  return {
    finalRebalance,
    finalHold,
    rebalanceReturn: ((finalRebalance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100,
    holdReturn: ((finalHold - INITIAL_BALANCE) / INITIAL_BALANCE) * 100,
    rebalanceCount,
    totalTrades,
    totalFees,
    equityCurve,
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  CRYPTO REBALANCE BOT — 5-YEAR BACKTEST')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Initial: $${INITIAL_BALANCE.toLocaleString()}`)
  console.log(`  Strategy: ${REBALANCE_THRESHOLD}% threshold rebalancing`)
  console.log(`  Assets: ${ALLOCATIONS.map(a => `${a.asset} ${a.targetPct * 100}%`).join(' | ')}`)
  console.log(`  Fee: ${FEE_PCT * 100}% per trade`)
  console.log(`  Period: ${YEARS} years`)
  console.log('')

  const exchange = new ccxt.binance({ enableRateLimit: true })
  const since = Date.now() - YEARS * 365.25 * 24 * 60 * 60 * 1000

  console.log('📥 Downloading OHLCV data from Binance...')
  const priceData = new Map<string, Map<number, number>>()

  for (const pair of PAIRS) {
    const candles = await fetchOHLCV(exchange, pair, since)
    const map = new Map<number, number>()
    for (const c of candles) {
      // Normalize to midnight UTC
      const day = new Date(c[0]!).setUTCHours(0, 0, 0, 0)
      map.set(day, c[4]!) // close price
    }
    priceData.set(pair, map)
    console.log(`  ✅ ${pair}: ${candles.length} candles`)
  }

  // Find common timestamps
  const allTimestamps = new Set<number>()
  for (const [, map] of priceData) {
    for (const ts of map.keys()) allTimestamps.add(ts)
  }
  const timestamps = [...allTimestamps]
    .filter(ts => PAIRS.every(p => priceData.get(p)?.has(ts)))
    .sort()

  console.log(`\n📊 Common trading days: ${timestamps.length}`)
  console.log(`   From: ${new Date(timestamps[0]!).toISOString().slice(0, 10)}`)
  console.log(`   To:   ${new Date(timestamps[timestamps.length - 1]!).toISOString().slice(0, 10)}`)

  console.log('\n⚙️  Running simulation...\n')
  const result = simulate(priceData, timestamps)

  // ─── Results ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log(`  📈 Rebalance Strategy:`)
  console.log(`     Final value:  $${Math.round(result.finalRebalance).toLocaleString()}`)
  console.log(`     Return:       ${result.rebalanceReturn.toFixed(1)}%`)
  console.log(`     Rebalances:   ${result.rebalanceCount}`)
  console.log(`     Total trades: ${result.totalTrades}`)
  console.log(`     Total fees:   $${Math.round(result.totalFees).toLocaleString()}`)
  console.log('')
  console.log(`  📊 Buy & Hold:`)
  console.log(`     Final value:  $${Math.round(result.finalHold).toLocaleString()}`)
  console.log(`     Return:       ${result.holdReturn.toFixed(1)}%`)
  console.log('')

  const outperformance = result.rebalanceReturn - result.holdReturn
  const emoji = outperformance > 0 ? '✅' : '❌'
  console.log(`  ${emoji} Outperformance: ${outperformance > 0 ? '+' : ''}${outperformance.toFixed(1)}%`)
  console.log(`     ($${Math.round(result.finalRebalance - result.finalHold).toLocaleString()})`)
  console.log('')
  console.log('═══════════════════════════════════════════════════════')

  // Print recent equity curve
  console.log('\n📉 Equity Curve (last 12 months):')
  const recent = result.equityCurve.slice(-52)
  for (const point of recent.filter((_, i) => i % 4 === 0)) {
    const bar = '█'.repeat(Math.max(1, Math.round(point.rebalance / 1000)))
    console.log(`  ${point.date} | Rebal: $${point.rebalance.toLocaleString().padStart(8)} | Hold: $${point.hold.toLocaleString().padStart(8)} | ${bar}`)
  }
}

main().catch(console.error)
