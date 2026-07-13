"""
Routes WebSocket et REST pour les données de marché.
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.connection_manager import manager
from app.tick_store import tick_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])


@router.websocket("/ws")
async def websocket_market(websocket: WebSocket):
    """
    WebSocket endpoint pour le frontend.
    Le client se connecte ici et reçoit les ticks en temps réel.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Maintenir la connexion ouverte, attendre les messages du client
            data = await websocket.receive_text()
            # Pour l'instant on ignore les messages entrants (phase MVP)
            logger.debug(f"Message client reçu : {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/last-tick")
async def get_last_tick():
    """Retourne le dernier tick reçu."""
    tick = tick_store.last
    if not tick:
        return {"status": "no_data", "message": "Aucun tick reçu pour l'instant"}
    return tick_store.to_dict(tick)


@router.get("/ticks")
async def get_ticks(limit: int = 50):
    """Retourne les derniers N ticks."""
    ticks = tick_store.all[-limit:]
    return [tick_store.to_dict(t) for t in ticks]
