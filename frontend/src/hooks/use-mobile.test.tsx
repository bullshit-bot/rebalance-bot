import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  let listeners: Record<string, Function[]>

  beforeEach(() => {
    listeners = { change: [] }
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: (_event: string, fn: Function) => { listeners.change.push(fn) },
        removeEventListener: (_event: string, fn: Function) => {
          listeners.change = listeners.change.filter(l => l !== fn)
        },
      })),
    })
  })

  it('returns false for desktop width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('responds to resize events', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 500 })
      listeners.change.forEach(fn => fn())
    })
    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile())
    expect(listeners.change.length).toBe(1)
    unmount()
    expect(listeners.change.length).toBe(0)
  })
})
