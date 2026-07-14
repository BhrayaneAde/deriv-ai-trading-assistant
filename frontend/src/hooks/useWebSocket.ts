/**
 * Hook WebSocket — reçoit ticks, analyse, bougies OHLC, mises à jour bougies.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useMarketStore, type Analysis, type Timeframe, type OHLCCandle } from '../store/marketStore'

const WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8000/market/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    setTick, setConnected, setError,
    setCandlesSnapshot, updateCandle,
  } = useMarketStore()

  const connect = useCallback(() => {
    if (ws.current) ws.current.close()
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => { setConnected(true); setError(null) }
    socket.onclose = () => {
      setConnected(false)
      timer.current = setTimeout(connect, RECONNECT_DELAY)
    }
    socket.onerror = () => setError('Connexion impossible')

    socket.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)

        switch (d.type) {
          // Tick + analyse
          case 'tick':
            setTick(
              { symbol: d.symbol, price: d.price, timestamp: d.timestamp },
              d.analysis as Analysis | undefined
            )
            break

          // Snapshot initial de toutes les bougies (envoyé à la connexion)
          case 'candles_snapshot':
            setCandlesSnapshot(d.data as Record<string, OHLCCandle[]>)
            break

          // Mise à jour d'une bougie en cours (chaque tick)
          case 'candle_update':
            updateCandle(d.timeframe as Timeframe, d.candle as OHLCCandle)
            break
        }
      } catch (err) {
        console.error('[WS] Parsing error:', err)
      }
    }
  }, [setTick, setConnected, setError, setCandlesSnapshot, updateCandle])

  useEffect(() => {
    connect()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      ws.current?.close()
    }
  }, [connect])
}
