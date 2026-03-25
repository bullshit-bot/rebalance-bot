import { PageTitle, SectionTitle } from "@/components/ui-brutal";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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

export default function SettingsPage() {
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
              <button className="brutal-btn-secondary text-xs w-full">Export Portfolio Data (JSON)</button>
              <button className="brutal-btn-secondary text-xs w-full">Export Order History (CSV)</button>
              <button className="brutal-btn-danger text-xs w-full">Clear Local Cache</button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          className="brutal-btn-primary flex items-center gap-1.5"
          onClick={() => toast.success("Settings saved")}
        >
          <Save size={15} /> Save Settings
        </button>
      </div>
    </div>
  );
}
