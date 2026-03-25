import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CopySourceInput } from '@/lib/api-types'

export function useCopySources() {
  return useQuery({
    queryKey: ['copy-sources'],
    queryFn: api.getCopySources,
  })
}

export function useCopyHistory(sourceId?: string, limit?: number) {
  return useQuery({
    queryKey: ['copy-history', sourceId, limit],
    queryFn: () => api.getCopyHistory(sourceId, limit),
  })
}

export function useAddCopySource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CopySourceInput) => api.addCopySource(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copy-sources'] }),
  })
}

export function useDeleteCopySource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCopySource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copy-sources'] }),
  })
}

export function useSyncCopy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sourceId?: string) => api.syncCopy(sourceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['copy-sources'] })
      qc.invalidateQueries({ queryKey: ['copy-history'] })
    },
  })
}
