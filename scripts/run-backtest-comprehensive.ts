/**
 * Comprehensive backtest: test ALL improvement ideas
 * 1. Trend filter MA100 (done)
 * 2. DCA 2-3x khi bear
 * 3. SOL 20% allocation
 * 4. Lump sum khi bear (reduce DCA, save for bear buying)
 * 5. 10-year period (BNB listed ~2017, SOL ~2020 - max common = SOL listing)
 *
 * Usage: bun run scripts/run-backtest-comprehensive.ts
 */

const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'
const FEE = 0.001

interface Candle { timestamp: number; close: number }

async function fetchOHLCV(pair: string, since: number): Promise<Candle[]> {
  const symbol = pair.replace('/', '')
  const all: Candle[] = []
  let cursor = since
  const end = Date.now()
  process.stdout.write(`  ${pair}...`)
  while (cursor < end) {
    const url = new URL(BINANCE_KLINES_URL)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', '1d')
    url.searchParams.set('startTime', String(cursor))
    url.searchParams.set('endTime', String(end))
    url.searchParams.set('limit', '1000')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`API ${res.status}`)
    const raw = (await res.json()) as (string | number)[][]
    if (raw.length === 0) break
    for (const c of raw) all.push({ timestamp: c[0] as number, close: parseFloat(c[4] as string) })
    cursor = (raw[raw.length - 1]![0] as number) + 86400000
    if (raw.length < 1000) break
    await new Promise(r => setTimeout(r, 150))
  }
  console.log(` ${all.length}`)
  return all
}

function sma(arr: number[], period: number, endIdx: number): number | null {
  if (endIdx + 1 < period) return null
  let sum = 0
  for (let i = endIdx + 1 - period; i <= endIdx; i++) sum += arr[i]!
  return sum / period
}

// ─── Scenario config ─────────────────────────────────────────────────────────
interface Scenario {
  name: string
  pairs: string[]
  allocs: { asset: string; pct: number }[]
  initial: number
  dcaBull: number       // DCA per day in bull
  dcaBear: number       // DCA per day in bear
  lumpSumBear: number   // Extra lump sum when entering bear (from saved DCA)
  maPeriod: number      // 0 = no filter
  bearCashPct: number
  cooldown: number
}

interface Result {
  name: string
  invested: number
  finalValue: number
  profit: number
  returnPct: number
  annualizedPct: number
  maxDD: number
  trades: number
  fees: number
  years: number
}

