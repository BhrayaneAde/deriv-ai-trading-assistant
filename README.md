# Deriv AI Trading Assistant

Assistant de trading intelligent connecté à Deriv, avec analyse multi-timeframe, stratégies techniques, gestion du risque et flux de décision professionnel.

---

## Table des matières

1. [Vision du projet](#vision)
2. [Stack technique](#stack)
3. [Démarrage rapide](#démarrage)
4. [Architecture du projet](#architecture)
5. [Flux de décision professionnel](#flux)
6. [Actifs supportés](#actifs)
7. [Module d'analyse](#analyse)
8. [Les 3 stratégies](#stratégies)
9. [Gestion du risque](#risque)
10. [Interface dashboard](#dashboard)
11. [API Backend](#api)
12. [Phases de développement](#phases)

---

## Vision

Créer un copilote intelligent d'analyse de marché connecté à Deriv qui :

- Récupère les données de marché en temps réel (ticks + bougies OHLC)
- Analyse automatiquement les mouvements sur 4 timeframes simultanés
- Détecte les opportunités avec un score de confiance ≥ 70%
- Explique **pourquoi** entrer ou ne pas entrer
- Gère le risque en fonction du capital de l'utilisateur
- Propose un prix cible quand le signal est insuffisant
- Surveille l'invalidation du signal tick par tick

> L'objectif n'est pas de garantir des gains, mais de fournir un copilote d'analyse structuré et stable.

---

## Stack

| Couche | Technologies |
|--------|-------------|
| Frontend | React 19 · TypeScript · Tailwind CSS v4 · Zustand · Vite |
| Backend | Python 3.12 · FastAPI · WebSocket · Uvicorn |
| Données | Deriv WebSocket API (temps réel) |
| Analyse | Calculs Python natifs (sans dépendances ML pour le MVP) |
| Communication | WebSocket bidirectionnel Backend ↔ Frontend |

---

## Démarrage

### Prérequis

- Python 3.12 (pas 3.14 — pas de wheels pydantic disponibles)
- Node.js 18+

### Backend

```bash
cd backend

# Créer et activer le venv Python 3.12
py -3.12 -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Installer les dépendances
pip install -r requirements.txt

# Configurer l'environnement
copy .env.example .env
# Éditer .env si nécessaire (DERIV_APP_ID par défaut = 1089)

# Lancer le serveur
python run.py
```

Le backend tourne sur `http://localhost:8000`
Documentation API interactive : `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install   # déjà fait si premier setup
npm run dev
```

Le dashboard est accessible sur `http://localhost:5173`

---

## Architecture

```
deriv-ai-trading-assistant/
│
├── backend/
│   ├── app/
│   │   ├── main.py                    # Point d'entrée FastAPI
│   │   ├── config.py                  # Variables d'environnement
│   │   ├── deriv_client.py            # Client WebSocket Deriv
│   │   ├── tick_store.py              # Buffer des derniers ticks
│   │   ├── candle_store.py            # Buffer des bougies OHLC par TF
│   │   ├── assets.py                  # Catalogue des actifs Deriv
│   │   ├── connection_manager.py      # Broadcast WebSocket → Frontend
│   │   ├── routers/
│   │   │   └── market.py              # Routes WebSocket et REST
│   │   └── analysis/
│   │       ├── engine.py              # Moteur principal (flux complet)
│   │       ├── indicators.py          # EMA, RSI, MACD, ATR, Bollinger...
│   │       ├── market_context.py      # Étape 1 : contexte marché
│   │       ├── confirmation.py        # Étape 4 : confirmation structurelle
│   │       ├── signal_lock.py         # Verrou de signal (stabilité)
│   │       ├── pending_order.py       # Prix cibles en attente
│   │       ├── position_manager.py    # TP / SL / lots / durée
│   │       └── strategies/
│   │           ├── trend_pullback.py  # Stratégie 1
│   │           ├── breakout_retest.py # Stratégie 2
│   │           ├── multi_tf.py        # Stratégie 3
│   │           └── scorer.py          # Orchestrateur + filtres
│   ├── run.py
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── App.tsx                    # Dashboard principal
        ├── store/marketStore.ts       # État global Zustand
        ├── hooks/useWebSocket.ts      # Connexion WS + reconnexion auto
        └── components/
            ├── AssetSelector.tsx      # Sélecteur d'actif
            ├── CapitalSettings.tsx    # Gestion du capital
            ├── SignalCard.tsx         # Signal + verrou + compte à rebours
            ├── MarketContextCard.tsx  # Contexte marché (étape 1)
            ├── MTFPanel.tsx           # Tableau multi-timeframe
            ├── StrategiesPanel.tsx    # 3 stratégies avec score
            ├── ConfirmationCard.tsx   # Confirmation + invalidation
            ├── PositionCard.tsx       # TP / SL / lots / durée
            ├── PendingOrdersCard.tsx  # Prix cibles ≥ 70% confiance
            ├── PriceCard.tsx          # Prix temps réel + tendance
            ├── MiniChart.tsx          # Graphique SVG + niveaux
            ├── TickFeed.tsx           # Flux des derniers prix
            └── ConnectionStatus.tsx   # Indicateur de connexion
```

---

## Flux de décision professionnel

Le moteur suit un flux séquentiel à 6 étapes. Un signal n'est émis qu'après validation de toutes les étapes.

```
Tick reçu
    │
    ├─► Signal encore verrouillé (bougie M5 non clôturée) ?
    │       └─ OUI → retourner signal stable + surveiller invalidation
    │
    └─► NON → Recalcul complet :
              │
              ├─ ÉTAPE 1 : Contexte marché
              │     Phase : trending_up / trending_down / ranging / breakout
              │     Structure : HH+HL (bullish) / LH+LL (bearish) / mixed
              │     Niveaux : swing high, swing low, range
              │     Volatilité : low / medium / high / extreme
              │
              ├─ ÉTAPE 2 : Analyse Multi-Timeframe (4 TF)
              │     1h   : direction macro (poids 4)
              │     15min: zone d'entrée (poids 3)
              │     5min : timing (poids 2)
              │     1min : déclencheur (poids 1)
              │     → Score pondéré Bull vs Bear
              │
              ├─ ÉTAPE 3 : 3 Stratégies (score /100 chacune)
              │     Trend + Pullback  : seuil ≥ 80/100
              │     Breakout + Retest : seuil ≥ 85/100
              │     Multi-TF H1/M15/M5: seuil ≥ 70/100
              │     + Filtres anti-faux signaux
              │     → Consensus 2/3 ou 3/3 stratégies
              │
              ├─ ÉTAPE 4 : Confirmation structurelle
              │     Conditions vérifiées sur 3 bougies M15 consécutives :
              │     EMA20 > EMA50 · RSI favorable · MACD histogram · Prix vs EMA
              │     → Signal rétrogradé si < 3 bougies confirmées
              │
              ├─ ÉTAPE 5 : Signal verrouillé
              │     BUY/SELL avec confiance ≥ 70%
              │     Durée verrou : 5min (confiance ≥ 80%) ou 3min
              │     Explication : contexte + raisons + mise recommandée
              │
              └─ ÉTAPE 6 : Surveillance tick par tick
                    Conditions d'invalidation BUY :
                      Stop Loss cassé · Support rompu · EMA20 < EMA50 · RSI < 32
                    Conditions d'invalidation SELL :
                      Stop Loss cassé · Résistance cassée · EMA20 > EMA50 · RSI > 68
                    → Verrou invalidé immédiatement si condition déclenchée
```

### Stabilité du signal

Un problème courant des assistants de trading : le signal change toutes les secondes (bruit du marché).

**Solution implémentée :**
- Le signal est calculé **uniquement à la clôture d'une bougie M5** (toutes les 5 minutes)
- Il reste **verrouillé** jusqu'à la prochaine clôture ou jusqu'à invalidation
- Pendant la validité, seul le **prix affiché** est mis à jour — pas le signal
- En cas de retournement violent (BUY → SELL sur les indicateurs), le verrou est invalidé immédiatement

```
10:15:00  Bougie M5 clôture  →  Analyse complète  →  Signal BUY verrouillé 5min
10:15:25  Tick reçu          →  Prix mis à jour   →  Signal BUY maintenu
10:15:49  Tick reçu          →  Check invalidation →  Signal BUY maintenu (pas de cassure)
10:20:00  Nouvelle bougie M5 →  Analyse complète  →  Nouveau signal calculé
```

---

## Actifs supportés

### Volatility Indices
| Symbole | Nom | Risque |
|---------|-----|--------|
| R_10 | Volatility 10 Index | Modéré |
| R_25 | Volatility 25 Index | Modéré |
| R_50 | Volatility 50 Index | Élevé |
| R_75 | Volatility 75 Index | Élevé |
| R_100 | Volatility 100 Index | Extrême |
| 1HZ10V | Volatility 10 (1s) | Modéré |
| 1HZ100V | Volatility 100 (1s) | Extrême |

### Boom Indices ⚡
Spikes haussiers imprévisibles. **Stratégie BUY uniquement.**
| Symbole | Fréquence spike |
|---------|----------------|
| BOOM300N | ~1 spike / 300 ticks |
| BOOM500 | ~1 spike / 500 ticks |
| BOOM1000 | ~1 spike / 1000 ticks |

### Crash Indices ⚡
Spikes baissiers imprévisibles. **Stratégie SELL uniquement.**
| Symbole | Fréquence spike |
|---------|----------------|
| CRASH300N | ~1 spike / 300 ticks |
| CRASH500 | ~1 spike / 500 ticks |
| CRASH1000 | ~1 spike / 1000 ticks |

### Step Index
| Symbole | Description |
|---------|-------------|
| stpRNG | Mouvements réguliers de 0.1, spread très faible |

> Changer d'actif via le dashboard → le backend se reconnecte automatiquement et récupère 200 bougies sur les 4 timeframes.

---

## Module d'analyse

### Indicateurs calculés (`indicators.py`)

| Indicateur | Paramètres | Usage |
|-----------|-----------|-------|
| EMA | 20, 50, 100, 200 | Tendance et pullback |
| RSI | 14 périodes | Momentum, surachat/survente |
| MACD | 12/26/9 | Croisement, histogram |
| ATR | 14 périodes | Volatilité réelle, calibrage TP/SL |
| Bollinger Bands | 20/2σ | Niveaux statistiques |
| Support/Résistance | 30 bougies | Niveaux structurels |

### Contexte marché (`market_context.py`)

Calcule avant toute analyse :
- **Phase** : trending_up · trending_down · ranging · breakout
- **Structure** : détection des pivots (swing high/low) → HH+HL ou LH+LL
- **Régime de volatilité** : ATR% → low / medium / high / extreme

### Confirmation structurelle (`confirmation.py`)

Vérifie que les conditions sont vraies sur **3 bougies M15 consécutives** :
- EMA20 > EMA50 (pour BUY)
- RSI > 45
- MACD histogram > 0
- Prix > EMA20

### Verrou de signal (`signal_lock.py`)

- Minimum **30 ticks** avant d'émettre le premier signal
- Signal verrouillé **5min** (confiance ≥ 80%) ou **3min**
- Recalcul uniquement à la clôture d'une bougie M5
- Invalidation immédiate si retournement détecté

### Prix cibles en attente (`pending_order.py`)

Quand la confiance est < 70%, calcule le prix exact où entrer pour atteindre ≥ 70% :
- Niveaux de support/résistance
- Bandes de Bollinger (lower/upper)
- EMA20/EMA50 dynamiques
- Retracements de Fibonacci (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- Alerte 🔔 si le prix est à moins de 0.3% du niveau cible

---

## Les 3 stratégies

### Stratégie 1 — Trend + Pullback (seuil ≥ 80/100)

Entrer uniquement dans le sens de la tendance, après un repli sur une EMA clé.

| Condition | Points |
|-----------|--------|
| Tendance EMA50/200 | 30 |
| Pullback EMA20/50 | 30 |
| Bougie de confirmation (engulfing, pin bar) | 20 |
| RSI en zone favorable | 20 |

### Stratégie 2 — Breakout + Retest (seuil ≥ 85/100)

Cassure d'un niveau clé suivie d'un retest réussi.

| Condition | Points |
|-----------|--------|
| Cassure validée (> 0.2 × ATR) | 40 |
| Retest du niveau cassé | 30 |
| Bougie post-retest | 20 |
| Filtre ATR (mouvement non épuisé) | 10 |

### Stratégie 3 — Multi-Timeframe H1/M15/M5 (seuil ≥ 70/100)

| Condition | Points |
|-----------|--------|
| Tendance H1 (EMA50 vs EMA200) | 30 |
| Confirmation M15 (pullback + RSI) | 35 |
| Déclencheur M5 (MACD + bougie engulfing) | 35 |

### Filtres anti-faux signaux (scorer.py)

Un signal est **bloqué** si :
- Dernière bougie M15 > 2 × ATR moyen (mouvement épuisé)
- Range < 1.5 × ATR (marché en consolidation étroite)
- Stratégie 1 et Stratégie 3 se contredisent (−10 pts)
- Moins de 2/3 stratégies actives et concordantes

**Décision finale :**
| Score | Label |
|-------|-------|
| 90-100 | Très fort |
| 80-89 | Fort |
| 70-79 | Moyen |
| < 70 | Ne pas entrer |

---

## Gestion du risque

### Mise recommandée

Calculée selon :
- Capital de l'utilisateur (configurable dans le dashboard)
- Score de confiance (60→100% → modulation)
- Alignement MTF (2/4 → 4/4 TF)
- Régime de volatilité (unstable = 0$)

| Alignement | Régime | Mise max |
|-----------|--------|----------|
| 4/4 TF | Calme | 3% du capital |
| 3/4 TF | Normal | 2% du capital |
| 2/4 TF | Normal | 1% du capital |
| < 2/4 | Tout | 0$ |
| Tout | Instable | 0$ |

### Plan de position (PositionCard)

Pour chaque signal BUY/SELL, le système calcule :
- **Take Profit** = ATR × facteur actif (1.5× à 2.5×)
- **Stop Loss** = ATR × 1.5
- **Risk/Reward** affiché (idéal ≥ 1:1.5)
- **Nombre de lots** (1 ou 2 selon R:R et confiance)
- **Durée suggérée** (adaptée à chaque actif, max 24h)
- **Nombre de répétitions** max (sans dépasser 10% du capital)
- **Message de sortie** : "Sortir à X.XX ou couper à Y.YY"

---

## Interface Dashboard

Le dashboard affiche en temps réel :

| Composant | Description |
|-----------|-------------|
| **AssetSelector** | Sélection de l'actif (Volatility / Boom / Crash / Step) |
| **CapitalSettings** | Saisie du capital + aperçu des mises 1%/2%/3% |
| **PriceCard** | Prix temps réel + variation + tendance |
| **SignalCard** | Signal MTF + 🔒 verrou + compte à rebours + mise |
| **MiniChart** | Graphique SVG + niveaux BB/Support/Résistance |
| **MarketContextCard** | Phase, structure HH/HL, swing levels, volatilité |
| **ConfirmationCard** | 3 bougies consécutives + conditions de surveillance |
| **PendingOrdersCard** | Prix cibles avec ≥70% confiance (si signal faible) |
| **StrategiesPanel** | Score des 3 stratégies, filtres, verdict global |
| **PositionCard** | TP/SL/lots/durée/répétitions/message de sortie |
| **MTFPanel** | Tableau 1h/15min/5min/1min avec direction et régime |
| **TickFeed** | Flux des derniers prix reçus |
| **FluxIndicator** | Étape active du flux (1→6) dans le header |

---

## API Backend

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Statut + compteurs bougies |
| GET | `/health` | Santé du système |
| WS | `/market/ws` | WebSocket temps réel (ticks + analyse) |
| GET | `/market/last-tick` | Dernier tick reçu |
| GET | `/market/ticks` | N derniers ticks |
| GET | `/analysis` | Dernière analyse MTF complète |
| POST | `/settings/amount` | Définir le capital |
| GET | `/settings/amount` | Lire le capital |
| POST | `/settings/symbol` | Changer l'actif surveillé |
| GET | `/assets` | Liste tous les actifs disponibles |

### Format message WebSocket

```json
{
  "type": "tick",
  "symbol": "R_50",
  "price": 90.46,
  "timestamp": 1720864500,
  "analysis": {
    "signal": { "type": "BUY", "confidence": 82, "advice": "...", "why": "..." },
    "signal_stability": { "locked": true, "remaining_seconds": 240, "remaining_label": "4min" },
    "context": { "phase": "trending_up", "structure": "bullish", ... },
    "confirmation": { "confirmed": true, "consecutive_candles": 3, ... },
    "invalidation": { "invalidated": false, ... },
    "stake": { "amount": 2.00, "pct_of_capital": 2.0, "enter_now": true },
    "position": { "take_profit": 90.78, "stop_loss": 90.15, "risk_reward": 1.8, ... },
    "pending_orders": [],
    "strategies": { "consensus": { "score": 82, "strategies_agree": 3 }, ... }
  }
}
```

---

## Variables d'environnement

```env
DERIV_APP_ID=1089          # App ID Deriv (1089 = app démo publique)
DERIV_API_TOKEN=           # Token personnel (optionnel pour données publiques)
```

Pour créer votre propre App ID : https://app.deriv.com/account/api-token

---

## Phases de développement

| Phase | Statut | Contenu |
|-------|--------|---------|
| **Phase 1 — MVP** | ✅ Terminé | Connexion Deriv, ticks R_50, dashboard basique |
| **Phase 2 — Indicateurs** | ✅ Terminé | EMA, RSI, MACD, Bollinger, Support/Résistance |
| **Phase 3 — MTF** | ✅ Terminé | 4 timeframes, bougies OHLC, analyse pondérée |
| **Phase 4 — Stratégies** | ✅ Terminé | 3 stratégies, scorer, filtres anti-faux signaux |
| **Phase 5 — Flux pro** | ✅ Terminé | Contexte, confirmation, verrou, invalidation, pending orders |
| **Phase 6 — Multi-actifs** | ✅ Terminé | Boom/Crash/Volatility/Step, position manager |
| **Phase 7 — IA/ML** | 🔲 Prévu | XGBoost/LSTM, prédictions, score de probabilité |
| **Phase 8 — Comptes** | 🔲 Prévu | Authentification, historique personnel, SaaS |
| **Phase 9 — Automatisation** | 🔲 Prévu | Exécution automatique via API Deriv |

---

## Notes importantes

> **Avertissement** : Cet assistant est un outil d'aide à la décision. Il ne garantit aucun gain. Tout trading comporte un risque de perte en capital. Ne jamais trader avec de l'argent que vous ne pouvez pas vous permettre de perdre.

> Les indices synthétiques Deriv (Volatility, Boom, Crash) sont des produits à fort effet de levier. Les Boom et Crash notamment peuvent générer des pertes ou des gains très rapides en quelques secondes.
