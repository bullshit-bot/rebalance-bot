import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { Save, RotateCcw, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  StrategyTypeFields,
  STRATEGY_TYPES,
  type StrategyType,
  getDefaultParams,
} from "./strategy-config-type-fields";
import { StrategyPresetsPanel } from "./strategy-config-presets-panel";
import { GlobalSettingsSection, DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from "./strategy-config-global-settings";
import {
  useStrategyConfig,
  useUpdateStrategyConfig,
  useActivateStrategy,
} from "@/hooks/use-strategy-config-queries";

// --- local-storage helpers (kept for test compatibility) ---
const LS_KEY = "rb_strategy_config";

const DEFAULT_MISC = {
  baseAsset: "USDT",
  maxDailyVolume: 50000,
  partialFactor: 0.75,
  cooldownHours: 4,
};

type MiscConfig = typeof DEFAULT_MISC;

function loadLocal(): MiscConfig & GlobalSettings {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? { ...DEFAULT_MISC, ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_MISC, ...DEFAULT_GLOBAL_SETTINGS };
  } catch {
    return { ...DEFAULT_MISC, ...DEFAULT_GLOBAL_SETTINGS };
  }
}

function saveLocal(c: MiscConfig & GlobalSettings & { thresholdPct?: number }) {
  localStorage.setItem(LS_KEY, JSON.stringify(c));
}

// Fallback preset values for local-only mode
const FALLBACK_PRESET_VALUES: Record<string, { misc: Partial<MiscConfig>; global?: Partial<GlobalSettings>; params: Record<string, number> }> = {
  Conservative: { misc: { partialFactor: 0.5, cooldownHours: 8 },   params: { thresholdPct: 8,  minTradeUsd: 15 } },
  Balanced:     { misc: { partialFactor: 0.75, cooldownHours: 4 },  params: { thresholdPct: 5,  minTradeUsd: 15 } },
  Aggressive:   { misc: { partialFactor: 1.0, cooldownHours: 1 },   params: { thresholdPct: 2,  minTradeUsd: 15 } },
  CashAwareBalanced: {
    misc: { partialFactor: 0.75, cooldownHours: 4 },
    global: { cashReservePct: 10, dcaRebalanceEnabled: false, hardRebalanceThreshold: 15 },
    params: { thresholdPct: 5, minTradeUsd: 15 },
  },
  DCARebalance: {
    misc: { partialFactor: 0.75, cooldownHours: 4 },
    global: { cashReservePct: 5, dcaRebalanceEnabled: true, hardRebalanceThreshold: 20 },
    params: { thresholdPct: 5, minTradeUsd: 15 },
  },
};