function simulate(
  priceData: Map<string, Map<number, number>>,
  timestamps: number[],
  sc: Scenario,
): Result {
  const btcPrices = timestamps.map(ts => priceData.get('BTC/USDT')?.get(ts) ?? 0)
  const h: Record<string, number> = {}
  let cash = 0
  let invested = 0
  let fees = 0
  let trades = 0
  let peak = 0
  let maxDD = 0
  let prevBull = true
  let savedForBear = 0  // Accumulated savings for lump sum bear buying

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]!
    const prices: Record<string, number> = {}
    for (const a of sc.allocs) prices[a.asset] = priceData.get(`${a.asset}/USDT`)?.get(ts) ?? 0

    // Trend check
    let bull = true
    if (sc.maPeriod > 0 && i >= sc.maPeriod) {
      const ma = sma(btcPrices, sc.maPeriod, i)
      bull = ma !== null && btcPrices[i]! >= ma
    }

    // Deposit logic
    if (i === 0) {
      invested += sc.initial
      // Buy initial allocation
      for (const a of sc.allocs) {
        if (prices[a.asset]! > 0) {
          h[a.asset] = (h[a.asset] ?? 0) + (sc.initial * a.pct) / prices[a.asset]!
        }
      }
    } else {
      if (bull) {
        // Bull: normal DCA
        const dailyDCA = sc.dcaBull
        invested += dailyDCA

        // If lumpSumBear strategy, save some for bear
        if (sc.lumpSumBear > 0) {
          const saveAmt = dailyDCA * 0.3  // Save 30% of DCA for bear buying
          savedForBear += saveAmt
          const buyAmt = dailyDCA - saveAmt
          cash += buyAmt
        } else {
          cash += dailyDCA
        }
      } else {
        // Bear: different DCA amount
        invested += sc.dcaBear
        cash += sc.dcaBear
      }
    }

    // Portfolio value
    let cryptoVal = 0
    for (const a of sc.allocs) cryptoVal += (h[a.asset] ?? 0) * prices[a.asset]!
    const totalVal = cryptoVal + cash

    if (sc.maPeriod > 0) {
      if (!bull && prevBull && cryptoVal > 0) {
        // TRANSITION: Bull → Bear - sell to cash
        const targetCash = totalVal * (sc.bearCashPct / 100)
        const needSell = targetCash - cash
        if (needSell > 0 && cryptoVal > 0) {
          const ratio = Math.min(1, needSell / cryptoVal)
          for (const a of sc.allocs) {
            const qty = (h[a.asset] ?? 0) * ratio
            if (qty > 0 && prices[a.asset]! > 0) {
              cash += qty * prices[a.asset]! * (1 - FEE)
              fees += qty * prices[a.asset]! * FEE
              h[a.asset] = (h[a.asset] ?? 0) - qty
              trades++
            }
          }
        }
      } else if (bull && !prevBull) {
        // TRANSITION: Bear → Bull - deploy cash + lump sum
        const lumpSum = savedForBear
        savedForBear = 0

        // Deploy excess cash into most underweight
        const deployCash = cash + lumpSum - (totalVal * 0.1)  // Keep 10% cash
        if (deployCash > 10) {
          // Spread across all assets by allocation
          for (const a of sc.allocs) {
            const buyAmt = deployCash * a.pct
            if (buyAmt > 5 && prices[a.asset]! > 0) {
              const fee = buyAmt * FEE
              h[a.asset] = (h[a.asset] ?? 0) + (buyAmt - fee) / prices[a.asset]!
              fees += fee
              trades++
            }
          }
          cash -= deployCash
          if (cash < 0) cash = 0
        }
      }

      // Bull mode: deploy DCA cash into most underweight
      if (bull && cash > totalVal * 0.15) {
        const excess = cash - totalVal * 0.1
        if (excess > 10) {
          let maxDrift = -Infinity
          let target: string | null = null
          cryptoVal = 0
          for (const a of sc.allocs) cryptoVal += (h[a.asset] ?? 0) * prices[a.asset]!
          for (const a of sc.allocs) {
            const held = (h[a.asset] ?? 0) * prices[a.asset]!
            const tgt = a.pct * (cryptoVal + excess)
            const drift = tgt - held
            if (drift > maxDrift) { maxDrift = drift; target = a.asset }
          }
          if (target && maxDrift > 5 && prices[target]! > 0) {
            const buyAmt = Math.min(excess, maxDrift)
            const fee = buyAmt * FEE
            h[target] = (h[target] ?? 0) + (buyAmt - fee) / prices[target]!
            cash -= buyAmt
            fees += fee
            trades++
          }
        }
      }
    } else {
      // No filter: just buy most underweight with DCA
      if (i > 0 && cash > 10) {
        let maxDrift = -Infinity
        let target: string | null = null
        for (const a of sc.allocs) {
          const held = (h[a.asset] ?? 0) * prices[a.asset]!
          const tgt = a.pct * (cryptoVal + cash)
          const drift = tgt - held
          if (drift > maxDrift) { maxDrift = drift; target = a.asset }
        }
        if (target && prices[target]! > 0) {
          const fee = cash * FEE
          h[target] = (h[target] ?? 0) + (cash - fee) / prices[target]!
          fees += fee
          trades++
          cash = 0
        }
      }
    }

    prevBull = bull

    // Drawdown
    let tv = cash + savedForBear
    for (const a of sc.allocs) tv += (h[a.asset] ?? 0) * prices[a.asset]!
    if (tv > peak) peak = tv
    const dd = peak > 0 ? ((peak - tv) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }

  // Final
  const lastTs = timestamps[timestamps.length - 1]!
  let finalVal = cash + savedForBear
  for (const a of sc.allocs) finalVal += (h[a.asset] ?? 0) * (priceData.get(`${a.asset}/USDT`)?.get(lastTs) ?? 0)

  const profit = finalVal - invested
  const returnPct = (profit / invested) * 100
  const years = timestamps.length / 365
  const annualized = (Math.pow(1 + returnPct / 100, 1 / years) - 1) * 100

  return { name: sc.name, invested, finalValue: finalVal, profit, returnPct, annualizedPct: annualized, maxDD, trades, fees, years }
}

