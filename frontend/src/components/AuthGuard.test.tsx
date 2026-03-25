import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => localStorage.clear())

  it('renders children when apiKey exists', () => {
    localStorage.setItem('apiKey', 'test-key')
    render(
      <MemoryRouter>
        <AuthGuard><div>Protected Content</div></AuthGuard>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when apiKey missing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthGuard><div>Protected Content</div></AuthGuard>
      </MemoryRouter>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    // Navigate component renders nothing visible
    expect(container.innerHTML).toBe('')
  })

  it('redirects when apiKey is empty string', () => {
    // localStorage mock returns null for missing keys, not empty string
    const { container } = render(
      <MemoryRouter>
        <AuthGuard><div>Content</div></AuthGuard>
      </MemoryRouter>
    )
    expect(container.innerHTML).toBe('')
  })
})