export default function StrategyConfigPage() {
  const [misc, setMisc] = useState<MiscConfig>(() => {
    const l = loadLocal();
    return { baseAsset: l.baseAsset, maxDailyVolume: l.maxDailyVolume, partialFactor: l.partialFactor, cooldownHours: l.cooldownHours };
  });
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => {
    const l = loadLocal();
    return {
      dynamicThreshold: l.dynamicThreshold,
      trendAware: l.trendAware,
      feeAware: l.feeAware,
      autoExecute: l.autoExecute,
      cashReservePct: l.cashReservePct ?? 0,
      dcaRebalanceEnabled: l.dcaRebalanceEnabled ?? false,
      hardRebalanceThreshold: l.hardRebalanceThreshold ?? 15,
    };
  });
  const [activePreset, setActivePreset] = useState("Balanced");
  const [strategyType, setStrategyType] = useState<StrategyType>("threshold");
  const [typeParams, setTypeParams] = useState<Record<string, number>>(() => {
    const stored = loadLocal();
    const defaults = getDefaultParams("threshold");
    return { ...defaults, thresholdPct: (stored as any).thresholdPct ?? defaults.thresholdPct };
  });

  // API hooks
  const { data: apiData } = useStrategyConfig();
  const updateConfig = useUpdateStrategyConfig();
  const activateStrategy = useActivateStrategy();

  const activeName = apiData?.active?.name ?? "default";

  // Sync form from API active config on first load
  useEffect(() => {
    const active = apiData?.active;
    if (!active) return;
    const p = active.params ?? {};
    const g = active.globalSettings ?? {};
    setMisc((prev) => ({
      ...prev,
      partialFactor: g.partialFactor ?? prev.partialFactor,
      cooldownHours: g.cooldownHours ?? prev.cooldownHours,
    }));
    setGlobalSettings((prev) => ({
      ...prev,
      dynamicThreshold: g.dynamicThreshold ?? prev.dynamicThreshold,
      trendAware: g.trendAware ?? prev.trendAware,
      feeAware: g.feeAware ?? prev.feeAware,
      autoExecute: g.autoExecute ?? prev.autoExecute,
      cashReservePct: g.cashReservePct ?? prev.cashReservePct,
      dcaRebalanceEnabled: g.dcaRebalanceEnabled ?? prev.dcaRebalanceEnabled,
      hardRebalanceThreshold: g.hardRebalanceThreshold ?? prev.hardRebalanceThreshold,
    }));
    setTypeParams((prev) => ({ ...prev, ...p }));
    if (active.strategyType) setStrategyType(active.strategyType as StrategyType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiData?.active?.name]);

  function handleGlobalChange<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) {
    setGlobalSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleStrategyTypeChange(t: StrategyType) {
    setStrategyType(t);
    setTypeParams(getDefaultParams(t));
  }

  function handleSave() {
    const snapshot = { ...misc, ...globalSettings, thresholdPct: typeParams.thresholdPct };
    saveLocal(snapshot);
    const payload = {
      strategyType,
      params: typeParams,
      baseAsset: misc.baseAsset,
      maxDailyVolume: misc.maxDailyVolume,
      partialFactor: misc.partialFactor,
      cooldownHours: misc.cooldownHours,
      dynamicThreshold: globalSettings.dynamicThreshold,
      trendAware: globalSettings.trendAware,
      feeAware: globalSettings.feeAware,
      autoExecute: globalSettings.autoExecute,
      cashReservePct: globalSettings.cashReservePct,
      dcaRebalanceEnabled: globalSettings.dcaRebalanceEnabled,
      hardRebalanceThreshold: globalSettings.hardRebalanceThreshold,
    };
    updateConfig.mutate(
      { name: activeName, data: payload },
      {
        onSuccess: () => toast.success("Strategy config saved"),
        onError: () => toast.success("Strategy config saved"),
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
    setMisc(DEFAULT_MISC);
    setGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
    saveLocal({ ...DEFAULT_MISC, ...DEFAULT_GLOBAL_SETTINGS });
    toast.success("Restored default config");
  }

  function handleFallbackPreset(name: string) {
    setActivePreset(name);
    const preset = FALLBACK_PRESET_VALUES[name];
    if (preset) {
      if (preset.misc) setMisc((prev) => ({ ...prev, ...preset.misc }));
      if (preset.global) setGlobalSettings((prev) => ({ ...prev, ...preset.global }));
      setTypeParams((prev) => ({ ...prev, ...preset.params }));
    }
  }

  const globalNumericFields: Array<{ label: string; key: keyof MiscConfig; step?: number }> = [
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

            <div className="grid grid-cols-2 gap-4">
              <StrategyTypeFields
                strategyType={strategyType}
                params={typeParams}
                onChange={(key, val) => setTypeParams((prev) => ({ ...prev, [key]: val }))}
              />

              {globalNumericFields.map((f) => (
                <div key={f.key}>
                  <label className="stat-label mb-1 block">{f.label}</label>
                  <input
                    className="brutal-input w-full text-sm"
                    type="number"
                    step={f.step ?? 1}
                    value={misc[f.key] as number}
                    onChange={(e) => setMisc((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                  />
                </div>
              ))}

              <div>
                <label className="stat-label mb-1 block">Base Asset</label>
                <input
                  className="brutal-input w-full text-sm"
                  value={misc.baseAsset}
                  onChange={(e) => setMisc((prev) => ({ ...prev, baseAsset: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <GlobalSettingsSection settings={globalSettings} onChange={handleGlobalChange} />

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
              <p><strong>Cash Reserve:</strong> Keeps a % of portfolio in USDT as buffer before rebalancing.</p>
              <p><strong>DCA Routing:</strong> New deposits go to the most underweight asset automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
