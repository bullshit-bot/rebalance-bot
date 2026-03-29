import { StatCard, ActionBadge, StatusBadge, PageTitle, SectionTitle, BrutalSkeleton } from "@/components/ui-brutal";
import { usePortfolio, usePortfolioHistory } from "@/hooks/use-portfolio-queries";
import { useTrades } from "@/hooks/use-trade-queries";
import { useRebalancePreview } from "@/hooks/use-rebalance-queries";
import { useStrategyConfig } from "@/hooks/use-strategy-config-queries";
import { useHealth } from "@/hooks/use-health-queries";
import { DollarSign, TrendingUp, Coins, Activity, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";

const COLORS = ["#7c3aed", "#2563eb", "#f59e0b", "#6b7280", "#ec4899", "#14b8a6"];

const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD"]);

// Skeleton placeholder for a stat card
function SkeletonStatCard() {
  return (
    <div className="brutal-card">
      <BrutalSkeleton variant="text" height={12} width="50%" className="mb-2" />
      <BrutalSkeleton variant="text" height={28} width="70%" className="mb-1" />
      <BrutalSkeleton variant="text" height={10} width="40%" />
    </div>
  );
}

// Skeleton placeholder for a chart card
function SkeletonChartCard({ colSpan = 4 }: { colSpan?: number }) {
  return (
    <div className={`lg:col-span-${colSpan} brutal-card`}>
      <BrutalSkeleton variant="text" height={18} width="40%" className="mb-3" />
      <BrutalSkeleton variant="rect" height={208} className="rounded-md" />
    </div>
  );
}

export default function OverviewPage() {
  const portfolioQuery = usePortfolio();
  const historyQuery = usePortfolioHistory();
  const tradesQuery = useTrades(5);
  const previewQuery = useRebalancePreview();
  const strategyQuery = useStrategyConfig();
  const healthQuery = useHealth();

  const isLoading =
    portfolioQuery.isLoading ||
    historyQuery.isLoading ||
    tradesQuery.isLoading ||
    previewQuery.isLoading;

  const hasError =
    portfolioQuery.isError ||
    historyQuery.isError ||
    tradesQuery.isError;

  if (isLoading) {
    return (
      <div>
        <PageTitle>Overview</PageTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <SkeletonChartCard colSpan={4} />
          <SkeletonChartCard colSpan={4} />
          <SkeletonChartCard colSpan={4} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <SkeletonChartCard colSpan={8} />
          <SkeletonChartCard colSpan={4} />
        </div>
        <div className="brutal-card">
          <BrutalSkeleton variant="text" height={18} width="30%" className="mb-3" />
          <BrutalSkeleton variant="rect" height={160} className="rounded-md" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div>
        <PageTitle>Overview</PageTitle>
        <div className="brutal-card border-destructive bg-destructive/5 text-destructive">
          <p className="font-bold">Failed to load portfolio data. Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const portfolio = portfolioQuery.data!;
  const assets = portfolio.assets ?? [];

  // Derived stats
  const portfolioValue = portfolio.totalValueUsd;
  const cashAvailable = assets
    .filter((a) => STABLECOINS.has(a.asset))
    .reduce((sum, a) => sum + a.valueUsd, 0);
  const driftScore = assets.length > 0
    ? Math.max(...assets.map((a) => Math.abs(a.driftPct)))
    : 0;
  const pendingActions = previewQuery.data?.trades.length ?? 0;

  // Cash reserve derived stats
  const cashReservePct = strategyQuery.data?.active?.globalSettings?.cashReservePct ?? 0;
  const cashTargetUsd = cashReservePct > 0 ? (portfolioValue * cashReservePct) / 100 : 0;
  const cashActualPct = portfolioValue > 0 ? (cashAvailable / portfolioValue) * 100 : 0;
  const cashDeviation = cashReservePct > 0 ? cashActualPct - cashReservePct : 0;
  const cashVariant: "success" | "warning" | "danger" =
    Math.abs(cashDeviation) <= 2 ? "success" : Math.abs(cashDeviation) <= 5 ? "warning" : "danger";

  // PnL derived from history (first vs last snapshot)
  const history = historyQuery.data ?? [];
  let pnlDisplay = "—";
  if (history.length >= 2) {
    const first = history[0].totalValueUsd;
    const last = history[history.length - 1].totalValueUsd;
    const diff = last - first;
    const pct = first > 0 ? ((diff / first) * 100).toFixed(2) : "0.00";
    pnlDisplay = `${diff >= 0 ? "+" : ""}$${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 0 })} (${diff >= 0 ? "+" : ""}${pct}%)`;
  }

  // Chart data
  const chartData = history.map((s) => ({
    date: new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: s.totalValueUsd,
  }));

  const pieData = assets.map((a) => ({ name: a.asset, value: a.currentPct }));
  const comparisonData = assets.map((a) => ({ asset: a.asset, current: a.currentPct, target: a.targetPct }));

  // Trend filter state from health endpoint
  const trendStatus = healthQuery.data?.trendStatus
  const trendFilterActive = trendStatus?.enabled === true

  // Alerts derived from high-drift assets
  const driftAlerts = assets
    .filter((a) => Math.abs(a.driftPct) > 3)
    .map((a) => ({
      id: a.asset,
      title: `${a.asset} Drift Alert`,
      message: `${a.asset} has drifted ${a.driftPct > 0 ? "+" : ""}${a.driftPct.toFixed(1)}% from target (${a.targetPct}%)`,
      severity: Math.abs(a.driftPct) > 6 ? "critical" : "warning",
    }));

  // Recent trades formatted for display
  const recentTrades = (tradesQuery.data ?? []).slice(0, 5).map((t) => ({
    id: String(t._id),
    time: new Date(t.executedAt).toLocaleString(),
    exchange: t.exchange,
    symbol: t.pair,
    side: t.side,
    qty: t.amount,
    price: t.price,
    fee: t.fee ?? 0,
    status: "filled",
  }));

  // Rebalance preview actions
  const rebalanceActions = (previewQuery.data?.trades ?? []).slice(0, 5);

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <PageTitle>Overview</PageTitle>
        {trendFilterActive && trendStatus && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 text-xs font-black uppercase tracking-wider ${
              trendStatus.bullish
                ? "border-green-500 bg-green-500/10 text-green-600"
                : "border-red-500 bg-red-500/10 text-red-600"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${trendStatus.bullish ? "bg-green-500" : "bg-red-500"}`} />
            {trendStatus.bullish ? "BULL" : "BEAR"}
            {trendStatus.ma !== null && (
              <span className="font-normal normal-case tracking-normal opacity-70 ml-1">
                MA{trendStatus.dataPoints >= 100 ? "100" : `(${trendStatus.dataPoints}d)`}: ${trendStatus.ma.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Hero stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Portfolio Value"
          value={`$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<DollarSign size={18} />}
        />
        <StatCard
          label="PnL (history)"
          value={pnlDisplay}
          variant={pnlDisplay.startsWith("+") ? "success" : "default"}
          icon={<TrendingUp size={18} />}
        />
        {cashReservePct > 0 ? (
          <div className={`brutal-card ${cashVariant === "success" ? "bg-success/10 border-success" : cashVariant === "warning" ? "bg-warning/10 border-warning" : "bg-destructive/10 border-destructive"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="stat-label mb-1">Cash Reserve</div>
                <div className="stat-value">
                  ${cashAvailable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {cashActualPct.toFixed(1)}% of {cashReservePct}% target
                  {" "}(${cashTargetUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                </div>
              </div>
              <div className="text-muted-foreground"><Coins size={18} /></div>
            </div>
          </div>
        ) : (
          <StatCard
            label="USDT Available"
            value={`$${cashAvailable.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<Coins size={18} />}
          />
        )}
        <StatCard
          label="Drift Score"
          value={`${driftScore.toFixed(1)}%`}
          subValue="Threshold: 5.0%"
          variant={driftScore > 4 ? "warning" : "default"}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Pending Actions"
          value={String(pendingActions)}
          variant="purple"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Last Updated"
          value={portfolio.updatedAt
            ? new Date(portfolio.updatedAt).toLocaleTimeString()
            : "—"}
          variant="success"
          icon={<CheckCircle size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Allocation donut */}
        <div className="lg:col-span-4 brutal-card">
          <SectionTitle>Allocation</SectionTitle>
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={2.5} stroke="hsl(var(--foreground))">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1 text-xs font-medium">
                <span className="w-2.5 h-2.5 rounded-sm border border-foreground" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name} {d.value.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>

        {/* Current vs Target */}
        <div className="lg:col-span-4 brutal-card">
          <SectionTitle>Current vs Target</SectionTitle>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={comparisonData} barGap={2}>
                <XAxis dataKey="asset" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar dataKey="current" fill="#7c3aed" name="Current" radius={[3, 3, 0, 0]} />
                <Bar dataKey="target" fill="#d4d4d4" name="Target" radius={[3, 3, 0, 0]} stroke="#000" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rebalance recommendations */}
        <div className="lg:col-span-4 brutal-card">
          <SectionTitle>Rebalance Recommendations</SectionTitle>
          {rebalanceActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rebalance needed.</p>
          ) : (
            <div className="space-y-2">
              {rebalanceActions.map((a, idx) => (
                <div key={`${a.exchange}-${a.pair}-${idx}`} className="flex items-center justify-between py-2 border-b border-foreground/10 last:border-0">
                  <div className="flex items-center gap-2">
                    <ActionBadge action={a.side.toLowerCase()} />
                    <span className="font-bold text-sm">{a.pair}</span>
                  </div>
                  <span className="text-sm tabular-nums font-medium">
                    {a.amount.toFixed(4)} {a.price ? `@ $${a.price.toLocaleString()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Performance chart */}
        <div className="lg:col-span-8 brutal-card">
          <SectionTitle>Portfolio Value (history)</SectionTitle>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted-foreground h-48 flex items-center">Not enough history data yet.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={["dataMin - 2000", "dataMax + 2000"]} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: "#fff", stroke: "#7c3aed" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="lg:col-span-4 brutal-card">
          <SectionTitle>Active Alerts</SectionTitle>
          {driftAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drift alerts.</p>
          ) : (
            <div className="space-y-2">
              {driftAlerts.map((a) => (
                <div key={a.id} className={`p-2.5 rounded-md border-[2px] ${a.severity === "critical" ? "border-destructive bg-destructive/5" : "border-warning bg-warning/5"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={13} className={a.severity === "critical" ? "text-destructive" : "text-warning"} />
                    <span className="text-xs font-bold">{a.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="brutal-card">
        <SectionTitle>Recent Orders</SectionTitle>
        <div className="overflow-x-auto">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Time</th><th>Exchange</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground text-sm py-8">No recent orders</td>
                </tr>
              ) : (
                recentTrades.map((o) => (
                  <tr key={o.id}>
                    <td className="tabular-nums text-xs">{o.time}</td>
                    <td className="text-xs font-medium">{o.exchange}</td>
                    <td className="font-bold text-sm">{o.symbol}</td>
                    <td><ActionBadge action={o.side.toLowerCase()} /></td>
                    <td className="tabular-nums">{o.qty}</td>
                    <td className="tabular-nums">${o.price.toLocaleString()}</td>
                    <td className="tabular-nums text-muted-foreground">${o.fee}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
