import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTaxReport(year?: number) {
  return useQuery({
    queryKey: ['tax-report', year],
    queryFn: () => api.getTaxReport(year),
  })
}
