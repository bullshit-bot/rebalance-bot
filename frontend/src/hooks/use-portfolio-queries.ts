import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: api.getPortfolio,
    refetchInterval: 10_000,
  })
}

export function usePortfolioHistory(from?: number, to?: number) {
  return useQuery({
    queryKey: ['portfolio-history', from, to],
    queryFn: () => api.getPortfolioHistory(from, to),
  })
}
