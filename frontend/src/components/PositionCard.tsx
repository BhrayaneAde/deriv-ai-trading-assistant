/**
 * Carte de position — TP, SL, lots, durée, répétitions, sortie.
 */
import { useMarketStore } from '../store/marketStore'

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color ?? 'text-white'}`}>{value}</span>
    </div>
  )
}

export function PositionCard() {
  const { analysis } = useMarketStore()
  const pos = analysis?.position
  const sig = analysis?.signal

  if (!pos) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">Plan de position</h3>
        <p className="text-gray-500 text-sm text-center py-6">
          {sig?.type === 'WAIT' || !sig
            ? 'En attente d\'un signal...'
            : 'Signal insuffisant — pas de position suggérée'}
        </p>
      </div>
    )
  }

  const isBuy = pos.direction === 'BUY'
  const dirColor = isBuy ? 'text-green-400' : 'text-red-400'
  const dirBg = isBuy ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-300 font-semibold text-sm">Plan de position</h3>
        <span className={`text-sm font-bold px-3 py-1 rounded-lg border ${dirBg} ${dirColor}`}>
          {isBuy ? '▲ BUY' : '▼ SELL'}
        </span>
      </div>

      {/* Prix d'entrée, TP, SL */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
          <p className="text-gray-500 text-xs mb-1">Entrée</p>
          <p className="text-white font-mono font-bold">{pos.entry_price.toFixed(2)}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
          <p className="text-green-400 text-xs mb-1">Take Profit</p>
          <p className="text-green-400 font-mono font-bold">{pos.take_profit.toFixed(2)}</p>
          <p className="text-green-500/70 text-xs">+{pos.tp_pips.toFixed(0)} pips</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-red-400 text-xs mb-1">Stop Loss</p>
          <p className="text-red-400 font-mono font-bold">{pos.stop_loss.toFixed(2)}</p>
          <p className="text-red-500/70 text-xs">-{pos.sl_pips.toFixed(0)} pips</p>
        </div>
      </div>

      {/* Détails */}
      <div className="space-y-0 mb-4">
        <Row label="Risk/Reward" value={`1 : ${pos.risk_reward.toFixed(2)}`}
          color={pos.risk_reward >= 1.5 ? 'text-green-400' : 'text-yellow-400'} />
        <Row label="Mise par lot" value={`${pos.lot_size.toFixed(2)}$`} />
        <Row label="Nombre de lots" value={`${pos.nb_lots} lot${pos.nb_lots > 1 ? 's' : ''}`} />
        <Row label="Mise totale" value={`${pos.total_stake.toFixed(2)}$`} />
        <Row label="Gain potentiel" value={`+${pos.potential_gain.toFixed(2)}$`} color="text-green-400" />
        <Row label="Perte max" value={`-${pos.potential_loss.toFixed(2)}$`} color="text-red-400" />
      </div>

      {/* Durée */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-3">
        <p className="text-blue-300 text-xs font-semibold">⏱ Durée suggérée</p>
        <p className="text-white text-sm mt-0.5">{pos.duration.label}</p>
      </div>

      {/* Répétitions */}
      <div className="bg-gray-700/40 rounded-lg px-3 py-2 mb-3">
        <p className="text-gray-400 text-xs font-semibold mb-0.5">🔄 Répétitions</p>
        <p className="text-gray-300 text-xs">{pos.repeat.advice}</p>
      </div>

      {/* Message de sortie */}
      <div className="bg-gray-900/60 border border-gray-600 rounded-lg px-3 py-2 mb-3">
        <p className="text-gray-400 text-xs font-semibold mb-1">📋 Quand sortir ?</p>
        <p className="text-gray-200 text-xs leading-relaxed">{pos.exit_message}</p>
      </div>

      {/* Avertissement */}
      {pos.warning && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <p className="text-orange-300 text-xs">{pos.warning}</p>
        </div>
      )}
    </div>
  )
}
