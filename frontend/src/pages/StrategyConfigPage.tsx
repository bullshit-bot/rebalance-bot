import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { Save, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

type Config = typeof DEFAULT_CONFIG;

function loadConfig(): Config {
  try {
    const stored = localStorage.getItem("rb_strategy_config");
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: Config) {
  localStorage.setItem("rb_strategy_config", JSON.stringify(config));
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-foreground/10 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full border-[2px] border-foreground relative transition-colors ${value ? "bg-primary" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-card border-[1.5px] border-foreground transition-transform ${
            value ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

const PRESETS = [
  { name: "Conservative", threshold: 8, partial: 0.5, cooldown: 8, desc: "Wide threshold, slow rebalance" },
  { name: "Balanced", threshold: 5, partial: 0.75, cooldown: 4, desc: "Standard configuration" },
  { name: "Aggressive", threshold: 2, partial: 1.0, cooldown: 1, desc: "Tight threshold, fast rebalance" },
];

export default function StrategyConfigPage() {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [activePreset, setActivePreset] = useState("Balanced");

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveConfig(config);
    toast.success("Strategy config saved");
  }

  function handleRestore() {
    setConfig(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
    toast.success("Restored default config");
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setActivePreset(p.name);
    setConfig((prev) => ({
      ...prev,
      thresholdPct: p.threshold,
      partialFactor: p.partial,
      cooldownHours: p.cooldown,
    }));
  }

  const numericFields: Array<{ label: string; key: keyof Config; step?: number }> = [
    { label: "Threshold %", key: "thresholdPct", step: 0.1 },
    { label: "Min Trade (USDT)", key: "minTradeUSDT" },
    { label: "Partial Factor", key: "partialFactor", step: 0.05 },
    { label: "Cooldown (hours)", key: "cooldownHours" },
    { label: "Max Daily Volume", key: "maxDailyVolume" },
  ];

  return (
    <div>
      <PageTitle>Strategy Config</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <div className="brutal-card">
            <SectionTitle>Parameters</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              {numericFields.map((f) => (
                <div key={f.key}>
                  <label className="stat-label mb-1 block">{f.label}</label>
                  <input
                    className="brutal-input w-full text-sm"
                    type="number"
                    step={f.step ?? 1}
                    value={config[f.key] as number}
                    onChange={(e) => set(f.key, Number(e.target.value) as Config[typeof f.key])}
                  />
                </div>
              ))}
              <div>
                <label className="stat-label mb-1 block">Base Asset</label>
                <input
                  className="brutal-input w-full text-sm"
                  value={config.baseAsset}
                  onChange={(e) => set("baseAsset", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="brutal-card">
            <SectionTitle>Toggles</SectionTitle>
            <Toggle label="Dynamic Threshold" value={config.dynamicThreshold} onChange={(v) => set("dynamicThreshold", v)} />
            <Toggle label="Trend-Aware Mode" value={config.trendAware} onChange={(v) => set("trendAware", v)} />
            <Toggle label="Fee-Aware Execution" value={config.feeAware} onChange={(v) => set("feeAware", v)} />
            <Toggle label="Auto Execute" value={config.autoExecute} onChange={(v) => set("autoExecute", v)} />
          </div>

          <div className="flex gap-3">
            <button
              className="brutal-btn-primary flex items-center gap-1.5"
              onClick={handleSave}
            >
              <Save size={15} /> Save Config
            </button>
            <button
              className="brutal-btn-secondary flex items-center gap-1.5"
              onClick={handleRestore}
            >
              <RotateCcw size={15} /> Restore Defaults
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="brutal-card">
            <SectionTitle>Presets</SectionTitle>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left p-3 rounded-md border-[2px] border-foreground transition-all duration-75 ${
                    activePreset === p.name
                      ? "bg-primary/10 brutal-shadow-sm border-primary"
                      : "bg-card hover:bg-secondary"
                  }`}
                >
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.desc}</div>
                  <div className="text-xs mt-1 tabular-nums">
                    T: {p.threshold}% · P: {p.partial} · C: {p.cooldown}h
                  </div>
                </button>
              ))}
            </div>
          </div>

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
