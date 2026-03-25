import { Play, Pause, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePortfolio } from "@/hooks/use-portfolio-queries";

export function DashboardHeader() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: portfolio } = usePortfolio();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const portfolioValue = portfolio?.totalValueUsd ?? 0;
  const lastUpdated = portfolio?.updatedAt
    ? new Date(portfolio.updatedAt).toLocaleString()
    : "—";

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

      <div className="flex items-center gap-5 text-sm">
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
          <div className="font-bold tabular-nums text-muted-foreground">—</div>
        </div>
        <div className="text-right hidden lg:block">
          <div className="stat-label">Last Updated</div>
          <div className="font-medium tabular-nums text-xs">{lastUpdated}</div>
        </div>

        <div className="flex gap-2 ml-2">
          <button className="brutal-btn-secondary text-xs flex items-center gap-1.5">
            <Play size={13} /> Dry Run
          </button>
          <button className="brutal-btn-warning text-xs flex items-center gap-1.5">
            <Pause size={13} /> Pause
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
