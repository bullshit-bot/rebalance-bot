import { useState } from "react";
import { PageTitle, SectionTitle, StatCard, BrutalTabs } from "@/components/ui-brutal";
import {
  useEquityCurve,
  usePnL,
  useDrawdown,
  useFees,
} from "@/hooks/use-analytics-queries";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { TrendingUp, Activity, DollarSign, BarChart3, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#7c3aed", "#2563eb", "#f59e0b"];

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-destructive">{message}</div>
  );
}

function OverviewTab() {
  const equity = useEquityCurve();
  const portfolio = usePortfolio();
  const drawdown = useDrawdown();
  const fees = useFees();

  const equityData = equity.data?.data ?? [];
  const portfolioValue = portfolio.data?.totalValueUsd ?? 0;
  const totalInvested = portfolio.data?.totalInvested ?? 0;

  // PnL from capital flows (deposits) — not realized trades
  const totalPnl = totalInvested > 0 ? portfolioValue - totalInvested : 0;
  const totalReturnPct = totalInvested > 0
    ? ((totalPnl / totalInvested) * 100).toFixed(1)
    : "0.0";

  const maxDd = drawdown.data?.maxDrawdownPct ?? 0;
  const totalFees = fees.data?.totalFeesUsd ?? 0;

  const chartData = equityData.map((p) => ({
    date: formatDate(p.timestamp),
    value: p.valueUsd,
  }));

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Total Return"
          value={`${Number(totalReturnPct) >= 0 ? "+" : ""}${totalReturnPct}%`}
          variant={Number(totalReturnPct) >= 0 ? "success" : "danger"}
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="Net PnL"
          value={`${totalPnl >= 0 ? "+" : "-"}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          variant={totalPnl >= 0 ? "success" : "danger"}
          icon={<DollarSign size={16} />}
        />
        <StatCard
          label="Max Drawdown"
          value={`${maxDd.toFixed(1)}%`}
          variant="danger"
          icon={<Activity size={16} />}
        />
        <StatCard
          label="Total Fees"
          value={`$${totalFees.toFixed(1)}`}
          variant="warning"
          icon={<BarChart3 size={16} />}
        />
      </div>
      <div className="brutal-card">
        <SectionTitle>Equity Curve (90d)</SectionTitle>
        {equity.isLoading && <LoadingRow />}
        {equity.isError && <ErrorRow message="Failed to load equity data." />}
        {!equity.isLoading && !equity.isError && (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={14} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
                  domain={["auto", "auto"]}
                />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function PnLTab() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data, isLoading, isError } = usePnL();

  // byAsset as bar chart data
  const byAsset = data?.byAsset ?? {};
  const assetData = Object.entries(byAsset).map(([asset, pnl]) => ({ asset, pnl }));

  const periodValue =
    period === "daily"
      ? data?.byPeriod.daily ?? 0
      : period === "weekly"
      ? data?.byPeriod.weekly ?? 0
      : data?.byPeriod.monthly ?? 0;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`brutal-btn-secondary text-xs px-3 py-1.5 capitalize ${
              period === p ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="brutal-card">
        <SectionTitle>PnL — {period.charAt(0).toUpperCase() + period.slice(1)}</SectionTitle>
        {isLoading && <LoadingRow />}
        {isError && <ErrorRow message="Failed to load PnL data." />}
        {!isLoading && !isError && (
          <>
            <div className="mb-3 text-sm">
              <span className="stat-label">Period PnL: </span>
              <span className={`font-bold tabular-nums ${periodValue >= 0 ? "text-success" : "text-destructive"}`}>
                {periodValue >= 0 ? "+" : ""}${periodValue.toLocaleString()}
              </span>
            </div>
            {assetData.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={assetData}>
                    <XAxis dataKey="asset" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="pnl" name="PnL" radius={[3, 3, 0, 0]} fill="#22c55e">
                      {assetData.map((d, i) => (
                        <Cell key={i} fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {assetData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No PnL data available.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DrawdownTab() {
  const { data, isLoading, isError } = useDrawdown();

  const chartData = (data?.drawdownSeries ?? []).map((p) => ({
    date: formatDate(p.timestamp),
    drawdown: p.drawdownPct * 100,
  }));

  return (
    <div className="brutal-card">
      <SectionTitle>Drawdown (90d)</SectionTitle>
      {isLoading && <LoadingRow />}
      {isError && <ErrorRow message="Failed to load drawdown data." />}
      {!isLoading && !isError && (
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={14} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function FeesTab() {
  const { data, isLoading, isError } = useFees();

  const byExchange = data?.byExchange ?? {};
  const total = data?.totalFeesUsd ?? 0;
  const pieData = Object.entries(byExchange).map(([exchange, fees]) => ({
    exchange,
    fees,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="brutal-card">
        <SectionTitle>Fees by Exchange</SectionTitle>
        {isLoading && <LoadingRow />}
        {isError && <ErrorRow message="Failed to load fee data." />}
        {!isLoading && !isError && (
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="fees"
                  nameKey="exchange"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  strokeWidth={2.5}
                  stroke="hsl(var(--foreground))"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="brutal-card">
        <SectionTitle>Fee Breakdown</SectionTitle>
        {isLoading && <LoadingRow />}
        {isError && <ErrorRow message="Failed to load fee data." />}
        {!isLoading && !isError && (
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Exchange</th>
                <th>Fees (USD)</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {pieData.map((f) => (
                <tr key={f.exchange}>
                  <td className="font-bold">{f.exchange}</td>
                  <td className="tabular-nums">${f.fees.toFixed(2)}</td>
                  <td className="tabular-nums">
                    {total > 0 ? ((f.fees / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-foreground">
                <td>Total</td>
                <td className="tabular-nums">${total.toFixed(1)}</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div>
      <PageTitle>Analytics</PageTitle>
      <BrutalTabs
        tabs={[
          { id: "overview", label: "Overview", content: <OverviewTab /> },
          { id: "pnl", label: "PnL", content: <PnLTab /> },
          { id: "drawdown", label: "Drawdown", content: <DrawdownTab /> },
          { id: "fees", label: "Fees", content: <FeesTab /> },
        ]}
      />
    </div>
  );
}
