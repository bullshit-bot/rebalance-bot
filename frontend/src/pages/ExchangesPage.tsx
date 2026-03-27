import { PageTitle, SectionTitle, StatusBadge } from "@/components/ui-brutal";
import { useHealth } from "@/hooks/use-health-queries";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { Server, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ExchangesPage() {
  const { data: health, isLoading, isError } = useHealth();
  const { data: portfolio } = usePortfolio();

  // Compute per-exchange spot balance from portfolio assets
  const exchangeBalances: Record<string, number> = {};
  for (const asset of portfolio?.assets ?? []) {
    const ex = asset.exchange ?? "unknown";
    exchangeBalances[ex] = (exchangeBalances[ex] ?? 0) + asset.valueUsd;
  }

  const exchanges = health
    ? Object.entries(health.exchanges).map(([name, status]) => ({
        name,
        connected: status === "connected",
        spotBalance: exchangeBalances[name] ?? 0,
        mode: name === "binance" && status === "connected" ? "Testnet (Sandbox)" : "—",
        lastSync: portfolio?.updatedAt ? new Date(portfolio.updatedAt).toLocaleString() : "—",
      }))
    : [];

  return (
    <div>
      <PageTitle>Exchanges</PageTitle>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading exchange status…</span>
        </div>
      )}

      {isError && (
        <div className="brutal-card border-destructive mb-4">
          <p className="text-sm text-destructive font-medium">Failed to load exchange status. Check backend connection.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {exchanges.map((ex) => (
          <div key={ex.name} className={`brutal-card ${ex.connected ? "border-success" : "border-destructive"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server size={20} />
                <span className="text-xl font-bold capitalize">{ex.name}</span>
              </div>
              <StatusBadge status={ex.connected ? "connected" : "disconnected"} />
            </div>

            <div className="grid grid-cols-2 gap-y-3 text-sm mb-4">
              <div>
                <span className="stat-label">API Label</span>
                <br />
                <span className="font-mono text-xs">{ex.connected ? "trading-bot" : "—"}</span>
              </div>
              <div>
                <span className="stat-label">Spot Balance</span>
                <br />
                <span className="font-bold tabular-nums">
                  {ex.connected && ex.spotBalance > 0
                    ? `$${ex.spotBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="stat-label">Last Sync</span>
                <br />
                <span className="text-xs tabular-nums">{ex.connected ? ex.lastSync : "—"}</span>
              </div>
              <div>
                <span className="stat-label">Mode</span>
                <br />
                <span className="text-xs">{ex.mode}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="brutal-btn-secondary text-xs flex items-center gap-1"
                onClick={() => toast.success(`${ex.name} sync started`)}
              >
                <RefreshCw size={12} /> Sync Now
              </button>
              {!ex.connected && (
                <button className="brutal-btn-primary text-xs flex items-center gap-1">
                  Reconnect
                </button>
              )}
            </div>
          </div>
        ))}

        {!isLoading && exchanges.length === 0 && !isError && (
          <div className="brutal-card col-span-full text-center py-8 text-muted-foreground">
            <p className="text-sm">No exchanges configured.</p>
          </div>
        )}
      </div>

      <div className="brutal-card">
        <SectionTitle>API Permission Checklist</SectionTitle>
        <div className="space-y-2">
          {["Read Account", "Read Balances", "Spot Trading", "Margin Trading", "Futures Trading", "Withdrawal"].map((perm, i) => (
            <div key={perm} className="flex items-center justify-between py-2 border-b border-foreground/10 last:border-0">
              <span className="text-sm font-medium">{perm}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs">
                  {i < 3 ? <CheckCircle size={13} className="text-success" /> : <XCircle size={13} className="text-muted-foreground" />}
                  Binance
                </span>
                <span className="flex items-center gap-1 text-xs">
                  {i < 1 ? <CheckCircle size={13} className="text-success" /> : <XCircle size={13} className="text-destructive" />}
                  OKX
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
