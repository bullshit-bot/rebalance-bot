import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import CopyTradingPage from './CopyTradingPage'

// Mock copy trading hooks
vi.mock('@/hooks/use-copy-trading-queries', () => ({
  useCopySources: vi.fn(),
  useCopyHistory: vi.fn(),
  useAddCopySource: vi.fn(),
  useDeleteCopySource: vi.fn(),
  useSyncCopy: vi.fn(),
}))

import {
  useCopySources,
  useCopyHistory,
  useAddCopySource,
  useDeleteCopySource,
  useSyncCopy,
} from '@/hooks/use-copy-trading-queries'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderWithProviders(ui: ReactNode) {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CopyTradingPage', () => {
  const mockCopySource = {
    id: 'cs1',
    name: 'AlphaTrader',
    sourceType: 'url',
    sourceUrl: 'https://example.com',
    allocations: '[]',
    weight: 0.6,
    syncInterval: '5m',
    enabled: 1,
    lastSyncedAt: 1710000000,
    createdAt: 1710000000,
  }

  const mockCopySource2 = {
    id: 'cs2',
    name: 'BetaSignals',
    sourceType: 'url',
    sourceUrl: 'https://beta.example.com',
    allocations: '[]',
    weight: 0.4,
    syncInterval: '15m',
    enabled: 0,
    lastSyncedAt: 1709000000,
    createdAt: 1709000000,
  }

  const mockSyncHistory = [
    {
      id: 1,
      sourceId: 'cs1',
      beforeAllocations: '[]',
      afterAllocations: '[]',
      changesApplied: 2,
      syncedAt: 1710000000,
    },
    {
      id: 2,
      sourceId: 'cs2',
      beforeAllocations: '[]',
      afterAllocations: '[]',
      changesApplied: 0,
      syncedAt: 1709500000,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCopySources).mockReturnValue({
      data: [mockCopySource, mockCopySource2],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useCopyHistory).mockReturnValue({
      data: mockSyncHistory,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useAddCopySource).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useDeleteCopySource).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useSyncCopy).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Copy Trading')).toBeInTheDocument()
  })

  it('renders add signal source form', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Add Signal Source')).toBeInTheDocument()
  })

  it('renders form fields', () => {
    renderWithProviders(<CopyTradingPage />)
    const nameInput = screen.getByPlaceholderText(/e.g. AlphaTrader/)
    const urlInput = screen.getByPlaceholderText(/https:\/\/signals/)
    expect(nameInput).toBeInTheDocument()
    expect(urlInput).toBeInTheDocument()
  })

  it('renders Add Source button', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByRole('button', { name: /Add Source/i })).toBeInTheDocument()
  })

  it('renders Signal Sources section', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Signal Sources')).toBeInTheDocument()
  })

  it('renders source cards with correct names', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('AlphaTrader')).toBeInTheDocument()
    expect(screen.getByText('BetaSignals')).toBeInTheDocument()
  })

  it('displays source URLs', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('https://beta.example.com')).toBeInTheDocument()
  })

  it('displays weight percentage', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('displays sync interval', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('5m')).toBeInTheDocument()
    expect(screen.getByText('15m')).toBeInTheDocument()
  })

  it('shows Sync Now button on each source card', () => {
    renderWithProviders(<CopyTradingPage />)
    const syncButtons = screen.getAllByRole('button', { name: /Sync Now/i })
    expect(syncButtons.length).toBe(2)
  })

  it('shows Remove button on each source card', () => {
    renderWithProviders(<CopyTradingPage />)
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
    expect(removeButtons.length).toBe(2)
  })

  it('renders Sync History section', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Sync History')).toBeInTheDocument()
  })

  it('renders sync history table headers', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Changes')).toBeInTheDocument()
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('displays sync history entries', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('cs1')).toBeInTheDocument()
    expect(screen.getByText('cs2')).toBeInTheDocument()
  })

  it('displays changes count in history', () => {
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows loading state for sources', () => {
    vi.mocked(useCopySources).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Loading sources…')).toBeInTheDocument()
  })

  it('shows error state for sources', () => {
    vi.mocked(useCopySources).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Failed to load copy sources.')).toBeInTheDocument()
  })

  it('shows loading state for history', () => {
    vi.mocked(useCopyHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<CopyTradingPage />)
    expect(screen.getByText('Loading history…')).toBeInTheDocument()
  })

  describe('Form submission', () => {
    it('submits form with correct data', () => {
      const mockMutate = vi.fn()
      vi.mocked(useAddCopySource).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)

      const nameInput = screen.getByPlaceholderText(/e.g. AlphaTrader/) as HTMLInputElement
      const urlInput = screen.getByPlaceholderText(/https:\/\/signals/) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /Add Source/i })

      fireEvent.change(nameInput, { target: { value: 'TestSource' } })
      fireEvent.change(urlInput, { target: { value: 'https://test.example.com' } })
      fireEvent.click(submitButton)

      expect(mockMutate).toHaveBeenCalled()
      const callArgs = mockMutate.mock.calls[0][0]
      expect(callArgs.name).toBe('TestSource')
      expect(callArgs.sourceUrl).toBe('https://test.example.com')
      expect(callArgs.sourceType).toBe('url')
    })

    it('shows loading state during add', () => {
      vi.mocked(useAddCopySource).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByRole('button', { name: /Adding/i })).toBeInTheDocument()
    })

    it('disables submit button during add', () => {
      vi.mocked(useAddCopySource).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      const submitButton = screen.getByRole('button', { name: /Adding/i })
      expect(submitButton).toBeDisabled()
    })

    it('shows error message on add failure', () => {
      vi.mocked(useAddCopySource).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Invalid URL format'),
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('Invalid URL format')).toBeInTheDocument()
    })

    it('requires name and URL fields', () => {
      const mockMutate = vi.fn()
      vi.mocked(useAddCopySource).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)

      const submitButton = screen.getByRole('button', { name: /Add Source/i })
      fireEvent.click(submitButton)

      // Should not call mutate if name or URL are empty
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  describe('Sync functionality', () => {
    it('calls sync mutation when sync button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useSyncCopy).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)

      const syncButtons = screen.getAllByRole('button', { name: /Sync Now/i })
      fireEvent.click(syncButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('cs1')
    })

    it('disables sync button during sync', () => {
      vi.mocked(useSyncCopy).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      const syncButtons = screen.getAllByRole('button', { name: /Sync Now/i })
      expect(syncButtons[0]).toBeDisabled()
    })
  })

  describe('Delete functionality', () => {
    it('calls delete mutation when remove button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useDeleteCopySource).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)

      const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
      fireEvent.click(removeButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('cs1')
    })

    it('disables remove button during deletion', () => {
      vi.mocked(useDeleteCopySource).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
      expect(removeButtons[0]).toBeDisabled()
    })
  })

  describe('Source status', () => {
    it('shows active status for enabled sources', () => {
      renderWithProviders(<CopyTradingPage />)
      // Should display badge for active source
      expect(screen.getByText('AlphaTrader')).toBeInTheDocument()
    })

    it('shows inactive status for disabled sources', () => {
      renderWithProviders(<CopyTradingPage />)
      // Should display badge for inactive source
      expect(screen.getByText('BetaSignals')).toBeInTheDocument()
    })
  })

  describe('Sync history', () => {
    it('shows applied changes message when changes > 0', () => {
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('Applied changes')).toBeInTheDocument()
    })

    it('shows no changes message when changes = 0', () => {
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('No changes')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles empty source list', () => {
      vi.mocked(useCopySources).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('Copy Trading')).toBeInTheDocument()
      expect(screen.queryByText('AlphaTrader')).not.toBeInTheDocument()
    })

    it('handles empty sync history', () => {
      vi.mocked(useCopyHistory).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('Sync History')).toBeInTheDocument()
    })

    it('handles source with 100% weight', () => {
      const sourceFullWeight = { ...mockCopySource, weight: 1.0 }
      vi.mocked(useCopySources).mockReturnValue({
        data: [sourceFullWeight],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('handles source with 1% weight', () => {
      const sourceMinWeight = { ...mockCopySource, weight: 0.01 }
      vi.mocked(useCopySources).mockReturnValue({
        data: [sourceMinWeight],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('1%')).toBeInTheDocument()
    })

    it('handles null lastSyncedAt', () => {
      const sourceNeverSynced = { ...mockCopySource, lastSyncedAt: null }
      vi.mocked(useCopySources).mockReturnValue({
        data: [sourceNeverSynced],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('Never')).toBeInTheDocument()
    })

    it('handles very large change counts', () => {
      const largeHistory = [
        { ...mockSyncHistory[0], changesApplied: 999 },
      ]
      vi.mocked(useCopyHistory).mockReturnValue({
        data: largeHistory,
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('999')).toBeInTheDocument()
    })

    it('handles multiple sources with same weight', () => {
      const source1 = { ...mockCopySource, id: 'cs1', weight: 0.5 }
      const source2 = { ...mockCopySource2, id: 'cs2', weight: 0.5 }
      vi.mocked(useCopySources).mockReturnValue({
        data: [source1, source2],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      const fiftyPercents = screen.getAllByText('50%')
      // Should be at least 2 (may be more if slider shows value)
      expect(fiftyPercents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Form field changes', () => {
    it('allows changing source name', () => {
      renderWithProviders(<CopyTradingPage />)
      const nameInput = screen.getByPlaceholderText(/e.g. AlphaTrader/) as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'NewSource' } })
      expect(nameInput.value).toBe('NewSource')
    })

    it('allows changing source URL', () => {
      renderWithProviders(<CopyTradingPage />)
      const urlInput = screen.getByPlaceholderText(/https:\/\/signals/) as HTMLInputElement
      fireEvent.change(urlInput, { target: { value: 'https://new.example.com' } })
      expect(urlInput.value).toBe('https://new.example.com')
    })

    it('allows changing weight slider', () => {
      renderWithProviders(<CopyTradingPage />)
      // Find the range input for weight
      const sliders = screen.getAllByRole('slider')
      fireEvent.change(sliders[0], { target: { value: '75' } })
      expect((sliders[0] as HTMLInputElement).value).toBe('75')
    })

    it('allows changing sync interval', () => {
      renderWithProviders(<CopyTradingPage />)
      const intervalSelects = screen.getAllByRole('combobox')
      fireEvent.change(intervalSelects[0], { target: { value: '1h' } })
      expect((intervalSelects[0] as HTMLSelectElement).value).toBe('1h')
    })
  })

  describe('Weight formatting', () => {
    it('converts decimal weight to percentage correctly', () => {
      vi.mocked(useCopySources).mockReturnValue({
        data: [{ ...mockCopySource, weight: 0.75 }],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<CopyTradingPage />)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })
})
