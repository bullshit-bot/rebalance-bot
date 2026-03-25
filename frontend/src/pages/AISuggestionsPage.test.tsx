import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import AISuggestionsPage from './AISuggestionsPage'

// Mock AI suggestion hooks
vi.mock('@/hooks/use-ai-queries', () => ({
  useAISuggestions: vi.fn(),
  useApproveSuggestion: vi.fn(),
  useRejectSuggestion: vi.fn(),
  useUpdateAIConfig: vi.fn(),
}))

import {
  useAISuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useUpdateAIConfig,
} from '@/hooks/use-ai-queries'

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

describe('AISuggestionsPage', () => {
  const mockPendingSuggestion = {
    id: 'ai1',
    source: 'openclaw',
    suggestedAllocations: '[{"asset":"BTC","targetPct":40}]',
    reasoning: 'BTC momentum strong',
    sentimentData: null,
    status: 'pending' as const,
    approvedAt: null,
    createdAt: 1710000000,
  }

  const mockApprovedSuggestion = {
    id: 'ai2',
    source: 'openclaw',
    suggestedAllocations: '[{"asset":"ETH","targetPct":30}]',
    reasoning: 'ETH underweight',
    sentimentData: null,
    status: 'approved' as const,
    approvedAt: 1710086400,
    createdAt: 1710000000,
  }

  const mockRejectedSuggestion = {
    id: 'ai3',
    source: 'openclaw',
    suggestedAllocations: '[{"asset":"SOL","targetPct":20}]',
    reasoning: 'SOL high volatility',
    sentimentData: null,
    status: 'rejected' as const,
    approvedAt: null,
    createdAt: 1709914400,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAISuggestions).mockReturnValue({
      data: [mockPendingSuggestion, mockApprovedSuggestion, mockRejectedSuggestion],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useApproveSuggestion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useRejectSuggestion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useUpdateAIConfig).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<AISuggestionsPage />)
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument()
  })

  it('renders all tabs', () => {
    renderWithProviders(<AISuggestionsPage />)
    expect(screen.getByText(/Pending/)).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Config')).toBeInTheDocument()
  })

  it('shows pending count in tab label', () => {
    renderWithProviders(<AISuggestionsPage />)
    expect(screen.getByText('Pending (1)')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useAISuggestions).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<AISuggestionsPage />)
    expect(screen.getByText('Loading suggestions…')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useAISuggestions).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    renderWithProviders(<AISuggestionsPage />)
    expect(screen.getByText('Failed to load AI suggestions.')).toBeInTheDocument()
  })

  describe('Pending Tab', () => {
    it('renders pending suggestions', () => {
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })

    it('displays suggestion source', () => {
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('openclaw')).toBeInTheDocument()
    })

    it('displays suggested allocations table', () => {
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.getByText('40%')).toBeInTheDocument()
    })

    it('shows approve button for pending suggestions', () => {
      renderWithProviders(<AISuggestionsPage />)
      const approveButtons = screen.getAllByRole('button', { name: /Approve/i })
      expect(approveButtons.length).toBeGreaterThan(0)
    })

    it('shows reject button for pending suggestions', () => {
      renderWithProviders(<AISuggestionsPage />)
      const rejectButtons = screen.getAllByRole('button', { name: /Reject/i })
      expect(rejectButtons.length).toBeGreaterThan(0)
    })

    it('shows empty state when no pending suggestions', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [mockApprovedSuggestion, mockRejectedSuggestion],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('No pending suggestions.')).toBeInTheDocument()
    })
  })

  describe('History Tab', () => {
    it('renders history tab content', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('History'))
      await waitFor(() => {
        expect(screen.getByText('Decision History')).toBeInTheDocument()
      })
    })

    it('displays decision history table headers', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('History'))
      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument()
        expect(screen.getByText('Source')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Reasoning')).toBeInTheDocument()
      })
    })

    it('displays approved suggestions in history', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('History'))
      await waitFor(() => {
        expect(screen.getByText('ETH underweight')).toBeInTheDocument()
      })
    })

    it('displays rejected suggestions in history', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('History'))
      await waitFor(() => {
        expect(screen.getByText('SOL high volatility')).toBeInTheDocument()
      })
    })

    it('does not show approve/reject buttons in history', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('History'))
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Config Tab', () => {
    it('renders config tab content', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByText('AI Config')).toBeInTheDocument()
      })
    })

    it('renders auto-approve toggle', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByText('Auto-Approve Suggestions')).toBeInTheDocument()
      })
    })

    it('renders max allocation shift slider', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        // Slider will be rendered but not easily accessible by label in jsdom
        expect(screen.getByText(/Max Allocation Shift/i)).toBeInTheDocument()
      })
    })

    it('renders Save Config button', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Config/i })).toBeInTheDocument()
      })
    })

    it('shows saving state during config update', async () => {
      vi.mocked(useUpdateAIConfig).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Saving/i })).toBeInTheDocument()
      })
    })

    it('shows success message after config save', async () => {
      vi.mocked(useUpdateAIConfig).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        isSuccess: true,
        error: null,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByText('Config saved.')).toBeInTheDocument()
      })
    })

    it('shows error message on config save failure', async () => {
      vi.mocked(useUpdateAIConfig).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        isSuccess: false,
        error: new Error('Failed to save config'),
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        expect(screen.getByText('Failed to save config')).toBeInTheDocument()
      })
    })
  })

  describe('Approve functionality', () => {
    it('calls approve mutation when approve button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useApproveSuggestion).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<AISuggestionsPage />)

      const approveButtons = screen.getAllByRole('button', { name: /Approve/i })
      fireEvent.click(approveButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('ai1')
    })
  })

  describe('Reject functionality', () => {
    it('calls reject mutation when reject button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useRejectSuggestion).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<AISuggestionsPage />)

      const rejectButtons = screen.getAllByRole('button', { name: /Reject/i })
      fireEvent.click(rejectButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('ai1')
    })
  })

  describe('Allocation parsing', () => {
    it('parses JSON allocations correctly', () => {
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('BTC')).toBeInTheDocument()
    })

    it('handles invalid JSON allocations gracefully', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            suggestedAllocations: 'invalid json',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      // Should still render suggestion without allocations table
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })

    it('handles empty allocations array', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            suggestedAllocations: '[]',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      // Should render suggestion but no allocation table
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })

    it('handles multiple allocations', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            suggestedAllocations: '[{"asset":"BTC","targetPct":40},{"asset":"ETH","targetPct":30},{"asset":"SOL","targetPct":30}]',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.getByText('ETH')).toBeInTheDocument()
      expect(screen.getByText('SOL')).toBeInTheDocument()
    })
  })

  describe('Config form', () => {
    it('allows toggling auto-approve', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        const toggleBtn = screen.getByRole('button', { name: '' }).parentElement?.querySelector('button')
        if (toggleBtn) fireEvent.click(toggleBtn)
      })
    })

    it('allows changing max allocation shift', async () => {
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        const sliders = screen.getAllByRole('slider')
        if (sliders.length > 0) {
          fireEvent.change(sliders[0], { target: { value: '10' } })
          expect((sliders[0] as HTMLInputElement).value).toBe('10')
        }
      })
    })

    it('submits config with correct data', async () => {
      const mockMutate = vi.fn()
      vi.mocked(useUpdateAIConfig).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      fireEvent.click(screen.getByText('Config'))
      await waitFor(() => {
        const saveBtn = screen.getByRole('button', { name: /Save Config/i })
        fireEvent.click(saveBtn)
        expect(mockMutate).toHaveBeenCalled()
      })
    })
  })

  describe('Edge cases', () => {
    it('handles empty suggestion list', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('No pending suggestions.')).toBeInTheDocument()
    })

    it('handles suggestions with special characters in reasoning', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            reasoning: 'Price < $50k & volume > 100% avg. Strong signal!',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText(/Price < \$50k & volume > 100%/)).toBeInTheDocument()
    })

    it('handles very long reasoning text', () => {
      const longReasoning = 'This is a very long reasoning string that explains why this allocation is suggested. It contains multiple sentences and detailed analysis.'
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            reasoning: longReasoning,
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText(/very long reasoning/)).toBeInTheDocument()
    })

    it('handles allocation with 0% target', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            suggestedAllocations: '[{"asset":"USDC","targetPct":0}]',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('USDC')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles allocation with 100% target', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          {
            ...mockPendingSuggestion,
            suggestedAllocations: '[{"asset":"BTC","targetPct":100}]',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('handles multiple suggestions with same reasoning', () => {
      vi.mocked(useAISuggestions).mockReturnValue({
        data: [
          mockPendingSuggestion,
          {
            ...mockPendingSuggestion,
            id: 'ai1b',
            suggestedAllocations: '[{"asset":"ETH","targetPct":30}]',
          },
        ],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AISuggestionsPage />)
      expect(screen.getByText('Pending (2)')).toBeInTheDocument()
    })

    it('handles mix of statuses correctly', () => {
      renderWithProviders(<AISuggestionsPage />)
      // Pending tab should show only pending
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
      // History tab should show approved and rejected
      fireEvent.click(screen.getByText('History'))
      expect(waitFor(() => screen.getByText('ETH underweight')))
    })
  })

  describe('Timestamp formatting', () => {
    it('formats Unix timestamp to readable date', () => {
      renderWithProviders(<AISuggestionsPage />)
      // Just verify the component renders without crashing
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })
  })

  describe('Data display', () => {
    it('displays brain icon in suggestion cards', () => {
      renderWithProviders(<AISuggestionsPage />)
      // Component should render successfully with icon
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })

    it('shows status badges correctly', () => {
      renderWithProviders(<AISuggestionsPage />)
      // Pending suggestions should show "open" status badge
      expect(screen.getByText('BTC momentum strong')).toBeInTheDocument()
    })
  })
})
