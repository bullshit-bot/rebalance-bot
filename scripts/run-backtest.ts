/**
 * Backtest script: 5-year rebalance + DCA strategy vs buy-and-hold
 * Uses Binance public REST API (no API key needed)
 *
 * Usage: bun run scripts/run-backtest.ts
 */

// ─── Config ──────────────────────────────────────────────────────────────────
const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
const ALLOCATIONS = [
  { asset: 'BTC', targetPct: 0.40 },
  { asset: 'ETH', targetPct: 0.30 },
  { asset: 'BNB', targetPct: 0.15 },
  { asset: 'SOL', targetPct: 0.15 },
]
const INITIAL_BALANCE = 1_000     // $1,000
const DCA_DAILY_AMOUNT = 20       // $20/day
const REBALANCE_THRESHOLD = 5     // 5% drift triggers rebalance
const FEE_PCT = 0.001             // 0.1% per trade (Binance spot)
const TIMEFRAME = '1d'
const YEARS = 5

// ─── Binance Public API ──────────────────────────────────────────────────────
const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines'

interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

async function fetchOHLCV(pair: string, since: number): Promise<Candle[]> {
  const symbol = pair.replace('/', '')
  const allCandles: Candle[] = []
  let cursor = since
  const endTime = Date.now()

  process.stdout.write(`  Fetching ${pair}...`)

  while (cursor < endTime) {
    const url = new URL(BINANCE_KLINES_URL)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', TIMEFRAME)
    url.searchParams.set('startTime', String(cursor))
    url.searchParams.set('endTime', String(endTime))
    url.searchParams.set('limit', '1000')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Binance API ${res.status}: ${await res.text()}`)

    const raw = (await res.json()) as (string | number)[][]
    if (raw.length === 0) break

    for (const c of raw) {
      allCandles.push({
        timestamp: c[0] as number,
        open: parseFloat(c[1] as string),
        high: parseFloat(c[2] as string),
        low: parseFloat(c[3] as string),
        close: parseFloat(c[4] as string),
        volume: parseFloat(c[5] as string),
      })
    }

    const lastTs = raw[raw.length - 1]![0] as number
    cursor = lastTs + 86400000
    if (raw.length < 1000) break
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(` ${allCandles.length} candles`)
  return allCandles
}

// ─── Simulation ──────────────────────────────────────────────────────────────
interface SimResult {
  label: string
  finalValue: number
  totalInvested: number
  returnPct: number
  returnUsd: number
  rebalanceCount: number
  totalTrades: number
  totalFees: number
  maxDrawdownPct: number
  equityCurve: { date: string; value: number }[]
}

function portfolioValue(
  holdings: Record<string, number>,
  prices: Record<string, number>,
): number {
  let total = 0
  for (const alloc of ALLOCATIONS) {
    const price = prices[alloc.asset] ?? 0
    total += (holdings[alloc.asset] ?? 0) * price
  }
  return total
}

function maxDrawdown(curve: number[]): number {
  let peak = curve[0] ?? 0
  let maxDD = 0
  for (const v of curve) {
    if (v > peak) peak = v
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

function simulate(
  priceData: Map<string, Map<number, number>>,
  timestamps: number[],
): { rebalanceDCA: SimResult; holdDCA: SimResult; holdNoDCA: SimResult } {
  // ── Strategy 1: Rebalance + DCA ──────────────────────────────────────────
  const rebalHoldings: Record<string, number> = {}
  let rebalCash = 0
  let rebalTrades = 0
  let rebalFees = 0
  let rebalCount = 0
  const rebalCurveValues: number[] = []
  const rebalCurve: { date: string; value: number }[] = []

  // ── Strategy 2: Buy-and-hold + DCA (same allocation, no rebalance) ─────
  const holdDCAHoldings: Record<string, number> = {}

  // ── Strategy 3: Buy-and-hold, no DCA (lump sum only) ───────────────────
  const holdNoDCAHoldings: Record<string, number> = {}

  const holdDCACurveValues: number[] = []
  const holdNoDCACurveValues: number[] = []
  const holdDCACurve: { date: string; value: number }[] = []
  const holdNoDCACurve: { date: string; value: number }[] = []

  // Initialize all portfolios at first day
  const firstPrices: Record<string, number> = {}
  for (const alloc of ALLOCATIONS) {
    const pair = `${alloc.asset}/USDT`
    const price = priceData.get(pair)?.get(timestamps[0]!)
    if (!price) throw new Error(`No price for ${pair} at start`)
    firstPrices[alloc.asset] = price

    const usdAmount = INITIAL_BALANCE * alloc.targetPct
    const amount = usdAmount / price
    rebalHoldings[alloc.asset] = amount
    holdDCAHoldings[alloc.asset] = amount
    holdNoDCAHoldings[alloc.asset] = amount
  }

  let totalInvested = INITIAL_BALANCE
  const totalDays = timestamps.length

  // ── Daily loop ─────────────────────────────────────────────────────────────
  for (let i = 0; i < totalDays; i++) {
    const ts = timestamps[i]!
    const prices: Record<string, number> = {}
    for (const alloc of ALLOCATIONS) {
      const pair = `${alloc.asset}/USDT`
      prices[alloc.asset] = priceData.get(pair)?.get(ts) ?? 0
    }

    // ── DCA: add $20/day (skip first day, already invested) ──────────────
    if (i > 0) {
      totalInvested += DCA_DAILY_AMOUNT
      for (const alloc of ALLOCATIONS) {
        const dcaUsd = DCA_DAILY_AMOUNT * alloc.targetPct
        const price = prices[alloc.asset]
        if (price && price > 0) {
          rebalHoldings[alloc.asset] = (rebalHoldings[alloc.asset] ?? 0) + dcaUsd / price
          holdDCAHoldings[alloc.asset] = (holdDCAHoldings[alloc.asset] ?? 0) + dcaUsd / price
        }
      }
    }

    // ── Rebalance check (strategy 1 only) ────────────────────────────────
    const totalValue = portfolioValue(rebalHoldings, prices)
    let maxDrift = 0
    for (const alloc of ALLOCATIONS) {
      const currentPct = totalValue > 0
        ? ((rebalHoldings[alloc.asset] ?? 0) * (prices[alloc.asset] ?? 0)) / totalValue
        : 0
      const drift = Math.abs(currentPct - alloc.targetPct) * 100
      if (drift > maxDrift) maxDrift = drift
    }

    if (maxDrift > REBALANCE_THRESHOLD) {
      rebalCount++
      for (const alloc of ALLOCATIONS) {
        const price = prices[alloc.asset]
        if (!price || price <= 0) continue

        const currentValue = (rebalHoldings[alloc.asset] ?? 0) * price
        const targetValue = totalValue * alloc.targetPct
        const diff = targetValue - currentValue

        if (Math.abs(diff) > 10) {
          const fee = Math.abs(diff) * FEE_PCT
          rebalFees += fee
          rebalTrades++

          if (diff > 0) {
            rebalHoldings[alloc.asset] = (rebalHoldings[alloc.asset] ?? 0) + (diff - fee) / price
          } else {
            rebalHoldings[alloc.asset] = (rebalHoldings[alloc.asset] ?? 0) + (diff + fee) / price
          }
        }
      }
    }

    // ── Record equity curves ─────────────────────────────────────────────
    const rebalVal = portfolioValue(rebalHoldings, prices)
    const holdDCAVal = portfolioValue(holdDCAHoldings, prices)
    const holdNoDCAVal = portfolioValue(holdNoDCAHoldings, prices)

    rebalCurveValues.push(rebalVal)
    holdDCACurveValues.push(holdDCAVal)
    holdNoDCACurveValues.push(holdNoDCAVal)

    const date = new Date(ts).toISOString().slice(0, 10)
    // Record weekly snapshots for display
    if (new Date(ts).getDay() === 0) {
      rebalCurve.push({ date, value: Math.round(rebalVal) })
      holdDCACurve.push({ date, value: Math.round(holdDCAVal) })
      holdNoDCACurve.push({ date, value: Math.round(holdNoDCAVal) })
    }
  }

  // ── Final values ─────────────────────────────────────────────────────────
  const finalRebal = rebalCurveValues[rebalCurveValues.length - 1] ?? 0
  const finalHoldDCA = holdDCACurveValues[holdDCACurveValues.length - 1] ?? 0
  const finalHoldNoDCA = holdNoDCACurveValues[holdNoDCACurveValues.length - 1] ?? 0

  return {
    rebalanceDCA: {
      label: 'Rebalance + DCA',
      finalValue: finalRebal,
      totalInvested,
      returnPct: ((finalRebal - totalInvested) / totalInvested) * 100,
      returnUsd: finalRebal - totalInvested,
      rebalanceCount: rebalCount,
      totalTrades: rebalTrades,
      totalFees: rebalFees,
      maxDrawdownPct: maxDrawdown(rebalCurveValues),
      equityCurve: rebalCurve,
    },
    holdDCA: {
      label: 'Buy & Hold + DCA',
      finalValue: finalHoldDCA,
      totalInvested,
      returnPct: ((finalHoldDCA - totalInvested) / totalInvested) * 100,
      returnUsd: finalHoldDCA - totalInvested,
      rebalanceCount: 0,
      totalTrades: 0,
      totalFees: 0,
      maxDrawdownPct: maxDrawdown(holdDCACurveValues),
      equityCurve: holdDCACurve,
    },
    holdNoDCA: {
      label: 'Buy & Hold (no DCA)',
      finalValue: finalHoldNoDCA,
      totalInvested: INITIAL_BALANCE,
      returnPct: ((finalHoldNoDCA - INITIAL_BALANCE) / INITIAL_BALANCE) * 100,
      returnUsd: finalHoldNoDCA - INITIAL_BALANCE,
      rebalanceCount: 0,
      totalTrades: 0,
      totalFees: 0,
      maxDrawdownPct: maxDrawdown(holdNoDCACurveValues),
      equityCurve: holdNoDCACurve,
    },
  }
}

// ─── Trend Filter Simulation ─────────────────────────────────────────────────

interface TrendScenario {
  name: string
  trendFilter: boolean
  maLen?: number
  bearCashPct?: number
  cashPct: number
  dcaMultiplier?: number
}

interface TrendResult {
  name: string
  invested: number
  finalValue: number
  profit: number
  returnPct: number
  maxDrawdownPct: number
  fees: number
  trades: number
}

function sma(arr: number[], period: number): number | null {
  if (arr.length < period) return null
  let sum = 0
  for (let i = arr.length - period; i < arr.length; i++) sum += arr[i]!
  return sum / period
}

function simulateTrendScenarios(
  priceData: Map<string, Map<number, number>>,
  timestamps: number[],
): TrendResult[] {
  // BTC price history for trend filter
  const btcPrices = timestamps.map(ts => priceData.get('BTC/USDT')?.get(ts) ?? 0)

  const scenarios: TrendScenario[] = [
    { name: 'Rebal+DCA (no filter)', trendFilter: false, cashPct: 0 },
    { name: 'MA200 -> 70% cash', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10 },
    { name: 'MA200 -> 80% cash', trendFilter: true, maLen: 200, bearCashPct: 80, cashPct: 10 },
    { name: 'MA100 -> 70% cash', trendFilter: true, maLen: 100, bearCashPct: 70, cashPct: 10 },
    { name: 'MA200 + DCA 2x bear', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10, dcaMultiplier: 2 },
    { name: 'MA200 + DCA 3x bear', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10, dcaMultiplier: 3 },
  ]

  const results: TrendResult[] = []

  for (const sc of scenarios) {
    const h: Record<string, number> = {} // asset holdings
    let cash = 0
    let invested = 0
    let fees = 0
    let trades = 0
    let peak = 0
    let mdd = 0

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i]!
      const prices: Record<string, number> = {}
      for (const alloc of ALLOCATIONS) {
        prices[alloc.asset] = priceData.get(`${alloc.asset}/USDT`)?.get(ts) ?? 0
      }

      // Trend check: BTC above MA = bull
      let bull = true
      if (sc.trendFilter && sc.maLen && i >= sc.maLen) {
        const ma = sma(btcPrices.slice(0, i + 1), sc.maLen)
        bull = ma !== null && btcPrices[i]! >= ma
      }

      // Daily deposit
      let deposit = i === 0 ? INITIAL_BALANCE : DCA_DAILY_AMOUNT
      if (sc.dcaMultiplier && !bull && i > 0) deposit *= sc.dcaMultiplier
      invested += deposit

      // Current crypto value
      let cryptoValue = 0
      for (const alloc of ALLOCATIONS) {
        cryptoValue += (h[alloc.asset] ?? 0) * prices[alloc.asset]!
      }
      const totalValue = cryptoValue + cash

      if (sc.trendFilter && !bull && cryptoValue > 0) {
        // BEAR MODE: sell crypto to target cash level
        const targetCash = totalValue * ((sc.bearCashPct ?? 70) / 100)
        if (cash < targetCash && cryptoValue > 0) {
          const sellRatio = Math.min(1, (targetCash - cash) / cryptoValue)
          for (const alloc of ALLOCATIONS) {
            const qty = (h[alloc.asset] ?? 0) * sellRatio
            cash += qty * prices[alloc.asset]! * (1 - FEE_PCT)
            fees += qty * prices[alloc.asset]! * FEE_PCT
            h[alloc.asset] = (h[alloc.asset] ?? 0) - qty
            trades++
          }
        }
        cash += deposit // DCA goes to cash in bear
      } else {
        // BULL MODE: DCA into most underweight asset
        const cryptoPool = totalValue * (1 - sc.cashPct / 100)
        let maxDriftVal = -Infinity
        let target: string | null = null
        for (const alloc of ALLOCATIONS) {
          const held = (h[alloc.asset] ?? 0) * prices[alloc.asset]!
          const targetUsd = (alloc.targetPct) * (cryptoPool > 0 ? cryptoPool : totalValue)
          const drift = targetUsd - held
          if (drift > maxDriftVal) { maxDriftVal = drift; target = alloc.asset }
        }
        if (target && maxDriftVal > 0 && prices[target]! > 0) {
          h[target] = (h[target] ?? 0) + deposit / prices[target]!
        } else {
          cash += deposit
        }

        // Re-deploy excess cash in bull
        const normalCash = totalValue * (sc.cashPct / 100)
        if (bull && cash > normalCash * 1.5) {
          const excess = cash - normalCash
          let md2 = -Infinity
          let t2: string | null = null
          for (const alloc of ALLOCATIONS) {
            const held = (h[alloc.asset] ?? 0) * prices[alloc.asset]!
            const targetUsd = alloc.targetPct * cryptoPool
            const drift = targetUsd - held
            if (drift > md2) { md2 = drift; t2 = alloc.asset }
          }
          if (t2 && md2 > 0 && prices[t2]! > 0) {
            const buyAmt = Math.min(excess, md2)
            h[t2] = (h[t2] ?? 0) + (buyAmt * (1 - FEE_PCT)) / prices[t2]!
            cash -= buyAmt
            fees += buyAmt * FEE_PCT
            trades++
          }
        }
      }

      // Drawdown tracking
      let totalVal = cash
      for (const alloc of ALLOCATIONS) {
        totalVal += (h[alloc.asset] ?? 0) * prices[alloc.asset]!
      }
      if (totalVal > peak) peak = totalVal
      const dd = peak > 0 ? ((peak - totalVal) / peak) * 100 : 0
      if (dd > mdd) mdd = dd
    }

    // Final value
    const lastTs = timestamps[timestamps.length - 1]!
    let finalVal = cash
    for (const alloc of ALLOCATIONS) {
      const price = priceData.get(`${alloc.asset}/USDT`)?.get(lastTs) ?? 0
      finalVal += (h[alloc.asset] ?? 0) * price
    }

    results.push({
      name: sc.name,
      invested,
      finalValue: finalVal,
      profit: finalVal - invested,
      returnPct: ((finalVal - invested) / invested) * 100,
      maxDrawdownPct: mdd,
      fees,
      trades,
    })
  }

  return results.sort((a, b) => b.returnPct - a.returnPct)
}

// ─── Display helpers ─────────────────────────────────────────────────────────
function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

function printResult(r: SimResult) {
  console.log(`  ${r.label}:`)
  console.log(`     Total invested: ${formatUsd(r.totalInvested)}`)
  console.log(`     Final value:    ${formatUsd(r.finalValue)}`)
  console.log(`     P&L:            ${r.returnUsd >= 0 ? '+' : ''}${formatUsd(r.returnUsd)} (${r.returnPct >= 0 ? '+' : ''}${r.returnPct.toFixed(1)}%)`)
  console.log(`     Max drawdown:   -${r.maxDrawdownPct.toFixed(1)}%`)
  if (r.rebalanceCount > 0) {
    console.log(`     Rebalances:     ${r.rebalanceCount}`)
    console.log(`     Total trades:   ${r.totalTrades}`)
    console.log(`     Total fees:     ${formatUsd(r.totalFees)}`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const totalDCAExpected = DCA_DAILY_AMOUNT * YEARS * 365
  console.log('')
  console.log('='.repeat(62))
  console.log('  CRYPTO PORTFOLIO BACKTEST — Rebalance + DCA')
  console.log('='.repeat(62))
  console.log(`  Initial capital:   ${formatUsd(INITIAL_BALANCE)}`)
  console.log(`  DCA:               ${formatUsd(DCA_DAILY_AMOUNT)}/day`)
  console.log(`  Total DCA (est):   ~${formatUsd(totalDCAExpected)} over ${YEARS} years`)
  console.log(`  Total invested:    ~${formatUsd(INITIAL_BALANCE + totalDCAExpected)}`)
  console.log(`  Threshold:         ${REBALANCE_THRESHOLD}% drift`)
  console.log(`  Fee:               ${FEE_PCT * 100}% per trade`)
  console.log(`  Assets:            ${ALLOCATIONS.map(a => `${a.asset} ${a.targetPct * 100}%`).join(' | ')}`)
  console.log(`  Period:            ${YEARS} years`)
  console.log('')

  const since = Date.now() - YEARS * 365.25 * 24 * 60 * 60 * 1000

  console.log('Downloading OHLCV data from Binance...')
  const priceData = new Map<string, Map<number, number>>()

  for (const pair of PAIRS) {
    const candles = await fetchOHLCV(pair, since)
    const map = new Map<number, number>()
    for (const c of candles) {
      const day = new Date(c.timestamp).setUTCHours(0, 0, 0, 0)
      map.set(day, c.close)
    }
    priceData.set(pair, map)
  }

  // Find common timestamps where all pairs have data
  const allTimestamps = new Set<number>()
  for (const [, map] of priceData) {
    for (const ts of map.keys()) allTimestamps.add(ts)
  }
  const timestamps = [...allTimestamps]
    .filter(ts => PAIRS.every(p => priceData.get(p)?.has(ts)))
    .sort()

  console.log(`\nCommon trading days: ${timestamps.length}`)
  console.log(`From: ${new Date(timestamps[0]!).toISOString().slice(0, 10)}`)
  console.log(`To:   ${new Date(timestamps[timestamps.length - 1]!).toISOString().slice(0, 10)}`)

  console.log('\nRunning simulation...\n')
  const { rebalanceDCA, holdDCA, holdNoDCA } = simulate(priceData, timestamps)

  // ── Asset prices comparison ──────────────────────────────────────────────
  console.log('='.repeat(62))
  console.log('  ASSET PRICES')
  console.log('='.repeat(62))
  for (const alloc of ALLOCATIONS) {
    const pair = `${alloc.asset}/USDT`
    const firstPrice = priceData.get(pair)?.get(timestamps[0]!)
    const lastPrice = priceData.get(pair)?.get(timestamps[timestamps.length - 1]!)
    if (firstPrice && lastPrice) {
      const change = ((lastPrice - firstPrice) / firstPrice) * 100
      console.log(`  ${alloc.asset.padEnd(5)} ${formatUsd(firstPrice).padStart(10)} -> ${formatUsd(lastPrice).padStart(10)}  (${change >= 0 ? '+' : ''}${change.toFixed(0)}%)`)
    }
  }

  // ── Results ──────────────────────────────────────────────────────────────
  console.log('')
  console.log('='.repeat(62))
  console.log('  RESULTS')
  console.log('='.repeat(62))
  console.log('')
  printResult(rebalanceDCA)
  console.log('')
  printResult(holdDCA)
  console.log('')
  printResult(holdNoDCA)

  // ── Comparison ───────────────────────────────────────────────────────────
  console.log('')
  console.log('-'.repeat(62))
  console.log('  COMPARISON')
  console.log('-'.repeat(62))
  const rebalVsHoldDCA = rebalanceDCA.finalValue - holdDCA.finalValue
  const rebalVsHoldNoDCA = rebalanceDCA.finalValue - holdNoDCA.finalValue
  console.log(`  Rebalance+DCA vs Hold+DCA:     ${rebalVsHoldDCA >= 0 ? '+' : ''}${formatUsd(rebalVsHoldDCA)} (${rebalVsHoldDCA >= 0 ? '+' : ''}${((rebalVsHoldDCA / holdDCA.finalValue) * 100).toFixed(1)}%)`)
  console.log(`  Rebalance+DCA vs Hold(no DCA): ${rebalVsHoldNoDCA >= 0 ? '+' : ''}${formatUsd(rebalVsHoldNoDCA)}`)
  console.log(`  DCA impact (Hold+DCA vs Hold): +${formatUsd(holdDCA.finalValue - holdNoDCA.finalValue)}`)
  console.log('')
  console.log('='.repeat(62))

  // ── Trend Filter Scenarios ────────────────────────────────────────────────
  console.log('')
  console.log('='.repeat(110))
  console.log('  TREND FILTER SCENARIOS (BTC MA as bull/bear signal)')
  console.log('='.repeat(110))
  console.log('')
  const trendResults = simulateTrendScenarios(priceData, timestamps)

  console.log(`${'Rank'.padStart(4)}  ${'Strategy'.padEnd(28)} ${'Invested'.padStart(10)} ${'Final'.padStart(10)} ${'Profit'.padStart(10)} ${'Return'.padStart(8)} ${'MaxDD'.padStart(8)} ${'Fees'.padStart(8)} ${'Trades'.padStart(7)}`)
  console.log('-'.repeat(110))
  for (let i = 0; i < trendResults.length; i++) {
    const r = trendResults[i]!
    console.log(
      `${String(i + 1).padStart(4)}  ${r.name.padEnd(28)} ${formatUsd(r.invested).padStart(10)} ${formatUsd(r.finalValue).padStart(10)} ${formatUsd(r.profit).padStart(10)} ${(r.returnPct.toFixed(1) + '%').padStart(8)} ${('-' + r.maxDrawdownPct.toFixed(1) + '%').padStart(8)} ${formatUsd(r.fees).padStart(8)} ${String(r.trades).padStart(7)}`,
    )
  }
  console.log('')
  console.log('='.repeat(110))

  // ── Equity Curve (last 12 months) ────────────────────────────────────────
  console.log('\nEquity Curve (last 12 months, monthly):')
  console.log(`${'Date'.padEnd(12)} ${'Rebal+DCA'.padStart(12)} ${'Hold+DCA'.padStart(12)} ${'Hold only'.padStart(12)}`)
  console.log('-'.repeat(50))
  const recent = rebalanceDCA.equityCurve.slice(-52)
  for (let i = 0; i < recent.length; i += 4) {
    const r = recent[i]!
    const h = holdDCA.equityCurve.slice(-52)[i]
    const n = holdNoDCA.equityCurve.slice(-52)[i]
    console.log(
      `${r.date.padEnd(12)} ${formatUsd(r.value).padStart(12)} ${formatUsd(h?.value ?? 0).padStart(12)} ${formatUsd(n?.value ?? 0).padStart(12)}`,
    )
  }
}

main().catch(console.error)
