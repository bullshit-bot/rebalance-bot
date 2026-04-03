import { PageTitle, SectionTitle, BrutalSkeleton } from "@/components/ui-brutal";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DollarSign, ArrowDownCircle, RefreshCw } from "lucide-react";

export default function CapitalFlowsPage() {
  const flowsQuery = useQuery({
    queryKey: ["capital-flows"],
    queryFn: api.getCapitalFlows,
  });

  const flows = flowsQuery.data ?? [];
  const totalInvested = flows.reduce((sum, f) => sum + f.amountUsd, 0);
  const totalDeposits = flows.filter((f) => f.type === "deposit").reduce((sum, f) => sum + f.amountUsd, 0);
  const totalDCA = flows.filter((f) => f.type === "dca").reduce((sum, f) => sum + f.amountUsd, 0);

  if (flowsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PageTitle>Capital Flows</PageTitle>
        <BrutalSkeleton variant="rect" height={200} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle>Capital Flows</PageTitle>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="brutal-card">
          <div className="stat-label mb-1">Total Invested</div>
          <div className="stat-value text-lg font-bold">
            ${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="brutal-card">
          <div className="stat-label mb-1 flex items-center gap-1">
            <ArrowDownCircle size={14} /> Deposits
          </div>
          <div className="stat-value text-lg font-bold">
            ${totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="brutal-card">
          <div className="stat-label mb-1 flex items-center gap-1">
            <RefreshCw size={14} /> DCA Buys
          </div>
          <div className="stat-value text-lg font-bold">
            ${totalDCA.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Transaction history table */}
      <div className="brutal-card">
        <SectionTitle>Transaction History</SectionTitle>
        {flows.length === 0 ? (
          <p className="text-muted-foreground text-sm mt-2">No capital flows recorded yet.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="text-left py-2 font-bold">Date</th>
                  <th className="text-left py-2 font-bold">Type</th>
                  <th className="text-right py-2 font-bold">Amount</th>
                  <th className="text-left py-2 font-bold">Note</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow._id} className="border-b border-muted hover:bg-muted/30">
                    <td className="py-2 tabular-nums">
                      {new Date(flow.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          flow.type === "deposit"
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-primary/15 text-primary border border-primary/30"
                        }`}
                      >
                        {flow.type === "deposit" ? (
                          <><ArrowDownCircle size={12} /> Deposit</>
                        ) : (
                          <><RefreshCw size={12} /> DCA</>
                        )}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      +${flow.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-muted-foreground">{flow.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
