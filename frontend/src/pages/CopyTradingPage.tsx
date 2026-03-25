import { useState } from "react";
import { PageTitle, SectionTitle, StatusBadge } from "@/components/ui-brutal";
import {
  useCopySources,
  useCopyHistory,
  useAddCopySource,
  useDeleteCopySource,
  useSyncCopy,
} from "@/hooks/use-copy-trading-queries";
import { Copy, RefreshCw, Trash2 } from "lucide-react";

const INTERVAL_OPTIONS = [
  { value: "1m",  label: "1 minute"   },
  { value: "5m",  label: "5 minutes"  },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h",  label: "1 hour"     },
];

/** Format unix seconds to a readable string */
function formatUnixSecs(ts: number | null): string {
  if (!ts) return "Never";
  return new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

export default function CopyTradingPage() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [weight, setWeight] = useState(50);
  const [interval, setInterval] = useState("5m");

  const { data: sources = [], isLoading: sourcesLoading, isError: sourcesError } = useCopySources();
  const { data: syncHistory = [], isLoading: historyLoading } = useCopyHistory();
  const addMutation = useAddCopySource();
  const deleteMutation = useDeleteCopySource();
  const syncMutation = useSyncCopy();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    addMutation.mutate(
      {
        name: name.trim(),
        sourceType: "url",
        sourceUrl: url.trim(),
        weight: weight / 100,
        syncInterval: interval,
      },
      {
        onSuccess: () => {
          setName("");
          setUrl("");
        },
      }
    );
  }

  function removeSource(id: string) {
    deleteMutation.mutate(id);
  }

  function syncNow(id: string) {
    syncMutation.mutate(id);
  }

  const syncStatusMap: Record<string, string> = {
    success: "filled",
    failed:  "failed",
    skipped: "cancelled",
  };

  return (
    <div>
      <PageTitle>Copy Trading</PageTitle>

      <div className="brutal-card mb-4">
        <SectionTitle>Add Signal Source</SectionTitle>
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="stat-label mb-1 block">Source Name</label>
              <input
                type="text"
                className="brutal-input w-full text-sm"
                placeholder="e.g. AlphaTrader"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="lg:col-span-2">
              <label className="stat-label mb-1 block">Signal URL</label>
              <input
                type="url"
                className="brutal-input w-full text-sm"
                placeholder="https://signals.example.com/feed"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">
                Weight: <span className="tabular-nums">{weight}%</span>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">Sync Interval</label>
              <select
                className="brutal-select w-full"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="brutal-btn-primary flex items-center gap-2"
            disabled={addMutation.isPending}
          >
            <Copy size={15} />
            {addMutation.isPending ? "Adding…" : "Add Source"}
          </button>
          {addMutation.isError && (
            <p className="text-destructive text-xs mt-2">
              {(addMutation.error as Error).message}
            </p>
          )}
        </form>
      </div>

      <SectionTitle>Signal Sources</SectionTitle>

      {sourcesLoading && (
        <div className="brutal-card bg-secondary/20 text-center py-8 text-muted-foreground mb-4">
          <p className="font-medium">Loading sources…</p>
        </div>
      )}
      {sourcesError && (
        <div className="brutal-card bg-destructive/10 text-center py-8 text-destructive mb-4">
          <p className="font-medium">Failed to load copy sources.</p>
        </div>
      )}

      {!sourcesLoading && !sourcesError && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {sources.map((s) => {
            const status = s.enabled === 1 ? "active" : "paused";
            const weightPct = Math.round(s.weight * 100);
            const lastSynced = formatUnixSecs(s.lastSyncedAt);

            return (
              <div key={s.id} className="brutal-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{s.name}</span>
                  <StatusBadge status={status === "active" ? "filled" : "open"} />
                </div>

                <div className="text-xs text-muted-foreground break-all">{s.sourceUrl}</div>

                <div className="grid grid-cols-2 gap-x-4 text-sm">
                  <div>
                    <span className="stat-label">Weight</span>
                    <div className="tabular-nums font-medium">{weightPct}%</div>
                  </div>
                  <div>
                    <span className="stat-label">Interval</span>
                    <div className="font-medium">{s.syncInterval}</div>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="stat-label">Last Synced</span>
                    <div className="tabular-nums text-xs text-muted-foreground">{lastSynced}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    className="brutal-btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center"
                    onClick={() => syncNow(s.id)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw size={12} /> Sync Now
                  </button>
                  <button
                    className="brutal-btn-danger flex items-center gap-1.5 text-xs flex-1 justify-center"
                    onClick={() => removeSource(s.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="brutal-card">
        <SectionTitle>Sync History</SectionTitle>
        {historyLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Loading history…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Changes</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((h) => {
                  const syncStatus = h.changesApplied > 0 ? "success" : "skipped";
                  const message = h.changesApplied > 0 ? "Applied changes" : "No changes";
                  return (
                    <tr key={h.id}>
                      <td className="tabular-nums text-xs">{formatUnixSecs(h.syncedAt)}</td>
                      <td className="font-medium">{h.sourceId}</td>
                      <td><StatusBadge status={syncStatusMap[syncStatus] ?? "open"} /></td>
                      <td className="tabular-nums">{h.changesApplied}</td>
                      <td className="text-xs text-muted-foreground">{message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
