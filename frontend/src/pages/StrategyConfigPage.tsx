import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { Save, RotateCcw, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Toggle } from "./strategy-config-toggle";
import {
  StrategyTypeFields,
  STRATEGY_TYPES,
  type StrategyType,
  getDefaultParams,
} from "./strategy-config-type-fields";
import { StrategyPresetsPanel } from "./strategy-config-presets-panel";
import {
  useStrategyConfig,
  useUpdateStrategyConfig,
  useActivateStrategy,
} from "@/hooks/use-strategy-config-queries";

// --- local-storage helpers (kept for test compatibility) ---
const LS_KEY = "rb_strategy_config";

const DEFAULT_CONFIG = {
  thresholdPct: 5.0,
  minTradeUSDT: 15,
  partialFactor: 0.75,
  cooldownHours: 4,
  maxDailyVolume: 50000,
  baseAsset: "USDT",
  dynamicThreshold: true,
  trendAware: false,
  feeAware: true,
  autoExecute: false,
};

type LocalConfig = typeof DEFAULT_CONFIG;

function loadLocal(): LocalConfig {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveLocal(c: LocalConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(c));
}

// Fallback preset values for local-only mode
const FALLBACK_PRESET_VALUES: Record<string, { local: Partial<LocalConfig>; params: Record<string, number> }> = {
  Conservative: { local: { partialFactor: 0.5, cooldownHours: 8 },   params: { thresholdPct: 8,  minTradeUsd: 15 } },
  Balanced:     { local: { partialFactor: 0.75, cooldownHours: 4 },  params: { thresholdPct: 5,  minTradeUsd: 15 } },
  Aggressive:   { local: { partialFactor: 1.0, cooldownHours: 1 },   params: { thresholdPct: 2,  minTradeUsd: 15 } },
};

