import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { GridBotInput } from '@/lib/api-types'

export function useGridBots() {
  return useQuery({
    queryKey: ['grid-bots'],
    queryFn: api.listGridBots,
    refetchInterval: 15_000,
  })
}

export function useCreateGridBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: GridBotInput) => api.createGridBot(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grid-bots'] }),
  })
}

export function useStopGridBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.stopGridBot(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grid-bots'] }),
  })
}
