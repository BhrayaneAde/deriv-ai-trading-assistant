/**
 * Panneau des 3 stratégies de trading.
 * Affiche le score, les conditions remplies/ratées et le verdict de chaque stratégie.
 */
import { useState } from 'react'
import { useMarketStore } from '../store/marketStore'

interface StrategyData {
  name: string
  direction: string
  score: number
  confidence_label: string
  entry_reason: string
  conditions_met: string[]
  conditions_failed: string[]
  active: boolean
}

interface StrategiesData {
  strategies: {
    trend_pullback: StrategyData
    breakout_retest: StrategyData
    multi_timeframe: StrategyData
    p2dro?: StrategyData   // optionnel — disponible quand M30/H1 ont assez de bougies
  }
  consensus: {
    direction: string
    score: number
    label: string
    strategies_agree: number
  }
  filters: {
    passed: string[]
    failed: string[]
    blocked: boolean
  }
  verdict: string
  enter_now: boolean
}

const SCORE_COLOR = (score: number) =>
  score >= 90 ? 'text-green-400' :
  score >= 80 ? 'text-blue-400'  :
  score >= 70 ? 'text-yellow-400':
  'text-gray-500'

const SCORE_BG = (score: number) =>
  score >= 90 ? 'bg-green-500/15 border-green-500/30' :
  score >= 80 ? 'bg-blue-500/15 border-blue-500/30'  :
  score >= 70 ? 'bg-yellow-500/15 border-yellow-500/30':
  'bg-gray-700/40 border-gray-600'

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 90 ? 'bg-green-500' :
    score >= 80 ? 'bg-blue-500'  :
    score >= 70 ? 'bg-yellow-500':
    'bg-gray-600'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-bold font-mono w-12 text-right ${SCORE_COLOR(score)}`}>
        {score}/100
      </span>
    </div>
  )
}

function StrategyCard({
  strat,
  expanded,
  onToggle,
}: {
  strat: StrategyData
  expanded: boolean
  onToggle: () => void
}) {
  const dirColor = strat.direction === 'BUY' ? 'text-green-400' : strat.direction === 'SELL' ? 'text-red-400' : 'text-gray-400'
  const dirIcon  = strat.direction === 'BUY' ? '▲' : strat.direction === 'SELL' ? '▼' : '◆'

  return (
    <div className={`rounded-xl border p-4 ${SCORE_BG(strat.active ? strat.score : 0)}`}>
      {/* En-tête cliquable */}
      <button
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
              strat.active
                ? `${dirColor} bg-gray-900/50 border-current/30`
                : 'text-gray-500 bg-gray-700/50 border-gray-600'
            }`}>
              {dirIcon} {strat.active ? strat.direction : 'INACTIF'}
            </span>
            <span className="text-white text-sm font-semibold">{strat.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${SCORE_COLOR(strat.score)}`}>
              {strat.confidence_label}
            </span>
            <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <ScoreBar score={strat.score} />
      </button>

      {/* Détails dépliables */}
      {expanded && (
        <div className="mt-3 space-y-2">
          {/* Raison d'entrée */}
          <p className="text-gray-300 text-xs bg-gray-900/50 rounded-lg px-3 py-2 leading-relaxed">
            {strat.entry_reason}
          </p>

          {/* Conditions remplies */}
          {strat.conditions_met.length > 0 && (
            <div>
              <p className="text-green-400 text-xs font-semibold mb-1">✓ Conditions remplies</p>
              <ul className="space-y-0.5">
                {strat.conditions_met.map((c, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                    <span className="text-green-500 shrink-0">+</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conditions ratées */}
          {strat.conditions_failed.length > 0 && (
            <div>
              <p className="text-red-400 text-xs font-semibold mb-1">✗ Conditions non remplies</p>
              <ul className="space-y-0.5">
                {strat.conditions_failed.map((c, i) => (
                  <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                    <span className="text-red-600 shrink-0">−</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StrategiesPanel() {
  const { analysis } = useMarketStore()
  const [expanded, setExpanded] = useState<string | null>(null)

  const strats = analysis?.strategies as StrategiesData | null | undefined

  if (!strats) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">Stratégies de trading</h3>
        <p className="text-gray-500 text-sm text-center py-6">
          En attente des bougies M15 (≥10 bougies requises)...
        </p>
      </div>
    )
  }

  const { consensus, filters, verdict, enter_now } = strats

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">Stratégies de trading</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Trend+Pullback · Breakout+Retest · Multi-TF · P2dro
          </p>
        </div>
        <div className="text-right">
          <span className={`text-lg font-bold font-mono ${SCORE_COLOR(consensus.score)}`}>
            {consensus.score}/100
          </span>
          <p className="text-gray-500 text-xs">{consensus.label}</p>
        </div>
      </div>

      {/* Verdict global */}
      <div className={`rounded-xl px-4 py-3 mb-4 border ${
        enter_now
          ? 'bg-green-500/10 border-green-500/30'
          : filters.blocked
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-gray-700/40 border-gray-600'
      }`}>
        <p className={`text-sm font-semibold ${
          enter_now ? 'text-green-300' : filters.blocked ? 'text-red-300' : 'text-gray-300'
        }`}>
          {verdict}
        </p>
        <div className="flex gap-4 mt-2 text-xs">
          <span className="text-gray-400">
            Stratégies actives : <span className="text-white font-bold">{consensus.strategies_agree}/3</span>
          </span>
          {consensus.direction !== 'NEUTRAL' && (
            <span className={consensus.direction === 'BUY' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              {consensus.direction === 'BUY' ? '▲ BUY' : '▼ SELL'}
            </span>
          )}
        </div>
      </div>

      {/* Filtres anti-faux signaux */}
      {(filters.passed.length > 0 || filters.failed.length > 0) && (
        <div className="mb-4 space-y-1">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
            Filtres anti-faux signaux
          </p>
          {filters.failed.map((f, i) => (
            <p key={i} className="text-red-400 text-xs flex gap-1.5">
              <span>🚫</span>{f}
            </p>
          ))}
          {filters.passed.map((f, i) => (
            <p key={i} className="text-green-500/70 text-xs flex gap-1.5">
              <span>✓</span>{f}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {([
          { key: 'trend_pullback',  data: strats.strategies.trend_pullback  },
          { key: 'breakout_retest', data: strats.strategies.breakout_retest },
          { key: 'multi_timeframe', data: strats.strategies.multi_timeframe },
          { key: 'p2dro',           data: strats.strategies.p2dro           },
        ] as { key: string; data: StrategyData | undefined }[])
          .filter(({ data }) => data !== undefined)
          .map(({ key, data }) => (
            <StrategyCard
              key={key}
              strat={data!}
              expanded={expanded === key}
              onToggle={() => setExpanded(expanded === key ? null : key)}
            />
          ))}
      </div>

      <p className="text-gray-600 text-xs mt-4 pt-3 border-t border-gray-700/50">
        Score 90-100 = Très fort · 80-89 = Fort · 70-79 = Moyen · &lt;70 = Ne pas entrer<br/>
        P2dro : Pin Bar H1/M30 + Divergence RSI + Ligne de tendance + Confirmation
      </p>
    </div>
  )
}
