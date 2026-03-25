import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTrades(limit?: number, rebalanceId?: string) {
  return useQuery({
    queryKey: ['trades', limit, rebalanceId],
    queryFn: () => api.getTrades(limit, rebalanceId),
  })
}
