// API client for rebalance-bot backend
// Base URL configurable via VITE_API_URL env var

import type {
  Portfolio, Snapshot, Trade, RebalancePreview, RebalanceEvent,
  Allocation, AllocationInput, HealthResponse,
  BacktestConfig, BacktestResult,
  EquityCurveResponse, PnLSummary, DrawdownResult, FeeSummary,
  TaxReport,
  GridBot, GridBotInput,
  SmartOrderDetail, SmartOrderInput,
  CopySource, CopySourceInput, CopySyncLog,
  AISuggestion,
} from './api-types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export function getApiKey(): string {
  return localStorage.getItem('apiKey') || ''
}

export function setApiKey(key: string) {
  localStorage.setItem('apiKey', key)
}

export function clearApiKey() {
  localStorage.removeItem('apiKey')
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    clearApiKey()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Build query string, omitting undefined/empty values
function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}

export const api = {
  // Portfolio
  getPortfolio: () => apiFetch<Portfolio>('/portfolio'),
  getPortfolioHistory: (from?: number, to?: number) =>
    apiFetch<Snapshot[]>(`/portfolio/history${qs({ from, to })}`),

  // Rebalance
  triggerRebalance: () => apiFetch<RebalanceEvent>('/rebalance', { method: 'POST' }),
  getRebalancePreview: () => apiFetch<RebalancePreview>('/rebalance/preview'),
  getRebalanceHistory: (limit?: number) =>
    apiFetch<RebalanceEvent[]>(`/rebalance/history${qs({ limit })}`),

  // Config / Allocations
  getAllocations: () => apiFetch<Allocation[]>('/config/allocations'),
  updateAllocations: (data: AllocationInput[]) =>
    apiFetch<Allocation[]>('/config/allocations', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAllocation: (asset: string) =>
    apiFetch<{ deleted: string }>(`/config/allocations/${encodeURIComponent(asset)}`, { method: 'DELETE' }),

  // Trades
  getTrades: (limit?: number, rebalanceId?: string) =>
    apiFetch<Trade[]>(`/trades${qs({ limit, rebalanceId })}`),

  // Health (public — also used for auth validation)
  getHealth: () => apiFetch<HealthResponse>('/health'),

  // Backtest
  runBacktest: (config: BacktestConfig) =>
    apiFetch<BacktestResult>('/backtest', { method: 'POST', body: JSON.stringify(config) }),
  getBacktestResult: (id: string) => apiFetch<BacktestResult>(`/backtest/${id}`),
  listBacktests: () => apiFetch<BacktestResult[]>('/backtest/list'),

  // Analytics
  getEquityCurve: (from?: number, to?: number) =>
    apiFetch<EquityCurveResponse>(`/analytics/equity-curve${qs({ from, to })}`),
  getPnL: (from?: number, to?: number) =>
    apiFetch<PnLSummary>(`/analytics/pnl${qs({ from, to })}`),
  getDrawdown: (from?: number, to?: number) =>
    apiFetch<DrawdownResult>(`/analytics/drawdown${qs({ from, to })}`),
  getFees: (from?: number, to?: number) =>
    apiFetch<FeeSummary>(`/analytics/fees${qs({ from, to })}`),

  // Tax
  getTaxReport: (year?: number) =>
    apiFetch<TaxReport>(`/tax/report${qs({ year })}`),
  exportTaxCsvUrl: (year?: number) =>
    `${API_BASE}/tax/export${qs({ year })}`,

  // Smart Orders
  createSmartOrder: (data: SmartOrderInput) =>
    apiFetch<{ orderId: string }>('/smart-order', { method: 'POST', body: JSON.stringify(data) }),
  getSmartOrder: (id: string) => apiFetch<SmartOrderDetail>(`/smart-order/${id}`),
  getActiveSmartOrders: () => apiFetch<SmartOrderDetail[]>('/smart-order/active'),
  pauseSmartOrder: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/smart-order/${id}/pause`, { method: 'PUT' }),
  resumeSmartOrder: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/smart-order/${id}/resume`, { method: 'PUT' }),
  cancelSmartOrder: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/smart-order/${id}/cancel`, { method: 'PUT' }),

  // Grid bots
  createGridBot: (data: GridBotInput) =>
    apiFetch<{ botId: string }>('/grid', { method: 'POST', body: JSON.stringify(data) }),
  getGridBot: (id: string) => apiFetch<GridBot>(`/grid/${id}`),
  listGridBots: () => apiFetch<GridBot[]>('/grid/list'),
  stopGridBot: (id: string) =>
    apiFetch<{ id: string; status: string; totalProfit: number; totalTrades: number }>(`/grid/${id}/stop`, { method: 'PUT' }),

  // Copy Trading
  addCopySource: (data: CopySourceInput) =>
    apiFetch<{ id: string }>('/copy/source', { method: 'POST', body: JSON.stringify(data) }),
  getCopySources: () => apiFetch<CopySource[]>('/copy/sources'),
  updateCopySource: (id: string, data: Partial<CopySourceInput>) =>
    apiFetch<{ ok: boolean }>(`/copy/source/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCopySource: (id: string) =>
    apiFetch<{ ok: boolean }>(`/copy/source/${id}`, { method: 'DELETE' }),
  syncCopy: (sourceId?: string) =>
    apiFetch<{ ok: boolean }>('/copy/sync', { method: 'POST', body: JSON.stringify({ sourceId }) }),
  getCopyHistory: (sourceId?: string, limit?: number) =>
    apiFetch<CopySyncLog[]>(`/copy/history${qs({ sourceId, limit })}`),

  // Strategy Config
  getStrategyConfig: () =>
    apiFetch<{ active: any; configs: any[] }>('/strategy-config'),
  getStrategyPresets: () =>
    apiFetch<Record<string, any>>('/strategy-config/presets'),
  createStrategyConfig: (data: any) =>
    apiFetch<any>('/strategy-config', { method: 'POST', body: JSON.stringify(data) }),
  updateStrategyConfig: (name: string, data: any) =>
    apiFetch<any>(`/strategy-config/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) }),
  activateStrategyConfig: (name: string) =>
    apiFetch<any>(`/strategy-config/${encodeURIComponent(name)}/activate`, { method: 'POST' }),
  createFromPreset: (presetName: string, configName: string) =>
    apiFetch<any>('/strategy-config/from-preset', { method: 'POST', body: JSON.stringify({ presetName, configName }) }),
  deleteStrategyConfig: (name: string) =>
    apiFetch<any>(`/strategy-config/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // AI Suggestions
  getAISuggestions: (status?: string, limit?: number) =>
    apiFetch<AISuggestion[]>(`/ai/suggestions${qs({ status, limit })}`),
  approveSuggestion: (id: string) =>
    apiFetch<{ ok: boolean }>(`/ai/suggestion/${id}/approve`, { method: 'PUT' }),
  rejectSuggestion: (id: string) =>
    apiFetch<{ ok: boolean }>(`/ai/suggestion/${id}/reject`, { method: 'PUT' }),
  updateAIConfig: (data: { autoApprove?: boolean; maxAllocationShiftPct?: number }) =>
    apiFetch<unknown>('/ai/config', { method: 'PUT', body: JSON.stringify(data) }),
  getMarketSummary: () => apiFetch<{ summary: string }>('/ai/summary'),
}
