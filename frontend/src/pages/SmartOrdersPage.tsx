import { useState } from "react";
import { PageTitle, SectionTitle, StatusBadge } from "@/components/ui-brutal";
import {
  useActiveSmartOrders,
  useCreateSmartOrder,
  usePauseSmartOrder,
  useResumeSmartOrder,
  useCancelSmartOrder,
} from "@/hooks/use-smart-order-queries";
import { Zap, Pause, X } from "lucide-react";

const PAIR_OPTIONS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];
const DURATION_OPTIONS = [
  { value: "30m", label: "30 minutes", ms: 1_800_000 },
  { value: "1h",  label: "1 hour",     ms: 3_600_000 },
  { value: "2h",  label: "2 hours",    ms: 7_200_000 },
  { value: "4h",  label: "4 hours",    ms: 14_400_000 },
  { value: "8h",  label: "8 hours",    ms: 28_800_000 },
  { value: "24h", label: "24 hours",   ms: 86_400_000 },
];

/** Format milliseconds into a human-readable duration string (e.g. "2h 30m") */
function formatDurationMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function SmartOrdersPage() {
  const [orderType, setOrderType] = useState<"TWAP" | "VWAP">("TWAP");
  const [pair, setPair] = useState("BTC/USDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState(0.5);
  const [duration, setDuration] = useState("2h");
  const [slices, setSlices] = useState(8);

  const { data: orders = [], isLoading, isError } = useActiveSmartOrders();
  const createMutation = useCreateSmartOrder();
  const pauseMutation = usePauseSmartOrder();
  const resumeMutation = useResumeSmartOrder();
  const cancelMutation = useCancelSmartOrder();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const durationMs = DURATION_OPTIONS.find((d) => d.value === duration)?.ms ?? 7_200_000;
    createMutation.mutate({
      type: orderType.toLowerCase() as "twap" | "vwap",
      exchange: "binance",
      pair,
      side: side.toLowerCase() as "buy" | "sell",
      totalAmount: amount,
      durationMs,
      slices,
    });
  }

  function togglePause(id: string, status: string) {
    if (status === "active") {
      pauseMutation.mutate(id);
    } else if (status === "paused") {
      resumeMutation.mutate(id);
    }
  }

  function cancelOrder(id: string) {
    cancelMutation.mutate(id);
  }

  return (
    <div>
      <PageTitle>Smart Orders</PageTitle>

      <div className="brutal-card mb-4">
        <SectionTitle>Create Smart Order</SectionTitle>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* TWAP / VWAP toggle */}
            <div>
              <label className="stat-label mb-2 block">Order Type</label>
              <div className="flex gap-3">
                {(["TWAP", "VWAP"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                    <input
                      type="radio"
                      className="brutal-radio"
                      name="orderType"
                      checked={orderType === t}
                      onChange={() => setOrderType(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="stat-label mb-1 block">Pair</label>
              <select
                className="brutal-select w-full"
                value={pair}
                onChange={(e) => setPair(e.target.value)}
              >
                {PAIR_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Side toggle */}
            <div>
              <label className="stat-label mb-2 block">Side</label>
              <div className="flex gap-3">
                {(["BUY", "SELL"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold">
                    <input
                      type="radio"
                      className="brutal-radio"
                      name="side"
                      checked={side === s}
                      onChange={() => setSide(s)}
                    />
                    <span className={s === "BUY" ? "text-success" : "text-destructive"}>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="stat-label mb-1 block">Total Amount</label>
              <input
                type="number"
                step="0.01"
                className="brutal-input w-full text-sm"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">Duration</label>
              <select
                className="brutal-select w-full"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="stat-label mb-1 block">
                Slices: <span className="tabular-nums">{slices}</span>
              </label>
              <input
                type="range"
                min={2}
                max={24}
                value={slices}
                onChange={(e) => setSlices(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            className="brutal-btn-primary flex items-center gap-2"
            disabled={createMutation.isPending}
          >
            <Zap size={15} />
            {createMutation.isPending ? "Creating…" : "Create Smart Order"}
          </button>
          {createMutation.isError && (
            <p className="text-destructive text-xs mt-2">
              {(createMutation.error as Error).message}
            </p>
          )}
        </form>
      </div>

      <SectionTitle>Active Orders</SectionTitle>

      {isLoading && (
        <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
          <p className="font-medium">Loading orders…</p>
        </div>
      )}

      {isError && (
        <div className="brutal-card bg-destructive/10 text-center py-12 text-destructive">
          <p className="font-medium">Failed to load smart orders.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((o) => {
            const progress = o.totalAmount > 0
              ? Math.round((o.filledAmount / o.totalAmount) * 100)
              : 0;
            const durationLabel = formatDurationMs(o.durationMs);
            const sideUpper = o.side.toUpperCase();

            return (
              <div key={o.id} className="brutal-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="brutal-badge bg-primary/15 text-primary font-bold">{o.type.toUpperCase()}</span>
                    <span className="font-bold">{o.pair}</span>
                    <span className={`brutal-badge uppercase ${sideUpper === "BUY" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {sideUpper}
                    </span>
                  </div>
                  <StatusBadge status={o.status === "active" ? "filled" : o.status === "paused" ? "open" : "cancelled"} />
                </div>

                <div className="text-xs text-muted-foreground">
                  {o.id} · {durationLabel} · {o.slicesTotal} slices
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span>{o.slicesCompleted}/{o.slicesTotal} slices filled</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2.5 rounded bg-secondary border-[1.5px] border-foreground overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 text-sm">
                  <div>
                    <span className="stat-label">Filled</span>
                    <div className="tabular-nums font-medium">
                      {o.filledAmount} / {o.totalAmount}
                    </div>
                  </div>
                  <div>
                    <span className="stat-label">Avg Price</span>
                    <div className="tabular-nums font-medium">
                      {o.avgPrice && o.avgPrice > 0 ? `$${o.avgPrice.toLocaleString()}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {(o.status === "active" || o.status === "paused") && (
                    <button
                      className="brutal-btn-secondary flex items-center gap-1.5 text-xs flex-1 justify-center"
                      onClick={() => togglePause(o.id, o.status)}
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                    >
                      <Pause size={12} />
                      {o.status === "paused" ? "Resume" : "Pause"}
                    </button>
                  )}
                  {(o.status === "active" || o.status === "paused") && (
                    <button
                      className="brutal-btn-danger flex items-center gap-1.5 text-xs flex-1 justify-center"
                      onClick={() => cancelOrder(o.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
