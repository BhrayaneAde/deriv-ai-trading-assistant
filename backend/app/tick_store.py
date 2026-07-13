"""
Stockage en mémoire des derniers ticks reçus.
Permet de partager les données entre le client Deriv et les routes WebSocket.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional
import time


@dataclass
class Tick:
    symbol: str
    price: float
    timestamp: float
    pip_size: float = 0.01


@dataclass
class TickStore:
    """Stocke les N derniers ticks en mémoire."""

    max_size: int = 500
    _ticks: Deque[Tick] = field(default_factory=lambda: deque(maxlen=500))
    _last_tick: Optional[Tick] = None

    def add(self, tick: Tick):
        self._ticks.append(tick)
        self._last_tick = tick

    @property
    def last(self) -> Optional[Tick]:
        return self._last_tick

    @property
    def all(self) -> list[Tick]:
        return list(self._ticks)

    def to_dict(self, tick: Tick) -> dict:
        return {
            "symbol": tick.symbol,
            "price": tick.price,
            "timestamp": tick.timestamp,
            "pip_size": tick.pip_size,
        }


# Instance partagée dans toute l'application
tick_store = TickStore()
