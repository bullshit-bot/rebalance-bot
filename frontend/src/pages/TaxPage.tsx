import { useState } from "react";
import { PageTitle, SectionTitle, StatCard } from "@/components/ui-brutal";
import { useTaxReport } from "@/hooks/use-tax-queries";
import { api } from "@/lib/api";
import { Download, TrendingUp, TrendingDown, DollarSign, Loader2 } from "lucide-react";

const YEARS = ["2026", "2025", "2024"];

export default function TaxPage() {
  const [year, setYear] = useState("2026");
  const { data, isLoading, isError } = useTaxReport(Number(year));

  const gains = data?.totalRealizedGain ?? 0;
  const losses = data?.totalRealizedLoss ?? 0;
  const net = data?.netGainLoss ?? 0;
  const events = data?.events ?? [];

  function handleExportCSV() {
    const url = api.exportTaxCsvUrl(Number(year));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${year}.csv`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <div>
      <PageTitle>Tax Reports</PageTitle>

      <div className="flex items-center gap-3 mb-4">
        <label className="stat-label">Tax Year</label>
        <select
          className="brutal-select"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          className="brutal-btn-secondary flex items-center gap-1.5 ml-auto"
          onClick={handleExportCSV}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading tax report…</span>
        </div>
      )}

      {isError && (
        <div className="brutal-card border-destructive mb-4">
          <p className="text-sm text-destructive font-medium">
            Failed to load tax report for {year}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Total Gains"
          value={`+$${gains.toLocaleString()}`}
          variant="success"
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="Total Losses"
          value={`-$${Math.abs(losses).toLocaleString()}`}
          variant="danger"
          icon={<TrendingDown size={16} />}
        />
        <StatCard
          label="Net PnL"
          value={`${net >= 0 ? "+" : ""}$${net.toLocaleString()}`}
          variant={net >= 0 ? "success" : "danger"}
          icon={<DollarSign size={16} />}
        />
      </div>

      <div className="brutal-card">
        <SectionTitle>Taxable Events — {year}</SectionTitle>
        <div className="overflow-x-auto">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Asset</th>
                <th>Action</th>
                <th>Amount</th>
                <th>Proceeds (USD)</th>
                <th>Cost Basis</th>
                <th>Gain / Loss</th>
                <th>Term</th>
              </tr>
            </thead>
            <tbody>
              {events.map((t, i) => {
                const dateStr = new Date(t.date * 1000).toISOString().slice(0, 10);
                return (
                  <tr key={i}>
                    <td className="tabular-nums text-xs">{dateStr}</td>
                    <td className="font-bold text-sm">{t.asset}</td>
                    <td>
                      <span className="brutal-badge uppercase bg-destructive/15 text-destructive">
                        {t.action}
                      </span>
                    </td>
                    <td className="tabular-nums">{t.amount}</td>
                    <td className="tabular-nums">${t.proceedsUsd.toLocaleString()}</td>
                    <td className="tabular-nums">${t.costBasisUsd.toLocaleString()}</td>
                    <td
                      className={`tabular-nums font-bold ${
                        t.gainLossUsd >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {t.gainLossUsd >= 0 ? "+" : ""}${t.gainLossUsd.toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`brutal-badge text-xs ${
                          t.isShortTerm
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {t.isShortTerm ? "short" : "long"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && events.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-6">
                    No taxable events for {year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
