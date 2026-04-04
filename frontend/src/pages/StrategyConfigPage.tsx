import { PageTitle } from "@/components/ui-brutal";
import { Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { StrategyType } from "./strategy-config-type-fields";
import { GlobalSettingsSection, DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from "./strategy-config-global-settings";
import {
  useStrategyConfig,
  useUpdateStrategyConfig,
} from "@/hooks/use-strategy-config-queries";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoreParams {
  strategyType: StrategyType;
  thresholdPct: number;
  minTradeUsd: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StrategyConfigPage() {
  const [core, setCore] = useState<CoreParams>({
    strategyType: "threshold",
    thresholdPct: 8,
    minTradeUsd: 10,
  });
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);

  const { data: apiData } = useStrategyConfig();
  const updateConfig = useUpdateStrategyConfig();
  const activeName = apiData?.active?.name ?? "default";

  // Sync from API on load
  useEffect(() => {
    const active = apiData?.active;
    if (!active) return;
    const p = active.params ?? {};
    const g = active.globalSettings ?? {};

    setCore({
      strategyType: (active.strategyType ?? p.type ?? "threshold") as StrategyType,
      thresholdPct: p.thresholdPct ?? 8,
      minTradeUsd: p.minTradeUsd ?? 10,
    });

    setGlobalSettings((prev) => ({
      ...prev,
      dynamicThreshold: g.dynamicThreshold ?? prev.dynamicThreshold,
      trendAware: g.trendAware ?? prev.trendAware,
      feeAware: g.feeAware ?? prev.feeAware,
      autoExecute: g.autoExecute ?? prev.autoExecute,
      cashReservePct: g.cashReservePct ?? prev.cashReservePct,
      dcaRebalanceEnabled: g.dcaRebalanceEnabled ?? prev.dcaRebalanceEnabled,
      dcaAmountUsd: g.dcaAmountUsd ?? prev.dcaAmountUsd,
      hardRebalanceThreshold: g.hardRebalanceThreshold ?? prev.hardRebalanceThreshold,
      trendFilterEnabled: g.trendFilterEnabled ?? prev.trendFilterEnabled,
      trendFilterMA: g.trendFilterMA ?? prev.trendFilterMA,
      bearCashPct: g.bearCashPct ?? prev.bearCashPct,
      trendFilterBuffer: g.trendFilterBuffer ?? prev.trendFilterBuffer,
      trendFilterCooldownDays: g.trendFilterCooldownDays ?? prev.trendFilterCooldownDays,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiData?.active?.name]);

  function handleSave() {
    const payload = {
      strategyType: core.strategyType,
      params: { type: core.strategyType, thresholdPct: core.thresholdPct, minTradeUsd: core.minTradeUsd },
      ...globalSettings,
    };
    updateConfig.mutate(
      { name: activeName, data: payload },
      {
        onSuccess: () => toast.success("Config saved"),
        onError: () => toast.error("Failed to save config"),
      }
    );
  }

  return (
    <div>
      <PageTitle>Strategy Config</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: strategy + global settings */}
        <div className="lg:col-span-7 space-y-4">
          {/* Core strategy params */}
          <div className="brutal-card">
            <h2 className="text-sm font-black uppercase tracking-wider mb-3 pb-2 border-b-2 border-foreground">
              Strategy
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="stat-label mb-1 block">Strategy Type</label>
                <select
                  className="brutal-input w-full text-sm"
                  value={core.strategyType}
                  onChange={(e) => setCore((prev) => ({ ...prev, strategyType: e.target.value as StrategyType }))}
                >
                  <option value="threshold">threshold</option>
                  <option value="equal-weight">equal-weight</option>
                  <option value="momentum-tilt">momentum-tilt</option>
                  <option value="vol-adjusted">vol-adjusted</option>
                  <option value="mean-reversion">mean-reversion</option>
                  <option value="momentum-weighted">momentum-weighted</option>
                </select>
              </div>
              <div>
                <label className="stat-label mb-1 block">Threshold %</label>
                <input
                  className="brutal-input w-full text-sm"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={core.thresholdPct}
                  onChange={(e) => setCore((prev) => ({ ...prev, thresholdPct: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="stat-label mb-1 block">Min Trade (USD)</label>
                <input
                  className="brutal-input w-full text-sm"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={core.minTradeUsd}
                  onChange={(e) => setCore((prev) => ({ ...prev, minTradeUsd: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Global settings */}
          <GlobalSettingsSection
            settings={globalSettings}
            onChange={(key, value) => setGlobalSettings((prev) => ({ ...prev, [key]: value }))}
          />

          <button
            className="brutal-btn-primary flex items-center gap-1.5"
            onClick={handleSave}
            disabled={updateConfig.isPending}
          >
            <Save size={15} /> Save Config
          </button>
        </div>

        {/* Right: info panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="brutal-card">
            <h2 className="text-sm font-black uppercase tracking-wider mb-3 pb-2 border-b-2 border-foreground">
              Settings Guide
            </h2>
            <div className="text-xs text-muted-foreground space-y-3">
              <div>
                <p className="font-bold text-foreground">Strategy Type</p>
                <p>Rebalancing algorithm. <code>threshold</code> is simplest and most tested.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Threshold %</p>
                <p>Min drift before rebalance triggers. Higher = fewer trades, lower fees. Optimal: 8%.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Trend Filter (MA Bear Protection)</p>
                <p>When BTC drops below MA, sells to cash. <strong>Most impactful setting</strong> — 3x return improvement in backtests. MA110 + Cooldown 1 day is optimal.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Bear Cash Target</p>
                <p>% to sell when bear mode triggers. 100% = sell everything to USDT.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">DCA Routing</p>
                <p>New deposits automatically buy the most underweight asset instead of spreading equally.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Hard Rebalance Threshold</p>
                <p>When DCA is on, full rebalance only fires above this drift % (default 15%).</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Cash Reserve</p>
                <p>% of portfolio kept in USDT as buffer. 0% is optimal with trend filter on.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Smart DCA (Buy the Dip)</p>
                <p>DCA more when BTC below MA, less when above. Backtest: +10% return with 1.5x/0.5x.</p>
              </div>
              <div>
                <p className="font-bold text-foreground">Fee-Aware</p>
                <p>Skips trades where fee exceeds expected drift correction benefit.</p>
              </div>
            </div>
          </div>

          {/* Current config summary */}
          <div className="brutal-card bg-green-500/5 border-green-500">
            <h2 className="text-sm font-black uppercase tracking-wider mb-2 text-green-700">
              Active Config
            </h2>
            <div className="text-xs space-y-1">
              <p>Strategy: <code className="font-bold">{core.strategyType}</code> | Threshold: <code className="font-bold">{core.thresholdPct}%</code></p>
              <p>Trend Filter: <code className="font-bold">{globalSettings.trendFilterEnabled ? `ON (MA${globalSettings.trendFilterMA}, Bear ${globalSettings.bearCashPct}%, CD ${globalSettings.trendFilterCooldownDays}d)` : "OFF"}</code></p>
              <p>DCA: <code className="font-bold">{globalSettings.dcaRebalanceEnabled ? `ON (hard ${globalSettings.hardRebalanceThreshold}%)` : "OFF"}</code> | Cash Reserve: <code className="font-bold">{globalSettings.cashReservePct}%</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
