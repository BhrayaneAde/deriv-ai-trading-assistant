"""
Point d'entrée FastAPI.
Démarre la connexion Deriv et souscrit aux ticks + bougies 4 TF.
"""

import asyncio
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.candle_store import TIMEFRAMES
from app.config import settings
from app.connection_manager import manager
from app.deriv_client import DerivClient, on_tick
from app.tick_store import Tick, tick_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Deriv AI Trading Assistant",
    description="Backend MTF connecté à Deriv",
    version="2.0.0",
)

import os

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if os.environ.get("FRONTEND_URL"):
    CORS_ORIGINS.append(os.environ["FRONTEND_URL"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import market
app.include_router(market.router)

from app.routers import account as account_router
app.include_router(account_router.router)

deriv_client = DerivClient()

# État utilisateur (modifiable via API)
_base_amount: float = 100.0
_current_symbol: str = "R_50"


async def on_tick_received(tick_data: dict):
    """Callback tick → analyse MTF → broadcast tick + bougie courante."""
    from app.analysis.engine import analyze
    from app.routers.market import build_candle_update

    tick = Tick(
        symbol=tick_data.get("symbol", "R_50"),
        price=float(tick_data.get("quote", 0)),
        timestamp=float(tick_data.get("epoch", time.time())),
        pip_size=float(tick_data.get("pip_size", 0.01)),
    )
    tick_store.add(tick)

    result = analyze(symbol=tick.symbol, base_amount=_base_amount)

    # Message principal : tick + analyse
    message: dict = {
        "type": "tick",
        "symbol": tick.symbol,
        "price": tick.price,
        "timestamp": tick.timestamp,
    }
    if result:
        message["analysis"] = result.to_dict()

    await manager.broadcast(message)

    # Mise à jour de la bougie en cours sur chaque TF
    for gran in TIMEFRAMES:
        candle_msg = build_candle_update(gran)
        if candle_msg:
            await manager.broadcast(candle_msg)


async def _connect_account(mgr):
    """Connexion compte avec retry."""
    for attempt in range(3):
        ok = await mgr.connect_and_authorize()
        if ok:
            await mgr.fetch_account_info()
            logger.info(f"Compte connecté : {mgr.info.loginid if mgr.info else 'N/A'}")
            return
        logger.warning(f"Tentative {attempt+1}/3 échouée — retry dans 5s")
        await asyncio.sleep(5)
    logger.error("Impossible de connecter le compte après 3 tentatives")


async def run_deriv_connection():
    """Connexion Deriv avec reconnexion automatique."""
    on_tick(on_tick_received)

    while True:
        try:
            await deriv_client.connect()
            await deriv_client.subscribe_ticks(_current_symbol)
            for gran in TIMEFRAMES:
                await deriv_client.fetch_candles(_current_symbol, gran, count=200)
                await asyncio.sleep(0.5)

            # Envoyer le snapshot des bougies à tous les clients connectés
            # (utile quand on change d'actif en cours de session)
            await asyncio.sleep(1.0)  # laisser le temps aux bougies d'arriver
            from app.routers.market import _build_candles_snapshot
            snapshot = _build_candles_snapshot()
            if snapshot:
                await manager.broadcast({
                    "type": "candles_snapshot",
                    "data": snapshot,
                })
                logger.info(f"Snapshot bougies broadcasté pour {_current_symbol}")

            await deriv_client.listen()

        except Exception as e:
            logger.error(f"Erreur connexion Deriv : {e}")
            deriv_client.connected = False
            logger.info("Reconnexion dans 5 secondes...")
            await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event():
    logger.info("Démarrage Deriv AI Trading Assistant v2")
    asyncio.create_task(run_deriv_connection())
    # Connexion compte si token disponible
    if settings.deriv_api_token:
        from app.account import account_manager
        asyncio.create_task(_connect_account(account_manager))
    else:
        logger.info("Pas de token API — mode données publiques uniquement")


@app.on_event("shutdown")
async def shutdown_event():
    await deriv_client.disconnect()


@app.get("/")
async def root():
    from app.candle_store import candle_store
    return {
        "status": "running",
        "deriv_connected": deriv_client.connected,
        "ticks": len(tick_store.all),
        "candles": {
            TIMEFRAMES[g]: candle_store.count(g) for g in TIMEFRAMES
        },
    }


@app.get("/health")
async def health():
    from app.candle_store import candle_store
    return {
        "status": "ok",
        "deriv_connected": deriv_client.connected,
        "clients_connected": len(manager.active_connections),
        "ticks_stored": len(tick_store.all),
        "candles": {TIMEFRAMES[g]: candle_store.count(g) for g in TIMEFRAMES},
    }


@app.get("/analysis")
async def get_analysis(amount: float = 100.0):
    """Retourne la dernière analyse MTF complète."""
    from app.analysis.engine import analyze
    result = analyze(base_amount=amount)
    if not result:
        return {"status": "no_data"}
    return result.to_dict()


@app.post("/settings/amount")
async def set_base_amount(amount: float):
    """Met à jour le montant de base de l'utilisateur."""
    global _base_amount
    if amount < 1:
        return {"error": "Montant minimum : 1$"}
    _base_amount = amount
    return {"status": "ok", "base_amount": _base_amount}


@app.get("/settings/amount")
async def get_base_amount():
    return {"base_amount": _base_amount}


@app.post("/settings/symbol")
async def set_symbol(symbol: str):
    """Change l'actif surveillé, vide les stores et force une reconnexion."""
    from app.assets import ASSETS
    from app.candle_store import candle_store, CandleStore
    from app.analysis.signal_lock import signal_lock
    global _current_symbol

    if symbol not in ASSETS:
        return {"error": f"Actif inconnu : {symbol}. Disponibles : {list(ASSETS.keys())}"}

    _current_symbol = symbol

    # Vider les stores pour ne pas mélanger les données de deux actifs différents
    tick_store._ticks.clear()
    tick_store._last_tick = None

    # Réinitialiser le candle store
    for gran in TIMEFRAMES:
        candle_store._stores[gran].clear()

    # Réinitialiser le verrou de signal
    signal_lock._locked = None
    signal_lock._tick_count = 0
    signal_lock._last_candle_epoch = 0

    # Force reconnexion — la boucle va redémarrer avec le nouveau symbole
    await deriv_client.disconnect()

    logger.info(f"Actif changé → {symbol}")
    return {"status": "ok", "symbol": _current_symbol}


@app.get("/assets")
async def list_assets():
    """Liste tous les actifs disponibles."""
    from app.assets import ASSETS
    return {
        sym: {
            "label": a.label,
            "family": a.family,
            "description": a.description,
            "risk_profile": a.risk_profile,
        }
        for sym, a in ASSETS.items()
    }
