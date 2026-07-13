/**
 * Store Zustand — données marché + analyse MTF + settings utilisateur.
 */
import { create } from 'zustand'

export interface Tick {
  symbol: string
  price: number
  timestamp: number
}

export interface TFIndicators {
  ema20: number | null
  ema50: number | null
  rsi14: number | null
  macd_line: number | null
  macd_signal: number | null
  macd_histogram: number | null
  bb_upper: number | null
  bb_middle: number | null
  bb_lower: number | null
  support: number | null
  resistance: number | null
  atr: number | null
}

export interface TFAnalysis {
  label: string
  granularity: number
  candle_count: number
  indicators: TFIndicators
  trend: { direction: string; label: string; strength: number }
  volatility: { regime: string; label: string; atr_pct: number | null }
  signal: { direction: number; reasons: string[]; confidence: number }
}

export interface MTFData {
  bull: number
  bear: number
  neutral: number
  alignment: number
}

export interface Signal {
  type: 'BUY' | 'SELL' | 'NEUTRAL' | 'WAIT'
  label: string
  confidence: number
  reasons: string[]
  advice: string
  why: string
}

export interface Stake {
  amount: number
  pct_of_capital: number
  reason: string
  enter_now: boolean
}

export interface PositionPlan {
  entry_price: number
  direction: string
  take_profit: number
  stop_loss: number
  tp_pips: number
  sl_pips: number
  risk_reward: number
  lot_size: number
  nb_lots: number
  total_stake: number
  potential_gain: number
  potential_loss: number
  duration: { min_minutes: number; max_minutes: number; label: string }
  repeat: { max_repeats: number; advice: string }
  exit_message: string
  warning: string
}

export interface PendingOrder {
  direction: string
  target_price: number
  current_price: number
  distance_pct: number
  distance_abs: number
  estimated_confidence: number
  level_type: string
  level_label: string
  rationale: string
  proximity_alert: boolean
  conditions_at_target: string[]
}

export interface Analysis {
  price: number
  timestamp: number
  symbol: string
  timeframes: Record<string, TFAnalysis>
  mtf: MTFData
  volatility: { regime: string; label: string }
  signal: Signal
  signal_stability: {
    locked: boolean
    remaining_seconds: number
    remaining_label: string
    tick_count: number
  }
  stake: Stake
  position: PositionPlan | null
  pending_orders: PendingOrder[]
  strategies: unknown | null
}

interface MarketState {
  currentTick: Tick | null
  ticks: Tick[]
  analysis: Analysis | null
  isConnected: boolean
  error: string | null
  baseAmount: number
  currentSymbol: string

  setTick: (tick: Tick, analysis?: Analysis) => void
  setConnected: (v: boolean) => void
  setError: (e: string | null) => void
  setBaseAmount: (v: number) => void
  setCurrentSymbol: (s: string) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  currentTick: null,
  ticks: [],
  analysis: null,
  isConnected: false,
  error: null,
  baseAmount: 100,
  currentSymbol: 'R_50',

  setTick: (tick, analysis) =>
    set((state) => ({
      currentTick: tick,
      ticks: [...state.ticks.slice(-299), tick],
      analysis: analysis ?? state.analysis,
    })),
  setConnected: (v) => set({ isConnected: v }),
  setError: (e) => set({ error: e }),
  setBaseAmount: (v) => set({ baseAmount: v }),
  setCurrentSymbol: (s) => set({ currentSymbol: s, ticks: [], analysis: null }),
}))
