/**
 * Carte signal MTF — avec indicateur de stabilité (verrou de signal).
 *
 * 🔒 Signal verrouillé = calculé à la clôture d'une bougie M5, stable 5min
 * 🔄 Signal en cours  = recalcul en cours (nouvelle bougie)
 */
import { useMarketStore } from '../store/marketStore'

const SIGNAL_CONFIG = {
  BUY:     { color: 'text-green-400', bg: 'bg-green-500/10',  border: 'border-green-500/30',  icon: '▲' },
  SELL:    { color: 'text-red-400',   bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: '▼' },
  NEUTRAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '◆' },
  WAIT:    { color: 'text-gray-400',  bg: 'bg-gray-700/40',   border: 'border-gray-600',      icon: '◌' },
}

function CountdownBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, (remaining / total) * 100) : 0
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-1000 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function SignalCard() {
  const { analysis, baseAmount } = useMarketStore()

  const sigType = (analysis?.signal.type ?? 'WAIT') as keyof typeof SIGNAL_CONFIG
  const cfg = SIGNAL_CONFIG[sigType]
  const signal = analysis?.signal
  const stake = analysis?.stake
  const regime = analysis?.volatility
  const stability = analysis?.signal_stability

  const isLocked = stability?.locked ?? false
  const remaining = stability?.remaining_seconds ?? 0
  const remainingLabel = stability?.remaining_label ?? ''
  const tickCount = stability?.tick_count ?? 0
  const LOCK_TOTAL = sigType === 'BUY' || sigType === 'SELL'
    ? (analysis?.signal.confidence ?? 0) >= 80 ? 300 : 180
    : 0

  const regimeColor =
    regime?.regime === 'unstable' ? 'text-red-400' :
    regime?.regime === 'calm'     ? 'text-green-400' : 'text-yellow-400'

  // Phase de collecte
  if (tickCount < 30) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 flex flex-col gap-3">
        <h3 className="text-gray-300 font-semibold text-sm">Signal</h3>
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Collecte des données...</p>
          <p className="text-gray-600 text-xs">{tickCount}/30 ticks reçus</p>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(tickCount / 30) * 100}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${cfg.bg} ${cfg.border}`}>

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-gray-300 font-semibold text-sm">Signal MTF</h3>
          {/* Indicateur de stabilité */}
          {isLocked && sigType !== 'WAIT' && sigType !== 'NEUTRAL' ? (
            <span className="text-xs bg-gray-900/60 border border-gray-600 text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              🔒 Stable
            </span>
          ) : (
            <span className="text-xs bg-gray-900/60 border border-gray-600 text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              🔄 Analyse
            </span>
          )}
        </div>
        {signal && signal.confidence > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gray-900/60 ${cfg.color}`}>
            {signal.confidence}%
          </span>
        )}
      </div>

      {/* Signal principal */}
      <div>
        <p className={`text-2xl font-bold ${cfg.color}`}>
          {cfg.icon} {signal?.label ?? 'Attente'}
        </p>
        {regime && (
          <p className={`text-xs mt-1 font-semibold ${regimeColor}`}>
            Marché : {regime.label}
          </p>
        )}
      </div>

      {/* Compte à rebours de validité */}
      {isLocked && remaining > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Signal valide encore</span>
            <span className="font-mono font-semibold text-white">{remainingLabel}</span>
          </div>
          <CountdownBar remaining={remaining} total={LOCK_TOTAL} />
          <p className="text-gray-600 text-xs">
            Recalcul à la prochaine clôture de bougie M5
          </p>
        </div>
      )}

      {/* Explication stabilité */}
      {!isLocked && sigType !== 'WAIT' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          <p className="text-blue-300 text-xs">
            🔄 Nouveau signal calculé à la clôture de la bougie M5.
            Il sera stable pendant 3 à 5 minutes.
          </p>
        </div>
      )}

      {/* Conseil d'entrée */}
      {signal?.advice && (
        <div className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
          stake?.enter_now
            ? 'bg-green-500/15 text-green-300 border-green-500/20'
            : 'bg-gray-700/50 text-gray-300 border-gray-600'
        }`}>
          {signal.advice}
        </div>
      )}

      {/* Mise recommandée */}
      {stake && (
        <div className="rounded-lg bg-gray-800/80 border border-gray-700 px-3 py-2.5">
          <p className="text-gray-400 text-xs mb-1 font-semibold uppercase tracking-wide">
            Gestion du risque
          </p>
          {stake.enter_now ? (
            <div className="flex items-center justify-between">
              <span className="text-white font-mono font-bold text-lg">
                {stake.amount.toFixed(2)}$
              </span>
              <span className="text-gray-400 text-xs">
                {stake.pct_of_capital}% de {baseAmount}$
              </span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Mise : 0$ (ne pas entrer)</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{stake.reason}</p>
        </div>
      )}

      {/* Explication pourquoi */}
      {signal?.why && (
        <div className="rounded-lg bg-gray-900/60 border border-gray-700/50 px-3 py-2">
          <p className="text-gray-400 text-xs font-semibold mb-1">Pourquoi ?</p>
          <p className="text-gray-300 text-xs leading-relaxed">{signal.why}</p>
        </div>
      )}

      {/* Raisons TF */}
      {signal?.reasons && signal.reasons.length > 0 && (
        <ul className="space-y-1">
          {signal.reasons.map((r, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-1.5">
              <span className={`shrink-0 ${cfg.color}`}>›</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-gray-600 text-xs mt-auto pt-2 border-t border-gray-700/40">
        ⚠ Signal stable sur bougie M5 · Pas un conseil financier
      </p>
    </div>
  )
}