function fmt(n: number): string { return `$${Math.round(n).toLocaleString()}` }

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('')
  console.log('='.repeat(90))
  console.log('  COMPREHENSIVE BACKTEST — All Improvement Ideas')
  console.log('='.repeat(90))

  // Fetch max data (SOL listed ~Apr 2020, so max common ~6 years)
  const since = Date.now() - 6 * 365.25 * 24 * 60 * 60 * 1000
  const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']

  console.log('\nDownloading data (max available)...')
  const priceData = new Map<string, Map<number, number>>()
  for (const pair of PAIRS) {
    const candles = await fetchOHLCV(pair, since)
    const map = new Map<number, number>()
    for (const c of candles) map.set(new Date(c.timestamp).setUTCHours(0, 0, 0, 0), c.close)
    priceData.set(pair, map)
  }

  const allTs = new Set<number>()
  for (const [, map] of priceData) for (const ts of map.keys()) allTs.add(ts)
  const timestamps = [...allTs].filter(ts => PAIRS.every(p => priceData.get(p)?.has(ts))).sort()
  const btcFirst = priceData.get('BTC/USDT')?.get(timestamps[0]!)
  const btcLast = priceData.get('BTC/USDT')?.get(timestamps[timestamps.length - 1]!)

  console.log(`\n${timestamps.length} days: ${new Date(timestamps[0]!).toISOString().slice(0, 10)} -> ${new Date(timestamps[timestamps.length - 1]!).toISOString().slice(0, 10)}`)
  console.log(`BTC: ${fmt(btcFirst ?? 0)} -> ${fmt(btcLast ?? 0)}`)

  // Also prepare 5-year subset
  const fiveYearAgo = Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000
  const ts5y = timestamps.filter(ts => ts >= fiveYearAgo)

  const baseAlloc = [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.30 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.15 }]
  const solAlloc = [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.25 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.20 }]
  const sol30Alloc = [{ asset: 'BTC', pct: 0.35 }, { asset: 'ETH', pct: 0.20 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.30 }]

  // ── Define ALL scenarios ───────────────────────────────────────────────────
  const scenarios: { sc: Scenario; ts: number[] }[] = [
    // === 5-YEAR TESTS ===
    // 1. Baseline: no filter
    { sc: { name: '5Y | Baseline (no filter)', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 0, bearCashPct: 0, cooldown: 3 }, ts: ts5y },

    // 2. Trend filter MA100
    { sc: { name: '5Y | MA100 filter', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 3. DCA 2x bear
    { sc: { name: '5Y | MA100 + DCA 2x bear', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 40, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 4. DCA 3x bear
    { sc: { name: '5Y | MA100 + DCA 3x bear', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 60, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 5. SOL 20% allocation
    { sc: { name: '5Y | MA100 + SOL 20%', pairs: PAIRS, allocs: solAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 6. SOL 30% allocation
    { sc: { name: '5Y | MA100 + SOL 30%', pairs: PAIRS, allocs: sol30Alloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 7. Lump sum bear (save 30% DCA in bull, deploy all when bear→bull)
    { sc: { name: '5Y | MA100 + Lump sum bear', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 1, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 8. DCA 3x bear + SOL 20%
    { sc: { name: '5Y | MA100+DCA3x+SOL20%', pairs: PAIRS, allocs: solAlloc, initial: 1000, dcaBull: 20, dcaBear: 60, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // 9. All combined: DCA 2x bear + SOL 20% + lump sum
    { sc: { name: '5Y | ALL COMBINED', pairs: PAIRS, allocs: solAlloc, initial: 1000, dcaBull: 20, dcaBear: 40, lumpSumBear: 1, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: ts5y },

    // === MAX PERIOD TESTS (6 years) ===
    { sc: { name: '6Y | Baseline (no filter)', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 0, bearCashPct: 0, cooldown: 3 }, ts: timestamps },

    { sc: { name: '6Y | MA100 filter', pairs: PAIRS, allocs: baseAlloc, initial: 1000, dcaBull: 20, dcaBear: 20, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: timestamps },

    { sc: { name: '6Y | MA100+DCA3x+SOL20%', pairs: PAIRS, allocs: solAlloc, initial: 1000, dcaBull: 20, dcaBear: 60, lumpSumBear: 0, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: timestamps },

    { sc: { name: '6Y | ALL COMBINED', pairs: PAIRS, allocs: solAlloc, initial: 1000, dcaBull: 20, dcaBear: 40, lumpSumBear: 1, maPeriod: 100, bearCashPct: 90, cooldown: 3 }, ts: timestamps },
  ]

  console.log(`\nRunning ${scenarios.length} scenarios...\n`)

  const results: Result[] = []
  for (const { sc, ts } of scenarios) {
    results.push(simulate(priceData, ts, sc))
  }

  // ── Print results ────────────────────────────────────────────────────────
  console.log('='.repeat(140))
  console.log('  ALL SCENARIOS COMPARISON')
  console.log('='.repeat(140))
  console.log(`${'#'.padStart(3)}  ${'Scenario'.padEnd(32)} ${'Period'.padStart(6)} ${'Invested'.padStart(10)} ${'Final'.padStart(10)} ${'Profit'.padStart(10)} ${'Return'.padStart(8)} ${'Annual'.padStart(8)} ${'MaxDD'.padStart(8)} ${'Trades'.padStart(7)} ${'Fees'.padStart(8)}`)
  console.log('-'.repeat(140))

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    const period = r.years.toFixed(1) + 'y'
    console.log(
      `${String(i + 1).padStart(3)}  ${r.name.padEnd(32)} ${period.padStart(6)} ${fmt(r.invested).padStart(10)} ${fmt(r.finalValue).padStart(10)} ${fmt(r.profit).padStart(10)} ${(r.returnPct.toFixed(1) + '%').padStart(8)} ${(r.annualizedPct.toFixed(1) + '%').padStart(8)} ${('-' + r.maxDD.toFixed(1) + '%').padStart(8)} ${String(r.trades).padStart(7)} ${fmt(r.fees).padStart(8)}`,
    )
  }

  // ── Highlight best ────────────────────────────────────────────────────────
  const best5y = results.filter(r => r.name.startsWith('5Y')).sort((a, b) => b.returnPct - a.returnPct)[0]!
  const bestAll = results.filter(r => r.name.startsWith('6Y')).sort((a, b) => b.returnPct - a.returnPct)[0]!

  console.log('')
  console.log('='.repeat(90))
  console.log('  WINNERS')
  console.log('='.repeat(90))
  console.log(`  Best 5Y:  ${best5y.name}`)
  console.log(`            ${fmt(best5y.invested)} -> ${fmt(best5y.finalValue)} | +${fmt(best5y.profit)} (+${best5y.returnPct.toFixed(1)}%) | ${best5y.annualizedPct.toFixed(1)}%/yr | DD -${best5y.maxDD.toFixed(1)}%`)
  console.log(`  Best 6Y:  ${bestAll.name}`)
  console.log(`            ${fmt(bestAll.invested)} -> ${fmt(bestAll.finalValue)} | +${fmt(bestAll.profit)} (+${bestAll.returnPct.toFixed(1)}%) | ${bestAll.annualizedPct.toFixed(1)}%/yr | DD -${bestAll.maxDD.toFixed(1)}%`)
  console.log('='.repeat(90))
}

main().catch(console.error)
