/**
 * Tableau d'analyse multi-timeframe.
 * Affiche le signal directionnel de chaque TF avec ses indicateurs clés.
 */
import { useMarketStore } from '../store/marketStore'

const TF_ORDER = ['1h', '15min', '5min', '1min']

function DirBadge({ dir }: { dir: number }) {
  if (dir === 1)  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400">▲ Haussier</span>
  if (dir === -1) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">▼ Baissier</span>
  return               <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-700 text-gray-400">◆ Neutre</span>
}

function RegimeBadge({ regime }: { regime: string }) {
  if (regime === 'unstable') return <span className="text-xs text-red-400 font-semibold">⚠ Instable</span>
  if (regime === 'calm')     return <span className="text-xs text-green-400">✓ Calme</span>
  return                            <span className="text-xs text-yellow-400">~ Normal</span>
}

export function MTFPanel() {
  const { analysis } = useMarketStore()

  if (!analysis) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-3">Analyse Multi-Timeframe</h3>
        <p className="text-gray-500 text-sm text-center py-6">Chargement des bougies...</p>
      </div>
    )
  }

  const tfs = analysis.timeframes
  const mtf = analysis.mtf

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-300 font-semibold text-sm">Analyse Multi-Timeframe</h3>
        {/* Compteur d'alignement */}
        <div className="flex gap-2 text-xs">
          <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">
            ▲ {mtf.bull}
          </span>
          <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">
            ▼ {mtf.bear}
          </span>
          <span className="bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
            ◆ {mtf.neutral}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {TF_ORDER.map((lbl) => {
          const tf = tfs[lbl]
          if (!tf) return (
            <div key={lbl} className="flex items-center justify-between py-2 px-3 bg-gray-700/30 rounded-lg opacity-40">
              <span className="text-gray-400 font-semibold text-sm w-12">{lbl}</span>
              <span className="text-gray-600 text-xs">En attente ({lbl === '1h' ? '≥10 bougies' : '≥10 bougies'})</span>
            </div>
          )

          const ind = tf.indicators
          return (
            <div key={lbl} className={`rounded-lg px-3 py-2.5 border ${
              tf.signal.direction === 1  ? 'border-green-500/20 bg-green-500/5' :
              tf.signal.direction === -1 ? 'border-red-500/20 bg-red-500/5' :
              'border-gray-700 bg-gray-700/30'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white font-bold text-sm w-12">{lbl}</span>
                <DirBadge dir={tf.signal.direction} />
                <span className="text-gray-400 text-xs">{tf.candle_count} bougies</span>
                <RegimeBadge regime={tf.volatility.regime} />
                <span className="text-gray-500 text-xs">{tf.signal.confidence}%</span>
              </div>

              {/* Indicateurs clés en ligne */}
              <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
                {ind.ema20 && ind.ema50 && (
                  <span>
                    EMA{' '}
                    <span className={ind.ema20 > ind.ema50 ? 'text-green-400' : 'text-red-400'}>
                      {ind.ema20 > ind.ema50 ? '20>50' : '20<50'}
                    </span>
                  </span>
                )}
                {ind.rsi14 && (
                  <span>
                    RSI{' '}
                    <span className={ind.rsi14 > 70 ? 'text-red-400' : ind.rsi14 < 30 ? 'text-green-400' : 'text-white'}>
                      {ind.rsi14.toFixed(1)}
                    </span>
                  </span>
                )}
                {ind.macd_line && (
                  <span>
                    MACD{' '}
                    <span className={ind.macd_line > 0 ? 'text-green-400' : 'text-red-400'}>
                      {ind.macd_line.toFixed(3)}
                    </span>
                  </span>
                )}
                {tf.volatility.atr_pct && (
                  <span>ATR <span className="text-white">{tf.volatility.atr_pct.toFixed(3)}%</span></span>
                )}
              </div>

              {/* Raisons (1ère seulement) */}
              {tf.signal.reasons.length > 0 && (
                <p className="text-gray-500 text-xs mt-1 truncate">
                  {tf.signal.reasons[0]}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
