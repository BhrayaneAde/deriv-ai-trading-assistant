/**
 * Carte principale affichant le prix actuel, la tendance et les stats.
 */

import { useMarketStore } from '../store/marketStore'

const SYMBOL_LABELS: Record<string, string> = {
  R_50: 'Volatility 50 Index',
  R_100: 'Volatility 100 Index',
  R_75: 'Volatility 75 Index',
  R_25: 'Volatility 25 Index',
  R_10: 'Volatility 10 Index',
}

export function PriceCard() {
  const { currentTick, ticks, symbol, analysis } = useMarketStore()

  const trend = analysis?.trend
  const trendConfig = {
    up:      { color: 'text-green-400', icon: '▲' },
    down:    { color: 'text-red-400',   icon: '▼' },
    neutral: { color: 'text-yellow-400', icon: '◆' },
  }
  const tc = trendConfig[trend?.direction ?? 'neutral']

  // Variation depuis le premier tick de la session
  const variation = (() => {
    if (ticks.length < 2 || !currentTick) return null
    const first = ticks[0].price
    const diff = currentTick.price - first
    const pct = (diff / first) * 100
    return { diff, pct }
  })()

  const lastTimestamp = currentTick
    ? new Date(currentTick.timestamp * 1000).toLocaleTimeString('fr-FR')
    : '--'

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-lg">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-xl">
            {SYMBOL_LABELS[symbol] ?? symbol}
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Indice synthétique</p>
        </div>
        <span className="bg-blue-500/20 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-500/30">
          LIVE
        </span>
      </div>

      {/* Prix + variation */}
      <div className="flex items-end gap-4 my-4">
        <div>
          <p className="text-gray-400 text-sm mb-1">Prix actuel</p>
          <p className="text-white text-5xl font-mono font-bold tracking-tight">
            {currentTick ? currentTick.price.toFixed(2) : '----.--'}
          </p>
        </div>
        {variation && (
          <div className="mb-1">
            <p className={`font-mono font-semibold text-lg ${variation.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {variation.diff >= 0 ? '+' : ''}{variation.diff.toFixed(2)}
            </p>
            <p className={`font-mono text-sm ${variation.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {variation.diff >= 0 ? '+' : ''}{variation.pct.toFixed(3)}%
            </p>
          </div>
        )}
      </div>

      {/* Stats bas */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
        <div>
          <p className="text-gray-400 text-xs mb-1">Tendance</p>
          <p className={`font-semibold ${tc.color}`}>
            {tc.icon} {trend?.label ?? 'Neutre'}
            {trend?.strength ? ` — ${trend.strength}%` : ''}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs mb-1">Dernier tick</p>
          <p className="text-gray-300 font-mono text-sm">{lastTimestamp}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs mb-1">Ticks reçus</p>
          <p className="text-white font-bold text-lg">{ticks.length}</p>
        </div>
      </div>
    </div>
  )
}
