import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore, type Analysis } from '../store/marketStore'

const WS_URL = 'ws://localhost:8000/market/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setTick, setConnected, setError } = useMarketStore()

  const connect = useCallback(() => {
    if (ws.current) ws.current.close()
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen  = () => { setConnected(true); setError(null) }
    socket.onclose = () => { setConnected(false); timer.current = setTimeout(connect, RECONNECT_DELAY) }
    socket.onerror = () => setError('Connexion impossible')
    socket.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type === 'tick') setTick(
          { symbol: d.symbol, price: d.price, timestamp: d.timestamp },
          d.analysis as Analysis | undefined
        )
      } catch {}
    }
  }, [setTick, setConnected, setError])

  useEffect(() => {
    connect()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      ws.current?.close()
    }
  }, [connect])
}
