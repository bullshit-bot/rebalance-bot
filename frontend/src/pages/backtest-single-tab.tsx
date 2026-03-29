import { useState } from "react";
import { SectionTitle, StatCard, ActionBadge } from "@/components/ui-brutal";
import { useRunBacktest } from "@/hooks/use-backtest-queries";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Percent,
  ReceiptText,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { BacktestConfig } from "@/lib/api-types";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];

interface BacktestTrade {
  date?: string
  pair?: string
  side?: string
  qty?: number
  price?: number
  fee?: number
  pnl?: number
  [key: string]: unknown
}

interface BacktestSingleTabProps {
  /** Pre-fill config from optimizer "Apply Best" action */
  prefilledConfig?: Partial<BacktestConfig & { strategyLabel?: string }>
}

export function BacktestSingleTab({ prefilledConfig }: BacktestSingleTabProps) {
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    prefilledConfig?.pairs ?? ["BTC/USDT", "ETH/USDT"]
  );
  const [startDate, setStartDate] = useState("2026-02-01");
  const [endDate, setEndDate] = useState("2026-03-01");
  const [threshold, setThreshold] = useState(prefilledConfig?.threshold ?? 5);
  const [balance, setBalance] = useState(prefilledConfig?.initialBalance ?? 100000);
  const [fee, setFee] = useState(
    prefilledConfig?.feePct !== undefined ? prefilledConfig.feePct * 100 : 0.1
  );

  const mutation = useRunBacktest();

  function togglePair(p: string) {
    setSelectedPairs((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleRunBacktest() {
    if (selectedPairs.length === 0) return;
    const config: BacktestConfig = {
      pairs: selectedPairs,
      allocations: selectedPairs.map((p) => ({
        asset: p.split("/")[0]!,
        targetPct: 100 / selectedPairs.length,
      })),
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
      initialBalance: balance,
      threshold,
      feePct: fee / 100,
      timeframe: "1d",
      exchange: "binance",
    };
    mutation.mutate(config);
  }

  const result = mutation.data;
  const metrics = result?.metrics ?? {};
  // Map API field names (totalReturnPct, sharpeRatio, etc.) to display values
  const totalReturn = typeof metrics.totalReturnPct === "number" ? Number(metrics.totalReturnPct.toFixed(1)) : null;
  const annualized = typeof metrics.annualizedReturnPct === "number" ? Number(metrics.annualizedReturnPct.toFixed(1)) : null;
  const sharpe = typeof metrics.sharpeRatio === "number" ? Number(metrics.sharpeRatio.toFixed(2)) : null;
  const maxDrawdown = typeof metrics.maxDrawdownPct === "number" ? Number(metrics.maxDrawdownPct.toFixed(1)) : null;
  const totalTrades = typeof metrics.totalTrades === "number" ? metrics.totalTrades : (result?.trades?.length ?? null);
  const totalFees = typeof metrics.totalFeesPaid === "number" ? Number(metrics.totalFeesPaid.toFixed(2)) : null;
  const trades = (result?.trades ?? []) as BacktestTrade[];
  // Build equity curve from result.equityCurve (array of {timestamp, value})
  const rawEquity = Array.isArray(result?.equityCurve) ? result.equityCurve : [];
  const rawBenchmark = result?.benchmark?.buyAndHold;
  const equityCurve = rawEquity.map((pt: { timestamp: number; value: number }) => ({
    date: new Date(pt.timestamp).toISOString().slice(0, 10),
    strategy: Math.round(pt.value),
    benchmark: rawBenchmark ? Math.round(rawBenchmark.finalValue * (pt.value / (rawEquity[rawEquity.length - 1]?.value || 1))) : undefined,
  })).filter((_: unknown, i: number) => i % Math.max(1, Math.floor(rawEquity.length / 100)) === 0);

  return (
    <div>
      {prefilledConfig?.strategyLabel && (
        <div className="brutal-card mb-4 border-primary bg-primary/10">
          <p className="text-sm font-bold">
            Pre-filled from optimizer: <span className="text-primary">{prefilledConfig.strategyLabel}</span>
          </p>
        </div>
      )}

      <div className="brutal-card mb-4">
        <SectionTitle>Configuration</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="md:col-span-2 lg:col-span-1">
            <label className="stat-label mb-2 block">Pairs</label>
            <div className="flex flex-wrap gap-3">
              {PAIRS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                  <input
                    type="checkbox"
                    className="brutal-checkbox"
                    checked={selectedPairs.includes(p)}
                    onChange={() => togglePair(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="stat-label mb-1 block">Start Date</label>
            <input type="date" className="brutal-input w-full text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <label className="stat-label mb-1 block">End Date</label>
            <input type="date" className="brutal-input w-full text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div>
            <label className="stat-label mb-1 block">
              Rebalance Threshold: <span className="tabular-nums">{threshold}%</span>
            </label>
            <input type="range" min={1} max={15} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-primary" />
          </div>

          <div>
            <label className="stat-label mb-1 block">Initial Balance (USDT)</label>
            <input type="number" className="brutal-input w-full text-sm" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
          </div>

          <div>
            <label className="stat-label mb-1 block">Fee per Trade (%)</label>
            <input type="number" step="0.01" className="brutal-input w-full text-sm" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
          </div>
        </div>

        <div className="mt-4">
          <button
            className="brutal-btn-primary flex items-center gap-2"
            onClick={handleRunBacktest}
            disabled={mutation.isPending || selectedPairs.length === 0}
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Running…</>
            ) : (
              <><FlaskConical size={15} /> Run Backtest</>
            )}
          </button>
          {mutation.isError && (
            <p className="text-sm text-destructive mt-2">Backtest failed: {String(mutation.error)}</p>
          )}
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            <StatCard label="Total Return" value={totalReturn !== null ? `+${totalReturn}%` : "—"} variant="success" icon={<TrendingUp size={16} />} />
            <StatCard label="Annualized" value={annualized !== null ? `+${annualized}%` : "—"} variant="success" icon={<Percent size={16} />} />
            <StatCard label="Sharpe Ratio" value={sharpe !== null ? String(sharpe) : "—"} variant="purple" icon={<Activity size={16} />} />
            <StatCard label="Max Drawdown" value={maxDrawdown !== null ? `${maxDrawdown}%` : "—"} variant="danger" icon={<TrendingDown size={16} />} />
            <StatCard label="Total Trades" value={totalTrades !== null ? String(totalTrades) : "—"} icon={<ReceiptText size={16} />} />
            <StatCard label="Total Fees" value={totalFees !== null ? `$${totalFees}` : "—"} variant="warning" icon={<DollarSign size={16} />} />
          </div>

          {equityCurve.length > 0 && (
            <div className="brutal-card mb-4">
              <SectionTitle>Equity Curve</SectionTitle>
              <div className="h-60">
                <ResponsiveContainer>
                  <LineChart data={equityCurve}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={["dataMin - 5000", "dataMax + 5000"]} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="strategy" stroke="#7c3aed" strokeWidth={2.5} dot={false} name="Strategy" />
                    <Line type="monotone" dataKey="benchmark" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Benchmark" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="brutal-card">
            <SectionTitle>Simulated Trades</SectionTitle>
            <div className="overflow-x-auto">
              <table className="brutal-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Pair</th><th>Side</th><th>Amount</th><th>Price</th><th>Fee</th><th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((t, i) => (
                    <tr key={i}>
                      <td className="tabular-nums text-xs">{t.timestamp ? new Date(t.timestamp as number).toISOString().slice(0, 10) : (t.date ?? "—")}</td>
                      <td className="font-bold text-sm">{t.pair ?? "—"}</td>
                      <td>{t.side ? <ActionBadge action={t.side.toLowerCase()} /> : <span>—</span>}</td>
                      <td className="tabular-nums">{t.amount !== undefined ? Number(t.amount).toFixed(4) : (t.qty ?? "—")}</td>
                      <td className="tabular-nums">{t.price !== undefined ? `$${Number(t.price).toLocaleString()}` : "—"}</td>
                      <td className="tabular-nums text-muted-foreground">{t.fee !== undefined ? `$${Number(t.fee).toFixed(2)}` : "—"}</td>
                      <td className="tabular-nums">{t.costUsd !== undefined ? `$${Number(t.costUsd).toFixed(0)}` : (t.pnl !== undefined ? `$${t.pnl}` : "—")}</td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted-foreground py-4">No trades in result</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !mutation.isPending && (
        <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
          <FlaskConical size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Configure parameters above and click <strong>Run Backtest</strong> to see results.</p>
        </div>
      )}
    </div>
  );
}
