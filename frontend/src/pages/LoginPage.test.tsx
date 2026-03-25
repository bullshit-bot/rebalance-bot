import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import LoginPage from './LoginPage'

// Mock useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock useNavigate hook
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('LoginPage', () => {
  const mockNavigate = vi.fn()
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      logout: vi.fn(),
      isAuthenticated: false,
    } as any)
  })

  it('renders login form', () => {
    renderWithRouter(<LoginPage />)
    expect(screen.getByText('Operator Console')).toBeInTheDocument()
    expect(screen.getByText('RBBot')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('does not call login when API key is empty', async () => {
    renderWithRouter(<LoginPage />)
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled()
    })
  })

  it('calls login with API key when form is submitted', async () => {
    mockLogin.mockResolvedValueOnce(true)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'test-api-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-api-key')
    })
  })

  it('navigates to home on successful login', async () => {
    mockLogin.mockResolvedValueOnce(true)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'valid-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('shows error message on failed login', async () => {
    mockLogin.mockResolvedValueOnce(false)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'invalid-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText('Invalid API key. Check your key and try again.')).toBeInTheDocument()
    })
  })

  it('shows error on network failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'))
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'test-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText('Cannot connect to backend. Is the server running?')).toBeInTheDocument()
    })
  })

  it('shows loading state during login', async () => {
    let resolveLogin: ((value: boolean) => void) | null = null
    const loginPromise = new Promise<boolean>((resolve) => {
      resolveLogin = resolve
    })
    mockLogin.mockReturnValueOnce(loginPromise)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'test-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument()
    })
    await act(async () => { resolveLogin?.(true) })
  })

  it('trims whitespace from API key', async () => {
    mockLogin.mockResolvedValueOnce(true)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key') as HTMLInputElement
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: '  test-api-key  ' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-api-key')
    })
  })

  it('disables submit button while loading', async () => {
    let resolveLogin: ((value: boolean) => void) | null = null
    const loginPromise = new Promise<boolean>((resolve) => {
      resolveLogin = resolve
    })
    mockLogin.mockReturnValueOnce(loginPromise)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    fireEvent.change(input, { target: { value: 'test-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument()
    })
    const connectingButton = screen.getByRole('button', { name: /Connecting/i })
    expect(connectingButton).toBeDisabled()
    await act(async () => { resolveLogin?.(true) })
  })

  it('clears previous error on new submit', async () => {
    mockLogin
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    renderWithRouter(<LoginPage />)
    const input = screen.getByPlaceholderText('Enter your API key')
    const submitButton = screen.getByRole('button', { name: /Sign In/i })
    // First failed attempt
    fireEvent.change(input, { target: { value: 'bad-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText('Invalid API key. Check your key and try again.')).toBeInTheDocument()
    })
    // Second attempt
    fireEvent.change(input, { target: { value: 'good-key' } })
    fireEvent.click(submitButton)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })
})
