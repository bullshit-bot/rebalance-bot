/**
 * Grid search optimizer: find best combination of parameters
 * Tests MA periods, bear cash %, allocation weights, thresholds, DCA multipliers
 *
 * Usage: bun run scripts/run-backtest-optimizer.ts
 */

// ─── Config ──────────────────────────────────────────────────────────────────
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
const INITIAL_BALANCE = 1_000
const BASE_DCA = 20
const FEE_PCT = 0.001
const YEARS = 5
const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'

// ─── Parameter Grid ──────────────────────────────────────────────────────────
const MA_PERIODS = [50, 100, 150, 200]
const BEAR_CASH_PCTS = [50, 60, 70, 80, 90]
const BULL_CASH_PCTS = [0, 5, 10, 15, 20]
const REBAL_THRESHOLDS = [3, 5, 7, 10]
const DCA_MULTIPLIERS = [1, 2, 3, 5]

// BTC+ETH >= 60% (conservative, blue-chip focused)
const ALLOC_SETS = [
  { name: 'BTC40/ETH30/BNB15/SOL15', allocs: [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.30 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.15 }] },
  { name: 'BTC50/ETH20/BNB15/SOL15', allocs: [{ asset: 'BTC', pct: 0.50 }, { asset: 'ETH', pct: 0.20 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.15 }] },
  { name: 'BTC40/ETH25/BNB15/SOL20', allocs: [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.25 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.20 }] },
  { name: 'BTC35/ETH25/BNB20/SOL20', allocs: [{ asset: 'BTC', pct: 0.35 }, { asset: 'ETH', pct: 0.25 }, { asset: 'BNB', pct: 0.20 }, { asset: 'SOL', pct: 0.20 }] },
  { name: 'BTC45/ETH25/BNB15/SOL15', allocs: [{ asset: 'BTC', pct: 0.45 }, { asset: 'ETH', pct: 0.25 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.15 }] },
  { name: 'BTC50/ETH25/BNB10/SOL15', allocs: [{ asset: 'BTC', pct: 0.50 }, { asset: 'ETH', pct: 0.25 }, { asset: 'BNB', pct: 0.10 }, { asset: 'SOL', pct: 0.15 }] },
  { name: 'BTC40/ETH30/BNB10/SOL20', allocs: [{ asset: 'BTC', pct: 0.40 }, { asset: 'ETH', pct: 0.30 }, { asset: 'BNB', pct: 0.10 }, { asset: 'SOL', pct: 0.20 }] },
  { name: 'BTC35/ETH30/BNB15/SOL20', allocs: [{ asset: 'BTC', pct: 0.35 }, { asset: 'ETH', pct: 0.30 }, { asset: 'BNB', pct: 0.15 }, { asset: 'SOL', pct: 0.20 }] },
]

// ─── Data fetching ───────────────────────────────────────────────────────────
interface Candle { timestamp: number; close: number }

