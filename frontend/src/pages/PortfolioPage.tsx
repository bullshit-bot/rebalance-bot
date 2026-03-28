import { PageTitle, SectionTitle, DriftBadge, ActionBadge, StatCard, BrutalSkeleton } from "@/components/ui-brutal";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { Wallet, TrendingUp } from "lucide-react";
import { useState } from "react";

const FILTERS = ["All", "Large Cap", "Alt", "Stablecoin"];

const CATEGORY_MAP: Record<string, string> = {
  BTC: "Large Cap",
  ETH: "Large Cap",
  SOL: "Alt",
  BNB: "Alt",
  AVAX: "Alt",
  USDT: "Stablecoin",
  USDC: "Stablecoin",
  TUSD: "Stablecoin",
  DAI: "Stablecoin",
  USD: "Stablecoin",
  LINK: "Alt",
};

// Derive action recommendation from drift percentage
function deriveAction(driftPct: number): string {
  if (driftPct > 2) return "sell";
  if (driftPct < -2) return "buy";
  return "hold";
}

export default function PortfolioPage() {
  const [filter, setFilter] = useState("All");
  const { data: portfolio, isLoading, isError } = usePortfolio();

  if (isLoading) {
    return (
      <div>
        <PageTitle>Portfolio</PageTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="brutal-card">
              <BrutalSkeleton variant="text" height={12} width="50%" className="mb-2" />
              <BrutalSkeleton variant="text" height={28} width="70%" />
            </div>
          ))}
        </div>
        <div className="brutal-card">
          <BrutalSkeleton variant="text" height={18} width="30%" className="mb-3" />
          <BrutalSkeleton variant="rect" height={200} className="rounded-md" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageTitle>Portfolio</PageTitle>
        <div className="brutal-card border-destructive bg-destructive/5 text-destructive">
          <p className="font-bold">Failed to load portfolio data. Please try again.</p>
        </div>
      </div>
    );
  }

  const assets = portfolio?.assets ?? [];

  const filteredAssets = filter === "All"
    ? assets
    : assets.filter((a) => CATEGORY_MAP[a.asset] === filter);

  const maxDrift = assets.length > 0
    ? Math.max(...assets.map((a) => Math.abs(a.driftPct)))
    : 0;
  const avgDrift = assets.length > 0
    ? assets.reduce((sum, a) => sum + Math.abs(a.driftPct), 0) / assets.length
    : 0;

  return (
    <div>
      <PageTitle>Portfolio</PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Value"
          value={`$${(portfolio?.totalValueUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<Wallet size={18} />}
        />
        <StatCard label="# Assets" value={String(assets.length)} />
        <StatCard
          label="Max Drift"
          value={`${maxDrift.toFixed(1)}%`}
          variant={maxDrift > 4 ? "warning" : "default"}
          icon={<TrendingUp size={18} />}
        />
        <StatCard label="Avg Drift" value={`${avgDrift.toFixed(1)}%`} />
      </div>

      <div className="brutal-card">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Holdings</SectionTitle>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold px-3 py-1 rounded-md border-[2px] border-foreground transition-all duration-75 ${
                  filter === f ? "bg-primary text-primary-foreground brutal-shadow-sm" : "bg-card hover:bg-secondary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Asset</th><th>Quantity</th><th>Price</th><th>Value</th><th>Current %</th><th>Target %</th><th>Drift</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground text-sm py-8">No assets found</td>
                </tr>
              ) : (
                filteredAssets.map((a) => {
                  const price = a.amount > 0 ? a.valueUsd / a.amount : 0;
                  return (
                    <tr key={a.asset}>
                      <td className="font-bold">{a.asset}</td>
                      <td className="tabular-nums">{a.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                      <td className="tabular-nums">${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="tabular-nums font-medium">${a.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="tabular-nums">{a.currentPct.toFixed(1)}%</td>
                      <td className="tabular-nums">{a.targetPct.toFixed(1)}%</td>
                      <td><DriftBadge drift={a.driftPct} /></td>
                      <td><ActionBadge action={deriveAction(a.driftPct)} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
