// WebSocket hook with auto-reconnect logic
// Connects to backend WS server using stored API key for auth

import { useEffect, useRef, useCallback, useState } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'

type WSMessageType =
  | 'prices'
  | 'portfolio'
  | 'rebalance:started'
  | 'rebalance:completed'
  | 'trade:executed'
  | 'alert'
  | 'exchange:status'
  | 'trailing-stop:triggered'

interface WSMessage {
  type: WSMessageType
  data: unknown
}

interface UseWebSocketReturn {
  connected: boolean
}

export function useWebSocket(onMessage?: (msg: WSMessage) => void): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    // Avoid opening a second socket if one is already open/connecting
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return

    const apiKey = localStorage.getItem('apiKey') || ''
    const ws = new WebSocket(`${WS_URL}?apiKey=${apiKey}`)

    ws.onopen = () => setConnected(true)

    ws.onclose = () => {
      setConnected(false)
      // Schedule reconnect — cleared on unmount
      reconnectTimerRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string)
        onMessage?.(msg)
      } catch {
        // Ignore malformed frames
      }
    }

    wsRef.current = ws
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => {
      // Clean up timer and socket on unmount
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
