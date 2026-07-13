"""
Stockage des bougies OHLC par timeframe.
Chaque timeframe a son propre buffer circulaire.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional


# Timeframes supportés (secondes → label)
TIMEFRAMES: dict[int, str] = {
    60:   "1min",
    300:  "5min",
    900:  "15min",
    3600: "1h",
}


@dataclass
class Candle:
    timestamp: int   # epoch de début de bougie
    open: float
    high: float
    low: float
    close: float
    granularity: int  # en secondes


@dataclass
class CandleStore:
    """Stocke les N dernières bougies pour chaque timeframe."""

    max_candles: int = 250

    # granularity → deque de Candles
    _stores: dict[int, Deque[Candle]] = field(default_factory=dict)

    def __post_init__(self):
        for gran in TIMEFRAMES:
            self._stores[gran] = deque(maxlen=self.max_candles)

    def add_candle(self, candle: Candle):
        store = self._stores.get(candle.granularity)
        if store is None:
            return
        # Mise à jour si même timestamp (bougie en cours), sinon ajout
        if store and store[-1].timestamp == candle.timestamp:
            store[-1] = candle
        else:
            store.append(candle)

    def get_candles(self, granularity: int) -> list[Candle]:
        return list(self._stores.get(granularity, []))

    def get_closes(self, granularity: int) -> list[float]:
        return [c.close for c in self._stores.get(granularity, [])]

    def get_highs(self, granularity: int) -> list[float]:
        return [c.high for c in self._stores.get(granularity, [])]

    def get_lows(self, granularity: int) -> list[float]:
        return [c.low for c in self._stores.get(granularity, [])]

    def get_opens(self, granularity: int) -> list[float]:
        return [c.open for c in self._stores.get(granularity, [])]

    def count(self, granularity: int) -> int:
        return len(self._stores.get(granularity, []))

    def last_candle(self, granularity: int) -> Optional[Candle]:
        store = self._stores.get(granularity)
        if store:
            return store[-1]
        return None


# Instance globale partagée
candle_store = CandleStore()
