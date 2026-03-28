import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BacktestConfig, OptimizationRequest } from '@/lib/api-types'

export function useBacktestList() {
  return useQuery({
    queryKey: ['backtest-list'],
    queryFn: api.listBacktests,
  })
}

export function useBacktestResult(id: string | null) {
  return useQuery({
    queryKey: ['backtest', id],
    queryFn: () => api.getBacktestResult(id!),
    enabled: !!id,
  })
}

export function useRunBacktest() {
  return useMutation({
    mutationFn: (config: BacktestConfig) => api.runBacktest(config),
  })
}

export function useRunOptimization() {
  return useMutation({
    mutationFn: (config: OptimizationRequest) => api.runOptimization(config),
  })
}
