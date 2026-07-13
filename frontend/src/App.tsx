/**
 * Dashboard — Flux professionnel complet
 * Données → Contexte → MTF → Confirmation → Signal → Surveillance → Invalidation
 */
import { useWebSocket } from './hooks/useWebSocket'
import { useMarketStore } from './store/marketStore'
import { ConnectionStatus } from './components/ConnectionStatus'
import { PriceCard } from './components/PriceCard'
import { MiniChart } from './components/MiniChart'
import { TickFeed } from './components/TickFeed'
import { SignalCard } from './components/SignalCard'
import { MTFPanel } from './components/MTFPanel'
import { CapitalSettings } from './components/CapitalSettings'
import { AssetSelector } from './components/AssetSelector'
import { PositionCard } from './components/PositionCard'
import { PendingOrdersCard } from './components/PendingOrdersCard'
import { StrategiesPanel } from './components/StrategiesPanel'
import { MarketContextCard } from './components/MarketContextCard'
import { ConfirmationCard } from './components/ConfirmationCard'

const FLUX_STEPS = [
  { n: 1, label: 'Contexte' },
  { n: 2, label: 'Analyse MTF' },
  { n: 3, label: 'Stratégies' },
  { n: 4, label: 'Confirmation' },
  { n: 5, label: 'Signal' },
  { n: 6, label: 'Surveillance' },
]

function FluxIndicator({ currentSignal }: { currentSignal: string }) {
  const activeStep =
    currentSignal === 'WAIT'    ? 1 :
    currentSignal === 'NEUTRAL' ? 2 :
    currentSignal === 'BUY' || currentSignal === 'SELL' ? 5 : 2

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {FLUX_STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center gap-1">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
            step.n === activeStep
              ? 'bg-blue-600 text-white'
              : step.n < activeStep
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-700 text-gray-500'
          }`}>
            <span>{step.n}</span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < FLUX_STEPS.length - 1 && (
            <span className={`text-xs ${step.n < activeStep ? 'text-green-600' : 'text-gray-700'}`}>›</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  useWebSocket()
  const { setCurrentSymbol, currentSymbol, analysis } = useMarketStore()

  const sigType = analysis?.signal.type ?? 'WAIT'
  const signalWeak = !analysis || sigType === 'NEUTRAL' || sigType === 'WAIT' || analysis.signal.confidence < 70
  const isInvalidated = (analysis as any)?.invalidation?.invalidated ?? false

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">D</div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Deriv AI Trading Assistant</h1>
              <p className="text-gray-500 text-xs">{currentSymbol} · MTF 1min/5min/15min/1h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FluxIndicator currentSignal={sigType} />
            <ConnectionStatus />
          </div>
        </div>
      </header>

      {/* Alerte invalidation */}
      {isInvalidated && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-semibold animate-pulse">
          🚨 Signal invalidé — conditions cassées. Ne pas entrer.
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-5 space-y-5">

        {/* Actif + Capital */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AssetSelector onSelect={setCurrentSymbol} />
          <CapitalSettings />
        </div>

        {/* Prix + Signal */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3"><PriceCard /></div>
          <div className="lg:col-span-2"><SignalCard /></div>
        </div>

        {/* Graphique */}
        <MiniChart height={170} />

        {/* FLUX : Contexte + Confirmation côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MarketContextCard />
          <ConfirmationCard />
        </div>

        {/* Ordres en attente */}
        {signalWeak && <PendingOrdersCard />}

        {/* Stratégies + Position */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <StrategiesPanel />
          <PositionCard />
        </div>

        {/* MTF + Flux de ticks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MTFPanel />
          <TickFeed />
        </div>

      </main>

      <footer className="text-center py-3 text-gray-700 text-xs border-t border-gray-800 mt-4">
        Flux : Contexte → MTF → Stratégies → Confirmation → Signal → Surveillance · Indicatif uniquement
      </footer>
    </div>
  )
}
