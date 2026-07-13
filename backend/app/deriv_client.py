"""
Client WebSocket Deriv.
- Ticks temps réel
- Bougies OHLC historiques + temps réel sur 4 timeframes (1min, 5min, 15min, 1h)
"""

import asyncio
import json
import logging
from typing import Callable, Optional

import websockets
from websockets.exceptions import ConnectionClosed

from app.candle_store import TIMEFRAMES, Candle, candle_store
from app.config import settings

logger = logging.getLogger(__name__)

# Callbacks
_tick_callbacks: list[Callable] = []


def on_tick(callback: Callable):
    """Enregistre un callback appelé à chaque nouveau tick."""
    _tick_callbacks.append(callback)


class DerivClient:
    def __init__(self):
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.connected = False

    async def connect(self):
        url = f"{settings.deriv_ws_url}?app_id={settings.deriv_app_id}"
        logger.info(f"Connexion à Deriv : {url}")
        self.ws = await websockets.connect(url, ping_interval=30, ping_timeout=10)
        self.connected = True
        logger.info("Connecté à Deriv WebSocket")

    async def _send(self, payload: dict):
        if self.ws:
            await self.ws.send(json.dumps(payload))

    async def subscribe_ticks(self, symbol: str = "R_50"):
        """Souscrit aux ticks temps réel."""
        await self._send({"ticks": symbol, "subscribe": 1})
        logger.info(f"Souscription ticks : {symbol}")

    async def fetch_candles(self, symbol: str, granularity: int, count: int = 200):
        """
        Récupère l'historique des bougies OHLC + souscrit aux mises à jour.
        granularity en secondes : 60=1min, 300=5min, 900=15min, 3600=1h
        """
        await self._send({
            "ticks_history": symbol,
            "adjust_start_time": 1,
            "count": count,
            "end": "latest",
            "granularity": granularity,
            "start": 1,
            "style": "candles",
            "subscribe": 1,
        })
        logger.info(f"Souscription bougies {TIMEFRAMES.get(granularity, granularity)} pour {symbol}")

    async def listen(self):
        """Boucle principale d'écoute des messages Deriv."""
        if not self.ws:
            raise RuntimeError("Non connecté.")
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                mtype = msg.get("msg_type")

                if mtype == "tick":
                    tick = msg.get("tick", {})
                    for cb in _tick_callbacks:
                        await cb(tick)

                elif mtype == "candles":
                    # Historique initial des bougies
                    gran = msg.get("echo_req", {}).get("granularity", 60)
                    for c in msg.get("candles", []):
                        candle_store.add_candle(Candle(
                            timestamp=int(c["epoch"]),
                            open=float(c["open"]),
                            high=float(c["high"]),
                            low=float(c["low"]),
                            close=float(c["close"]),
                            granularity=gran,
                        ))
                    logger.info(
                        f"Bougies reçues TF {TIMEFRAMES.get(gran, gran)} : "
                        f"{candle_store.count(gran)} bougies"
                    )

                elif mtype == "ohlc":
                    # Mise à jour bougie en cours
                    ohlc = msg.get("ohlc", {})
                    gran = int(ohlc.get("granularity", 60))
                    candle_store.add_candle(Candle(
                        timestamp=int(ohlc["open_time"]),
                        open=float(ohlc["open"]),
                        high=float(ohlc["high"]),
                        low=float(ohlc["low"]),
                        close=float(ohlc["close"]),
                        granularity=gran,
                    ))

                elif mtype == "error":
                    logger.error(f"Erreur Deriv : {msg.get('error')}")

        except ConnectionClosed:
            logger.warning("Connexion Deriv fermée.")
            self.connected = False

    async def disconnect(self):
        if self.ws:
            await self.ws.close()
            self.connected = False
            logger.info("Déconnecté de Deriv")
