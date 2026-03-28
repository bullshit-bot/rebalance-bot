import { useState } from "react";
import { PageTitle, SectionTitle, StatusBadge, BrutalTabs } from "@/components/ui-brutal";
import {
  useAISuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useUpdateAIConfig,
} from "@/hooks/use-ai-queries";
import type { AISuggestion } from "@/lib/api-types";
import { Brain, Check, X, Save } from "lucide-react";

/** Parse suggestedAllocations JSON string, return array of { asset, targetPct } */
function parseSuggestedAllocations(raw: string): Array<{ asset: string; targetPct: number }> {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

/** Format unix seconds to readable date-time string */
function formatUnixSecs(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

function SuggestionCard({
  s,
  onApprove,
  onReject,
}: {
  s: AISuggestion;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const allocations = parseSuggestedAllocations(s.suggestedAllocations);

  return (
    <div className="brutal-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Brain size={15} className="text-primary shrink-0" />
          <span className="text-xs text-muted-foreground tabular-nums">{formatUnixSecs(s.createdAt)}</span>
          <span className="brutal-badge bg-secondary text-muted-foreground text-xs">{s.source}</span>
        </div>
        <StatusBadge status={s.status === "pending" ? "open" : s.status === "approved" ? "filled" : "cancelled"} />
      </div>

      <p className="text-sm">{s.reasoning}</p>

      {allocations.length > 0 && (
        <div>
          <span className="stat-label mb-1 block">Suggested Allocations</span>
          <table className="brutal-table text-xs">
            <thead>
              <tr><th>Asset</th><th>Target %</th></tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.asset}>
                  <td className="font-bold">{a.asset}</td>
                  <td className="tabular-nums">{a.targetPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.status === "pending" && (
        <div className="flex gap-2">
          <button
            className="brutal-btn-success flex items-center gap-1.5 text-xs flex-1 justify-center"
            onClick={() => onApprove(s.id)}
          >
            <Check size={12} /> Approve
          </button>
          <button
            className="brutal-btn-danger flex items-center gap-1.5 text-xs flex-1 justify-center"
            onClick={() => onReject(s.id)}
          >
            <X size={12} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

function PendingTab({
  suggestions,
  onApprove,
  onReject,
}: {
  suggestions: AISuggestion[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const pending = suggestions.filter((s) => s.status === "pending");
  if (pending.length === 0) {
    return (
      <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
        <Brain size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium">No pending suggestions.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {pending.map((s) => (
        <SuggestionCard key={s.id} s={s} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}

function HistoryTab({ suggestions }: { suggestions: AISuggestion[] }) {
  const history = suggestions.filter((s) => s.status !== "pending");
  const statusMap: Record<string, string> = {
    approved: "filled",
    rejected: "cancelled",
    "auto-applied": "filled",
  };
  return (
    <div className="brutal-card">
      <SectionTitle>Decision History</SectionTitle>
      <div className="overflow-x-auto">
        <table className="brutal-table">
          <thead>
            <tr><th>Date</th><th>Source</th><th>Status</th><th>Reasoning</th></tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td className="tabular-nums text-xs">{formatUnixSecs(s.createdAt)}</td>
                <td className="font-medium">{s.source}</td>
                <td><StatusBadge status={statusMap[s.status] ?? "open"} /></td>
                <td className="text-xs text-muted-foreground max-w-xs truncate">{s.reasoning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const AI_CONFIG_KEY = "ai_config";

function loadAIConfig() {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw) as { autoApprove: boolean; maxShift: number };
  } catch { /* ignore */ }
  return { autoApprove: false, maxShift: 5 };
}

function ConfigTab() {
  const saved = loadAIConfig();
  const [autoApprove, setAutoApprove] = useState(saved.autoApprove);
  const [maxShift, setMaxShift] = useState(saved.maxShift);
  const updateConfig = useUpdateAIConfig();

  function handleAutoApproveToggle() {
    const next = !autoApprove;
    setAutoApprove(next);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ autoApprove: next, maxShift }));
  }

  function handleMaxShiftChange(val: number) {
    setMaxShift(val);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ autoApprove, maxShift: val }));
  }

  function handleSave() {
    updateConfig.mutate({ autoApprove, maxAllocationShiftPct: maxShift });
  }

  return (
    <div className="brutal-card max-w-md space-y-5">
      <SectionTitle>AI Config</SectionTitle>

      <div className="flex items-center justify-between py-2.5 border-b border-foreground/10">
        <div>
          <div className="text-sm font-bold">Auto-Approve Suggestions</div>
          <div className="text-xs text-muted-foreground">Automatically apply AI suggestions above confidence threshold</div>
        </div>
        <button
          onClick={handleAutoApproveToggle}
          className={`w-12 h-6 rounded-full border-[2px] border-foreground relative transition-colors ${autoApprove ? "bg-primary" : "bg-secondary"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card border-[1.5px] border-foreground transition-transform ${autoApprove ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div>
        <label className="stat-label mb-1 block">
          Max Allocation Shift: <span className="tabular-nums">{maxShift}%</span>
        </label>
        <input
          type="range"
          min={1}
          max={20}
          value={maxShift}
          onChange={(e) => handleMaxShiftChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">
          AI suggestions shifting more than this will require manual approval regardless of auto-approve setting.
        </p>
      </div>

      <button
        className="brutal-btn-primary flex items-center gap-2"
        onClick={handleSave}
        disabled={updateConfig.isPending}
      >
        <Save size={15} />
        {updateConfig.isPending ? "Saving…" : "Save Config"}
      </button>
      {updateConfig.isError && (
        <p className="text-destructive text-xs">{(updateConfig.error as Error).message}</p>
      )}
      {updateConfig.isSuccess && (
        <p className="text-success text-xs">Config saved.</p>
      )}
    </div>
  );
}

export default function AISuggestionsPage() {
  const { data: suggestions = [], isLoading, isError } = useAISuggestions();
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();

  function approve(id: string) {
    approveMutation.mutate(id);
  }

  function reject(id: string) {
    rejectMutation.mutate(id);
  }

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  if (isLoading) {
    return (
      <div>
        <PageTitle>AI Suggestions</PageTitle>
        <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
          <p className="font-medium">Loading suggestions…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageTitle>AI Suggestions</PageTitle>
        <div className="brutal-card bg-destructive/10 text-center py-12 text-destructive">
          <p className="font-medium">Failed to load AI suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle>AI Suggestions</PageTitle>
      <BrutalTabs
        tabs={[
          {
            id: "pending",
            label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
            content: <PendingTab suggestions={suggestions} onApprove={approve} onReject={reject} />,
          },
          {
            id: "history",
            label: "History",
            content: <HistoryTab suggestions={suggestions} />,
          },
          {
            id: "config",
            label: "Config",
            content: <ConfigTab />,
          },
        ]}
      />
    </div>
  );
}
