import { PageTitle, SectionTitle, BrutalSkeleton } from "@/components/ui-brutal";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { useAllocations } from "@/hooks/use-allocation-queries";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const COLORS = ["#7c3aed", "#2563eb", "#f59e0b", "#6b7280", "#ec4899", "#14b8a6"];

export default function AllocationsPage() {
  const portfolioQuery = usePortfolio();
  const allocationsQuery = useAllocations();

  const isLoading = portfolioQuery.isLoading || allocationsQuery.isLoading;
  const isError = portfolioQuery.isError || allocationsQuery.isError;

  if (isLoading) {
    return (
      <div>
        <PageTitle>Allocations</PageTitle>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-5 brutal-card">
            <BrutalSkeleton variant="text" height={18} width="40%" className="mb-3" />
            <BrutalSkeleton variant="rect" height={256} className="rounded-md" />
          </div>
          <div className="lg:col-span-7 brutal-card">
            <BrutalSkeleton variant="text" height={18} width="40%" className="mb-3" />
            <BrutalSkeleton variant="rect" height={256} className="rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageTitle>Allocations</PageTitle>
        <div className="brutal-card border-destructive bg-destructive/5 text-destructive">
          <p className="font-bold">Failed to load allocations data. Please try again.</p>
        </div>
      </div>
    );
  }

  const assets = portfolioQuery.data?.assets ?? [];
  const allocations = allocationsQuery.data ?? [];

  // Build a merged view: use portfolio assets for current pct, allocations for target pct
  const targetMap = new Map(allocations.map((a) => [a.asset, a.targetPct]));

  // Pie data uses allocation targets (fallback to asset targetPct from portfolio)
  const pieData = assets.map((a) => ({
    name: a.asset,
    value: targetMap.get(a.asset) ?? a.targetPct,
  }));

  const barData = assets.map((a) => ({
    asset: a.asset,
    current: a.currentPct,
    target: targetMap.get(a.asset) ?? a.targetPct,
  }));

  return (
    <div>
      <PageTitle>Allocations</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <div className="lg:col-span-5 brutal-card">
          <SectionTitle>Target Allocation</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} strokeWidth={2.5} stroke="hsl(var(--foreground))">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {pieData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs font-medium">
                <span className="w-3 h-3 rounded-sm border-[1.5px] border-foreground" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name} {d.value.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 brutal-card">
          <SectionTitle>Current vs Target</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={barData} barGap={2}>
                <XAxis dataKey="asset" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar dataKey="current" fill="#7c3aed" name="Current %" radius={[3, 3, 0, 0]} />
                <Bar dataKey="target" fill="#d4d4d4" name="Target %" radius={[3, 3, 0, 0]} stroke="#000" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {assets.map((a) => {
          const targetPct = targetMap.get(a.asset) ?? a.targetPct;
          const alloc = allocations.find((al) => al.asset === a.asset);
          // Rebalance band from allocation config, fallback to 4%
          const band = alloc?.minTradeUsd ? "custom" : "4";
          return (
            <div key={a.asset} className="brutal-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{a.asset}</span>
                <span className="text-xs brutal-badge bg-primary/10 text-primary">{targetPct.toFixed(1)}% target</span>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                Rebalance band: ±{band}%
              </div>
              <div className="w-full bg-secondary rounded-sm h-3 border-[1.5px] border-foreground overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(a.currentPct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1 tabular-nums">
                <span>Current: {a.currentPct.toFixed(1)}%</span>
                <span>Target: {targetPct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
