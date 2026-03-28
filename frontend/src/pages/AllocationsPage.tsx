import { useState } from "react";
import { PageTitle, SectionTitle, BrutalSkeleton } from "@/components/ui-brutal";
import { usePortfolio } from "@/hooks/use-portfolio-queries";
import { useAllocations, useUpdateAllocations, useDeleteAllocation } from "@/hooks/use-allocation-queries";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#7c3aed", "#2563eb", "#f59e0b", "#6b7280", "#ec4899", "#14b8a6"];

export default function AllocationsPage() {
  const portfolioQuery = usePortfolio();
  const allocationsQuery = useAllocations();
  const updateMutation = useUpdateAllocations();
  const deleteMutation = useDeleteAllocation();

  const [editMode, setEditMode] = useState(false);
  // editValues: map of asset -> targetPct string (for input binding)
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  // new allocation form
  const [addOpen, setAddOpen] = useState(false);
  const [newAsset, setNewAsset] = useState("");
  const [newPct, setNewPct] = useState("");

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
  const targetMap = new Map(allocations.map((a) => [a.asset, a.targetPct]));

  const pieData = assets.map((a) => ({
    name: a.asset,
    value: targetMap.get(a.asset) ?? a.targetPct,
  }));

  const barData = assets.map((a) => ({
    asset: a.asset,
    current: a.currentPct,
    target: targetMap.get(a.asset) ?? a.targetPct,
  }));

  function enterEditMode() {
    const vals: Record<string, string> = {};
    for (const a of allocations) {
      vals[a.asset] = String(a.targetPct);
    }
    setEditValues(vals);
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setAddOpen(false);
    setNewAsset("");
    setNewPct("");
  }

  async function saveAll() {
    const updated = allocations.map((a) => ({
      asset: a.asset,
      targetPct: parseFloat(editValues[a.asset] ?? String(a.targetPct)),
      exchange: a.exchange ?? undefined,
      minTradeUsd: a.minTradeUsd ?? undefined,
    }));
    updateMutation.mutate(updated, {
      onSuccess: () => {
        toast.success("Allocations saved");
        setEditMode(false);
      },
      onError: (err) => toast.error(`Save failed: ${(err as Error).message}`),
    });
  }

  async function handleDelete(asset: string) {
    if (!confirm(`Delete allocation for ${asset}?`)) return;
    deleteMutation.mutate(asset, {
      onSuccess: () => toast.success(`${asset} allocation deleted`),
      onError: (err) => toast.error(`Delete failed: ${(err as Error).message}`),
    });
  }

  async function handleAdd() {
    const pct = parseFloat(newPct);
    if (!newAsset.trim() || isNaN(pct) || pct <= 0) {
      toast.error("Enter a valid asset symbol and percentage");
      return;
    }
    const existing = allocations.map((a) => ({
      asset: a.asset,
      targetPct: a.targetPct,
      exchange: a.exchange ?? undefined,
      minTradeUsd: a.minTradeUsd ?? undefined,
    }));
    updateMutation.mutate([...existing, { asset: newAsset.toUpperCase().trim(), targetPct: pct }], {
      onSuccess: () => {
        toast.success(`${newAsset.toUpperCase().trim()} allocation added`);
        setAddOpen(false);
        setNewAsset("");
        setNewPct("");
      },
      onError: (err) => toast.error(`Add failed: ${(err as Error).message}`),
    });
  }

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

      {/* Allocation cards with edit/delete */}
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Allocations</SectionTitle>
        <div className="flex gap-2">
          {!editMode ? (
            <button className="brutal-btn-primary flex items-center gap-1.5 text-xs" onClick={enterEditMode}>
              <Pencil size={13} /> Edit Allocations
            </button>
          ) : (
            <>
              <button
                className="brutal-btn-primary flex items-center gap-1.5 text-xs"
                onClick={saveAll}
                disabled={updateMutation.isPending}
              >
                <Check size={13} /> {updateMutation.isPending ? "Saving…" : "Save All"}
              </button>
              <button className="brutal-btn-secondary flex items-center gap-1.5 text-xs" onClick={cancelEditMode}>
                <X size={13} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        {assets.map((a) => {
          const targetPct = targetMap.get(a.asset) ?? a.targetPct;
          const alloc = allocations.find((al) => al.asset === a.asset);
          const band = alloc?.minTradeUsd ? "custom" : "4";
          return (
            <div key={a.asset} className="brutal-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{a.asset}</span>
                {editMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={editValues[a.asset] ?? String(targetPct)}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [a.asset]: e.target.value }))}
                      className="w-20 text-xs font-bold px-2 py-1 border-[2px] border-foreground rounded-md bg-card tabular-nums"
                    />
                    <span className="text-xs font-bold">%</span>
                    <button
                      className="p-1 rounded-md border-[2px] border-foreground bg-destructive/10 hover:bg-destructive/20 text-destructive"
                      onClick={() => handleDelete(a.asset)}
                      title="Delete allocation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs brutal-badge bg-primary/10 text-primary">{targetPct.toFixed(1)}% target</span>
                )}
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

      {/* Add Allocation */}
      {!addOpen ? (
        <button
          className="brutal-btn-secondary flex items-center gap-1.5 text-xs mt-2"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={13} /> Add Allocation
        </button>
      ) : (
        <div className="brutal-card max-w-sm mt-2">
          <SectionTitle>Add Allocation</SectionTitle>
          <div className="flex flex-col gap-3">
            <div>
              <label className="stat-label mb-1 block">Asset Symbol</label>
              <input
                type="text"
                placeholder="e.g. BTC"
                value={newAsset}
                onChange={(e) => setNewAsset(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border-[2px] border-foreground rounded-md bg-card font-bold uppercase"
              />
            </div>
            <div>
              <label className="stat-label mb-1 block">Target %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                placeholder="e.g. 25"
                value={newPct}
                onChange={(e) => setNewPct(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border-[2px] border-foreground rounded-md bg-card tabular-nums"
              />
            </div>
            <div className="flex gap-2">
              <button
                className="brutal-btn-primary flex items-center gap-1.5 text-xs flex-1 justify-center"
                onClick={handleAdd}
                disabled={updateMutation.isPending}
              >
                <Plus size={13} /> {updateMutation.isPending ? "Adding…" : "Add"}
              </button>
              <button
                className="brutal-btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center"
                onClick={() => { setAddOpen(false); setNewAsset(""); setNewPct(""); }}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
