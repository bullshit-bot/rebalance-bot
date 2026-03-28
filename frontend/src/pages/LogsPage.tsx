import { PageTitle, LogLevelBadge, BrutalPagination } from "@/components/ui-brutal";
import { useLogs } from "@/hooks/use-log-queries";
import { useState } from "react";
import { Download, ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FILTER_CHIPS = ["All", "Info", "Warning", "Error", "Execution", "Sync"];
const PAGE_SIZE = 20;

export default function LogsPage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: logs = [], isLoading, isError } = useLogs();

  const levelFiltered =
    filter === "All" ? logs : logs.filter((l) => l.level === filter.toLowerCase());
  const filtered = search.trim()
    ? levelFiltered.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    : levelFiltered;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterChange = (f: string) => {
    setFilter(f);
    setCurrentPage(1);
  };
  const handleSearch = (v: string) => {
    setSearch(v);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'logs.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  // Filters that only execution logs exist for
  const isSystemFilter = ["Info", "Warning", "Error", "Sync"].includes(filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <PageTitle>Logs</PageTitle>
        <button className="brutal-btn-secondary text-xs flex items-center gap-1.5" onClick={handleExport}>
          <Download size={13} /> Export Logs
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-4 max-w-xs">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          className="brutal-input w-full pl-8 text-sm"
          placeholder="Search log messages…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-1.5 mb-4">
        {FILTER_CHIPS.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`text-xs font-bold px-3 py-1.5 rounded-md border-[2px] border-foreground transition-all duration-75 ${
              filter === f
                ? "bg-primary text-primary-foreground brutal-shadow-sm"
                : "bg-card hover:bg-secondary"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading logs…</span>
        </div>
      )}

      {isError && (
        <div className="brutal-card border-destructive mb-4">
          <p className="text-sm text-destructive font-medium">Failed to load logs.</p>
        </div>
      )}

      <div className="brutal-card p-0">
        <div className="divide-y divide-foreground/10">
          {paged.map((log) => (
            <div key={log.id}>
              <button
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
              >
                {log.details ? (
                  expanded === log.id ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="text-xs tabular-nums text-muted-foreground w-36 flex-shrink-0">
                  {log.time}
                </span>
                <LogLevelBadge level={log.level} />
                <span className="text-sm">{log.message}</span>
              </button>
              {expanded === log.id && log.details && (
                <div className="px-4 pb-3 ml-14">
                  <pre className="text-xs font-mono bg-foreground/5 p-3 rounded-md border-[1.5px] border-foreground/20 overflow-x-auto">
                    {JSON.stringify(JSON.parse(log.details), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
          {!isLoading && paged.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {isSystemFilter
                ? "System logs not available — only trade execution logs are recorded"
                : "No logs found"}
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} entries · page {safePage} of {totalPages}
          </span>
          <BrutalPagination current={safePage} total={totalPages} onChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
