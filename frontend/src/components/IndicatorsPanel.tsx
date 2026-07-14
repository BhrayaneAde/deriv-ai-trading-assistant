/**
 * Panneau des indicateurs techniques.
 * Affiche EMA, RSI, MACD, Bollinger Bands et Supports/Résistances.
 */

import { useMarketStore } from '../store/marketStore'

function IndicatorRow({
  label,
  value,
  unit = '',
  color,
  badge,
}: {
  label: string
  value: number | null | undefined
  unit?: string
  color?: string
  badge?: string
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700/60 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      {value !== null && value !== undefined ? (
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${badge}`}>
              {badge.includes('green') ? '▲' : badge.includes('red') ? '▼' : '◆'}
            </span>
          )}
          <span className={`font-mono text-sm font-semibold ${color ?? 'text-white'}`}>
            {value.toFixed(4)}{unit}
          </span>
        </div>
      ) : (
        <span className="text-gray-600 text-xs bg-gray-700/50 px-2 py-0.5 rounded">
          En attente...
        </span>
      )}
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mt-4 mb-1 first:mt-0">
      {title}
    </p>
  )
}

export function IndicatorsPanel() {
  const { analysis, currentTick } = useMarketStore()
  const ind = analysis?.indicators

  // Couleur RSI
  const rsiColor =
    ind?.rsi14 == null ? undefined
    : ind.rsi14 > 70 ? 'text-red-400'
    : ind.rsi14 < 30 ? 'text-green-400'
    : 'text-white'

  // Couleur MACD
  const macdColor =
    ind?.macd_line == null ? undefined
    : ind.macd_line > 0 ? 'text-green-400'
    : 'text-red-400'

  // Couleur prix vs Bollinger
  void (() => {
    if (!ind?.bb_upper || !ind?.bb_lower || !currentTick) return null
    if (currentTick.price >= ind.bb_upper) return 'text-red-400'
    if (currentTick.price <= ind.bb_lower) return 'text-green-400'
    return 'text-white'
  })()

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 h-full">
      <h3 className="text-gray-300 font-semibold text-sm mb-3">
        Indicateurs techniques
      </h3>

      {/* EMA */}
      <SectionTitle title="Moyennes mobiles (EMA)" />
      <IndicatorRow
        label="EMA 20"
        value={ind?.ema20}
        color={
          ind?.ema20 && ind?.ema50
            ? ind.ema20 > ind.ema50 ? 'text-green-400' : 'text-red-400'
            : undefined
        }
      />
      <IndicatorRow
        label="EMA 50"
        value={ind?.ema50}
      />
      <IndicatorRow
        label="EMA 100"
        value={ind?.ema100}
      />
      <IndicatorRow
        label="EMA 200"
        value={ind?.ema200}
      />

      {/* Momentum */}
      <SectionTitle title="Momentum" />
      <IndicatorRow
        label="RSI (14)"
        value={ind?.rsi14}
        color={rsiColor}
      />
      <IndicatorRow
        label="MACD"
        value={ind?.macd_line}
        color={macdColor}
      />
      <IndicatorRow
        label="MACD Signal"
        value={ind?.macd_signal}
      />
      <IndicatorRow
        label="MACD Histogramme"
        value={ind?.macd_histogram}
        color={
          ind?.macd_histogram == null ? undefined
          : ind.macd_histogram > 0 ? 'text-green-400'
          : 'text-red-400'
        }
      />

      {/* Bollinger */}
      <SectionTitle title="Bandes de Bollinger (20)" />
      <IndicatorRow label="Haute" value={ind?.bb_upper} color="text-red-300" />
      <IndicatorRow label="Médiane" value={ind?.bb_middle} />
      <IndicatorRow label="Basse" value={ind?.bb_lower} color="text-green-300" />

      {/* Support / Résistance */}
      <SectionTitle title="Support / Résistance" />
      <IndicatorRow label="Support" value={ind?.support} color="text-green-400" />
      <IndicatorRow label="Résistance" value={ind?.resistance} color="text-red-400" />
    </div>
  )
}
