/**
 * Backtest: Rebalance + DCA $50/day vs Buy-and-Hold + DCA vs just DCA
 * 5 years Binance data, Equal Weight strategy (best performer)
 */
import ccxt from 'ccxt'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB']
const INITIAL = 10_000
const DCA_DAILY = 50 // $50/day
const FEE = 0.001
const THRESHOLD = 5
const YEARS = 5

async function fetchData() {
  const exchange = new ccxt.binance({ enableRateLimit: true })
  const since = Date.now() - YEARS * 365.25 * 86400000
  const priceData = new Map<string, Map<number, number>>()
  for (const pair of PAIRS) {
    console.log(`  Fetching ${pair}...`)
    const candles: number[][] = []
    let cursor = since
    while (cursor < Date.now()) {
      const batch = await exchange.fetchOHLCV(pair, '1d', cursor, 1000)
      if (batch.length === 0) break
      candles.push(...batch)
      cursor = (batch[batch.length - 1]?.[0] ?? Date.now()) + 86400000
      await new Promise(r => setTimeout(r, 200))
    }
    const map = new Map<number, number>()
    for (const c of candles) map.set(new Date(c[0]!).setUTCHours(0, 0, 0, 0), c[4]!)
    priceData.set(pair, map)
    console.log(`  ✅ ${pair}: ${candles.length} days`)
  }
  const allTs = new Set<number>()
  for (const [, m] of priceData) for (const ts of m.keys()) allTs.add(ts)
  const timestamps = [...allTs].filter(ts => PAIRS.every(p => priceData.get(p)?.has(ts))).sort()
  return { priceData, timestamps }
}

interface Result {
  name: string; finalValue: number; totalInvested: number;
  returnPct: number; profitUsd: number; rebalances: number; trades: number; fees: number;
}

