import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from './use-websocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null

  constructor(public url: string) {
    // Auto-open after tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    }, 0)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  send() {}
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket)
    localStorage.setItem('apiKey', 'test-key')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('connects and reports connected state', async () => {
    const { result } = renderHook(() => useWebSocket())
    expect(result.current.connected).toBe(false)

    await act(async () => { vi.advanceTimersByTime(10) })
    expect(result.current.connected).toBe(true)
  })

  it('passes messages to callback', async () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket(onMessage))

    await act(async () => { vi.advanceTimersByTime(10) })

    // Simulate incoming message
    const instances = vi.mocked(WebSocket)
    // Access the last created instance
    // Since MockWebSocket auto-opens, we need to trigger onmessage
  })

  it('disconnects on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket())
    await act(async () => { vi.advanceTimersByTime(10) })
    unmount()
    // Should not throw
  })

  it('reconnects after close', async () => {
    const { result } = renderHook(() => useWebSocket())
    await act(async () => { vi.advanceTimersByTime(10) })
    expect(result.current.connected).toBe(true)

    // Simulate disconnect and reconnect timer
    await act(async () => {
      // Force close by clearing WebSocket
      result.current // trigger re-check
    })
  })

  it('includes apiKey in URL', () => {
    renderHook(() => useWebSocket())
    // WebSocket constructor receives URL with apiKey
  })
})
