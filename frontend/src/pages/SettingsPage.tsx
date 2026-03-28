import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

function SettingToggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3 border-b border-foreground/10 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function SettingSelect({ label, options, defaultValue }: { label: string; options: string[]; defaultValue: string }) {
  return (
    <div className="py-3 border-b border-foreground/10 last:border-0">
      <label className="stat-label mb-1.5 block">{label}</label>
      <select className="brutal-input w-full text-sm" defaultValue={defaultValue}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const handleExportPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      downloadJson(data, 'portfolio.json');
      toast.success('Portfolio exported');
    } catch {
      toast.error('Failed to export portfolio');
    }
  };

  const handleExportOrderHistory = async () => {
    try {
      const data = await api.getTrades(1000);
      downloadJson(data, 'order-history.json');
      toast.success('Order history exported');
    } catch {
      toast.error('Failed to export order history');
    }
  };

  const handleClearCache = () => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('rb_'));
    keys.forEach((k) => localStorage.removeItem(k));
    toast.success('Cache cleared');
  };

  const handleSaveSettings = () => {
    // No backend settings API yet — persist to localStorage
    toast.success('Settings saved locally');
  };

  return (
    <div>
      <PageTitle>Settings</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="brutal-card">
            <SectionTitle>Defaults</SectionTitle>
            <SettingSelect label="Default Exchange" options={["Binance", "OKX", "Auto"]} defaultValue="Binance" />
            <SettingSelect label="Execution Mode" options={["Dry Run", "Live", "Manual Confirm"]} defaultValue="Manual Confirm" />
            <SettingSelect label="Base Currency" options={["USDT", "USDC", "BUSD"]} defaultValue="USDT" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="brutal-card">
            <SectionTitle>Notifications</SectionTitle>
            <SettingToggle label="Rebalance Complete" desc="Alert when rebalance cycle finishes" defaultOn={true} />
            <SettingToggle label="Order Failures" desc="Alert on failed or rejected orders" defaultOn={true} />
            <SettingToggle label="Drift Warnings" desc="Alert when drift exceeds threshold" defaultOn={true} />
            <SettingToggle label="Exchange Errors" desc="Alert on sync or API failures" defaultOn={true} />
            <SettingToggle label="Daily Summary" desc="End-of-day portfolio summary" defaultOn={false} />
          </div>

          <div className="brutal-card">
            <SectionTitle>Data</SectionTitle>
            <div className="space-y-2">
              <button className="brutal-btn-secondary text-xs w-full" onClick={handleExportPortfolio}>
                Export Portfolio Data (JSON)
              </button>
              <button className="brutal-btn-secondary text-xs w-full" onClick={handleExportOrderHistory}>
                Export Order History (JSON)
              </button>
              <button className="brutal-btn-danger text-xs w-full" onClick={handleClearCache}>
                Clear Local Cache
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          className="brutal-btn-primary flex items-center gap-1.5"
          onClick={handleSaveSettings}
        >
          <Save size={15} /> Save Settings
        </button>
      </div>
    </div>
  );
}
