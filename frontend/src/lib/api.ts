// API client for rebalance-bot backend
// Base URL configurable via VITE_API_URL env var

import type {
  Portfolio, Snapshot, Trade, RebalancePreview, RebalanceEvent,
  Allocation, AllocationInput, HealthResponse,
  BacktestConfig, BacktestResult,
  EquityCurveResponse, PnLSummary, DrawdownResult, FeeSummary,
  TaxReport,
  OptimizationRequest, OptimizationResult,
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
  getCapitalFlows: () =>
    apiFetch<Array<{ _id: string; type: string; amountUsd: number; note?: string; createdAt: string }>>('/portfolio/capital-flows'),

  // Rebalance
  triggerRebalance: () => apiFetch<RebalanceEvent>('/rebalance', { method: 'POST' }),
  getRebalancePreview: () => apiFetch<RebalancePreview>('/rebalance/preview'),
  getRebalanceHistory: (limit?: number) =>
    apiFetch<RebalanceEvent[]>(`/rebalance/history${qs({ limit })}`),
  pauseBot: () => apiFetch<{ status: string }>('/rebalance/pause', { method: 'POST' }),
  resumeBot: () => apiFetch<{ status: string }>('/rebalance/resume', { method: 'POST' }),

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
  runOptimization: (config: OptimizationRequest) =>
    apiFetch<OptimizationResult>('/backtest/optimize', { method: 'POST', body: JSON.stringify(config) }),

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

}
