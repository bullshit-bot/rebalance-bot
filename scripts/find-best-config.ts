/**
 * Grid search: find best DCA + Trend Filter config
 * Tests MA period, bear cash %, cooldown, threshold combinations
 *
 * Usage: bun run scripts/find-best-config.ts
 */
import { connectDB } from '../src/db/connection'
import { backtestSimulator } from '../src/backtesting/backtest-simulator'
import type { BacktestConfig } from '../src/backtesting/backtest-simulator'
import type { Allocation, ExchangeName } from '../src/types/index'

// ─── Fixed config ────────────────────────────────────────────────────────────

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
const ALLOCATIONS: Allocation[] = [
  { asset: 'BTC', targetPct: 40 },
  { asset: 'ETH', targetPct: 25 },
  { asset: 'SOL', targetPct: 20 },
  { asset: 'BNB', targetPct: 15 },
]
const INITIAL = 1000
const FEE = 0.001
const DCA = 20 // $/day
const EXCHANGE: ExchangeName = 'binance'
const YEARS = 5

// ─── Grid parameters ─────────────────────────────────────────────────────────

const MA_PERIODS = [50, 70, 80, 90, 100, 110, 120, 150, 200]
const BEAR_CASH_PCTS = [70, 80, 90, 100]
const COOLDOWN_DAYS = [1, 2, 3, 5, 7]
const THRESHOLDS = [2, 3, 4, 5, 6, 8, 10]
const CASH_RESERVES = [0]
const TREND_BUFFERS = [0, 1, 2, 3]

// Total combos: 9 × 4 × 5 × 7 × 1 × 4 = 5040

// ─── Types ───────────────────────────────────────────────────────────────────

interface Result {
  label: string
  ma: number
  bearCash: number
  cooldown: number
  threshold: number
  cashReserve: number
  buffer: number
  returnPct: number
  annualized: number
  sharpe: number
  maxDD: number
  trades: number
  fees: number
  score: number
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB()

  const now = Date.now()
  const startDate = now - YEARS * 365 * 24 * 60 * 60 * 1000

  const combos: Array<{
    ma: number; bearCash: number; cooldown: number; threshold: number; cashReserve: number; buffer: number
  }> = []

  for (const ma of MA_PERIODS) {
    for (const bear of BEAR_CASH_PCTS) {
      for (const cd of COOLDOWN_DAYS) {
        for (const th of THRESHOLDS) {
          for (const cr of CASH_RESERVES) {
            for (const buf of TREND_BUFFERS) {
              combos.push({ ma, bearCash: bear, cooldown: cd, threshold: th, cashReserve: cr, buffer: buf })
            }
          }
        }
      }
    }
  }

  console.log(`\n=== DCA + Trend Filter Grid Search ===`)
  console.log(`Combos: ${combos.length} | Pairs: ${PAIRS.join(', ')} | DCA: $${DCA}/day`)
  console.log(`Initial: $${INITIAL} | Period: ${YEARS}Y | Fee: ${FEE * 100}%\n`)

  const results: Result[] = []
  let done = 0

  for (const c of combos) {
    done++
    if (done % 50 === 0) process.stdout.write(`\rProgress: ${done}/${combos.length}`)

    try {
      const config: BacktestConfig = {
        exchange: EXCHANGE,
        pairs: PAIRS,
        timeframe: '1d' as const,
        allocations: ALLOCATIONS,
        startDate,
        endDate: now,
        initialBalance: INITIAL,
        threshold: c.threshold,
        feePct: FEE,
        dcaAmountUsd: DCA,
        dcaIntervalCandles: 1,
        trendFilterMaPeriod: c.ma,
        trendFilterBearCashPct: c.bearCash,
        trendFilterCooldownCandles: c.cooldown,
        trendFilterBuffer: c.buffer,
        cashReservePct: c.cashReserve,
      }

      const res = await backtestSimulator.run(config)
      const m = res.metrics

      // Composite score: prioritize Sharpe (risk-adjusted) and return
      const normReturn = Math.max(0, m.totalReturnPct) / 300 // normalize ~300% max
      const normDD = 1 - Math.min(Math.abs(m.maxDrawdownPct), 100) / 100
      const score = 0.35 * m.sharpeRatio + 0.35 * normReturn + 0.3 * normDD

      if (done <= 3) console.log(`\nCombo result: return=${m.totalReturnPct.toFixed(1)}% sharpe=${m.sharpeRatio.toFixed(2)} dd=${m.maxDrawdownPct.toFixed(1)}%`)
      results.push({
        label: `MA${c.ma}-bear${c.bearCash}-cd${c.cooldown}-th${c.threshold}-buf${c.buffer}`,
        ma: c.ma, bearCash: c.bearCash, cooldown: c.cooldown,
        threshold: c.threshold, cashReserve: c.cashReserve, buffer: c.buffer,
        returnPct: m.totalReturnPct,
        annualized: m.annualizedReturnPct,
        sharpe: m.sharpeRatio,
        maxDD: m.maxDrawdownPct,
        trades: m.totalTrades,
        fees: m.totalFeesPaid,
        score,
      })
    } catch (err) {
      if (done <= 3) console.error(`\nCombo failed:`, c, err instanceof Error ? err.message : err)
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  // Print top 30
  console.log(`\n\n=== TOP 30 RESULTS ===\n`)
  console.log(
    pad('Rank', 5) + pad('Config', 35) + pad('Return%', 10) + pad('Annual%', 10) +
    pad('Sharpe', 8) + pad('MaxDD%', 9) + pad('Trades', 8) + pad('Score', 8)
  )
  console.log('-'.repeat(93))

  for (let i = 0; i < Math.min(30, results.length); i++) {
    const r = results[i]!
    console.log(
      pad(String(i + 1), 5) +
      pad(r.label, 35) +
      pad(r.returnPct.toFixed(1), 10) +
      pad(r.annualized.toFixed(1), 10) +
      pad(r.sharpe.toFixed(2), 8) +
      pad(r.maxDD.toFixed(1), 9) +
      pad(String(r.trades), 8) +
      pad(r.score.toFixed(4), 8)
    )
  }

  // Summary
  const best = results[0]!
  console.log(`\n=== BEST CONFIG ===`)
  console.log(`MA Period: ${best.ma}`)
  console.log(`Bear Cash: ${best.bearCash}%`)
  console.log(`Cooldown: ${best.cooldown} days`)
  console.log(`Threshold: ${best.threshold}%`)
  console.log(`Trend Buffer: ${best.buffer}%`)
  console.log(`Cash Reserve: ${best.cashReserve}%`)
  console.log(`Return: +${best.returnPct.toFixed(1)}% | Annual: +${best.annualized.toFixed(1)}%`)
  console.log(`Sharpe: ${best.sharpe.toFixed(2)} | MaxDD: ${best.maxDD.toFixed(1)}%`)
  console.log(`Trades: ${best.trades} | Fees: $${best.fees.toFixed(2)}`)

  process.exit(0)
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
