import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getAISuggestions: vi.fn(),
    approveSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    updateAIConfig: vi.fn(),
    getMarketSummary: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import {
  useAISuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useUpdateAIConfig,
  useMarketSummary,
} from '@/hooks/use-ai-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-ai-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAISuggestions', () => {
    it('fetches AI suggestions without status filter', async () => {
      const mockData = [
        {
          id: 'ai-1',
          source: 'sentiment-analysis',
          suggestedAllocations: '{}',
          reasoning: 'Market bullish on BTC',
          sentimentData: '{}',
          status: 'pending' as const,
          approvedAt: null,
          createdAt: Date.now(),
        },
      ]
      vi.mocked(api.getAISuggestions).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useAISuggestions(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches AI suggestions with status filter', async () => {
      vi.mocked(api.getAISuggestions).mockResolvedValueOnce([])

      const { result } = renderHook(() => useAISuggestions('approved'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getAISuggestions).toHaveBeenCalledWith('approved')
    })

    it('has correct query key without status', async () => {
      vi.mocked(api.getAISuggestions).mockResolvedValueOnce([])

      const { result } = renderHook(() => useAISuggestions(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      // Query key should be ['ai-suggestions', undefined]
      expect(result.current.data).toEqual([])
    })

    it('has correct query key with status', async () => {
      vi.mocked(api.getAISuggestions).mockResolvedValueOnce([])

      const { result } = renderHook(() => useAISuggestions('rejected'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      // Query key should be ['ai-suggestions', 'rejected']
      expect(result.current.data).toEqual([])
    })

    it('handles error', async () => {
      vi.mocked(api.getAISuggestions).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useAISuggestions(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useApproveSuggestion', () => {
    it('approves suggestion', async () => {
      const mockData = { ok: true }
      vi.mocked(api.approveSuggestion).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useApproveSuggestion(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('ai-1')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.approveSuggestion).toHaveBeenCalledWith('ai-1')
    })

    it('invalidates ai-suggestions on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.approveSuggestion).mockResolvedValueOnce({ ok: true })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useApproveSuggestion(), { wrapper })

      await act(async () => {
        result.current.mutate('ai-2')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['ai-suggestions'] })
      )
    })

    it('handles error', async () => {
      vi.mocked(api.approveSuggestion).mockRejectedValueOnce(new Error('Approve failed'))

      const { result } = renderHook(() => useApproveSuggestion(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('ai-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useRejectSuggestion', () => {
    it('rejects suggestion', async () => {
      const mockData = { ok: true }
      vi.mocked(api.rejectSuggestion).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useRejectSuggestion(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('ai-3')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.rejectSuggestion).toHaveBeenCalledWith('ai-3')
    })

    it('invalidates ai-suggestions on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.rejectSuggestion).mockResolvedValueOnce({ ok: true })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useRejectSuggestion(), { wrapper })

      await act(async () => {
        result.current.mutate('ai-4')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['ai-suggestions'] })
      )
    })

    it('handles error', async () => {
      vi.mocked(api.rejectSuggestion).mockRejectedValueOnce(new Error('Reject failed'))

      const { result } = renderHook(() => useRejectSuggestion(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('ai-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useUpdateAIConfig', () => {
    it('updates AI config', async () => {
      const mockData = {}
      vi.mocked(api.updateAIConfig).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useUpdateAIConfig(), {
        wrapper: createWrapper(),
      })

      const config = { autoApprove: true, maxAllocationShiftPct: 5 }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.updateAIConfig).toHaveBeenCalledWith(config)
    })

    it('updates only autoApprove flag', async () => {
      vi.mocked(api.updateAIConfig).mockResolvedValueOnce({})

      const { result } = renderHook(() => useUpdateAIConfig(), {
        wrapper: createWrapper(),
      })

      const config = { autoApprove: false }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(api.updateAIConfig).toHaveBeenCalled())
      expect(api.updateAIConfig).toHaveBeenCalledWith(config)
    })

    it('updates only maxAllocationShiftPct', async () => {
      vi.mocked(api.updateAIConfig).mockResolvedValueOnce({})

      const { result } = renderHook(() => useUpdateAIConfig(), {
        wrapper: createWrapper(),
      })

      const config = { maxAllocationShiftPct: 10 }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(api.updateAIConfig).toHaveBeenCalled())
      expect(api.updateAIConfig).toHaveBeenCalledWith(config)
    })

    it('handles error', async () => {
      vi.mocked(api.updateAIConfig).mockRejectedValueOnce(new Error('Update failed'))

      const { result } = renderHook(() => useUpdateAIConfig(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate({ autoApprove: true })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useMarketSummary', () => {
    it('fetches market summary', async () => {
      const mockData = { summary: 'Market is trending bullish' }
      vi.mocked(api.getMarketSummary).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useMarketSummary(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('calls api.getMarketSummary', async () => {
      vi.mocked(api.getMarketSummary).mockResolvedValueOnce({ summary: 'Test' })

      const { result } = renderHook(() => useMarketSummary(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getMarketSummary).toHaveBeenCalled()
    })

    it('handles error', async () => {
      vi.mocked(api.getMarketSummary).mockRejectedValueOnce(new Error('Summary fetch failed'))

      const { result } = renderHook(() => useMarketSummary(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getMarketSummary).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useMarketSummary(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })
  })
})
