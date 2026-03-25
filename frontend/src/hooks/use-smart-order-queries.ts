import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SmartOrderInput } from '@/lib/api-types'

export function useActiveSmartOrders() {
  return useQuery({
    queryKey: ['smart-orders-active'],
    queryFn: api.getActiveSmartOrders,
    refetchInterval: 10_000,
  })
}

export function useCreateSmartOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SmartOrderInput) => api.createSmartOrder(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-orders-active'] }),
  })
}

export function usePauseSmartOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.pauseSmartOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-orders-active'] }),
  })
}

export function useResumeSmartOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.resumeSmartOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-orders-active'] }),
  })
}

export function useCancelSmartOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.cancelSmartOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-orders-active'] }),
  })
}
