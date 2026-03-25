import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useRebalancePreview() {
  return useQuery({
    queryKey: ['rebalance-preview'],
    queryFn: api.getRebalancePreview,
  })
}

export function useTriggerRebalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.triggerRebalance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] })
      qc.invalidateQueries({ queryKey: ['trades'] })
    },
  })
}

export function useRebalanceHistory(limit?: number) {
  return useQuery({
    queryKey: ['rebalance-history', limit],
    queryFn: () => api.getRebalanceHistory(limit),
  })
}
