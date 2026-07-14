/**
 * Sélecteur d'actif — Volatility, Boom, Crash, Step.
 */
import { useState } from 'react'
import { useMarketStore } from '../store/marketStore'

const ASSETS = {
  volatility: [
    { symbol: 'R_10',    label: 'V10',   desc: 'Volatilité 10%' },
    { symbol: 'R_25',    label: 'V25',   desc: 'Volatilité 25%' },
    { symbol: 'R_50',    label: 'V50',   desc: 'Volatilité 50%' },
    { symbol: 'R_75',    label: 'V75',   desc: 'Volatilité 75%' },
    { symbol: 'R_100',   label: 'V100',  desc: 'Volatilité 100%' },
    { symbol: '1HZ10V',  label: 'V10(1s)',  desc: '1 seconde' },
    { symbol: '1HZ100V', label: 'V100(1s)', desc: '1 seconde' },
  ],
  boom: [
    { symbol: 'BOOM300N',  label: 'Boom 300',  desc: '~1 spike / 300 ticks' },
    { symbol: 'BOOM500',   label: 'Boom 500',  desc: '~1 spike / 500 ticks' },
    { symbol: 'BOOM1000',  label: 'Boom 1000', desc: '~1 spike / 1000 ticks' },
  ],
  crash: [
    { symbol: 'CRASH300N',  label: 'Crash 300',  desc: '~1 spike / 300 ticks' },
    { symbol: 'CRASH500',   label: 'Crash 500',  desc: '~1 spike / 500 ticks' },
    { symbol: 'CRASH1000',  label: 'Crash 1000', desc: '~1 spike / 1000 ticks' },
  ],
  step: [
    { symbol: 'stpRNG', label: 'Step Index', desc: 'Mouvements réguliers' },
  ],
}

const FAMILY_CONFIG = {
  volatility: { label: 'Volatility', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  boom:       { label: 'Boom',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  crash:      { label: 'Crash',      color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  step:       { label: 'Step',       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
}

interface Props {
  onSelect: (symbol: string) => void
}

export function AssetSelector({ onSelect }: Props) {
  const { currentSymbol } = useMarketStore()
  const [loading, setLoading] = useState<string | null>(null)

  const handleSelect = async (symbol: string) => {
    if (symbol === currentSymbol) return
    setLoading(symbol)
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/settings/symbol?symbol=${symbol}`, { method: 'POST' })
      onSelect(symbol)
    } catch {
      onSelect(symbol) // mise à jour locale même si backend indisponible
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <h3 className="text-gray-300 font-semibold text-sm mb-4">Choisir l'actif</h3>

      <div className="space-y-4">
        {(Object.entries(ASSETS) as [keyof typeof ASSETS, typeof ASSETS.volatility][]).map(([family, items]) => {
          const cfg = FAMILY_CONFIG[family]
          return (
            <div key={family}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${cfg.color}`}>
                {cfg.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map(({ symbol, label, desc }) => {
                  const isActive = symbol === currentSymbol
                  const isLoading = loading === symbol
                  return (
                    <button
                      key={symbol}
                      onClick={() => handleSelect(symbol)}
                      disabled={isLoading}
                      aria-pressed={isActive}
                      title={desc}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isActive
                          ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-1 ring-offset-1 ring-offset-gray-800 ${cfg.border.replace('border-', 'ring-')}`
                          : 'bg-gray-700/50 text-gray-400 border-gray-600 hover:bg-gray-700 hover:text-white'
                      } ${isLoading ? 'opacity-60 cursor-wait' : ''}`}
                    >
                      {isLoading ? '...' : label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Avertissement Boom/Crash */}
      {currentSymbol && (currentSymbol.includes('BOOM') || currentSymbol.includes('CRASH')) && (
        <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <p className="text-orange-300 text-xs font-semibold">
            {currentSymbol.includes('BOOM')
              ? '⚡ Boom Index : spikes haussiers imprévisibles. Stratégie BUY recommandée uniquement.'
              : '⚡ Crash Index : spikes baissiers imprévisibles. Stratégie SELL recommandée uniquement.'}
          </p>
          <p className="text-orange-400/70 text-xs mt-1">
            Gain ou perte en quelques secondes. Ne jamais risquer plus de 1-2% du capital.
          </p>
        </div>
      )}
    </div>
  )
}
