/**
 * Graphique SVG temps réel avec niveaux Bollinger, Support et Résistance.
 */

import { useMemo } from 'react'
import { useMarketStore } from '../store/marketStore'

interface Props {
  height?: number
  pointsCount?: number
}

export function MiniChart({ height = 180, pointsCount = 100 }: Props) {
  const { ticks, analysis } = useMarketStore()
  const width = 800

  const chartData = useMemo(() => {
    if (ticks.length < 2) return null

    const data = ticks.slice(-pointsCount)
    const prices = data.map((t) => t.price)

    const ind = analysis?.indicators
    const allValues = [...prices]
    if (ind?.bb_upper) allValues.push(ind.bb_upper)
    if (ind?.bb_lower) allValues.push(ind.bb_lower)
    if (ind?.support) allValues.push(ind.support)
    if (ind?.resistance) allValues.push(ind.resistance)

    const min = Math.min(...allValues) * 0.9995
    const max = Math.max(...allValues) * 1.0005
    const range = max - min || 1

    const pad = 12
    const chartW = width - pad * 2
    const chartH = height - pad * 2

    const toX = (i: number) => pad + (i / (data.length - 1)) * chartW
    const toY = (p: number) => pad + ((max - p) / range) * chartH

    const pricePath = data.map((t, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)},${toY(t.price)}`).join(' ')
    const isUp = prices[prices.length - 1] >= prices[0]

    // Lignes horizontales Bollinger / Support / Résistance
    const hLines = []
    if (ind?.bb_upper != null) hLines.push({ y: toY(ind.bb_upper), color: '#f87171', dash: '4,3', label: `BB↑ ${ind.bb_upper.toFixed(2)}` })
    if (ind?.bb_lower != null) hLines.push({ y: toY(ind.bb_lower), color: '#4ade80', dash: '4,3', label: `BB↓ ${ind.bb_lower.toFixed(2)}` })
    if (ind?.resistance != null) hLines.push({ y: toY(ind.resistance), color: '#fb923c', dash: '6,3', label: `R ${ind.resistance.toFixed(2)}` })
    if (ind?.support != null) hLines.push({ y: toY(ind.support), color: '#60a5fa', dash: '6,3', label: `S ${ind.support.toFixed(2)}` })

    return { pricePath, isUp, hLines, minPrice: min, maxPrice: max, toX, toY }
  }, [ticks, analysis, height, pointsCount, width])

  if (!chartData) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 text-sm">En attente des données...</p>
      </div>
    )
  }

  const { pricePath, isUp, hLines, minPrice, maxPrice } = chartData
  const lineColor = isUp ? '#4ade80' : '#f87171'

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-gray-400 text-xs font-medium">
          Graphique temps réel ({Math.min(ticks.length, pointsCount)} ticks)
        </span>
        <span className="text-gray-400 text-xs font-mono">
          <span className="text-gray-500">H: </span><span className="text-white">{maxPrice.toFixed(2)}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-500">B: </span><span className="text-white">{minPrice.toFixed(2)}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        aria-label="Graphique prix temps réel"
        role="img"
      >
        {/* Grille */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1="12" x2={width - 12}
            y1={12 + r * (height - 24)} y2={12 + r * (height - 24)}
            stroke="#374151" strokeWidth="1" strokeDasharray="3,5" />
        ))}

        {/* Niveaux horizontaux */}
        {hLines.map((l, i) => (
          <g key={i}>
            <line x1="12" x2={width - 12} y1={l.y} y2={l.y}
              stroke={l.color} strokeWidth="1" strokeDasharray={l.dash} opacity="0.7" />
            <text x={width - 14} y={l.y - 3} textAnchor="end"
              fill={l.color} fontSize="9" opacity="0.9">{l.label}</text>
          </g>
        ))}

        {/* Zone sous la courbe */}
        <path d={`${pricePath} L ${width - 12},${height - 12} L 12,${height - 12} Z`}
          fill={lineColor} fillOpacity="0.07" />

        {/* Courbe principale */}
        <path d={pricePath} fill="none" stroke={lineColor}
          strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  )
}
