/**
 * Smart DCA Backtest Comparison
 * Runs 4 configs and compares fixed vs smart DCA performance.
 * Usage: bun run scripts/smart-dca-backtest.ts
 */
import { connectDB, disconnectDB } from "../src/db/connection";
import { backtestSimulator } from "../src/backtesting/backtest-simulator";
import type { BacktestConfig } from "../src/backtesting/metrics-calculator";

const BASE_CONFIG: Omit<BacktestConfig, "smartDcaEnabled" | "smartDcaDipMultiplier" | "smartDcaHighMultiplier"> = {
  pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"],
  allocations: [
    { asset: "BTC", targetPct: 40, exchange: "binance" as const, minTradeUsd: 10 },
    { asset: "ETH", targetPct: 25, exchange: "binance" as const, minTradeUsd: 10 },
    { asset: "SOL", targetPct: 20, exchange: "binance" as const, minTradeUsd: 10 },
    { asset: "BNB", targetPct: 15, exchange: "binance" as const, minTradeUsd: 10 },
  ],
  startDate: new Date("2021-03-30").getTime(),
  endDate: new Date("2026-03-29").getTime(),
  initialBalance: 1000,
  threshold: 10,
  feePct: 0.001,
  timeframe: "1d",
  exchange: "binance" as const,
  dcaAmountUsd: 20,
  dcaIntervalCandles: 1,
  trendFilterMaPeriod: 120,
  trendFilterBearCashPct: 100,
  trendFilterCooldownCandles: 1,
  trendFilterBuffer: 0,
  simpleEarnEnabled: true,
};

interface TestCase {
  name: string;
  smartDcaEnabled: boolean;
  dipMultiplier: number;
  highMultiplier: number;
}

const CONFIGS: TestCase[] = [
  { name: "A: Fixed $20/day", smartDcaEnabled: false, dipMultiplier: 1, highMultiplier: 1 },
  { name: "B: Smart 1.5x/0.75x", smartDcaEnabled: true, dipMultiplier: 1.5, highMultiplier: 0.75 },
  { name: "C: Smart 2.0x/0.5x", smartDcaEnabled: true, dipMultiplier: 2.0, highMultiplier: 0.5 },
  { name: "D: Smart 1.25x/0.85x", smartDcaEnabled: true, dipMultiplier: 1.25, highMultiplier: 0.85 },
];

async function main() {
  await connectDB();
  console.log("Connected to MongoDB\n");
  console.log("=" .repeat(80));
  console.log("SMART DCA BACKTEST COMPARISON");
  console.log("Period: 2021-03-30 → 2026-03-29 | Initial: $1,000 | DCA base: $20/day");
  console.log("Strategy: threshold 10% | MA120 | Bear cash 100% | Earn enabled");
  console.log("=" .repeat(80));

  const results: Array<{
    name: string;
    returnPct: number;
    sharpe: number;
    maxDD: number;
    totalDca: number;
    finalValue: number;
  }> = [];

  for (const tc of CONFIGS) {
    console.log(`\nRunning: ${tc.name}...`);
    try {
      const config: BacktestConfig = {
        ...BASE_CONFIG,
        smartDcaEnabled: tc.smartDcaEnabled,
        smartDcaDipMultiplier: tc.dipMultiplier,
        smartDcaHighMultiplier: tc.highMultiplier,
      };

      const result = await backtestSimulator.run(config);
      const m = result.metrics;

      results.push({
        name: tc.name,
        returnPct: m.totalReturnPct,
        sharpe: m.sharpeRatio,
        maxDD: m.maxDrawdownPct,
        totalDca: m.totalDcaInjected ?? 0,
        finalValue: result.equityCurve[result.equityCurve.length - 1]?.value ?? 0,
      });

      console.log(
        `  Return: ${m.totalReturnPct >= 0 ? "+" : ""}${m.totalReturnPct.toFixed(1)}% | ` +
        `Sharpe: ${m.sharpeRatio.toFixed(2)} | ` +
        `MaxDD: ${m.maxDrawdownPct.toFixed(1)}% | ` +
        `DCA total: $${(m.totalDcaInjected ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} | ` +
        `Final: $${(result.equityCurve[result.equityCurve.length - 1]?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      );
    } catch (err) {
      console.error(`  FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  // Summary table
  console.log("\n" + "=" .repeat(80));
  console.log("COMPARISON SUMMARY");
  console.log("=" .repeat(80));
  console.log(
    "Config".padEnd(25) +
    "Return %".padStart(10) +
    "Sharpe".padStart(8) +
    "MaxDD %".padStart(9) +
    "DCA Total".padStart(12) +
    "Final $".padStart(12)
  );
  console.log("-".repeat(76));

  for (const r of results) {
    console.log(
      r.name.padEnd(25) +
      `${r.returnPct >= 0 ? "+" : ""}${r.returnPct.toFixed(1)}%`.padStart(10) +
      r.sharpe.toFixed(2).padStart(8) +
      `${r.maxDD.toFixed(1)}%`.padStart(9) +
      `$${r.totalDca.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.padStart(12) +
      `$${r.finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.padStart(12)
    );
  }

  // Decision
  if (results.length >= 2) {
    const baseline = results[0];
    const best = results.slice(1).sort((a, b) => b.returnPct - a.returnPct)[0];
    if (best && baseline) {
      const returnDiff = best.returnPct - baseline.returnPct;
      const sharpeDiff = best.sharpe - baseline.sharpe;
      console.log(`\nBest Smart DCA: ${best.name}`);
      console.log(`  vs Baseline: Return ${returnDiff >= 0 ? "+" : ""}${returnDiff.toFixed(1)}%, Sharpe ${sharpeDiff >= 0 ? "+" : ""}${sharpeDiff.toFixed(2)}`);
      console.log(`  Decision: ${returnDiff > 5 || sharpeDiff > 0.1 ? "GO — implement Smart DCA" : "NO-GO — improvement insufficient"}`);
    }
  }

  await disconnectDB();
}

main().catch(console.error);
