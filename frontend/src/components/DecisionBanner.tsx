/**
 * Bannière de décision principale — visible immédiatement.
 * Message clair : ACHETEZ / VENDEZ / NE RIEN FAIRE
 */
import { useMarketStore } from '../store/marketStore'

export function DecisionBanner() {
  const { analysis, currentTick, baseAmount } = useMarketStore()

  const sig        = analysis?.signal
  const stability  = analysis?.signal_stability
  const pos        = analysis?.position
  const stake      = analysis?.stake
  const pending    = analysis?.pending_orders ?? []
  const regime     = analysis?.volatility
  const ctx        = (analysis as any)?.context

  const price = currentTick?.price

  // ── Pas encore de données ──
  if (!sig || sig.type === 'WAIT' || !price) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center animate-pulse">
            <span className="text-gray-400 text-xl">⏳</span>
          </div>
          <div>
            <p className="text-gray-300 font-bold text-lg">Collecte des données...</p>
            <p className="text-gray-500 text-sm">
              {stability ? `${stability.tick_count}/30 ticks reçus` : 'Connexion en cours'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Marché instable ──
  if (regime?.regime === 'unstable') {
    return (
      <div className="bg-red-900/30 border-2 border-red-500/50 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
            <span className="text-3xl">⛔</span>
          </div>
          <div className="flex-1">
            <p className="text-red-400 font-black text-2xl tracking-wide">NE RIEN FAIRE</p>
            <p className="text-red-300 font-semibold text-sm mt-0.5">Marché instable — volatilité trop élevée</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              {ctx?.phase_label ?? 'Conditions défavorables'}. Attendez que la volatilité redescende avant d'entrer en position.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Signal NEUTRE ou faible ──
  if (sig.type === 'NEUTRAL' || sig.confidence < 60) {
    const bestPending = pending.find(p => p.estimated_confidence >= 70)
    const nearestFvg  = analysis?.nearest_fvg_entry
    return (
      <div className="bg-yellow-900/20 border-2 border-yellow-500/40 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
            <span className="text-3xl">⏳</span>
          </div>
          <div className="flex-1">
            <p className="text-yellow-400 font-black text-2xl tracking-wide">NE RIEN FAIRE POUR L'INSTANT</p>
            <p className="text-yellow-300 text-sm mt-0.5">{sig.why || 'Signal insuffisant — attendre confirmation'}</p>

            {/* FVG optimal */}
            {nearestFvg && (
              <div className="mt-3 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                <p className="text-purple-400 text-xs font-bold mb-2">
                  ⭐ Attendez ce FVG pour entrer
                </p>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Direction : </span>
                    <span className={`font-bold ${nearestFvg.direction === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                      {nearestFvg.direction === 'bullish' ? '▲ BUY' : '▼ SELL'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Entrée : </span>
                    <span className="text-white font-mono font-bold">{nearestFvg.midpoint.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Zone : </span>
                    <span className="text-gray-300 font-mono">{nearestFvg.bottom.toFixed(4)}–{nearestFvg.top.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Force : </span>
                    <span className="text-white font-semibold capitalize">{nearestFvg.strength}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Prix cible pending order */}
            {bestPending && !nearestFvg && (
              <div className="mt-3 bg-gray-800/60 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">
                  📍 Prix cible à surveiller
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xl font-mono font-bold ${bestPending.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                    {bestPending.target_price.toFixed(4)}
                  </span>
                  <span className="text-gray-400 text-xs">Confiance : <span className="text-white font-bold">{bestPending.estimated_confidence}%</span></span>
                  <span className="text-gray-400 text-xs">Distance : <span className="text-white font-mono">{bestPending.distance_pct.toFixed(3)}%</span></span>
                </div>
                {bestPending.proximity_alert && (
                  <p className="text-yellow-400 text-xs font-bold mt-1 animate-pulse">🔔 Le prix s'approche !</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Signal BUY ──
  if (sig.type === 'BUY') {
    const locked = stability?.locked
    return (
      <div className="bg-green-900/25 border-2 border-green-500/60 rounded-2xl p-5 shadow-lg shadow-green-900/20">
        <div className="flex items-start gap-4">
          {/* Icône */}
          <div className="w-14 h-14 rounded-2xl bg-green-500/25 border border-green-500/50 flex items-center justify-center shrink-0">
            <span className="text-3xl">▲</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Titre */}
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <p className="text-green-400 font-black text-2xl tracking-wide">VOUS POUVEZ ACHETER</p>
              <span className="bg-green-500/20 border border-green-500/40 text-green-300 text-sm font-bold px-2.5 py-0.5 rounded-full">
                {sig.confidence}% confiance
              </span>
              {locked && stability?.remaining_label && (
                <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                  🔒 Signal stable {stability.remaining_label}
                </span>
              )}
            </div>

            {/* Prix + mise + TP/SL */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="bg-gray-800/70 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-0.5">Prix actuel</p>
                <p className="text-white font-mono font-bold text-lg">{price.toFixed(4)}</p>
              </div>
              <div className="bg-gray-800/70 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-0.5">Mise suggérée</p>
                <p className="text-white font-mono font-bold text-lg">
                  {stake?.enter_now ? `${stake.amount.toFixed(2)}$` : '—'}
                </p>
                {(stake?.pct_of_capital ?? 0) > 0 && (
                  <p className="text-gray-500 text-xs">{stake!.pct_of_capital}% de {baseAmount}$</p>
                )}
              </div>
              {pos && (
                <>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                    <p className="text-green-400 text-xs mb-0.5">Take Profit</p>
                    <p className="text-green-400 font-mono font-bold text-lg">{pos.take_profit.toFixed(4)}</p>
                    <p className="text-green-500/60 text-xs">+{pos.tp_pips.toFixed(1)} pips</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <p className="text-red-400 text-xs mb-0.5">Stop Loss</p>
                    <p className="text-red-400 font-mono font-bold text-lg">{pos.stop_loss.toFixed(4)}</p>
                    <p className="text-red-500/60 text-xs">-{pos.sl_pips.toFixed(1)} pips</p>
                  </div>
                </>
              )}
            </div>

            {/* Pourquoi */}
            <p className="text-gray-300 text-sm mt-3 leading-relaxed">{sig.why}</p>

            {/* FVG confirmation pour BUY */}
            {(() => {
              const nearestFvg = analysis?.nearest_fvg_entry
              if (!nearestFvg) return null
              const dist = Math.abs(nearestFvg.midpoint - price) / price * 100
              const insideZone = price >= nearestFvg.bottom && price <= nearestFvg.top
              return (
                <div className={`mt-3 rounded-xl p-3 border ${
                  insideZone
                    ? 'bg-purple-500/15 border-purple-500/40'
                    : 'bg-green-500/8 border-green-500/20'
                }`}>
                  <p className={`text-xs font-bold mb-1.5 ${insideZone ? 'text-purple-400' : 'text-green-400/80'}`}>
                    {insideZone ? '⚡ PRIX DANS LE FVG — Entrée optimale maintenant !' : '📍 FVG haussier de référence'}
                  </p>
                  <div className="flex gap-4 flex-wrap text-xs">
                    <span className="text-gray-400">Zone : <span className="text-white font-mono">{nearestFvg.bottom.toFixed(4)}–{nearestFvg.top.toFixed(4)}</span></span>
                    <span className="text-gray-400">Entrée idéale : <span className="text-green-400 font-mono font-bold">{nearestFvg.midpoint.toFixed(4)}</span></span>
                    <span className="text-gray-400">Distance : <span className="text-white font-mono">{dist.toFixed(3)}%</span></span>
                    <span className="text-gray-400">Force : <span className="text-white capitalize">{nearestFvg.strength}</span></span>
                  </div>
                  {!insideZone && dist > 0.1 && (
                    <p className="text-gray-500 text-xs mt-1">
                      Attendre que le prix recule vers {nearestFvg.midpoint.toFixed(4)} pour une entrée de meilleure qualité.
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Raisons */}
            {sig.reasons.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {sig.reasons.map((r, i) => (
                  <span key={i} className="bg-green-500/10 border border-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Signal SELL ──
  return (
    <div className="bg-red-900/25 border-2 border-red-500/60 rounded-2xl p-5 shadow-lg shadow-red-900/20">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/25 border border-red-500/50 flex items-center justify-center shrink-0">
          <span className="text-3xl">▼</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <p className="text-red-400 font-black text-2xl tracking-wide">VOUS POUVEZ VENDRE</p>
            <span className="bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {sig.confidence}% confiance
            </span>
            {stability?.locked && stability?.remaining_label && (
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                🔒 Signal stable {stability.remaining_label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="bg-gray-800/70 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-0.5">Prix actuel</p>
              <p className="text-white font-mono font-bold text-lg">{price.toFixed(4)}</p>
            </div>
            <div className="bg-gray-800/70 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-0.5">Mise suggérée</p>
              <p className="text-white font-mono font-bold text-lg">
                {stake?.enter_now ? `${stake.amount.toFixed(2)}$` : '—'}
              </p>
              {(stake?.pct_of_capital ?? 0) > 0 && (
                <p className="text-gray-500 text-xs">{stake!.pct_of_capital}% de {baseAmount}$</p>
              )}
            </div>
            {pos && (
              <>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <p className="text-green-400 text-xs mb-0.5">Take Profit</p>
                  <p className="text-green-400 font-mono font-bold text-lg">{pos.take_profit.toFixed(4)}</p>
                  <p className="text-green-500/60 text-xs">+{pos.tp_pips.toFixed(1)} pips</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-xs mb-0.5">Stop Loss</p>
                  <p className="text-red-400 font-mono font-bold text-lg">{pos.stop_loss.toFixed(4)}</p>
                  <p className="text-red-500/60 text-xs">-{pos.sl_pips.toFixed(1)} pips</p>
                </div>
              </>
            )}
          </div>

          <p className="text-gray-300 text-sm mt-3 leading-relaxed">{sig.why}</p>

          {/* FVG confirmation pour SELL */}
          {(() => {
            const nearestFvg = analysis?.nearest_fvg_entry
            if (!nearestFvg) return null
            const dist = Math.abs(nearestFvg.midpoint - price) / price * 100
            const insideZone = price >= nearestFvg.bottom && price <= nearestFvg.top
            return (
              <div className={`mt-3 rounded-xl p-3 border ${
                insideZone
                  ? 'bg-purple-500/15 border-purple-500/40'
                  : 'bg-red-500/8 border-red-500/20'
              }`}>
                <p className={`text-xs font-bold mb-1.5 ${insideZone ? 'text-purple-400' : 'text-red-400/80'}`}>
                  {insideZone ? '⚡ PRIX DANS LE FVG — Entrée optimale maintenant !' : '📍 FVG baissier de référence'}
                </p>
                <div className="flex gap-4 flex-wrap text-xs">
                  <span className="text-gray-400">Zone : <span className="text-white font-mono">{nearestFvg.bottom.toFixed(4)}–{nearestFvg.top.toFixed(4)}</span></span>
                  <span className="text-gray-400">Entrée idéale : <span className="text-red-400 font-mono font-bold">{nearestFvg.midpoint.toFixed(4)}</span></span>
                  <span className="text-gray-400">Distance : <span className="text-white font-mono">{dist.toFixed(3)}%</span></span>
                  <span className="text-gray-400">Force : <span className="text-white capitalize">{nearestFvg.strength}</span></span>
                </div>
                {!insideZone && dist > 0.1 && (
                  <p className="text-gray-500 text-xs mt-1">
                    Attendre que le prix remonte vers {nearestFvg.midpoint.toFixed(4)} pour une entrée de meilleure qualité.
                  </p>
                )}
              </div>
            )
          })()}

          {sig.reasons.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {sig.reasons.map((r, i) => (
                <span key={i} className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
