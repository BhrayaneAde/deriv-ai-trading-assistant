/**
 * Carte "Ordres en attente" — prix cibles avec ≥70% confiance.
 * Affiché quand le signal actuel est incertain ou < 70%.
 */
import { useMarketStore, type PendingOrder } from '../store/marketStore'

const LEVEL_ICONS: Record<string, string> = {
  support:    '🟢',
  resistance: '🔴',
  fibonacci:  '🌀',
  bb:         '📊',
  ema:        '📈',
}

const DIR_CONFIG = {
  BUY:  { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/25', icon: '▲' },
  SELL: { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/25',   icon: '▼' },
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-gray-600'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold ${value >= 70 ? 'text-white' : 'text-gray-500'}`}>
        {value}%
      </span>
    </div>
  )
}

function OrderRow({ order }: { order: PendingOrder }) {
  const dir = DIR_CONFIG[order.direction as keyof typeof DIR_CONFIG] ?? DIR_CONFIG.BUY
  const icon = LEVEL_ICONS[order.level_type] ?? '📍'

  return (
    <div className={`rounded-xl border p-4 ${
      order.proximity_alert
        ? 'border-yellow-500/50 bg-yellow-500/5 ring-1 ring-yellow-500/20'
        : `${dir.border} ${dir.bg}`
    }`}>

      {/* En-tête */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-white text-sm font-semibold">{order.level_label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${dir.bg} ${dir.color} border ${dir.border}`}>
            {dir.icon} {order.direction}
          </span>
        </div>
        {order.proximity_alert && (
          <span className="text-yellow-400 text-xs font-bold animate-pulse">
            🔔 PROCHE
          </span>
        )}
      </div>

      {/* Prix cible */}
      <div className="flex items-end gap-3 mb-2">
        <div>
          <p className="text-gray-400 text-xs">Prix cible</p>
          <p className={`text-2xl font-mono font-bold ${dir.color}`}>
            {order.target_price.toFixed(2)}
          </p>
        </div>
        <div className="mb-1">
          <p className="text-gray-500 text-xs">Distance</p>
          <p className="text-gray-300 text-sm font-mono">
            {order.direction === 'BUY' ? '↓' : '↑'} {order.distance_pct.toFixed(3)}%
            <span className="text-gray-500 ml-1">({order.distance_abs.toFixed(2)})</span>
          </p>
        </div>
      </div>

      {/* Barre de confiance */}
      <div className="mb-3">
        <p className="text-gray-400 text-xs mb-1">Confiance estimée à ce niveau</p>
        <ConfidenceBar value={order.estimated_confidence} />
      </div>

      {/* Conditions remplies */}
      {order.conditions_at_target.length > 0 && (
        <div className="mb-3">
          <p className="text-gray-500 text-xs font-semibold mb-1">Conditions à ce niveau :</p>
          <ul className="space-y-0.5">
            {order.conditions_at_target.map((c, i) => (
              <li key={i} className={`text-xs flex gap-1.5 ${dir.color}`}>
                <span className="shrink-0">✓</span>
                <span className="text-gray-300">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Explication */}
      <p className="text-gray-400 text-xs leading-relaxed bg-gray-900/40 rounded-lg px-3 py-2">
        {order.rationale}
      </p>
    </div>
  )
}

export function PendingOrdersCard() {
  const { analysis } = useMarketStore()
  const orders = analysis?.pending_orders ?? []
  const signal = analysis?.signal

  // Afficher uniquement si signal incertain
  const shouldShow = (
    !signal ||
    signal.type === 'NEUTRAL' ||
    signal.type === 'WAIT' ||
    signal.confidence < 70
  )

  if (!shouldShow || orders.length === 0) {
    if (!shouldShow) return null  // signal fort → pas besoin d'ordres en attente
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">⏳ Ordres en attente</h3>
        <p className="text-gray-500 text-sm text-center py-4">
          Calcul des niveaux optimaux en cours...
        </p>
      </div>
    )
  }

  const hasProximity = orders.some(o => o.proximity_alert)

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">
            ⏳ Attendre — Prix cibles recommandés
          </h3>
          <p className="text-gray-400 text-xs mt-0.5">
            Signal actuel &lt; 70% — entrez seulement à ces niveaux
          </p>
        </div>
        {hasProximity && (
          <span className="text-yellow-400 text-xs font-bold bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-full animate-pulse">
            🔔 Niveau proche !
          </span>
        )}
      </div>

      <div className="space-y-3">
        {orders.map((order, i) => (
          <OrderRow key={i} order={order} />
        ))}
      </div>

      <p className="text-gray-600 text-xs mt-4 pt-3 border-t border-gray-700/50">
        Ces niveaux sont calculés à partir des supports, résistances, Fibonacci et Bollinger Bands.
        L'alerte 🔔 s'active quand le prix est à moins de 0.3% du niveau.
      </p>
    </div>
  )
}
