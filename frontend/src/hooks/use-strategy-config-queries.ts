import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const QUERY_KEY = 'strategyConfig'
const PRESETS_KEY = 'strategyPresets'

export function useStrategyConfig() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: api.getStrategyConfig,
  })
}

export function useStrategyPresets() {
  return useQuery({
    queryKey: [PRESETS_KEY],
    queryFn: api.getStrategyPresets,
  })
}

export function useUpdateStrategyConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: any }) =>
      api.updateStrategyConfig(name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useActivateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.activateStrategyConfig(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useCreateFromPreset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ presetName, configName }: { presetName: string; configName: string }) =>
      api.createFromPreset(presetName, configName),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useDeleteStrategyConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.deleteStrategyConfig(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
