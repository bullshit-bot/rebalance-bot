import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAISuggestions(status?: string) {
  return useQuery({
    queryKey: ['ai-suggestions', status],
    queryFn: () => api.getAISuggestions(status),
  })
}

export function useApproveSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.approveSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useRejectSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.rejectSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useUpdateAIConfig() {
  return useMutation({
    mutationFn: (data: { autoApprove?: boolean; maxAllocationShiftPct?: number }) =>
      api.updateAIConfig(data),
  })
}

export function useMarketSummary() {
  return useQuery({
    queryKey: ['market-summary'],
    queryFn: api.getMarketSummary,
  })
}
