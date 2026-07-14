/**
 * Panneau compte Deriv — solde, type, positions ouvertes, transactions.
 */
import { useState, useEffect, useCallback } from 'react'

interface AccountInfo {
  loginid: string
  fullname: string
  email: string
  balance: number
  currency: string
  account_type: string
  is_virtual: boolean
  landing_company: string
  country: string
}

interface Position {
  contract_id: string
  contract_type: string
  symbol: string
  buy_price: number
  current_value: number
  profit_loss: number
  profit_loss_pct: number
  entry_spot: number
  current_spot: number
  status: string
  duration: string
}

interface Transaction {
  transaction_id: string
  action: string
  amount: number
  balance_after: number
  symbol: string
  timestamp: number
}

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export function AccountPanel() {
  const [info, setInfo] = useState<AccountInfo | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'account' | 'positions' | 'history'>('account')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [infoRes, posRes, txRes] = await Promise.all([
        fetch(`${API}/account/info`),
        fetch(`${API}/account/positions`),
        fetch(`${API}/account/transactions?limit=15`),
      ])

      if (!infoRes.ok) {
        const err = await infoRes.json()
        setError(err.detail ?? 'Erreur connexion compte')
        return
      }

      const infoData = await infoRes.json()
      const posData  = await posRes.json()
      const txData   = await txRes.json()

      setInfo(infoData)
      setPositions(posData.positions ?? [])
      setTransactions(txData.transactions ?? [])
    } catch (e) {
      setError('Serveur backend inaccessible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    // Rafraîchir le solde toutes les 30s
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const formatTime = (epoch: number) =>
    new Date(epoch * 1000).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

  if (error) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-red-500/30 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-300 font-semibold text-sm">Compte Deriv</h3>
          <button onClick={fetchAll} className="text-xs text-blue-400 hover:text-blue-300">
            Réessayer
          </button>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-400 text-sm">⚠ {error}</p>
          <p className="text-gray-500 text-xs mt-1">
            Vérifiez que DERIV_API_TOKEN est configuré dans backend/.env
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-xs font-bold">D</div>
          <h3 className="text-white font-semibold text-sm">Compte Deriv</h3>
          {info && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
              info.is_virtual
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-green-500/20 text-green-400'
            }`}>
              {info.is_virtual ? 'DEMO' : 'RÉEL'}
            </span>
          )}
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          aria-label="Rafraîchir"
        >
          {loading ? '⏳' : '↻'}
        </button>
      </div>

      {/* Solde principal */}
      {info ? (
        <div className="bg-gray-700/50 rounded-xl p-4 mb-4">
          <p className="text-gray-400 text-xs mb-1">Solde disponible</p>
          <p className="text-white text-3xl font-mono font-bold">
            {info.balance.toFixed(2)}
            <span className="text-gray-400 text-lg ml-2">{info.currency}</span>
          </p>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>{info.loginid}</span>
            <span>·</span>
            <span>{info.fullname || info.email}</span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-700/30 rounded-xl p-4 mb-4 animate-pulse">
          <div className="h-3 bg-gray-600 rounded w-24 mb-2" />
          <div className="h-8 bg-gray-600 rounded w-40" />
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 mb-4 bg-gray-700/40 rounded-lg p-1">
        {([
          { key: 'account',   label: 'Compte' },
          { key: 'positions', label: `Positions (${positions.length})` },
          { key: 'history',   label: 'Historique' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs py-1.5 rounded font-semibold transition-all ${
              tab === t.key
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Onglet Compte */}
      {tab === 'account' && info && (
        <div className="space-y-2 text-sm">
          {[
            { label: 'ID de compte',   value: info.loginid },
            { label: 'Type',           value: info.is_virtual ? 'Démo' : 'Réel' },
            { label: 'Devise',         value: info.currency },
            { label: 'Société',        value: info.landing_company },
            { label: 'Pays',           value: info.country },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-1 border-b border-gray-700/50 last:border-0">
              <span className="text-gray-400">{label}</span>
              <span className="text-white font-mono text-xs">{value || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Onglet Positions */}
      {tab === 'positions' && (
        <div>
          {positions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucune position ouverte</p>
          ) : (
            <div className="space-y-2">
              {positions.map(pos => (
                <div
                  key={pos.contract_id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    pos.profit_loss >= 0
                      ? 'bg-green-500/10 border-green-500/25'
                      : 'bg-red-500/10 border-red-500/25'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-white text-xs font-semibold">{pos.symbol}</span>
                      <span className="text-gray-400 text-xs ml-2">{pos.contract_type}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${pos.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.profit_loss >= 0 ? '+' : ''}{pos.profit_loss.toFixed(2)} {info?.currency}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                    <span>Mise : <span className="text-white font-mono">{pos.buy_price.toFixed(4)}</span></span>
                    <span>Valeur : <span className="text-white font-mono">{pos.current_value.toFixed(4)}</span></span>
                    {pos.entry_spot > 0 && (
                      <span>Entrée : <span className="text-white font-mono">{pos.entry_spot.toFixed(4)}</span></span>
                    )}
                    {pos.current_spot > 0 && (
                      <span>Spot actuel : <span className={`font-mono font-semibold ${pos.current_spot >= pos.entry_spot ? 'text-green-400' : 'text-red-400'}`}>{pos.current_spot.toFixed(4)}</span></span>
                    )}
                    <span className={`font-semibold ${pos.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.profit_loss_pct >= 0 ? '+' : ''}{pos.profit_loss_pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Onglet Historique */}
      {tab === 'history' && (
        <div>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucune transaction</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.transaction_id} className="flex justify-between items-center py-1.5 px-2 rounded-lg bg-gray-700/30 text-xs">
                  <div>
                    <span className="text-gray-300 capitalize">{tx.action}</span>
                    {tx.symbol && <span className="text-gray-500 ml-2">{tx.symbol.split(' ')[0]}</span>}
                    <p className="text-gray-600">{formatTime(tx.timestamp)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                    </p>
                    <p className="text-gray-500">Solde : {tx.balance_after.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
