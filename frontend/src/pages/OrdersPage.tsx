import { PageTitle, ActionBadge, StatusBadge, BrutalPagination, BrutalSkeleton } from "@/components/ui-brutal";
import { useTrades } from "@/hooks/use-trade-queries";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";

const FILTER_TABS = ["All", "Filled"];
const PAGE_SIZE = 20;

// Map Trade fields to display row shape
function formatTrade(trade: {
  _id: string;
  exchange: string;
  pair: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  fee: number | null;
  rebalanceId: string | null;
  executedAt: string;
}) {
  return {
    id: trade._id,
    time: new Date(trade.executedAt).toLocaleString(),
    exchange: trade.exchange,
    symbol: trade.pair,
    side: trade.side,
    type: "market" as const,
    qty: trade.amount,
    price: trade.price,
    fee: trade.fee ?? 0,
    status: "filled",
    source: trade.rebalanceId ? "rebalance" : "manual",
  };
}

export default function OrdersPage() {
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: rawTrades, isLoading, isError } = useTrades(100);

  const orders = useMemo(() => (rawTrades ?? []).map(formatTrade), [rawTrades]);

  const statusFiltered = tab === "All" ? orders : orders.filter((o) => o.status === tab.toLowerCase());
  const filtered = search.trim()
    ? statusFiltered.filter((o) =>
        o.symbol.toLowerCase().includes(search.toLowerCase()) ||
        o.exchange.toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase())
      )
    : statusFiltered;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleTabChange = (t: string) => { setTab(t); setCurrentPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setCurrentPage(1); };

  return (
    <div>
      <PageTitle>Orders</PageTitle>

      {/* Search input */}
      <div className="relative mb-4 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          className="brutal-input w-full pl-8 text-sm"
          placeholder="Search pair, exchange, order ID…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-1.5 mb-5">
        {FILTER_TABS.map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`text-xs font-bold px-3 py-1.5 rounded-md border-[2px] border-foreground transition-all duration-75 ${
              tab === t ? "bg-primary text-primary-foreground brutal-shadow-sm" : "bg-card hover:bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="brutal-card">
          <BrutalSkeleton variant="text" height={18} width="30%" className="mb-3" />
          <BrutalSkeleton variant="rect" height={200} className="rounded-md" />
        </div>
      ) : isError ? (
        <div className="brutal-card border-destructive bg-destructive/5 text-destructive">
          <p className="font-bold">Failed to load orders. Please try again.</p>
        </div>
      ) : (
        <div className="brutal-card">
          <div className="overflow-x-auto">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>ID</th><th>Time</th><th>Exchange</th><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Fee</th><th>Status</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id}</td>
                    <td className="tabular-nums text-xs">{o.time}</td>
                    <td className="text-xs font-medium">{o.exchange}</td>
                    <td className="font-bold">{o.symbol}</td>
                    <td><ActionBadge action={o.side.toLowerCase()} /></td>
                    <td className="text-xs">{o.type}</td>
                    <td className="tabular-nums">{o.qty}</td>
                    <td className="tabular-nums">${o.price.toLocaleString()}</td>
                    <td className="tabular-nums text-muted-foreground">${o.fee}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-xs text-muted-foreground">{o.source}</td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-muted-foreground text-sm py-8">No orders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} orders · page {safePage} of {totalPages}
          </span>
          <BrutalPagination current={safePage} total={totalPages} onChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
