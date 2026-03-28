import { useState } from "react";
import { PageTitle } from "@/components/ui-brutal";
import { FlaskConical, Zap } from "lucide-react";
import { BacktestSingleTab } from "./backtest-single-tab";
import { BacktestOptimizerTab } from "./backtest-optimizer-tab";
import type { OptimizationResultItem } from "@/lib/api-types";
import type { BacktestConfig } from "@/lib/api-types";

type Tab = "single" | "optimizer";

export default function BacktestingPage() {
  const [tab, setTab] = useState<Tab>("single");
  const [prefilledConfig, setPrefilledConfig] = useState<
    Partial<BacktestConfig & { strategyLabel?: string }> | undefined
  >(undefined);

  /** Called when user clicks "Apply Best" in the optimizer table */
  function handleApplyBest(item: OptimizationResultItem) {
    setPrefilledConfig({
      threshold: typeof item.params["thresholdPct"] === "number"
        ? (item.params["thresholdPct"] as number)
        : 5,
      strategyLabel: item.label,
    });
    setTab("single");
  }

  return (
    <div>
      <PageTitle>Backtesting</PageTitle>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-foreground transition-colors text-sm ${
            tab === "single"
              ? "bg-foreground text-background"
              : "bg-background hover:bg-secondary/30"
          }`}
          onClick={() => setTab("single")}
        >
          <FlaskConical size={15} />
          Single Backtest
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-foreground transition-colors text-sm ${
            tab === "optimizer"
              ? "bg-foreground text-background"
              : "bg-background hover:bg-secondary/30"
          }`}
          onClick={() => setTab("optimizer")}
        >
          <Zap size={15} />
          Strategy Optimizer
        </button>
      </div>

      {tab === "single" ? (
        <BacktestSingleTab prefilledConfig={prefilledConfig} />
      ) : (
        <BacktestOptimizerTab onApplyBest={handleApplyBest} />
      )}
    </div>
  );
}
