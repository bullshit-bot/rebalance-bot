// Global settings section for StrategyConfigPage
// Contains toggles and cash-reserve / DCA controls

import { Toggle } from "./strategy-config-toggle";

export interface GlobalSettings {
  dynamicThreshold: boolean;
  trendAware: boolean;
  feeAware: boolean;
  autoExecute: boolean;
  cashReservePct: number;
  dcaRebalanceEnabled: boolean;
  hardRebalanceThreshold: number;
  trendFilterEnabled: boolean;
  trendFilterMA: number;
  bearCashPct: number;
  trendFilterBuffer: number;
  trendFilterCooldownDays: number;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  dynamicThreshold: true,
  trendAware: false,
  feeAware: true,
  autoExecute: false,
  cashReservePct: 0,
  dcaRebalanceEnabled: false,
  hardRebalanceThreshold: 15,
  trendFilterEnabled: false,
  trendFilterMA: 100,
  bearCashPct: 70,
  trendFilterBuffer: 2,
  trendFilterCooldownDays: 3,
};

interface Props {
  settings: GlobalSettings;
  onChange: <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => void;
}

export function GlobalSettingsSection({ settings, onChange }: Props) {
  return (
    <div className="brutal-card">
      <h2 className="text-sm font-black uppercase tracking-wider mb-3 pb-2 border-b-2 border-foreground">
        Global Settings
      </h2>

      {/* Standard toggles */}
      <Toggle
        label="Dynamic Threshold"
        value={settings.dynamicThreshold}
        onChange={(v) => onChange("dynamicThreshold", v)}
      />
      <Toggle
        label="Fee-Aware Execution"
        value={settings.feeAware}
        onChange={(v) => onChange("feeAware", v)}
      />
      <Toggle
        label="Auto Execute"
        value={settings.autoExecute}
        onChange={(v) => onChange("autoExecute", v)}
      />

      {/* Cash Reserve slider */}
      <div className="py-3 border-b border-foreground/10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Cash Reserve</span>
          <span className="text-sm font-bold tabular-nums">{settings.cashReservePct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={settings.cashReservePct}
          onChange={(e) => onChange("cashReservePct", Number(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1">
          % of portfolio kept in USDT as cash buffer
        </p>
      </div>

      {/* DCA Routing toggle */}
      <div className="border-b border-foreground/10 last:border-0">
        <Toggle
          label="DCA Routing"
          value={settings.dcaRebalanceEnabled}
          onChange={(v) => onChange("dcaRebalanceEnabled", v)}
        />
        <p className="text-xs text-muted-foreground -mt-1 pb-2">
          Route DCA deposits to most underweight asset
        </p>
      </div>

      {/* Hard Rebalance Threshold — only visible when DCA routing on */}
      {settings.dcaRebalanceEnabled && (
        <div className="py-3">
          <label className="stat-label">Hard Rebalance Threshold %</label>
          <input
            type="number"
            min={5}
            max={50}
            step={1}
            value={settings.hardRebalanceThreshold}
            onChange={(e) => onChange("hardRebalanceThreshold", Number(e.target.value))}
            className="brutal-input w-full mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Traditional sell+buy rebalance only fires above this drift
          </p>
        </div>
      )}

      {/* Trend Filter toggle */}
      <div className="border-b border-foreground/10 last:border-0">
        <Toggle
          label="Trend Filter (MA Bear Protection)"
          value={settings.trendFilterEnabled}
          onChange={(v) => onChange("trendFilterEnabled", v)}
        />
        <p className="text-xs text-muted-foreground -mt-1 pb-2">
          Sell to cash in bear market (BTC below MA), DCA only in bull
        </p>
      </div>

      {/* Trend filter params — only visible when enabled */}
      {settings.trendFilterEnabled && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="stat-label">MA Period (days)</label>
            <input
              type="number"
              min={20}
              max={365}
              step={1}
              value={settings.trendFilterMA}
              onChange={(e) => onChange("trendFilterMA", Number(e.target.value))}
              className="brutal-input w-full mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              BTC simple moving average period (default: 100)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Bear Cash Target</span>
              <span className="text-sm font-bold tabular-nums">{settings.bearCashPct}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={settings.bearCashPct}
              onChange={(e) => onChange("bearCashPct", Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              % in stablecoins when bear mode triggers
            </p>
          </div>

          <div>
            <label className="stat-label">Cooldown (days)</label>
            <input
              type="number"
              min={1}
              max={14}
              step={1}
              value={settings.trendFilterCooldownDays}
              onChange={(e) => onChange("trendFilterCooldownDays", Number(e.target.value))}
              className="brutal-input w-full mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Min days between bull/bear state changes (prevents whipsaw)
            </p>
          </div>

          <div>
            <label className="stat-label">Buffer % (whipsaw guard)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={settings.trendFilterBuffer}
              onChange={(e) => onChange("trendFilterBuffer", Number(e.target.value))}
              className="brutal-input w-full mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Still treat as bull if price is within this % below MA
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
