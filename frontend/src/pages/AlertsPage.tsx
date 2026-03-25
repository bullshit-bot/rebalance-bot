import { PageTitle, SeverityBadge } from "@/components/ui-brutal";
import { useAlerts } from "@/hooks/use-alert-queries";
import type { DerivedAlert } from "@/hooks/use-alert-queries";
import { useState, useEffect } from "react";
import { X, AlertTriangle, Info, AlertOctagon, Loader2 } from "lucide-react";

export default function AlertsPage() {
  const { data: queryAlerts = [], isLoading, isError } = useAlerts();

  // Track dismissed IDs locally so dismissals survive re-fetches
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Reset dismissed IDs when query data changes (e.g. new alert IDs)
  useEffect(() => {
    setDismissedIds((prev) => {
      const newIds = new Set(queryAlerts.map((a) => a.id));
      const filtered = new Set([...prev].filter((id) => newIds.has(id)));
      return filtered;
    });
  }, [queryAlerts]);

  const alerts: DerivedAlert[] = queryAlerts.map((a) => ({
    ...a,
    dismissed: dismissedIds.has(a.id),
  }));

  const active = alerts.filter((a) => !a.dismissed);
  const dismissed = alerts.filter((a) => a.dismissed);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const iconMap = {
    critical: <AlertOctagon size={16} className="text-destructive" />,
    warning: <AlertTriangle size={16} className="text-warning" />,
    info: <Info size={16} className="text-primary" />,
  };

  const borderMap = {
    critical: "border-destructive",
    warning: "border-warning",
    info: "border-primary",
  };

  return (
    <div>
      <PageTitle>Alerts</PageTitle>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Checking for alerts…</span>
        </div>
      )}

      {isError && (
        <div className="brutal-card border-destructive mb-4">
          <p className="text-sm text-destructive font-medium">Failed to load alerts.</p>
        </div>
      )}

      {!isLoading && active.length === 0 && (
        <div className="brutal-card text-center py-8">
          <p className="text-muted-foreground font-medium">No active alerts. All clear. ✓</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {active.map((a) => (
          <div key={a.id} className={`brutal-card ${borderMap[a.severity]}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {iconMap[a.severity]}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{a.title}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="text-sm text-muted-foreground">{a.message}</p>
                  <span className="text-xs text-muted-foreground tabular-nums mt-1 block">
                    {a.time}
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                className="p-1 hover:bg-secondary rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {dismissed.length > 0 && (
        <div className="brutal-card">
          <h3 className="text-lg font-bold mb-3">Dismissed</h3>
          <div className="space-y-2">
            {dismissed.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-foreground/10 last:border-0 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={a.severity} />
                  <span className="text-sm">{a.title}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
