import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import NotFound from './NotFound'

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('NotFound', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    return () => {
      consoleErrorSpy.mockRestore()
    }
  })

  it('renders 404 heading', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders oops message', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('Oops! Page not found')).toBeInTheDocument()
  })

  it('renders return to home link', () => {
    renderWithRouter(<NotFound />)
    const link = screen.getByRole('link', { name: 'Return to Home' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('logs error when rendered', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithRouter(<NotFound />)
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('logs correct error message with pathname', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithRouter(<NotFound />)
    expect(consoleErrorSpy).toHaveBeenCalled()
    const call = consoleErrorSpy.mock.calls[0]
    expect(String(call[0])).toContain('404 Error')
    consoleErrorSpy.mockRestore()
  })

  it('has correct styling classes', () => {
    renderWithRouter(<NotFound />)
    const container = screen.getByText('404').parentElement?.parentElement
    expect(container).toHaveClass('flex', 'min-h-screen', 'items-center', 'justify-center', 'bg-muted')
  })

  it('heading has correct styling', () => {
    renderWithRouter(<NotFound />)
    const heading = screen.getByText('404')
    expect(heading).toHaveClass('mb-4', 'text-4xl', 'font-bold')
  })

  it('message has correct styling', () => {
    renderWithRouter(<NotFound />)
    const message = screen.getByText('Oops! Page not found')
    expect(message).toHaveClass('mb-4', 'text-xl', 'text-muted-foreground')
  })

  it('link has correct styling', () => {
    renderWithRouter(<NotFound />)
    const link = screen.getByRole('link', { name: 'Return to Home' })
    expect(link).toHaveClass('text-primary', 'underline', 'hover:text-primary/90')
  })

  it('renders text center alignment', () => {
    renderWithRouter(<NotFound />)
    const textCenter = screen.getByText('404').parentElement
    expect(textCenter).toHaveClass('text-center')
  })

  it('does not render any buttons', () => {
    renderWithRouter(<NotFound />)
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('does not render any forms', () => {
    renderWithRouter(<NotFound />)
    const forms = screen.queryAllByRole('form')
    expect(forms).toHaveLength(0)
  })

  it('renders exactly one link', () => {
    renderWithRouter(<NotFound />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
  })
})
