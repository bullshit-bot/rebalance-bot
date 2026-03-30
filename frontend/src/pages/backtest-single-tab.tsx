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

// Default target allocations matching strategy config
const DEFAULT_ALLOCATIONS: Record<string, number> = {
  BTC: 40, ETH: 25, SOL: 20, BNB: 15,
};

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
  prefilledConfig?: Partial<BacktestConfig & { strategyLabel?: string }>
}

export function BacktestSingleTab({ prefilledConfig }: BacktestSingleTabProps) {
  // Basic config
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    prefilledConfig?.pairs ?? ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]
  );
  const [startDate, setStartDate] = useState("2021-03-30");
  const [endDate, setEndDate] = useState("2026-03-29");
  const [threshold, setThreshold] = useState(prefilledConfig?.threshold ?? 5);
  const [balance, setBalance] = useState(prefilledConfig?.initialBalance ?? 1000);
  const [fee, setFee] = useState(
    prefilledConfig?.feePct !== undefined ? prefilledConfig.feePct * 100 : 0.1
  );

  // DCA config
  const [dcaEnabled, setDcaEnabled] = useState(true);
  const [dcaAmount, setDcaAmount] = useState(20);

  // Trend filter config
  const [trendEnabled, setTrendEnabled] = useState(false);
  const [trendMaPeriod, setTrendMaPeriod] = useState(100);
  const [trendBearCashPct, setTrendBearCashPct] = useState(90);
  const [trendCooldown, setTrendCooldown] = useState(3);
  const [trendBuffer, setTrendBuffer] = useState(0);

  // Cash reserve
  const [cashReservePct, setCashReservePct] = useState(0);

  const mutation = useRunBacktest();

  function togglePair(p: string) {
    setSelectedPairs((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleRunBacktest() {
    if (selectedPairs.length === 0) return;
    const config: Record<string, unknown> = {
      pairs: selectedPairs,
      allocations: selectedPairs.map((p) => {
        const asset = p.split("/")[0]!;
        return {
          asset,
          targetPct: DEFAULT_ALLOCATIONS[asset] ?? (100 / selectedPairs.length),
          minTradeUsd: 10,
        };
      }),
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
      initialBalance: balance,
      threshold,
      feePct: fee / 100,
      timeframe: "1d",
      exchange: "binance",
    };
    // DCA params
    if (dcaEnabled && dcaAmount > 0) {
      config.dcaAmountUsd = dcaAmount;
      config.dcaIntervalCandles = 1;
    }
    // Trend filter params
    if (trendEnabled) {
      config.trendFilterMaPeriod = trendMaPeriod;
      config.trendFilterBearCashPct = trendBearCashPct;
      config.trendFilterCooldownCandles = trendCooldown;
      config.trendFilterBuffer = trendBuffer;
    }
    // Cash reserve
    if (cashReservePct > 0) {
      config.cashReservePct = cashReservePct;
    }
    mutation.mutate(config as BacktestConfig);
  }

  const result = mutation.data;
  const metrics = result?.metrics ?? {};
  const totalReturn = typeof metrics.totalReturnPct === "number" ? Number(metrics.totalReturnPct.toFixed(1)) : null;
  const annualized = typeof metrics.annualizedReturnPct === "number" ? Number(metrics.annualizedReturnPct.toFixed(1)) : null;
  const sharpe = typeof metrics.sharpeRatio === "number" ? Number(metrics.sharpeRatio.toFixed(2)) : null;
  const maxDrawdown = typeof metrics.maxDrawdownPct === "number" ? Number(metrics.maxDrawdownPct.toFixed(1)) : null;
  const totalTrades = typeof metrics.totalTrades === "number" ? metrics.totalTrades : (result?.trades?.length ?? null);
  const totalFees = typeof metrics.totalFeesPaid === "number" ? Number(metrics.totalFeesPaid.toFixed(2)) : null;
  const totalDca = typeof metrics.totalDcaInjected === "number" ? Math.round(metrics.totalDcaInjected) : null;
  const trades = (result?.trades ?? []) as BacktestTrade[];
  const rawEquity = Array.isArray(result?.equityCurve) ? result.equityCurve : [];
  const rawBenchmark = result?.benchmark?.buyAndHold;
  const equityCurve = rawEquity.map((pt: { timestamp: number; value: number }) => ({
    date: new Date(pt.timestamp).toISOString().slice(0, 10),
    strategy: Math.round(pt.value),
    benchmark: rawBenchmark ? Math.round(rawBenchmark.finalValue * (pt.value / (rawEquity[rawEquity.length - 1]?.value || 1))) : undefined,
  })).filter((_: unknown, i: number) => i % Math.max(1, Math.floor(rawEquity.length / 100)) === 0);

  const totalInvested = balance + (totalDca ?? 0);

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
          {/* Pairs */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="stat-label mb-2 block">Pairs</label>
            <div className="flex flex-wrap gap-3">
              {PAIRS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                  <input type="checkbox" className="brutal-checkbox" checked={selectedPairs.includes(p)} onChange={() => togglePair(p)} />
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

        {/* DCA Section */}
        <div className="mt-4 pt-4 border-t-2 border-foreground/10">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
              <input type="checkbox" className="brutal-checkbox" checked={dcaEnabled} onChange={(e) => setDcaEnabled(e.target.checked)} />
              DCA (Dollar-Cost Averaging)
            </label>
          </div>
          {dcaEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="stat-label mb-1 block">DCA Amount ($/day)</label>
                <input type="number" className="brutal-input w-full text-sm" value={dcaAmount} onChange={(e) => setDcaAmount(Number(e.target.value))} />
              </div>
              <div>
                <label className="stat-label mb-1 block">
                  Cash Reserve: <span className="tabular-nums">{cashReservePct}%</span>
                </label>
                <input type="range" min={0} max={30} value={cashReservePct} onChange={(e) => setCashReservePct(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Trend Filter Section */}
        <div className="mt-4 pt-4 border-t-2 border-foreground/10">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
              <input type="checkbox" className="brutal-checkbox" checked={trendEnabled} onChange={(e) => setTrendEnabled(e.target.checked)} />
              Trend Filter (BTC MA)
            </label>
            {trendEnabled && <span className="text-xs text-muted-foreground">Sell to cash when BTC below MA, buy back when above</span>}
          </div>
          {trendEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="stat-label mb-1 block">
                  MA Period: <span className="tabular-nums">{trendMaPeriod}</span>
                </label>
                <input type="range" min={20} max={200} step={10} value={trendMaPeriod} onChange={(e) => setTrendMaPeriod(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="stat-label mb-1 block">
                  Bear Cash: <span className="tabular-nums">{trendBearCashPct}%</span>
                </label>
                <input type="range" min={50} max={100} step={5} value={trendBearCashPct} onChange={(e) => setTrendBearCashPct(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="stat-label mb-1 block">
                  Cooldown: <span className="tabular-nums">{trendCooldown} days</span>
                </label>
                <input type="range" min={0} max={10} value={trendCooldown} onChange={(e) => setTrendCooldown(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Buffer: <span className="tabular-nums">{trendBuffer}%</span>
                </label>
                <input type="range" min={0} max={5} step={0.5} value={trendBuffer} onChange={(e) => setTrendBuffer(Number(e.target.value))} className="w-full accent-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            className="brutal-btn-primary flex items-center gap-2"
            onClick={handleRunBacktest}
            disabled={mutation.isPending || selectedPairs.length === 0}
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Running...</>
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
          {/* Summary banner */}
          {totalDca !== null && totalDca > 0 && (
            <div className="brutal-card mb-4 bg-primary/5 border-primary/30">
              <p className="text-sm font-bold">
                Total Invested: ${totalInvested.toLocaleString()} (${balance.toLocaleString()} initial + ${totalDca.toLocaleString()} DCA)
                {trendEnabled && " | Trend Filter: ON"}
                {cashReservePct > 0 && ` | Cash Reserve: ${cashReservePct}%`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            <StatCard label="Total Return" value={totalReturn !== null ? `${totalReturn > 0 ? "+" : ""}${totalReturn}%` : "\u2014"} variant={totalReturn !== null && totalReturn > 0 ? "success" : "danger"} icon={<TrendingUp size={16} />} />
            <StatCard label="Annualized" value={annualized !== null ? `${annualized > 0 ? "+" : ""}${annualized}%` : "\u2014"} variant={annualized !== null && annualized > 0 ? "success" : "danger"} icon={<Percent size={16} />} />
            <StatCard label="Sharpe Ratio" value={sharpe !== null ? String(sharpe) : "\u2014"} variant="purple" icon={<Activity size={16} />} />
            <StatCard label="Max Drawdown" value={maxDrawdown !== null ? `-${maxDrawdown}%` : "\u2014"} variant="danger" icon={<TrendingDown size={16} />} />
            <StatCard label="Total Trades" value={totalTrades !== null ? String(totalTrades) : "\u2014"} icon={<ReceiptText size={16} />} />
            <StatCard label="Total Fees" value={totalFees !== null ? `$${totalFees}` : "\u2014"} variant="warning" icon={<DollarSign size={16} />} />
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
            <SectionTitle>Simulated Trades ({trades.length} total{trades.length > 50 ? ", showing first 50" : ""})</SectionTitle>
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
                      <td className="tabular-nums text-xs">{t.timestamp ? new Date(t.timestamp as number).toISOString().slice(0, 10) : (t.date ?? "\u2014")}</td>
                      <td className="font-bold text-sm">{t.pair ?? "\u2014"}</td>
                      <td>{t.side ? <ActionBadge action={t.side.toLowerCase()} /> : <span>{"\u2014"}</span>}</td>
                      <td className="tabular-nums">{t.amount !== undefined ? Number(t.amount).toFixed(4) : (t.qty ?? "\u2014")}</td>
                      <td className="tabular-nums">{t.price !== undefined ? `$${Number(t.price).toLocaleString()}` : "\u2014"}</td>
                      <td className="tabular-nums text-muted-foreground">{t.fee !== undefined ? `$${Number(t.fee).toFixed(2)}` : "\u2014"}</td>
                      <td className="tabular-nums">{t.costUsd !== undefined ? `$${Number(t.costUsd).toFixed(0)}` : "\u2014"}</td>
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
