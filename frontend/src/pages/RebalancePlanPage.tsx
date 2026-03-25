import { PageTitle, SectionTitle, StatCard, ActionBadge, BrutalConfirmDialog, BrutalSkeleton } from "@/components/ui-brutal";
import { useRebalancePreview, useTriggerRebalance } from "@/hooks/use-rebalance-queries";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { Repeat, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RebalancePlanPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const portfolioQuery = usePortfolio();
  const previewQuery = useRebalancePreview();
  const triggerMutation = useTriggerRebalance();

  const isLoading = portfolioQuery.isLoading || previewQuery.isLoading;
  const isError = portfolioQuery.isError || previewQuery.isError;

  const handleApprove = () => {
    triggerMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Rebalance execution started");
        setConfirmOpen(false);
      },
      onError: (err) => {
        toast.error(`Rebalance failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        setConfirmOpen(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div>
        <PageTitle>Rebalance Plan</PageTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="brutal-card">
              <BrutalSkeleton variant="text" height={12} width="50%" className="mb-2" />
              <BrutalSkeleton variant="text" height={28} width="70%" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="brutal-card">
              <BrutalSkeleton variant="rect" height={140} className="rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageTitle>Rebalance Plan</PageTitle>
        <div className="brutal-card border-destructive bg-destructive/5 text-destructive">
          <p className="font-bold">Failed to load rebalance plan data. Please try again.</p>
        </div>
      </div>
    );
  }

  const portfolioValue = portfolioQuery.data?.totalValueUsd ?? 0;
  const trades = previewQuery.data?.trades ?? [];

  return (
    <div>
      <PageTitle>Rebalance Plan</PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Portfolio NAV"
          value={`$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <StatCard label="Threshold" value="—" />
        <StatCard label="Min Trade" value="—" />
        <StatCard label="Partial Factor" value="—" />
        <StatCard
          label="Total Actions"
          value={String(trades.length)}
          variant="purple"
          icon={<Repeat size={18} />}
        />
      </div>

      <SectionTitle>Proposed Actions</SectionTitle>
      {trades.length === 0 ? (
        <div className="brutal-card mb-6">
          <p className="text-sm text-muted-foreground">No rebalance actions needed at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {trades.map((a, idx) => (
            <div key={`${a.exchange}-${a.pair}-${idx}`} className={`brutal-card ${a.side === "sell" ? "border-destructive" : "border-success"}`}>
              <div className="flex items-center justify-between mb-3">
                <ActionBadge action={a.side.toLowerCase()} />
                <span className="font-bold text-lg">{a.pair}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div><span className="stat-label">Exchange</span><br /><span className="font-bold">{a.exchange}</span></div>
                <div><span className="stat-label">Type</span><br /><span className="font-bold">{a.type}</span></div>
                <div><span className="stat-label">Amount</span><br /><span className="font-bold tabular-nums">{a.amount.toFixed(6)}</span></div>
                <div><span className="stat-label">Price</span><br /><span className="font-bold tabular-nums">{a.price ? `$${a.price.toLocaleString()}` : "market"}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="brutal-card">
        <SectionTitle>Plan Actions</SectionTitle>
        <div className="flex gap-3 mb-4">
          <button
            className="brutal-btn-primary flex items-center gap-1.5"
            onClick={() => setConfirmOpen(true)}
            disabled={triggerMutation.isPending || trades.length === 0}
          >
            <CheckCircle size={15} />
            {triggerMutation.isPending ? "Executing…" : "Approve & Execute"}
          </button>
          <button className="brutal-btn-secondary flex items-center gap-1.5">
            <Repeat size={15} /> Dry Run
          </button>
          <button className="brutal-btn-danger flex items-center gap-1.5">
            <XCircle size={15} /> Reject Plan
          </button>
        </div>
        <div className="brutal-card bg-secondary/50 text-sm">
          <SectionTitle>Preview</SectionTitle>
          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
            {trades.length === 0
              ? "[PREVIEW] No trades required — portfolio is within threshold."
              : trades.map((t) =>
                  `[PREVIEW] ${t.side.toUpperCase()} ${t.amount.toFixed(4)} ${t.pair} on ${t.exchange}${t.price ? ` @ $${t.price.toLocaleString()}` : " (market)"}`
                ).join("\n")}
          </pre>
        </div>
      </div>

      <BrutalConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Approve & Execute Rebalance"
        message="Are you sure you want to execute this rebalance plan? This will place real trades."
        confirmLabel="Execute"
        cancelLabel="Cancel"
        variant="primary"
      />
    </div>
  );
}