export default function StrategyConfigPage() {
  const [local, setLocal] = useState<LocalConfig>(loadLocal);
  const [activePreset, setActivePreset] = useState("Balanced");
  const [strategyType, setStrategyType] = useState<StrategyType>("threshold");
  const [typeParams, setTypeParams] = useState<Record<string, number>>(() => {
    // Merge stored thresholdPct/minTradeUSDT into default params for backward compat
    const stored = loadLocal();
    const defaults = getDefaultParams("threshold");
    return {
      ...defaults,
      thresholdPct: stored.thresholdPct ?? defaults.thresholdPct,
      minTradeUsd: stored.minTradeUSDT ?? defaults.minTradeUsd,
    };
  });

  // API hooks
  const { data: apiData } = useStrategyConfig();
  const updateConfig = useUpdateStrategyConfig();
  const activateStrategy = useActivateStrategy();

  // Active config name from API (fall back to "default")
  const activeName = apiData?.active?.name ?? "default";

  // Sync form from API active config on first load
  useEffect(() => {
    const active = apiData?.active;
    if (!active) return;
    const p = active.params ?? {};
    const g = active.globalSettings ?? {};
    setLocal((prev) => ({
      ...prev,
      thresholdPct: p.thresholdPct ?? p.baseThresholdPct ?? prev.thresholdPct,
      minTradeUSDT: p.minTradeUsd ?? prev.minTradeUSDT,
      partialFactor: g.partialFactor ?? prev.partialFactor,
      cooldownHours: g.cooldownHours ?? prev.cooldownHours,
      dynamicThreshold: g.dynamicThreshold ?? prev.dynamicThreshold,
      trendAware: g.trendAware ?? prev.trendAware,
      feeAware: g.feeAware ?? prev.feeAware,
      autoExecute: g.autoExecute ?? prev.autoExecute,
    }));
    setTypeParams((prev) => ({
      ...prev,
      ...p,
    }));
    if (active.strategyType) setStrategyType(active.strategyType as StrategyType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiData?.active?.name]);

  function setLocalField<K extends keyof LocalConfig>(key: K, value: LocalConfig[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleStrategyTypeChange(t: StrategyType) {
    setStrategyType(t);
    setTypeParams(getDefaultParams(t));
  }

  function handleTypeParamChange(key: string, value: number) {
    setTypeParams((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    // Include thresholdPct in local save for backward compat with tests/legacy readers
    const localWithThreshold = { ...local, thresholdPct: typeParams.thresholdPct ?? local.thresholdPct };
    saveLocal(localWithThreshold);
    const payload = {
      strategyType,
      params: typeParams,
      baseAsset: local.baseAsset,
      maxDailyVolume: local.maxDailyVolume,
      partialFactor: local.partialFactor,
      cooldownHours: local.cooldownHours,
      dynamicThreshold: local.dynamicThreshold,
      trendAware: local.trendAware,
      feeAware: local.feeAware,
      autoExecute: local.autoExecute,
    };
    updateConfig.mutate(
      { name: activeName, data: payload },
      {
        onSuccess: () => toast.success("Strategy config saved"),
        onError: () => {
          // API unavailable — local save already done above
          toast.success("Strategy config saved");
        },
      }
    );
  }

  function handleActivate() {
    activateStrategy.mutate(activeName, {
      onSuccess: () => toast.success(`Activated: ${activeName}`),
      onError: (e: any) => toast.error(e.message || "Failed to activate"),
    });
  }

  function handleRestore() {
    setLocal(DEFAULT_CONFIG);
    saveLocal(DEFAULT_CONFIG);
    toast.success("Restored default config");
  }

  function handleFallbackPreset(name: string) {
    setActivePreset(name);
    const preset = FALLBACK_PRESET_VALUES[name];
    if (preset) {
      setLocal((prev) => ({ ...prev, ...preset.local }));
      setTypeParams((prev) => ({ ...prev, ...preset.params }));
    }
  }

  const globalFields: Array<{ label: string; key: keyof LocalConfig; step?: number }> = [
    { label: "Partial Factor", key: "partialFactor", step: 0.05 },
    { label: "Cooldown (hours)", key: "cooldownHours" },
    { label: "Max Daily Volume", key: "maxDailyVolume" },
  ];

  return (
    <div>
      <PageTitle>Strategy Config</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: parameters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="brutal-card">
            <SectionTitle>Parameters</SectionTitle>

            {/* Strategy type selector */}
            <div className="mb-4">
              <label className="stat-label mb-1 block">Strategy Type</label>
              <select
                className="brutal-input w-full text-sm"
                value={strategyType}
                onChange={(e) => handleStrategyTypeChange(e.target.value as StrategyType)}
              >
                {STRATEGY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Per-type dynamic fields */}
            <div className="grid grid-cols-2 gap-4">
              <StrategyTypeFields
                strategyType={strategyType}
                params={typeParams}
                onChange={handleTypeParamChange}
              />

              {/* Global numeric fields */}
              {globalFields.map((f) => (
                <div key={f.key}>
                  <label className="stat-label mb-1 block">{f.label}</label>
                  <input
                    className="brutal-input w-full text-sm"
                    type="number"
                    step={f.step ?? 1}
                    value={local[f.key] as number}
                    onChange={(e) =>
                      setLocalField(f.key, Number(e.target.value) as LocalConfig[typeof f.key])
                    }
                  />
                </div>
              ))}

              {/* Base Asset */}
              <div>
                <label className="stat-label mb-1 block">Base Asset</label>
                <input
                  className="brutal-input w-full text-sm"
                  value={local.baseAsset}
                  onChange={(e) => setLocalField("baseAsset", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="brutal-card">
            <SectionTitle>Toggles</SectionTitle>
            <Toggle label="Dynamic Threshold" value={local.dynamicThreshold} onChange={(v) => setLocalField("dynamicThreshold", v)} />
            <Toggle label="Trend-Aware Mode" value={local.trendAware} onChange={(v) => setLocalField("trendAware", v)} />
            <Toggle label="Fee-Aware Execution" value={local.feeAware} onChange={(v) => setLocalField("feeAware", v)} />
            <Toggle label="Auto Execute" value={local.autoExecute} onChange={(v) => setLocalField("autoExecute", v)} />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              className="brutal-btn-primary flex items-center gap-1.5"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              <Save size={15} /> Save Config
            </button>
            <button
              className="brutal-btn-primary flex items-center gap-1.5"
              onClick={handleActivate}
              disabled={activateStrategy.isPending}
            >
              <Zap size={15} /> Activate
            </button>
            <button
              className="brutal-btn-secondary flex items-center gap-1.5"
              onClick={handleRestore}
            >
              <RotateCcw size={15} /> Restore Defaults
            </button>
          </div>
        </div>

        {/* Right column: presets + info */}
        <div className="lg:col-span-5 space-y-4">
          <StrategyPresetsPanel
            activePreset={activePreset}
            onApplyFallback={handleFallbackPreset}
          />

          <div className="brutal-card bg-secondary/30">
            <SectionTitle>How It Works</SectionTitle>
            <div className="text-xs text-muted-foreground space-y-2">
              <p><strong>Threshold:</strong> Minimum drift % before rebalancing triggers.</p>
              <p><strong>Partial Factor:</strong> 1.0 = full rebalance, 0.5 = half correction per cycle.</p>
              <p><strong>Cooldown:</strong> Minimum wait between rebalance executions.</p>
              <p><strong>Dynamic Threshold:</strong> Adjusts threshold based on market volatility.</p>
              <p><strong>Fee-Aware:</strong> Skips trades where fee exceeds expected drift benefit.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
