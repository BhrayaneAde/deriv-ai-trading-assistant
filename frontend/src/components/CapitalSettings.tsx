/**
 * Widget de configuration du capital utilisateur.
 * Envoie le montant au backend via API REST.
 */
import { useState } from 'react'
import { useMarketStore } from '../store/marketStore'

export function CapitalSettings() {
  const { baseAmount, setBaseAmount } = useMarketStore()
  const [input, setInput] = useState(String(baseAmount))
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const val = parseFloat(input)
    if (isNaN(val) || val < 1) return

    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/settings/amount?amount=${val}`, { method: 'POST' })
      setBaseAmount(val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Backend pas encore disponible — mise à jour locale seulement
      setBaseAmount(val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 px-5 py-4 flex items-center gap-4 flex-wrap">
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">
          Capital de base
        </p>
        <p className="text-gray-500 text-xs">
          Utilisé pour calculer la mise recommandée
        </p>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
          <input
            type="number"
            min="1"
            step="10"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg pl-7 pr-3 py-2 w-32
                       text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            aria-label="Montant du capital"
          />
        </div>
        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {saved ? '✓ Enregistré' : 'Appliquer'}
        </button>
      </div>

      {/* Affichage des mises selon risque */}
      <div className="w-full grid grid-cols-3 gap-2 mt-1">
        {[
          { label: 'Risque faible (1%)',  pct: 1 },
          { label: 'Risque moyen (2%)',   pct: 2 },
          { label: 'Risque élevé (3%)',   pct: 3 },
        ].map(({ label, pct }) => (
          <div key={pct} className="bg-gray-700/50 rounded-lg px-3 py-2 text-center">
            <p className="text-gray-400 text-xs">{label}</p>
            <p className="text-white font-mono font-bold text-sm mt-0.5">
              {(baseAmount * pct / 100).toFixed(2)}$
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
