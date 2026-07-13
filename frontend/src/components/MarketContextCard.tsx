/**
 * Carte Contexte du Marché — Phase, Structure HH/HL, Niveaux swing, Volatilité.
 * Correspond à l'Étape 1 du flux professionnel.
 */
import { useMarketStore } from '../store/marketStore'

const PHASE_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  trending_up:   { color: 'text-green-400',  icon: '📈', bg: 'bg-green-500/10 border-green-500/25'  },
  trending_down: { color: 'text-red-400',    icon: '📉', bg: 'bg-red-500/10 border-red-500/25'      },
  breakout:      { color: 'text-orange-400', icon: '⚡', bg: 'bg-orange-500/10 border-orange-500/25'},
  ranging:       { color: 'text-yellow-400', icon: '↔',  bg: 'bg-yellow-500/10 border-yellow-500/25'},
  unknown:       { color: 'text-gray-400',   icon: '❓', bg: 'bg-gray-700/40 border-gray-600'       },
}

const VOL_CONFIG: Record<string, { color: string }> = {
  low:     { color: 'text-green-400'  },
  medium:  { color: 'text-blue-400'   },
  high:    { color: 'text-orange-400' },
  extreme: { color: 'text-red-400'    },
  unknown: { color: 'text-gray-400'   },
}

function LevelBadge({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-700/40 last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      {value != null
        ? <span className={`font-mono text-xs font-semibold ${color}`}>{value.toFixed(2)}</span>
        : <span className="text-gray-600 text-xs">—</span>}
    </div>
  )
}

export function MarketContextCard() {
  const { analysis } = useMarketStore()
  const ctx = (analysis as any)?.context

  if (!ctx) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
        <h3 className="text-gray-300 font-semibold text-sm mb-2">Contexte du marché</h3>
        <p className="text-gray-500 text-sm text-center py-4">En attente des bougies M15...</p>
      </div>
    )
  }

  const phaseCfg = PHASE_CONFIG[ctx.phase] ?? PHASE_CONFIG.unknown
  const volCfg   = VOL_CONFIG[ctx.volatility?.regime] ?? VOL_CONFIG.unknown

  const structureColor =
    ctx.structure === 'bullish' ? 'text-green-400' :
    ctx.structure === 'bearish' ? 'text-red-400'   : 'text-yellow-400'

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
      <h3 className="text-gray-300 font-semibold text-sm mb-4">
        Étape 1 — Contexte du marché
      </h3>

      {/* Phase */}
      <div className={`rounded-xl border px-4 py-3 mb-4 ${phaseCfg.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{phaseCfg.icon}</span>
          <span className={`font-bold text-sm ${phaseCfg.color}`}>{ctx.phase_label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>Force : <span className={`font-bold ${phaseCfg.color}`}>{ctx.phase_strength}%</span></span>
          <span>Durée : <span className="text-white font-mono">{ctx.phase_duration} bougies</span></span>
        </div>
        {/* Barre de force */}
        <div className="mt-2 bg-gray-700/60 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              ctx.phase === 'trending_up' ? 'bg-green-500' :
              ctx.phase === 'trending_down' ? 'bg-red-500' :
              ctx.phase === 'breakout' ? 'bg-orange-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${ctx.phase_strength}%` }}
          />
        </div>
      </div>

      {/* Structure + Volatilité */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-700/40 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs mb-1">Structure</p>
          <p className={`text-sm font-semibold ${structureColor}`}>
            {ctx.structure === 'bullish' ? '▲ Haussière (HH+HL)' :
             ctx.structure === 'bearish' ? '▼ Baissière (LH+LL)' : '◆ Mixte'}
          </p>
        </div>
        <div className="bg-gray-700/40 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs mb-1">Volatilité</p>
          <p className={`text-sm font-semibold ${volCfg.color}`}>
            {ctx.volatility?.label ?? '—'}
          </p>
          {ctx.volatility?.atr_pct != null && (
            <p className="text-gray-500 text-xs">ATR {ctx.volatility.atr_pct.toFixed(3)}%</p>
          )}
        </div>
      </div>

      {/* Niveaux structurels */}
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
          Niveaux clés (50 bougies)
        </p>
        <div className="space-y-0">
          <LevelBadge label="Swing High"   value={ctx.levels?.swing_high}  color="text-red-300"   />
          <LevelBadge label="Résistance"   value={ctx.levels?.last_lh ?? ctx.levels?.last_hh} color="text-orange-400" />
          <LevelBadge label="Support"      value={ctx.levels?.last_hl ?? ctx.levels?.last_ll} color="text-blue-400"   />
          <LevelBadge label="Swing Low"    value={ctx.levels?.swing_low}   color="text-green-300" />
          <LevelBadge
            label="Range total"
            value={ctx.levels?.range_size}
            color="text-gray-300"
          />
        </div>
      </div>
    </div>
  )
}
