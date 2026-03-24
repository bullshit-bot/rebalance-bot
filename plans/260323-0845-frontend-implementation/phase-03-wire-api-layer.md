---
title: "Wire API Layer"
status: completed
priority: P1
effort: 5h
---

# Phase 3: Wire API Layer (Replace Mock Data)

## Context Links
- [TanStack Query setup](../../frontend/src/App.tsx) — QueryClient already configured
- [Mock data](../../frontend/src/lib/mockData.ts)
- [UI components](../../frontend/src/components/ui-brutal.tsx) — BrutalSkeleton, BrutalAlert available

## Overview
Create API service layer + WebSocket hook. Replace all mockData imports with useQuery/useMutation hooks calling the real backend. Add loading/error states.

## Key Design Decisions
- Single `src/lib/api.ts` file with typed fetch wrapper + all endpoint functions
- API key stored in localStorage, read by fetch wrapper, sent as `X-API-Key` header
- One custom hook file per domain: `src/hooks/use-portfolio.ts`, `src/hooks/use-rebalance.ts`, etc.
- WebSocket hook: single connection, event-based dispatch, auto-reconnect
- Loading state: use `BrutalSkeleton` from ui-brutal.tsx
- Error state: use `BrutalAlert` variant="danger"
- Toast notifications via existing Sonner toaster (already in App.tsx)

## Files to Create

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `src/lib/api.ts` | Fetch wrapper + all API endpoint functions | ~180 |
| `src/hooks/use-websocket.ts` | WebSocket connection + event dispatch | ~80 |
| `src/hooks/use-portfolio.ts` | useQuery hooks for portfolio endpoints | ~50 |
| `src/hooks/use-rebalance.ts` | useQuery/useMutation for rebalance endpoints | ~60 |
| `src/hooks/use-trades.ts` | useQuery for trades/orders | ~30 |
| `src/hooks/use-analytics.ts` | useQuery hooks for analytics endpoints | ~50 |
| `src/hooks/use-backtest.ts` | useMutation + useQuery for backtesting | ~50 |
| `src/hooks/use-tax.ts` | useQuery for tax report + export | ~35 |
| `src/hooks/use-grid.ts` | useQuery/useMutation for grid bots | ~60 |
| `src/hooks/use-smart-orders.ts` | useQuery/useMutation for TWAP/VWAP | ~60 |
| `src/hooks/use-copy-trading.ts` | useQuery/useMutation for copy trading | ~70 |
| `src/hooks/use-ai.ts` | useQuery/useMutation for AI suggestions | ~60 |
| `src/hooks/use-auth.ts` | Auth state management (localStorage key) | ~40 |
| `src/lib/api-types.ts` | Shared TypeScript interfaces for API responses | ~120 |

### Files to Modify (all pages -- replace mock imports)
- Every page in `src/pages/*.tsx` -- swap mockData imports for hook calls
- `src/components/DashboardHeader.tsx` -- use portfolio hook for live stats
- `src/App.tsx` -- add auth guard redirect to /login

## Implementation Steps

### 1. Create `src/lib/api-types.ts`
Define response interfaces matching backend API. Reuse/extend existing types from mockData.ts where shapes match:
- `Portfolio`, `Holding`, `PortfolioSnapshot`
- `RebalancePreview`, `RebalanceAction`, `RebalanceHistory`
- `Trade`, `Order`
- `ExchangeStatus`
- `BacktestRequest`, `BacktestResult`, `EquityCurvePoint`
- `AnalyticsData`, `PnLEntry`, `DrawdownEntry`, `FeeEntry`
- `TaxEvent`, `TaxReport`
- `GridBot`, `GridBotRequest`
- `SmartOrder`, `SmartOrderRequest`
- `CopySource`, `CopyHistory`
- `AiSuggestion`, `AiConfig`

### 2. Create `src/lib/api.ts` -- fetch wrapper

```ts
const API_BASE = "http://localhost:3001/api";

function getApiKey(): string {
  return localStorage.getItem("apiKey") ?? "";
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getApiKey(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API ${res.status}`);
  }
  return res.json();
}
```

Then export typed functions for every endpoint:
```ts
// Portfolio
export const fetchPortfolio = () => apiFetch<Portfolio>("/portfolio");
export const fetchPortfolioHistory = () => apiFetch<PortfolioSnapshot[]>("/portfolio/history");
export const fetchPrices = () => apiFetch<PriceMap>("/prices");

// Rebalance
export const triggerRebalance = () => apiFetch<void>("/rebalance", { method: "POST" });
export const fetchRebalancePreview = () => apiFetch<RebalancePreview>("/rebalance/preview");
export const fetchRebalanceHistory = () => apiFetch<RebalanceHistory[]>("/rebalance/history");

// ... etc for all endpoints
```

### 3. Create `src/hooks/use-auth.ts`
- `useAuth()` returns `{ apiKey, setApiKey, clearApiKey, isAuthenticated }`
- Reads/writes `localStorage.getItem("apiKey")`
- Used by LoginPage and auth guard

### 4. Create `src/hooks/use-websocket.ts`

```ts
export function useWebSocket() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  useEffect(() => {
    const key = localStorage.getItem("apiKey") ?? "";
    const ws = new WebSocket(`ws://localhost:3001/ws?apiKey=${key}`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "prices") setPrices(msg.data);
      setLastEvent(msg);
    };

    // Auto-reconnect on close
    ws.onclose = () => setTimeout(() => {/* reconnect logic */}, 3000);

    return () => ws.close();
  }, []);

  return { prices, lastEvent };
}
```
- Invalidate relevant TanStack queries on WS events (e.g., `rebalance:completed` -> invalidate portfolio + rebalance queries)

### 5. Create domain hooks (one per file)
Pattern for each hook file:
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, fetchPortfolioHistory } from "@/lib/api";

export function usePortfolio() {
  return useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio });
}

export function usePortfolioHistory() {
  return useQuery({ queryKey: ["portfolio-history"], queryFn: fetchPortfolioHistory });
}
```

