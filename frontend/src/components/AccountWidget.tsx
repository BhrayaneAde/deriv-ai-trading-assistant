/**
 * Widget compact de connexion compte Deriv — affiché dans le header.
 * Montre : solde, loginid, bouton de connexion/refresh.
 * Clique → ouvre le panneau complet dans les détails.
 */
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

interface AccountSummary {
  loginid: string
  balance: number
  currency: string
  is_virtual: boolean
  account_type: string
}

interface Props {
  onOpenDetails: () => void
}

export function AccountWidget({ onOpenDetails }: Props) {
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)

  const fetchAccount = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/account/info`)
      if (res.ok) {
        const data = await res.json()
        setAccount(data)
        setShowTokenInput(false)
      } else {
        const err = await res.json()
        setError(err.detail ?? 'Non connecté')
        setShowTokenInput(true)
      }
    } catch {
      setError('Backend inaccessible')
    } finally {
      setLoading(false)
    }
  }

  const saveToken = async () => {
    if (!tokenInput.trim()) return
    try {
      // Envoyer le token au backend via un endpoint dédié
      const res = await fetch(`${API}/account/set-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      })
      if (res.ok) {
        setTokenInput('')
        setShowTokenInput(false)
        await fetchAccount()
      } else {
        setError('Token invalide')
      }
    } catch {
      setError('Erreur de connexion')
    }
  }

  useEffect(() => { fetchAccount() }, [])

  // ── Compte connecté ──
  if (account) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => { onOpenDetails(); fetchAccount() }}
          className="flex items-center gap-2 bg-gray-700/60 hover:bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 transition-all"
          title="Voir le compte Deriv"
        >
          <div className={`w-2 h-2 rounded-full ${account.is_virtual ? 'bg-yellow-400' : 'bg-green-400'}`} />
          <div className="text-left">
            <p className="text-white text-xs font-semibold leading-none">
              {account.balance.toFixed(2)} {account.currency}
            </p>
            <p className="text-gray-400 text-xs leading-none mt-0.5">
              {account.loginid} · {account.is_virtual ? 'Démo' : 'Réel'}
            </p>
          </div>
          <span className="text-gray-500 text-xs">›</span>
        </button>
        <button
          onClick={fetchAccount}
          disabled={loading}
          className="text-gray-500 hover:text-white text-sm transition-colors"
          title="Rafraîchir"
        >
          {loading ? '⏳' : '↻'}
        </button>
      </div>
    )
  }

  // ── Non connecté — affiche bouton + optionnel champ token ──
  return (
    <div className="flex items-center gap-2">
      {!showTokenInput ? (
        <button
          onClick={() => setShowTokenInput(true)}
          className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
        >
          <span>🔑</span>
          Connecter compte Deriv
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Token API Deriv..."
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveToken()}
            className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5 w-52
                       focus:outline-none focus:border-blue-500 placeholder-gray-500"
            autoFocus
          />
          <button
            onClick={saveToken}
            disabled={!tokenInput.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? '...' : 'OK'}
          </button>
          <button
            onClick={() => { setShowTokenInput(false); setTokenInput('') }}
            className="text-gray-500 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {error && !showTokenInput && (
        <span className="text-red-400 text-xs">{error}</span>
      )}
    </div>
  )
}
