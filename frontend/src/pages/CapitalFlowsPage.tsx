import { PageTitle, SectionTitle, BrutalSkeleton } from "@/components/ui-brutal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowDownCircle, RefreshCw, Plus } from "lucide-react";
import { useState } from "react";

export default function CapitalFlowsPage() {
  const queryClient = useQueryClient();
  const flowsQuery = useQuery({
    queryKey: ["capital-flows"],
    queryFn: api.getCapitalFlows,
  });

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const addDeposit = useMutation({
    mutationFn: () => api.addDeposit(Number(amount), note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capital-flows"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success(`Deposit $${Number(amount).toLocaleString()} recorded`);
      setAmount("");
      setNote("");
    },
    onError: () => {
      toast.error("Failed to record deposit");
    },
  });

  const flows = flowsQuery.data ?? [];
  const totalInvested = flows.reduce((sum, f) => sum + f.amountUsd, 0);
  const depositCount = flows.filter((f) => f.type === "deposit").length;

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

      {/* Summary + Add deposit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="brutal-card">
          <div className="stat-label mb-1">Total Invested</div>
          <div className="stat-value text-2xl font-bold">
            ${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {depositCount} deposit{depositCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Add deposit form */}
        <div className="brutal-card">
          <div className="stat-label mb-2 flex items-center gap-1">
            <Plus size={14} /> Record Deposit
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number(amount) > 0) addDeposit.mutate();
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="brutal-input flex-1 text-sm px-2 py-1.5"
                required
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="brutal-input flex-1 text-sm px-2 py-1.5"
              />
            </div>
            <button
              type="submit"
              disabled={addDeposit.isPending || !amount || Number(amount) <= 0}
              className="brutal-btn-primary text-sm py-1.5 flex items-center justify-center gap-1"
            >
              <ArrowDownCircle size={14} />
              {addDeposit.isPending ? "Adding..." : "Add Deposit"}
            </button>
            {addDeposit.isError && (
              <p className="text-destructive text-xs">Failed to add deposit</p>
            )}
          </form>
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
                  <th className="text-right py-2 pr-6 font-bold">Amount</th>
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
                    <td className="py-2 pr-6 text-right tabular-nums font-medium">
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
