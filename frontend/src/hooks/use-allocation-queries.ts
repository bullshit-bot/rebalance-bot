import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AllocationInput } from '@/lib/api-types'

export function useAllocations() {
  return useQuery({
    queryKey: ['allocations'],
    queryFn: api.getAllocations,
  })
}

export function useUpdateAllocations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AllocationInput[]) => api.updateAllocations(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocations'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useDeleteAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (asset: string) => api.deleteAllocation(asset),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocations'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}
