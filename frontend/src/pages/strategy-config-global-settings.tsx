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
  dcaAmountUsd: number;
  hardRebalanceThreshold: number;
  trendFilterEnabled: boolean;
  trendFilterMA: number;
  bearCashPct: number;
  trendFilterBuffer: number;
  trendFilterCooldownDays: number;
  smartDcaEnabled: boolean;
  smartDcaDipMultiplier: number;
  smartDcaHighMultiplier: number;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  dynamicThreshold: true,
  trendAware: false,
  feeAware: true,
  autoExecute: false,
  cashReservePct: 0,
  dcaRebalanceEnabled: false,
  dcaAmountUsd: 20,
  hardRebalanceThreshold: 15,
  trendFilterEnabled: false,
  trendFilterMA: 100,
  bearCashPct: 70,
  trendFilterBuffer: 2,
  trendFilterCooldownDays: 3,
  smartDcaEnabled: false,
  smartDcaDipMultiplier: 1.5,
  smartDcaHighMultiplier: 0.5,
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

      {/* Fee-Aware: only toggle that actually affects trade decisions */}
      <Toggle
        label="Fee-Aware Execution"
        value={settings.feeAware}
        onChange={(v) => onChange("feeAware", v)}
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

      {/* DCA Amount — only visible when DCA routing on */}
      {settings.dcaRebalanceEnabled && (
        <div className="py-3 border-b border-foreground/10">
          <label className="stat-label">DCA Amount (USD)</label>
          <input
            type="number"
            min={1}
            max={100000}
            step={1}
            value={settings.dcaAmountUsd}
            onChange={(e) => onChange("dcaAmountUsd", Number(e.target.value))}
            className="brutal-input w-full mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            USD amount per scheduled DCA execution
          </p>
        </div>
      )}

      {/* Smart DCA — only visible when DCA routing on */}
      {settings.dcaRebalanceEnabled && (
        <div className="py-3 border-b border-foreground/10">
          <Toggle
            label="Smart DCA (Buy the Dip)"
            value={settings.smartDcaEnabled}
            onChange={(v) => onChange("smartDcaEnabled", v)}
          />
          <p className="text-xs text-muted-foreground -mt-1 pb-2">
            DCA more when BTC below MA, less when above
          </p>
          {settings.smartDcaEnabled && (
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Dip Multiplier</span>
                  <span className="text-sm font-bold tabular-nums">
                    {settings.smartDcaDipMultiplier}x (${(settings.dcaAmountUsd * settings.smartDcaDipMultiplier).toFixed(0)}/day)
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.25}
                  value={settings.smartDcaDipMultiplier}
                  onChange={(e) => onChange("smartDcaDipMultiplier", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Multiply DCA amount when BTC is below MA (buying the dip)
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">High Multiplier</span>
                  <span className="text-sm font-bold tabular-nums">
                    {settings.smartDcaHighMultiplier}x (${(settings.dcaAmountUsd * settings.smartDcaHighMultiplier).toFixed(0)}/day)
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.25}
                  value={settings.smartDcaHighMultiplier}
                  onChange={(e) => onChange("smartDcaHighMultiplier", Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Multiply DCA amount when BTC is above MA (reduce buying high)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

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
