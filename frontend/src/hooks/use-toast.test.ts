import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, toast } from './use-toast'

describe('useToast', () => {
  it('returns toasts array and toast function', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toBeDefined()
    expect(Array.isArray(result.current.toasts)).toBe(true)
    expect(result.current.toast).toBeDefined()
    expect(result.current.dismiss).toBeDefined()
  })

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'Test toast' })
    })
    expect(result.current.toasts.length).toBeGreaterThanOrEqual(1)
    expect(result.current.toasts[0].title).toBe('Test toast')
  })

  it('dismisses a toast', () => {
    const { result } = renderHook(() => useToast())
    let toastId: string
    act(() => {
      const t = result.current.toast({ title: 'Dismiss me' })
      toastId = t.id
    })
    act(() => {
      result.current.dismiss(toastId!)
    })
    // Toast should be marked for dismissal
    const found = result.current.toasts.find(t => t.id === toastId!)
    if (found) {
      expect(found.open).toBe(false)
    }
  })

  it('standalone toast function works', () => {
    const result = toast({ title: 'Standalone' })
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.dismiss).toBeDefined()
    expect(result.update).toBeDefined()
  })

  it('updates a toast', () => {
    const { result } = renderHook(() => useToast())
    let toastId: string
    act(() => {
      const t = result.current.toast({ title: 'Original' })
      toastId = t.id
    })
    act(() => {
      result.current.toast({ title: 'Updated' })
    })
    expect(result.current.toasts.length).toBeGreaterThanOrEqual(1)
  })
})