async function fetchOHLCV(pair: string, since: number): Promise<Candle[]> {
  const symbol = pair.replace('/', '')
  const allCandles: Candle[] = []
  let cursor = since
  const endTime = Date.now()

  process.stdout.write(`  ${pair}...`)

  while (cursor < endTime) {
    const url = new URL(BINANCE_KLINES_URL)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', '1d')
    url.searchParams.set('startTime', String(cursor))
    url.searchParams.set('endTime', String(endTime))
    url.searchParams.set('limit', '1000')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${await res.text()}`)
    const raw = (await res.json()) as (string | number)[][]
    if (raw.length === 0) break

    for (const c of raw) {
      allCandles.push({ timestamp: c[0] as number, close: parseFloat(c[4] as string) })
    }

    cursor = (raw[raw.length - 1]![0] as number) + 86400000
    if (raw.length < 1000) break
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(` ${allCandles.length}`)
  return allCandles
}

// ─── SMA helper ──────────────────────────────────────────────────────────────
function sma(arr: number[], period: number, endIdx: number): number | null {
  if (endIdx + 1 < period) return null
  let sum = 0
  for (let i = endIdx + 1 - period; i <= endIdx; i++) sum += arr[i]!
  return sum / period
}

// ─── Simulation engine ──────────────────────────────────────────────────────
interface Params {
  allocName: string
  allocs: { asset: string; pct: number }[]
  maPeriod: number
  bearCashPct: number
  bullCashPct: number
  dcaMultiplier: number
  rebalThreshold: number
}

interface Result {
  params: Params
  invested: number
  finalValue: number
  profit: number
  returnPct: number
  maxDD: number
  fees: number
  trades: number
  riskAdjusted: number
}

/**
 * Core simulation: tracks holdings per asset + cash.
 * - Bear mode (BTC < MA): sell crypto to bearCashPct, DCA goes to cash
 * - Bull mode (BTC >= MA): DCA into most underweight asset, rebalance if drift > threshold
 * - State transition (bear→bull): gradually re-deploy cash via DCA, not instant lump
 */
function runSim(
  priceData: Map<string, Map<number, number>>,
  timestamps: number[],
  btcPrices: number[],
  params: Params,
): Result {
  const { allocs, maPeriod, bearCashPct, bullCashPct, dcaMultiplier, rebalThreshold } = params
  const h: Record<string, number> = {}
  let cash = 0
  let invested = 0
  let fees = 0
  let trades = 0
  let peak = 0
  let maxDD = 0
  let prevBull = true

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]!
    const prices: Record<string, number> = {}
    for (const a of allocs) prices[a.asset] = priceData.get(`${a.asset}/USDT`)?.get(ts) ?? 0

    // Trend: BTC above MA = bull
    let bull = true
    if (i >= maPeriod) {
      const ma = sma(btcPrices, maPeriod, i)
      bull = ma !== null && btcPrices[i]! >= ma
    }

    // Deposit
    let deposit = i === 0 ? INITIAL_BALANCE : BASE_DCA
    if (!bull && i > 0 && dcaMultiplier > 1) deposit *= dcaMultiplier
    invested += deposit

    // Current portfolio value
    let cryptoVal = 0
    for (const a of allocs) cryptoVal += (h[a.asset] ?? 0) * prices[a.asset]!
    const totalVal = cryptoVal + cash + deposit

    if (!bull) {
      // ── BEAR MODE ──────────────────────────────────────────────────────
      // Only sell on transition bull→bear (not every bear day)
      if (prevBull && cryptoVal > 0) {
        const targetCash = totalVal * (bearCashPct / 100)
        const needToSell = targetCash - cash - deposit
        if (needToSell > 0 && cryptoVal > 0) {
          const sellRatio = Math.min(1, needToSell / cryptoVal)
          for (const a of allocs) {
            const qty = (h[a.asset] ?? 0) * sellRatio
            if (qty > 0 && prices[a.asset]! > 0) {
              const proceeds = qty * prices[a.asset]!
              cash += proceeds * (1 - FEE_PCT)
              fees += proceeds * FEE_PCT
              h[a.asset] = (h[a.asset] ?? 0) - qty
              trades++
            }
          }
        }
      }
      // DCA goes to cash in bear
      cash += deposit
    } else {
      // ── BULL MODE ──────────────────────────────────────────────────────
      // Add deposit first
      cash += deposit

      // Recalculate after deposit
      cryptoVal = 0
      for (const a of allocs) cryptoVal += (h[a.asset] ?? 0) * prices[a.asset]!
      const tv = cryptoVal + cash
      const targetCryptoVal = tv * (1 - bullCashPct / 100)

      // Check rebalance needed
      if (cryptoVal > 0) {
        let maxDrift = 0
        for (const a of allocs) {
          const held = (h[a.asset] ?? 0) * prices[a.asset]!
          const currentPct = held / cryptoVal
          const drift = Math.abs(currentPct - a.pct) * 100
          if (drift > maxDrift) maxDrift = drift
        }

        if (maxDrift > rebalThreshold) {
          // Rebalance existing crypto holdings
          for (const a of allocs) {
            const held = (h[a.asset] ?? 0) * prices[a.asset]!
            const target = a.pct * targetCryptoVal
            const diff = target - held
            if (Math.abs(diff) > 5 && prices[a.asset]! > 0) {
              const fee = Math.abs(diff) * FEE_PCT
              fees += fee
              trades++
              if (diff > 0) {
                // Buy: take from cash
                const buyUsd = Math.min(diff, cash)
                if (buyUsd > 5) {
                  h[a.asset] = (h[a.asset] ?? 0) + (buyUsd - fee) / prices[a.asset]!
                  cash -= buyUsd
                }
              } else {
                // Sell
                const sellQty = Math.min(Math.abs(diff) / prices[a.asset]!, h[a.asset] ?? 0)
                if (sellQty > 0) {
                  h[a.asset] = (h[a.asset] ?? 0) - sellQty
                  cash += sellQty * prices[a.asset]! * (1 - FEE_PCT)
                }
              }
            }
          }
        }
      }

      // Deploy excess cash into most underweight asset
      const normalCash = tv * (bullCashPct / 100)
      const excessCash = cash - normalCash
      if (excessCash > 10) {
        // Find most underweight
        let maxDriftVal = -Infinity
        let target: string | null = null
        for (const a of allocs) {
          cryptoVal = 0
          for (const aa of allocs) cryptoVal += (h[aa.asset] ?? 0) * prices[aa.asset]!
          const held = (h[a.asset] ?? 0) * prices[a.asset]!
          const targetUsd = a.pct * (cryptoVal > 0 ? cryptoVal + excessCash : tv)
          const drift = targetUsd - held
          if (drift > maxDriftVal) { maxDriftVal = drift; target = a.asset }
        }
        if (target && maxDriftVal > 5 && prices[target]! > 0) {
          const buyAmt = Math.min(excessCash, maxDriftVal)
          const fee = buyAmt * FEE_PCT
          h[target] = (h[target] ?? 0) + (buyAmt - fee) / prices[target]!
          cash -= buyAmt
          fees += fee
          trades++
        }
      }
    }

    prevBull = bull

    // Drawdown tracking
    let tv = cash
    for (const a of allocs) tv += (h[a.asset] ?? 0) * prices[a.asset]!
    if (tv > peak) peak = tv
    const dd = peak > 0 ? ((peak - tv) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }

  // Final value
  const lastTs = timestamps[timestamps.length - 1]!
  let finalVal = cash
  for (const a of allocs) {
    finalVal += (h[a.asset] ?? 0) * (priceData.get(`${a.asset}/USDT`)?.get(lastTs) ?? 0)
  }

  const profit = finalVal - invested
  const returnPct = (profit / invested) * 100
  return {
    params,
    invested,
    finalValue: finalVal,
    profit,
    returnPct,
    maxDD,
    fees,
    trades,
    riskAdjusted: maxDD > 0 ? returnPct / maxDD : 0,
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────
function fmt(n: number): string { return `$${Math.round(n).toLocaleString()}` }

function printRow(i: number, r: Result) {
  const p = r.params
  console.log(
    `${String(i).padStart(3)}  ${p.allocName.padEnd(24)} ${String(p.maPeriod).padStart(4)} ${String(p.bearCashPct).padStart(5)} ${String(p.bullCashPct).padStart(5)} ${String(p.dcaMultiplier).padStart(4)} ${String(p.rebalThreshold).padStart(4)} ${fmt(r.invested).padStart(9)} ${fmt(r.finalValue).padStart(10)} ${fmt(r.profit).padStart(9)} ${(r.returnPct.toFixed(1) + '%').padStart(8)} ${('-' + r.maxDD.toFixed(1) + '%').padStart(8)} ${r.riskAdjusted.toFixed(2).padStart(7)}`,
  )
}

function printHeader() {
  console.log(`${'#'.padStart(3)}  ${'Allocation'.padEnd(24)} ${'MA'.padStart(4)} ${'Bear'.padStart(5)} ${'Bull'.padStart(5)} ${'DCA'.padStart(4)} ${'Thr'.padStart(4)} ${'Invested'.padStart(9)} ${'Final'.padStart(10)} ${'Profit'.padStart(9)} ${'Return'.padStart(8)} ${'MaxDD'.padStart(8)} ${'R/Risk'.padStart(7)}`)
  console.log('-'.repeat(115))
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('')
  console.log('='.repeat(80))
  console.log('  BACKTEST OPTIMIZER — Grid Search')
  console.log('='.repeat(80))

  const totalCombos = ALLOC_SETS.length * MA_PERIODS.length * BEAR_CASH_PCTS.length
    * BULL_CASH_PCTS.length * DCA_MULTIPLIERS.length * REBAL_THRESHOLDS.length
  console.log(`  Grid: ${totalCombos} combinations`)
  console.log(`  MA: ${MA_PERIODS.join(', ')} | Bear%: ${BEAR_CASH_PCTS.join(', ')} | Bull%: ${BULL_CASH_PCTS.join(', ')}`)
  console.log(`  DCAx: ${DCA_MULTIPLIERS.join(', ')} | Threshold: ${REBAL_THRESHOLDS.join(', ')}%`)
  console.log(`  Allocations: ${ALLOC_SETS.length} sets`)
  console.log('')

  // Fetch data
  console.log('Downloading data...')
  const since = Date.now() - YEARS * 365.25 * 24 * 60 * 60 * 1000
  const priceData = new Map<string, Map<number, number>>()

  for (const pair of PAIRS) {
    const candles = await fetchOHLCV(pair, since)
    const map = new Map<number, number>()
    for (const c of candles) {
      map.set(new Date(c.timestamp).setUTCHours(0, 0, 0, 0), c.close)
    }
    priceData.set(pair, map)
  }

  const allTs = new Set<number>()
  for (const [, map] of priceData) for (const ts of map.keys()) allTs.add(ts)
  const timestamps = [...allTs].filter(ts => PAIRS.every(p => priceData.get(p)?.has(ts))).sort()
  const btcPrices = timestamps.map(ts => priceData.get('BTC/USDT')?.get(ts) ?? 0)

  console.log(`\n${timestamps.length} days: ${new Date(timestamps[0]!).toISOString().slice(0, 10)} -> ${new Date(timestamps[timestamps.length - 1]!).toISOString().slice(0, 10)}`)
  console.log(`\nRunning ${totalCombos} simulations...`)

  const startTime = Date.now()
  const results: Result[] = []
  let count = 0

  for (const allocSet of ALLOC_SETS) {
    for (const ma of MA_PERIODS) {
      for (const bearCash of BEAR_CASH_PCTS) {
        for (const bullCash of BULL_CASH_PCTS) {
          for (const dcaMult of DCA_MULTIPLIERS) {
            for (const thresh of REBAL_THRESHOLDS) {
              results.push(runSim(priceData, timestamps, btcPrices, {
                allocName: allocSet.name,
                allocs: allocSet.allocs,
                maPeriod: ma,
                bearCashPct: bearCash,
                bullCashPct: bullCash,
                dcaMultiplier: dcaMult,
                rebalThreshold: thresh,
              }))
              count++
              if (count % 500 === 0) process.stdout.write(`  ${count}/${totalCombos}\r`)
            }
          }
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone: ${count} sims in ${elapsed}s\n`)

  // ── TOP 15 by Return % ──────────────────────────────────────────────────
  console.log('='.repeat(115))
  console.log('  TOP 15 — BY RETURN %')
  console.log('='.repeat(115))
  printHeader()
  const byReturn = [...results].sort((a, b) => b.returnPct - a.returnPct).slice(0, 15)
  byReturn.forEach((r, i) => printRow(i + 1, r))

  // ── TOP 15 by Risk-Adjusted ────────────────────────────────────────────
  console.log('\n' + '='.repeat(115))
  console.log('  TOP 15 — BY RISK-ADJUSTED (Return% / MaxDD%)')
  console.log('='.repeat(115))
  printHeader()
  const byRisk = [...results].sort((a, b) => b.riskAdjusted - a.riskAdjusted).slice(0, 15)
  byRisk.forEach((r, i) => printRow(i + 1, r))

  // ── TOP 15 same investment ($37.5k) ─────────────────────────────────────
  const sameDCA = results.filter(r => r.params.dcaMultiplier === 1)
  console.log('\n' + '='.repeat(115))
  console.log('  TOP 15 — SAME INVESTMENT (DCA 1x, ~$37.5k)')
  console.log('='.repeat(115))
  printHeader()
  const byProfit = [...sameDCA].sort((a, b) => b.returnPct - a.returnPct).slice(0, 15)
  byProfit.forEach((r, i) => printRow(i + 1, r))

  // ── OPTIMAL ──────────────────────────────────────────────────────────────
  const best = byRisk[0]!
  const bestReturn = byReturn[0]!
  console.log('\n' + '='.repeat(80))
  console.log('  OPTIMAL CONFIGS')
  console.log('='.repeat(80))
  console.log('')
  console.log('  Best Risk-Adjusted:')
  console.log(`    ${best.params.allocName} | MA${best.params.maPeriod} | Bear${best.params.bearCashPct}% | Bull${best.params.bullCashPct}% | DCA${best.params.dcaMultiplier}x | Thr${best.params.rebalThreshold}%`)
  console.log(`    Invested: ${fmt(best.invested)} -> ${fmt(best.finalValue)} | P&L: ${fmt(best.profit)} (+${best.returnPct.toFixed(1)}%) | DD: -${best.maxDD.toFixed(1)}%`)
  console.log('')
  console.log('  Best Return:')
  console.log(`    ${bestReturn.params.allocName} | MA${bestReturn.params.maPeriod} | Bear${bestReturn.params.bearCashPct}% | Bull${bestReturn.params.bullCashPct}% | DCA${bestReturn.params.dcaMultiplier}x | Thr${bestReturn.params.rebalThreshold}%`)
  console.log(`    Invested: ${fmt(bestReturn.invested)} -> ${fmt(bestReturn.finalValue)} | P&L: ${fmt(bestReturn.profit)} (+${bestReturn.returnPct.toFixed(1)}%) | DD: -${bestReturn.maxDD.toFixed(1)}%`)
  console.log('')
  console.log('='.repeat(80))
}

main().catch(console.error)
