import { useState } from "react";
import { PageTitle, SectionTitle, StatusBadge } from "@/components/ui-brutal";
import { useGridBots, useCreateGridBot, useStopGridBot } from "@/hooks/use-grid-queries";
import { Grid3X3, Square, StopCircle } from "lucide-react";

const PAIR_OPTIONS = [
  { value: "BTC/USDT", label: "BTC/USDT" },
  { value: "ETH/USDT", label: "ETH/USDT" },
  { value: "SOL/USDT", label: "SOL/USDT" },
  { value: "BNB/USDT", label: "BNB/USDT" },
];

export default function GridTradingPage() {
  const [pair, setPair] = useState("BTC/USDT");
  const [lowerPrice, setLowerPrice] = useState(60000);
  const [upperPrice, setUpperPrice] = useState(75000);
  const [levels, setLevels] = useState(10);
  const [investment, setInvestment] = useState(5000);
  const [mode, setMode] = useState<"normal" | "reverse">("normal");

  const { data: bots = [], isLoading, isError } = useGridBots();
  const createMutation = useCreateGridBot();
  const stopMutation = useStopGridBot();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      exchange: "binance",
      pair,
      priceLower: lowerPrice,
      priceUpper: upperPrice,
      gridLevels: levels,
      investment,
      gridType: mode,
    });
  }

  function stopBot(id: string) {
    stopMutation.mutate(id);
  }

  return (
    <div>
      <PageTitle>Grid Trading</PageTitle>

      <div className="brutal-card mb-4">
        <SectionTitle>Create Grid Bot</SectionTitle>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="stat-label mb-1 block">Pair</label>
              <select
                className="brutal-select w-full"
                value={pair}
                onChange={(e) => setPair(e.target.value)}
              >
                {PAIR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="stat-label mb-1 block">Lower Price (USDT)</label>
              <input
                type="number"
                className="brutal-input w-full text-sm"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">Upper Price (USDT)</label>
              <input
                type="number"
                className="brutal-input w-full text-sm"
                value={upperPrice}
                onChange={(e) => setUpperPrice(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">
                Grid Levels: <span className="tabular-nums">{levels}</span>
              </label>
              <input
                type="range"
                min={2}
                max={30}
                value={levels}
                onChange={(e) => setLevels(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="stat-label mb-1 block">Investment (USDT)</label>
              <input
                type="number"
                className="brutal-input w-full text-sm"
                value={investment}
                onChange={(e) => setInvestment(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="stat-label mb-2 block">Mode</label>
              <div className="flex gap-3">
                {(["normal", "reverse"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm font-bold capitalize">
                    <input
                      type="radio"
                      className="brutal-radio"
                      name="gridMode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="brutal-btn-primary flex items-center gap-2"
            disabled={createMutation.isPending}
          >
            <Grid3X3 size={15} />
            {createMutation.isPending ? "Creating…" : "Create Grid Bot"}
          </button>
          {createMutation.isError && (
            <p className="text-destructive text-xs mt-2">
              {(createMutation.error as Error).message}
            </p>
          )}
        </form>
      </div>

      <SectionTitle>Active Bots</SectionTitle>

      {isLoading && (
        <div className="brutal-card bg-secondary/20 text-center py-12 text-muted-foreground">
          <p className="font-medium">Loading bots…</p>
        </div>
      )}

      {isError && (
        <div className="brutal-card bg-destructive/10 text-center py-12 text-destructive">
          <p className="font-medium">Failed to load grid bots.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => {
            const pnl = bot.totalProfit ?? 0;
            const trades = bot.totalTrades ?? 0;
            const pnlPct = bot.investment > 0 ? (pnl / bot.investment) * 100 : 0;

            return (
              <div key={bot.id} className="brutal-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{bot.pair}</span>
                  <StatusBadge status={bot.status === "active" ? "filled" : "cancelled"} />
                </div>

                <div className="text-xs text-muted-foreground">
                  {bot.id} · {bot.gridType} · {bot.gridLevels} levels
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="stat-label">Range</span>
                    <div className="tabular-nums font-medium">
                      ${bot.priceLower.toLocaleString()} – ${bot.priceUpper.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="stat-label">Investment</span>
                    <div className="tabular-nums font-medium">${bot.investment.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="stat-label">PnL</span>
                    <div className={`tabular-nums font-bold ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(1)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                    </div>
                  </div>
                  <div>
                    <span className="stat-label">Trades</span>
                    <div className="tabular-nums font-medium">{trades}</div>
                  </div>
                </div>

                {bot.status === "active" && (
                  <button
                    className="brutal-btn-danger flex items-center gap-1.5 text-xs w-full justify-center mt-1"
                    onClick={() => stopBot(bot.id)}
                    disabled={stopMutation.isPending}
                  >
                    <StopCircle size={13} /> Stop Bot
                  </button>
                )}
                {bot.status === "stopped" && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center mt-1">
                    <Square size={13} /> Stopped
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