Query key conventions:
- `["portfolio"]`, `["portfolio-history"]`
- `["rebalance-preview"]`, `["rebalance-history"]`
- `["trades"]`
- `["analytics", type, { from, to }]` — type = equity/pnl/drawdown/fees
- `["backtest", id]`, `["backtests"]`
- `["tax", year]`
- `["grid-bots"]`, `["grid-bot", id]`
- `["smart-orders"]`, `["smart-order", id]`
- `["copy-sources"]`, `["copy-history"]`
- `["ai-suggestions"]`, `["ai-config"]`

Mutations invalidate related queries on success:
```ts
export function useTriggerRebalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerRebalance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["rebalance-history"] });
      toast.success("Rebalance executed");
    },
    onError: (e) => toast.error(e.message),
  });
}
```

### 6. Wire all pages — replace mock imports
For each page, the pattern is:
```tsx
// BEFORE
import { HOLDINGS } from "@/lib/mockData";
// ...
{HOLDINGS.map(h => ...)}

// AFTER
import { usePortfolio } from "@/hooks/use-portfolio";
// ...
const { data, isLoading, error } = usePortfolio();
if (isLoading) return <BrutalSkeleton variant="rect" height="200px" />;
if (error) return <BrutalAlert variant="danger">{error.message}</BrutalAlert>;
{data.holdings.map(h => ...)}
```

Page-by-page wiring:

| Page | Hooks Used |
|------|-----------|
| OverviewPage | usePortfolio, usePortfolioHistory, useRebalancePreview, useAlerts |
| PortfolioPage | usePortfolio, usePrices |
| RebalancePlanPage | useRebalancePreview, useTriggerRebalance |
| OrdersPage | useTrades |
| AllocationsPage | usePortfolio |
| ExchangesPage | useExchangeStatus |
| StrategyConfigPage | useConfig, useUpdateConfig |
| LogsPage | useLogs (if endpoint exists, else keep mock) |
| AlertsPage | useAlerts (if endpoint exists, else keep mock) |
| SettingsPage | useConfig, useUpdateConfig |
| BacktestingPage | useRunBacktest, useBacktestResult |
| AnalyticsPage | useAnalytics (equity/pnl/drawdown/fees) |
| TaxPage | useTaxReport, useTaxExport |
| GridBotPage | useGridBots, useCreateGrid, useStopGrid |
| SmartOrdersPage | useSmartOrders, useCreateSmartOrder, usePause/Cancel |
| CopyTradingPage | useCopySources, useCopyHistory, useAddSource |
| AiSuggestionsPage | useAiSuggestions, useApprove/Reject, useAiConfig |
| DashboardHeader | usePortfolio (for live portfolio value + pnl) |

### 7. Add auth guard to App.tsx
- Wrap DashboardLayout routes in an `AuthGuard` component
- If no apiKey in localStorage, redirect to `/login`
- Simple component:
```tsx
function AuthGuard() {
  const key = localStorage.getItem("apiKey");
  if (!key) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

### 8. Delete mockData.ts (or keep as fallback)
- After all pages wired, remove `src/lib/mockData.ts`
- If any page still needs mock data (Logs/Alerts without endpoints), keep only those constants

## Todo List
- [x] Create `src/lib/api-types.ts` with all response interfaces
- [x] Create `src/lib/api.ts` with fetch wrapper + all endpoint functions
- [x] Create `src/hooks/use-auth.ts`
- [x] Create `src/hooks/use-websocket.ts` with auto-reconnect
- [x] Create domain hooks: use-portfolio, use-rebalance, use-trades
- [x] Create domain hooks: use-analytics, use-backtest, use-tax
- [x] Create domain hooks: use-grid, use-smart-orders, use-copy-trading, use-ai
- [x] Wire OverviewPage, PortfolioPage, RebalancePlanPage
- [x] Wire OrdersPage, AllocationsPage, ExchangesPage
- [x] Wire StrategyConfigPage, LogsPage, AlertsPage, SettingsPage
- [x] Wire BacktestingPage, AnalyticsPage, TaxPage
- [x] Wire GridBotPage, SmartOrdersPage, CopyTradingPage, AiSuggestionsPage
- [x] Wire DashboardHeader with live portfolio data
- [x] Add AuthGuard to App.tsx
- [x] Remove or minimize mockData.ts

## Success Criteria
- [x] No mockData imports remain in production pages
- [x] All pages show loading skeletons while fetching
- [x] All pages show error alerts on API failure
- [x] WebSocket updates prices in real-time
- [x] Auth guard redirects unauthenticated users to /login
- [x] Mutations show toast on success/error
- [x] `npm run build` succeeds with no TS errors

## Risk Assessment
- **High**: backend response shapes may differ from assumed types
  - **Mitigation**: define types in api-types.ts first, adjust after testing against real API
- **Medium**: WebSocket reconnection edge cases
  - **Mitigation**: simple 3s retry with max 10 attempts, log errors
- **Low**: some endpoints may not exist yet (Logs, Alerts)
  - **Mitigation**: keep mock data as fallback for missing endpoints, note in comments