function simulate(
  name: string, priceData: Map<string, Map<number, number>>, timestamps: number[],
  opts: { rebalance: boolean; dca: boolean; smartDca: boolean; equalWeight: boolean },
): Result {
  const alloc = opts.equalWeight
    ? ASSETS.map(a => ({ asset: a, pct: 0.25 }))
    : [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.30 }, { asset: 'SOL', pct: 0.15 }, { asset: 'BNB', pct: 0.15 }]

  const portfolio: Record<string, number> = {}
  let totalInvested = INITIAL
  let fees = 0, trades = 0, rebalances = 0

  // Init buy
  for (const a of alloc) {
    const price = priceData.get(`${a.asset}/USDT`)!.get(timestamps[0]!)!
    portfolio[a.asset] = (INITIAL * a.pct) / price
  }

  for (let i = 1; i < timestamps.length; i++) {
    const ts = timestamps[i]!
    const prices: Record<string, number> = {}
    for (const a of ASSETS) prices[a] = priceData.get(`${a}/USDT`)!.get(ts) ?? 0

    // DCA: add $50 daily
    if (opts.dca) {
      totalInvested += DCA_DAILY

      if (opts.smartDca) {
        // Smart DCA: buy underweight assets first
        let total = 0
        for (const a of alloc) total += (portfolio[a.asset] ?? 0) * prices[a.asset]!

        const underweight: { asset: string; deficit: number }[] = []
        for (const a of alloc) {
          const currentPct = ((portfolio[a.asset] ?? 0) * prices[a.asset]!) / (total || 1)
          const deficit = a.pct - currentPct
          if (deficit > 0) underweight.push({ asset: a.asset, deficit })
        }

        if (underweight.length > 0) {
          const totalDeficit = underweight.reduce((s, u) => s + u.deficit, 0)
          for (const u of underweight) {
            const amount = DCA_DAILY * (u.deficit / totalDeficit)
            const fee = amount * FEE
            fees += fee
            portfolio[u.asset] = (portfolio[u.asset] ?? 0) + (amount - fee) / prices[u.asset]!
            trades++
          }
        } else {
          // All at target, split evenly
          for (const a of alloc) {
            const amount = DCA_DAILY * a.pct
            const fee = amount * FEE
            fees += fee
            portfolio[a.asset] = (portfolio[a.asset] ?? 0) + (amount - fee) / prices[a.asset]!
            trades++
          }
        }
      } else {
        // Simple DCA: split evenly per allocation
        for (const a of alloc) {
          const amount = DCA_DAILY * a.pct
          const fee = amount * FEE
          fees += fee
          portfolio[a.asset] = (portfolio[a.asset] ?? 0) + (amount - fee) / prices[a.asset]!
          trades++
        }
      }
    }

    // Rebalance check
    if (opts.rebalance) {
      let total = 0
      for (const a of alloc) total += (portfolio[a.asset] ?? 0) * prices[a.asset]!

      let maxDrift = 0
      for (const a of alloc) {
        const drift = Math.abs(((portfolio[a.asset] ?? 0) * prices[a.asset]!) / total - a.pct) * 100
        if (drift > maxDrift) maxDrift = drift
      }

      if (maxDrift > THRESHOLD) {
        rebalances++
        for (const a of alloc) {
          const currentVal = (portfolio[a.asset] ?? 0) * prices[a.asset]!
          const targetVal = total * a.pct
          const diff = targetVal - currentVal
          if (Math.abs(diff) > 10) {
            const fee = Math.abs(diff) * FEE
            fees += fee
            trades++
            portfolio[a.asset] = (portfolio[a.asset] ?? 0) + (diff > 0 ? (diff - fee) : (diff + fee)) / prices[a.asset]!
          }
        }
      }
    }
  }

  // Final value
  const lastTs = timestamps[timestamps.length - 1]!
  let finalValue = 0
  for (const a of ASSETS) {
    finalValue += (portfolio[a] ?? 0) * (priceData.get(`${a}/USDT`)!.get(lastTs) ?? 0)
  }

  return {
    name, finalValue: Math.round(finalValue), totalInvested: Math.round(totalInvested),
    returnPct: ((finalValue - totalInvested) / totalInvested) * 100,
    profitUsd: Math.round(finalValue - totalInvested),
    rebalances, trades, fees: Math.round(fees),
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  BACKTEST: REBALANCE + DCA $50/DAY — 5 YEARS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Initial: $${INITIAL.toLocaleString()} + DCA $${DCA_DAILY}/day`)
  console.log(`  Total DCA over 5 years: ~$${Math.round(DCA_DAILY * 365.25 * YEARS).toLocaleString()}`)
  console.log(`  Total invested: ~$${Math.round(INITIAL + DCA_DAILY * 365.25 * YEARS).toLocaleString()}`)
  console.log('')

  console.log('📥 Loading Binance data...')
  const { priceData, timestamps } = await fetchData()
  console.log(`📊 ${timestamps.length} trading days\n`)

  const results: Result[] = [
    simulate('1. Rebalance + Smart DCA (Equal Weight)', priceData, timestamps,
      { rebalance: true, dca: true, smartDca: true, equalWeight: true }),
    simulate('2. Rebalance + Simple DCA (Equal Weight)', priceData, timestamps,
      { rebalance: true, dca: true, smartDca: false, equalWeight: true }),
    simulate('3. Rebalance + Smart DCA (40/30/15/15)', priceData, timestamps,
      { rebalance: true, dca: true, smartDca: true, equalWeight: false }),
    simulate('4. Only Rebalance, no DCA (Equal Weight)', priceData, timestamps,
      { rebalance: true, dca: false, smartDca: false, equalWeight: true }),
    simulate('5. Only DCA, no Rebalance (Equal Weight)', priceData, timestamps,
      { rebalance: false, dca: true, smartDca: false, equalWeight: true }),
    simulate('6. Only DCA, no Rebalance (40/30/15/15)', priceData, timestamps,
      { rebalance: false, dca: true, smartDca: false, equalWeight: false }),
  ]

  results.sort((a, b) => b.profitUsd - a.profitUsd)

  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════')
  console.log(' Strategy                                    Invested    Final$     Profit    Return%  Rebals  Fees')
  console.log('─────────────────────────────────────────────────────────────────────────────────────────────────────')
  for (const r of results) {
    const name = r.name.padEnd(44)
    const invested = `$${r.totalInvested.toLocaleString()}`.padStart(9)
    const final = `$${r.finalValue.toLocaleString()}`.padStart(10)
    const profit = `${r.profitUsd > 0 ? '+' : ''}$${r.profitUsd.toLocaleString()}`.padStart(10)
    const ret = `${r.returnPct.toFixed(1)}%`.padStart(8)
    const rebals = `${r.rebalances}`.padStart(6)
    const fees = `$${r.fees.toLocaleString()}`.padStart(6)
    console.log(`${name} ${invested} ${final} ${profit} ${ret} ${rebals} ${fees}`)
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════')

  const best = results[0]!
  console.log(`\n🏆 WINNER: ${best.name}`)
  console.log(`   Invested $${best.totalInvested.toLocaleString()} → $${best.finalValue.toLocaleString()}`)
  console.log(`   Profit: +$${best.profitUsd.toLocaleString()} (${best.returnPct.toFixed(1)}%)`)
}

main().catch(console.error)
