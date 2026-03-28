import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

const STORAGE_KEY = "rb_settings";

interface AppSettings {
  defaultExchange: string;
  executionMode: string;
  baseCurrency: string;
  notifyRebalance: boolean;
  notifyOrderFail: boolean;
  notifyDrift: boolean;
  notifyExchangeErr: boolean;
  notifyDailySummary: boolean;
}

const DEFAULTS: AppSettings = {
  defaultExchange: "Binance",
  executionMode: "Manual Confirm",
  baseCurrency: "USDT",
  notifyRebalance: true,
  notifyOrderFail: true,
  notifyDrift: true,
  notifyExchangeErr: true,
  notifyDailySummary: false,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success("Settings saved");
  };

  const handleExportPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      downloadJson(data, "portfolio.json");
      toast.success("Portfolio exported");
    } catch { toast.error("Failed to export portfolio"); }
  };

  const handleExportOrders = async () => {
    try {
      const data = await api.getTrades(1000);
      downloadJson(data, "order-history.json");
      toast.success("Order history exported");
    } catch { toast.error("Failed to export order history"); }
  };

  const handleClearCache = () => {
    Object.keys(localStorage).filter((k) => k.startsWith("rb_")).forEach((k) => localStorage.removeItem(k));
    setSettings({ ...DEFAULTS });
    toast.success("Cache cleared");
  };

  return (
    <div>
      <PageTitle>Settings</PageTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="brutal-card">
          <SectionTitle>Defaults</SectionTitle>
          <div className="py-3 border-b border-foreground/10">
            <label className="stat-label mb-1.5 block">Default Exchange</label>
            <select className="brutal-input w-full text-sm" value={settings.defaultExchange} onChange={(e) => update("defaultExchange", e.target.value)}>
              {["Binance", "OKX", "Auto"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="py-3 border-b border-foreground/10">
            <label className="stat-label mb-1.5 block">Execution Mode</label>
            <select className="brutal-input w-full text-sm" value={settings.executionMode} onChange={(e) => update("executionMode", e.target.value)}>
              {["Dry Run", "Live", "Manual Confirm"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="py-3">
            <label className="stat-label mb-1.5 block">Base Currency</label>
            <select className="brutal-input w-full text-sm" value={settings.baseCurrency} onChange={(e) => update("baseCurrency", e.target.value)}>
              {["USDT", "USDC", "BUSD"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="brutal-card">
            <SectionTitle>Notifications</SectionTitle>
            {([
              ["notifyRebalance", "Rebalance Complete", "Alert when rebalance cycle finishes"],
              ["notifyOrderFail", "Order Failures", "Alert on failed or rejected orders"],
              ["notifyDrift", "Drift Warnings", "Alert when drift exceeds threshold"],
              ["notifyExchangeErr", "Exchange Errors", "Alert on sync or API failures"],
              ["notifyDailySummary", "Daily Summary", "End-of-day portfolio summary"],
            ] as const).map(([key, label, desc]) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-foreground/10 last:border-0">
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <Switch checked={settings[key]} onCheckedChange={(v) => update(key, v)} />
              </div>
            ))}
          </div>

          <div className="brutal-card">
            <SectionTitle>Data</SectionTitle>
            <div className="space-y-2">
              <button className="brutal-btn-secondary text-xs w-full" onClick={handleExportPortfolio}>Export Portfolio Data (JSON)</button>
              <button className="brutal-btn-secondary text-xs w-full" onClick={handleExportOrders}>Export Order History (JSON)</button>
              <button className="brutal-btn-danger text-xs w-full" onClick={handleClearCache}>Clear Local Cache</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button className="brutal-btn-primary flex items-center gap-1.5" onClick={handleSave}>
          <Save size={15} /> Save Settings
        </button>
      </div>
    </div>
  );
}
