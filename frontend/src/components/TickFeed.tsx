/**
 * Liste défilante des derniers ticks reçus.
 */

import { useMarketStore } from '../store/marketStore'

export function TickFeed() {
  const { ticks } = useMarketStore()

  const recent = [...ticks].reverse().slice(0, 12)

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
      <h3 className="text-gray-300 font-semibold text-sm mb-3">Flux de prix</h3>

      {recent.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          En attente des ticks...
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {recent.map((tick, i) => {
            const prev = recent[i + 1]
            const isUp = prev ? tick.price >= prev.price : true
            const time = new Date(tick.timestamp * 1000).toLocaleTimeString('fr-FR')

            return (
              <div
                key={tick.timestamp}
                className={`flex justify-between items-center py-1.5 px-3 rounded-lg text-sm ${
                  i === 0 ? 'bg-gray-700/80' : 'bg-gray-700/30'
                }`}
              >
                <span className="text-gray-400 font-mono text-xs">{time}</span>
                <span
                  className={`font-mono font-semibold ${
                    isUp ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {isUp ? '▲' : '▼'} {tick.price.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
