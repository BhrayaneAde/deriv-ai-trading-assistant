"""
Gestionnaire des connexions WebSocket côté clients (frontend React).
Diffuse les données à tous les clients connectés.
"""

import logging
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Gère les connexions WebSocket des clients frontend."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connecté. Total : {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"Client déconnecté. Total : {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Envoie un message JSON à tous les clients connectés."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Nettoyage des connexions mortes
        for conn in disconnected:
            self.disconnect(conn)


# Instance partagée
manager = ConnectionManager()
