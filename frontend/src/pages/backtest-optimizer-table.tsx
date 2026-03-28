import { useState } from "react";
import type { OptimizationResultItem } from "@/lib/api-types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type SortKey = keyof Pick<OptimizationResultItem, "rank" | "totalReturn" | "sharpeRatio" | "maxDrawdown" | "totalTrades" | "compositeScore">

interface BacktestOptimizerTableProps {
  results: OptimizationResultItem[]
  onApplyBest?: (item: OptimizationResultItem) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

/** Formats strategy-specific params as a compact key=value string */
function formatParams(params: Record<string, unknown>): string {
  const skip = new Set(["type", "minTradeUsd"])
  return Object.entries(params)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BacktestOptimizerTable({ results, onApplyBest }: BacktestOptimizerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortAsc, setSortAsc] = useState(true)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(key === "rank") // rank/trades: asc by default; metrics: desc
    }
  }

  const sorted = [...results].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number)
    return sortAsc ? diff : -diff
  })

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return <span className="opacity-20 ml-1">↕</span>
    return <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
  }

  function thClass(key: SortKey) {
    return `cursor-pointer select-none whitespace-nowrap hover:text-primary transition-colors${sortKey === key ? " text-primary" : ""}`
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="brutal-table w-full text-sm">
          <thead>
            <tr>
              <th className={thClass("rank")} onClick={() => handleSort("rank")}>
                Rank{sortIndicator("rank")}
              </th>
              <th>Strategy</th>
              <th>Params</th>
              <th className={thClass("totalReturn")} onClick={() => handleSort("totalReturn")}>
                Return%{sortIndicator("totalReturn")}
              </th>
              <th className={thClass("sharpeRatio")} onClick={() => handleSort("sharpeRatio")}>
                Sharpe{sortIndicator("sharpeRatio")}
              </th>
              <th className={thClass("maxDrawdown")} onClick={() => handleSort("maxDrawdown")}>
                MaxDD%{sortIndicator("maxDrawdown")}
              </th>
              <th className={thClass("totalTrades")} onClick={() => handleSort("totalTrades")}>
                Trades{sortIndicator("totalTrades")}
              </th>
              <th className={thClass("compositeScore")} onClick={() => handleSort("compositeScore")}>
                Score{sortIndicator("compositeScore")}
              </th>
              {onApplyBest && <th></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isTop = r.rank <= 3
              return (
                <tr
                  key={r.label}
                  className={
                    r.rank === 1
                      ? "bg-primary/10 font-semibold"
                      : isTop
                      ? "bg-primary/5"
                      : ""
                  }
                >
                  <td className="tabular-nums text-center font-bold">
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                  </td>
                  <td>
                    <span className="font-mono text-xs bg-secondary/40 px-1.5 py-0.5 rounded">
                      {r.strategyType}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground max-w-[200px] truncate" title={formatParams(r.params)}>
                    {formatParams(r.params)}
                  </td>
                  <td className={`tabular-nums font-bold ${r.totalReturn >= 0 ? "text-success" : "text-destructive"}`}>
                    {r.totalReturn >= 0 ? "+" : ""}{fmt(r.totalReturn)}%
                  </td>
                  <td className="tabular-nums">{fmt(r.sharpeRatio)}</td>
                  <td className="tabular-nums text-destructive">-{fmt(r.maxDrawdown)}%</td>
                  <td className="tabular-nums">{r.totalTrades}</td>
                  <td className="tabular-nums font-bold text-primary">{fmt(r.compositeScore, 4)}</td>
                  {onApplyBest && (
                    <td>
                      {r.rank === 1 && (
                        <button
                          className="brutal-btn-primary text-xs py-1 px-2 whitespace-nowrap"
                          onClick={() => onApplyBest(r)}
                        >
                          Apply Best
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
