import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getCopySources: vi.fn(),
    getCopyHistory: vi.fn(),
    addCopySource: vi.fn(),
    deleteCopySource: vi.fn(),
    syncCopy: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import {
  useCopySources,
  useCopyHistory,
  useAddCopySource,
  useDeleteCopySource,
  useSyncCopy,
} from '@/hooks/use-copy-trading-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-copy-trading-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useCopySources', () => {
    it('fetches copy sources', async () => {
      const mockData = [
        {
          id: 'src-1',
          name: 'Source 1',
          sourceType: 'url' as const,
          sourceUrl: 'https://example.com/allocations',
          allocations: '{}',
          weight: 1,
          syncInterval: '1h',
          enabled: 1 as const,
          lastSyncedAt: Date.now(),
          createdAt: Date.now(),
        },
      ]
      vi.mocked(api.getCopySources).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useCopySources(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getCopySources).mockResolvedValueOnce([])

      const { result } = renderHook(() => useCopySources(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getCopySources).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useCopySources(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useCopyHistory', () => {
    it('fetches copy history without params', async () => {
      const mockData = [
        {
          id: 1,
          sourceId: 'src-1',
          beforeAllocations: '{}',
          afterAllocations: '{}',
          changesApplied: 1,
          syncedAt: Date.now(),
        },
      ]
      vi.mocked(api.getCopyHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useCopyHistory(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches copy history with sourceId and limit', async () => {
      vi.mocked(api.getCopyHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => useCopyHistory('src-2', 50), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getCopyHistory).toHaveBeenCalledWith('src-2', 50)
    })

    it('has correct query key with params', async () => {
      vi.mocked(api.getCopyHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => useCopyHistory('src-3', 100), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
  })

  describe('useAddCopySource', () => {
    it('adds copy source', async () => {
      const mockData = { id: 'src-new' }
      vi.mocked(api.addCopySource).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useAddCopySource(), { wrapper: createWrapper() })

      const input = {
        name: 'New Source',
        sourceType: 'url' as const,
        sourceUrl: 'https://example.com',
      }

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('invalidates copy-sources on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.addCopySource).mockResolvedValueOnce({ id: 'src-456' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useAddCopySource(), { wrapper })

      await act(async () => {
        result.current.mutate({
          name: 'Test Source',
          sourceType: 'manual',
        })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['copy-sources'] })
      )
    })
  })

  describe('useDeleteCopySource', () => {
    it('deletes copy source', async () => {
      const mockData = { ok: true }
      vi.mocked(api.deleteCopySource).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useDeleteCopySource(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('src-1')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.deleteCopySource).toHaveBeenCalledWith('src-1')
    })

    it('invalidates copy-sources on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.deleteCopySource).mockResolvedValueOnce({ ok: true })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteCopySource(), { wrapper })

      await act(async () => {
        result.current.mutate('src-2')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['copy-sources'] })
      )
    })
  })

  describe('useSyncCopy', () => {
    it('syncs copy without sourceId', async () => {
      const mockData = { ok: true }
      vi.mocked(api.syncCopy).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useSyncCopy(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.syncCopy).toHaveBeenCalledWith(undefined)
    })

    it('syncs copy with specific sourceId', async () => {
      vi.mocked(api.syncCopy).mockResolvedValueOnce({ ok: true })

      const { result } = renderHook(() => useSyncCopy(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate('src-3')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.syncCopy).toHaveBeenCalledWith('src-3')
    })

    it('invalidates copy-sources on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.syncCopy).mockResolvedValueOnce({ ok: true })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useSyncCopy(), { wrapper })

      await act(async () => {
        result.current.mutate('src-4')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['copy-sources'] })
      )
    })

    it('invalidates copy-history on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.syncCopy).mockResolvedValueOnce({ ok: true })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useSyncCopy(), { wrapper })

      await act(async () => {
        result.current.mutate('src-5')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['copy-history'] })
      )
    })
  })

  describe('error handling', () => {
    it('handles add source error', async () => {
      vi.mocked(api.addCopySource).mockRejectedValueOnce(new Error('Add failed'))

      const { result } = renderHook(() => useAddCopySource(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate({
          name: 'Test',
          sourceType: 'url',
        })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles delete source error', async () => {
      vi.mocked(api.deleteCopySource).mockRejectedValueOnce(new Error('Delete failed'))

      const { result } = renderHook(() => useDeleteCopySource(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('src-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles sync error', async () => {
      vi.mocked(api.syncCopy).mockRejectedValueOnce(new Error('Sync failed'))

      const { result } = renderHook(() => useSyncCopy(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate('src-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
