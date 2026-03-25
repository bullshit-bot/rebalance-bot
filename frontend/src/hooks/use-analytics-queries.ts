import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useEquityCurve(from?: number, to?: number) {
  return useQuery({
    queryKey: ['equity-curve', from, to],
    queryFn: () => api.getEquityCurve(from, to),
  })
}

export function usePnL(from?: number, to?: number) {
  return useQuery({
    queryKey: ['pnl', from, to],
    queryFn: () => api.getPnL(from, to),
  })
}

export function useDrawdown(from?: number, to?: number) {
  return useQuery({
    queryKey: ['drawdown', from, to],
    queryFn: () => api.getDrawdown(from, to),
  })
}

export function useFees(from?: number, to?: number) {
  return useQuery({
    queryKey: ['fees', from, to],
    queryFn: () => api.getFees(from, to),
  })
}
