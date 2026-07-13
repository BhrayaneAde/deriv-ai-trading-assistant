/**
 * Carte Confirmation + Invalidation — Étapes 4 et 5 du flux.
 *
 * Confirmation : signal tenu sur N bougies consécutives
 * Invalidation : conditions cassées tick par tick
 */
import { useMarketStore } from '../store/marketStore'

interface ConfirmationData {
  confirmed: boolean
  direction: string
  score: number
  conditions_ok: string[]
  conditions_failed: string[]
  consecutive_candles: number
}

interface InvalidationData {
  invalidated: boolean
  reason: string
  invalidation_price: number | null
}

function ProgressCircle({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#facc15' : '#f87171'
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#374151" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" fill={color} fontSize="11" fontWeight="bold"
        transform={`rotate(90, ${size/2}, ${size/2})`}>
        {value}%
      </text>
    </svg>
  )
}

export function ConfirmationCard() {
  const { analysis } = useMarketStore()
  const conf = (analysis as any)?.confirmation as ConfirmationData | null
  const inv  = (analysis as any)?.invalidation as InvalidationData | null
  const sig  = analysis?.signal

  // Pas de signal actif
  if (!sig || sig.type === 'WAIT') {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">Confirmation & Invalidation</h3>
        <p className="text-gray-500 text-sm text-center py-4">En attente d'un signal...</p>
      </div>
    )
  }

  const isConfirmed = conf?.confirmed ?? false
  const isBuy = sig.type === 'BUY'
  const isInvalidated = inv?.invalidated ?? false

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 space-y-4">
      <h3 className="text-gray-300 font-semibold text-sm">
        Étapes 4 & 5 — Confirmation & Invalidation
      </h3>

      {/* Invalidation — prioritaire si active */}
      {isInvalidated && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3">
          <p className="text-red-400 font-bold text-sm mb-1">🚨 Signal Invalidé</p>
          <p className="text-red-300 text-xs">{inv?.reason}</p>
          {inv?.invalidation_price && (
            <p className="text-red-500/70 text-xs mt-1 font-mono">
              Prix d'invalidation : {inv.invalidation_price.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Confirmation structurelle */}
      {conf && (
        <div className={`rounded-xl border px-4 py-3 ${
          isConfirmed
            ? 'bg-green-500/10 border-green-500/25'
            : 'bg-yellow-500/10 border-yellow-500/25'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`font-bold text-sm ${isConfirmed ? 'text-green-400' : 'text-yellow-400'}`}>
                {isConfirmed ? '✅ Signal confirmé' : `⏳ ${conf.consecutive_candles}/3 bougies confirmées`}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                Confirmation sur 3 bougies M15 consécutives
              </p>
            </div>
            <ProgressCircle value={conf.score} />
          </div>

          {/* Bougies confirmées */}
          <div className="flex gap-1.5 mb-3">
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex-1 h-2 rounded-full ${
                i < conf.consecutive_candles
                  ? (isConfirmed ? 'bg-green-500' : 'bg-yellow-500')
                  : 'bg-gray-700'
              }`} />
            ))}
          </div>

          {/* Conditions OK */}
          {conf.conditions_ok.length > 0 && (
            <div className="mb-2">
              <p className="text-green-400/80 text-xs font-semibold mb-1">Conditions remplies</p>
              <ul className="space-y-0.5">
                {conf.conditions_ok.map((c, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                    <span className="text-green-500 shrink-0">✓</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conditions ratées */}
          {conf.conditions_failed.length > 0 && (
            <div>
              <p className="text-red-400/80 text-xs font-semibold mb-1">À confirmer encore</p>
              <ul className="space-y-0.5">
                {conf.conditions_failed.map((c, i) => (
                  <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                    <span className="text-red-600 shrink-0">✗</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Surveillance active (signal non invalidé) */}
      {!isInvalidated && sig.type !== 'NEUTRAL' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-blue-300 text-sm font-semibold mb-1">
            👁 Surveillance active — tick par tick
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            Signal {sig.type === 'BUY' ? 'BUY' : 'SELL'} surveillé. Invalidation automatique si :
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
            {isBuy ? (
              <>
                <li>• Stop Loss cassé</li>
                <li>• Support rompu (−0.5×ATR)</li>
                <li>• EMA20 croise sous EMA50</li>
                <li>• RSI chute sous 32</li>
              </>
            ) : (
              <>
                <li>• Stop Loss cassé</li>
                <li>• Résistance cassée (+0.5×ATR)</li>
                <li>• EMA20 croise au-dessus EMA50</li>
                <li>• RSI monte au-dessus de 68</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
