import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavLink } from './NavLink'

describe('NavLink', () => {
  it('renders link with text', () => {
    render(
      <MemoryRouter>
        <NavLink to="/test">Test Link</NavLink>
      </MemoryRouter>
    )
    expect(screen.getByText('Test Link')).toBeInTheDocument()
  })

  it('renders as anchor element', () => {
    render(
      <MemoryRouter>
        <NavLink to="/foo">Foo</NavLink>
      </MemoryRouter>
    )
    const link = screen.getByText('Foo')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/foo')
  })

  it('applies className', () => {
    render(
      <MemoryRouter>
        <NavLink to="/x" className="my-class">X</NavLink>
      </MemoryRouter>
    )
    expect(screen.getByText('X')).toHaveClass('my-class')
  })

  it('applies activeClassName when route is active', () => {
    render(
      <MemoryRouter initialEntries={['/active']}>
        <NavLink to="/active" activeClassName="is-active">Active</NavLink>
      </MemoryRouter>
    )
    expect(screen.getByText('Active')).toHaveClass('is-active')
  })

  it('does not apply activeClassName when route is not active', () => {
    render(
      <MemoryRouter initialEntries={['/other']}>
        <NavLink to="/active" activeClassName="is-active">Inactive</NavLink>
      </MemoryRouter>
    )
    expect(screen.getByText('Inactive')).not.toHaveClass('is-active')
  })
})
