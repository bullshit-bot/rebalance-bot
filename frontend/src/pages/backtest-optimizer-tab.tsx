import { useState } from "react";
import { SectionTitle } from "@/components/ui-brutal";
import { useRunOptimization } from "@/hooks/use-backtest-queries";
import { Loader2, Zap } from "lucide-react";
import type { OptimizationResultItem } from "@/lib/api-types";
import { BacktestOptimizerTable } from "./backtest-optimizer-table";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT", "DOT/USDT"];

const STRATEGY_TYPES = [
  { value: "threshold", label: "Threshold" },
  { value: "equal-weight", label: "Equal Weight" },
  { value: "mean-reversion", label: "Mean Reversion" },
  { value: "vol-adjusted", label: "Vol Adjusted" },
  { value: "momentum-weighted", label: "Momentum Weighted" },
  { value: "momentum-tilt", label: "Momentum Tilt" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BacktestOptimizerTabProps {
  onApplyBest?: (item: OptimizationResultItem) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BacktestOptimizerTab({ onApplyBest }: BacktestOptimizerTabProps) {
  // Config state
  const [selectedPairs, setSelectedPairs] = useState<string[]>(["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]);
  const [startDate, setStartDate] = useState("2021-01-01");
  const [endDate, setEndDate] = useState("2026-01-01");
  const [balance, setBalance] = useState(100000);
  const [fee, setFee] = useState(0.1);
  const [topN, setTopN] = useState(20);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  const mutation = useRunOptimization();

  function togglePair(p: string) {
    setSelectedPairs((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function toggleStrategy(s: string) {
    setSelectedStrategies((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function handleRunOptimization() {
    if (selectedPairs.length === 0) return;
    mutation.mutate({
      pairs: selectedPairs,
      allocations: selectedPairs.map((p) => ({
        asset: p.split("/")[0]!,
        targetPct: 100 / selectedPairs.length,
      })),
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
      initialBalance: balance,
      feePct: fee / 100,
      timeframe: "1d",
      exchange: "binance",
      strategyTypes: selectedStrategies.length > 0 ? selectedStrategies : undefined,
      topN,
    });
  }

  const result = mutation.data;
  const comboCount = selectedStrategies.length === 0
    ? 98  // total combos across all strategies
    : "varies";

  return (
    <div>
      <div className="brutal-card mb-4">
        <SectionTitle>Optimization Config</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Pair selection */}
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
            <label className="stat-label mb-1 block">Initial Balance (USDT)</label>
            <input type="number" className="brutal-input w-full text-sm" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
          </div>

          <div>
            <label className="stat-label mb-1 block">Fee per Trade (%)</label>
            <input type="number" step="0.01" className="brutal-input w-full text-sm" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
          </div>

          <div>
            <label className="stat-label mb-1 block">Top N Results</label>
            <input type="number" min={5} max={50} className="brutal-input w-full text-sm" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
          </div>
        </div>

        {/* Strategy type filter */}
        <div className="mt-4">
          <label className="stat-label mb-2 block">Strategy Types (leave empty for all)</label>
          <div className="flex flex-wrap gap-3">
            {STRATEGY_TYPES.map((s) => (
              <label key={s.value} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                <input type="checkbox" className="brutal-checkbox" checked={selectedStrategies.includes(s.value)} onChange={() => toggleStrategy(s.value)} />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            className="brutal-btn-primary flex items-center gap-2"
            onClick={handleRunOptimization}
            disabled={mutation.isPending || selectedPairs.length === 0}
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Optimizing…</>
            ) : (
              <><Zap size={15} /> Run Optimization</>
            )}
          </button>
          <span className="text-xs text-muted-foreground">
            ~{comboCount} combinations · may take several minutes
          </span>
        </div>

        {mutation.isPending && (
          <div className="mt-3 brutal-card bg-secondary/20 py-3 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Running grid search across strategy parameters… this can take <strong>5–15 minutes</strong> for a full grid. Please keep this tab open.
            </p>
          </div>
        )}

        {mutation.isError && (
          <p className="text-sm text-destructive mt-2">Optimization failed: {String(mutation.error)}</p>
        )}
      </div>

      {result && (
        <div className="brutal-card">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>
              Results — Best: <span className="text-primary">{result.bestStrategy}</span>
            </SectionTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {result.ranCombinations}/{result.totalCombinations} ran · {result.skippedCombinations} skipped · {(result.elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <BacktestOptimizerTable results={result.results} onApplyBest={onApplyBest} />
        </div>
      )}

      {!result && !mutation.isPending && (
        <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
          <Zap size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            Configure and click <strong>Run Optimization</strong> to find the best strategy parameters.
          </p>
          <p className="text-xs mt-1">Runs ~98 backtests and ranks by composite score (Sharpe + Return − Drawdown).</p>
        </div>
      )}
    </div>
  );
}
