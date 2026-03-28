/**
 * Backtest: Compare DCA + trend-following filter scenarios
 */
import { connectDB, disconnectDB } from '../src/db/connection'
import { OhlcvCandleModel } from '../src/db/models'

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
const ALLOCS: Record<string, number> = { BTC: 40, ETH: 15, SOL: 20, BNB: 25 }
const FEE = 0.001

function sma(arr: number[], period: number): number | null {
  if (arr.length < period) return null
  let sum = 0
  for (let i = arr.length - period; i < arr.length; i++) sum += arr[i]!
  return sum / period
}

interface Scenario {
  name: string; trendFilter: boolean; maLen?: number; bearCashPct?: number
  cashPct: number; dcaMultiplier?: number
}

async function run() {
  await connectDB()
  const now = Date.now()
  const start = now - 5 * 365 * 86400000

  // Load prices
  const pd: Record<string, Record<number, number>> = {}
  for (const pair of PAIRS) {
    const candles = await OhlcvCandleModel.find({ pair, timeframe: '1d', timestamp: { $gte: start, $lte: now } }).sort({ timestamp: 1 }).lean()
    pd[pair] = {}
    for (const c of candles) pd[pair]![c.timestamp] = c.close
  }

  // Common timeline
  const allTs = new Set(Object.keys(pd['BTC/USDT']!).map(Number))
  for (const pair of PAIRS.slice(1)) {
    const ts = new Set(Object.keys(pd[pair]!).map(Number))
    for (const t of allTs) if (!ts.has(t)) allTs.delete(t)
  }
  const timeline = [...allTs].sort((a, b) => a - b)
  const btcPrices = timeline.map(t => pd['BTC/USDT']![t]!)

  const scenarios: Scenario[] = [
    { name: 'Current (no filter)', trendFilter: false, cashPct: 10 },
    { name: 'MA200 → 70% cash', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10 },
    { name: 'MA200 → 80% cash', trendFilter: true, maLen: 200, bearCashPct: 80, cashPct: 10 },
    { name: 'MA100 → 70% cash', trendFilter: true, maLen: 100, bearCashPct: 70, cashPct: 10 },
    { name: 'MA200 + DCA 2x bear', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10, dcaMultiplier: 2 },
    { name: 'MA200 + DCA 3x bear', trendFilter: true, maLen: 200, bearCashPct: 70, cashPct: 10, dcaMultiplier: 3 },
  ]

  const results: { name: string; inv: number; final: number; profit: number; ret: number; mdd: number; fees: number; trades: number }[] = []

  for (const sc of scenarios) {
    const h: Record<string, number> = {}
    let cash = 0, inv = 0, fees = 0, trades = 0, peak = 0, mdd = 0

    for (let i = 0; i < timeline.length; i++) {
      const prices: Record<string, number> = {}
      for (const pair of PAIRS) prices[pair.split('/')[0]!] = pd[pair]![timeline[i]!]!

      // Trend check
      let bull = true
      if (sc.trendFilter && sc.maLen && i >= sc.maLen) {
        const ma = sma(btcPrices.slice(0, i + 1), sc.maLen)
        bull = ma !== null && btcPrices[i]! >= ma
      }

      // DCA deposit
      let dep = i === 0 ? 1000 : 20
      if (sc.dcaMultiplier && !bull && i > 0) dep *= sc.dcaMultiplier
      inv += dep

      // Portfolio value
      let cv = Object.entries(h).reduce((s, [a, q]) => s + q * (prices[a] ?? 0), 0)
      let tv = cv + cash

      if (sc.trendFilter && !bull && cv > 0) {
        // BEAR: sell to target cash level
        const targetCash = tv * ((sc.bearCashPct ?? 70) / 100)
        if (cash < targetCash) {
          const sellRatio = Math.min(1, (targetCash - cash) / cv)
          for (const [a, q] of Object.entries(h)) {
            const sq = q * sellRatio
            cash += sq * prices[a]! * (1 - FEE)
            fees += sq * prices[a]! * FEE
            h[a] = q - sq
            trades++
          }
        }
        cash += dep // DCA goes to cash in bear
      } else {
        // BULL: DCA route to most underweight
        const cryptoPool = tv * (1 - sc.cashPct / 100)
        let maxDrift = -Infinity, target: string | null = null
        for (const [asset, pct] of Object.entries(ALLOCS)) {
          const held = (h[asset] ?? 0) * prices[asset]!
          const targetUsd = (pct / 100) * (cryptoPool > 0 ? cryptoPool : tv)
          const drift = targetUsd - held
          if (drift > maxDrift) { maxDrift = drift; target = asset }
        }
        if (target && maxDrift > 0) {
          h[target] = (h[target] ?? 0) + dep / prices[target]!
        } else {
          cash += dep
        }

        // Re-deploy excess cash in bull
        const normalCash = tv * (sc.cashPct / 100)
        if (bull && cash > normalCash * 1.5) {
          const excess = cash - normalCash
          let md2 = -Infinity, t2: string | null = null
          for (const [asset, pct] of Object.entries(ALLOCS)) {
            const held = (h[asset] ?? 0) * prices[asset]!
            const targetUsd = (pct / 100) * cryptoPool
            const drift = targetUsd - held
            if (drift > md2) { md2 = drift; t2 = asset }
          }
          if (t2 && md2 > 0) {
            const buyAmt = Math.min(excess, md2)
            h[t2] = (h[t2] ?? 0) + (buyAmt * (1 - FEE)) / prices[t2]!
            cash -= buyAmt
            fees += buyAmt * FEE
            trades++
          }
        }
      }

      // Drawdown tracking
      cv = Object.entries(h).reduce((s, [a, q]) => s + q * (prices[a] ?? 0), 0)
      tv = cv + cash
      if (tv > peak) peak = tv
      const dd = peak > 0 ? ((tv - peak) / peak) * 100 : 0
      if (dd < mdd) mdd = dd
    }

    // Final value
    const finalPrices: Record<string, number> = {}
    for (const pair of PAIRS) finalPrices[pair.split('/')[0]!] = pd[pair]![timeline[timeline.length - 1]!]!
    let finalVal = cash
    for (const [a, q] of Object.entries(h)) finalVal += q * (finalPrices[a] ?? 0)
    results.push({ name: sc.name, inv, final: finalVal, profit: finalVal - inv, ret: ((finalVal - inv) / inv) * 100, mdd, fees, trades })
  }

  results.sort((a, b) => b.ret - a.ret)
  console.log('')
  console.log('Rank  Strategy                    Invested      Final     Profit   Return%  MaxDD%    Fees  Trades')
  console.log('-'.repeat(100))
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    console.log(
      `${String(i + 1).padStart(2)}    ${r.name.padEnd(28)}$${r.inv.toLocaleString().padStart(8)}  $${r.final.toFixed(0).padStart(8)}  $${r.profit.toFixed(0).padStart(7)}  ${(r.ret.toFixed(1) + '%').padStart(8)}  ${(r.mdd.toFixed(1) + '%').padStart(7)}  $${r.fees.toFixed(0).padStart(5)}  ${String(r.trades).padStart(6)}`
    )
  }

  await disconnectDB()
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
