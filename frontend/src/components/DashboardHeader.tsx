import { Play, Pause, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePortfolio, usePortfolioHistory } from "@/hooks/use-portfolio-queries";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function DashboardHeader() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: portfolio } = usePortfolio();
  const { data: history } = usePortfolioHistory();
  const [paused, setPaused] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleDryRun = async () => {
    try {
      const preview = await api.getRebalancePreview();
      const trades = preview.trades?.length ?? 0;
      if (trades === 0) {
        toast.info("Dry Run: No trades needed — portfolio is within threshold");
      } else {
        toast.success(`Dry Run: ${trades} trades proposed. Check Rebalance Plan page.`);
        navigate("/rebalance");
      }
    } catch {
      toast.error("Dry Run failed — check backend connection");
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (paused) {
        await api.resumeBot();
        setPaused(false);
        toast.success("Bot resumed — drift detection active");
      } else {
        await api.pauseBot();
        setPaused(true);
        toast.warning("Bot paused — no automatic rebalancing");
      }
    } catch {
      toast.error("Failed to toggle pause state");
    }
  };

  const portfolioValue = portfolio?.totalValueUsd ?? 0;
  const lastUpdated = portfolio?.updatedAt
    ? new Date(portfolio.updatedAt).toLocaleString()
    : "—";

  // 24h PnL from snapshot history
  const snapshots = history ?? [];
  let pnl24h = "";
  if (snapshots.length >= 2) {
    const now = snapshots[snapshots.length - 1].totalValueUsd;
    // Find snapshot closest to 24h ago
    const cutoff = Date.now() - 86_400_000;
    const older = snapshots.filter((s) => new Date(s.createdAt).getTime() <= cutoff);
    const ref = older.length > 0 ? older[older.length - 1].totalValueUsd : snapshots[0].totalValueUsd;
    const diff = now - ref;
    const sign = diff >= 0 ? "+" : "-";
    pnl24h = `${sign}$${Math.abs(diff).toFixed(0)}`;
  }

  return (
    <header className="border-b-[2.5px] border-foreground bg-card px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">Rebalance Bot</h1>
        <span className="brutal-badge bg-primary text-primary-foreground text-[10px]">
          Personal Mode
        </span>
        <div className="flex gap-2">
          <span className="brutal-badge bg-success text-success-foreground text-[10px]">
            Binance ●
          </span>
          <span className="brutal-badge bg-destructive/20 text-destructive text-[10px]">
            OKX ○
          </span>
        </div>
      </div>

      <div className="flex items-center gap-8 text-sm">
        <div className="text-right">
          <div className="stat-label">Portfolio</div>
          <div className="font-bold tabular-nums">
            {portfolio
              ? `$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="stat-label">24h PnL</div>
          <div className={`font-bold tabular-nums ${pnl24h.startsWith("+") ? "text-green-600" : pnl24h.startsWith("-") ? "text-red-600" : "text-muted-foreground"}`}>
            {pnl24h || "—"}
          </div>
        </div>
        <div className="text-right hidden lg:block">
          <div className="stat-label">Last Updated</div>
          <div className="font-medium tabular-nums text-xs">{lastUpdated}</div>
        </div>

        <div className="flex gap-2 ml-2">
          <button onClick={handleDryRun} className="brutal-btn-secondary text-xs flex items-center gap-1.5">
            <Play size={13} /> Dry Run
          </button>
          <button onClick={handlePauseToggle} className={`text-xs flex items-center gap-1.5 ${paused ? "brutal-btn-primary" : "brutal-btn-warning"}`}>
            {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
          </button>
          <button
            onClick={handleLogout}
            className="brutal-btn-secondary text-xs flex items-center gap-1.5 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
