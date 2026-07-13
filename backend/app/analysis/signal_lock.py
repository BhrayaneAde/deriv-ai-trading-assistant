"""
Verrou de signal — stabilisation des décisions de trading.

Principe :
  Un signal est calculé à la clôture d'une bougie M5.
  Il reste VERROUILLÉ (inchangé) jusqu'à la clôture de la bougie suivante.
  Pendant cette fenêtre, les ticks ne font que mettre à jour le prix.

Cela évite les retournements parasites toutes les secondes.

Durée de validité par timeframe de référence :
  M5  →  5 minutes  (300 secondes)
  M15 →  15 minutes (900 secondes)
  M1  →  1 minute   (60 secondes)
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Timeframe de référence pour le verrou (en secondes)
# On utilise M5 : un signal reste valide 5 minutes
LOCK_DURATION_SECONDS = 300   # 5 minutes
MIN_TICKS_BEFORE_SIGNAL = 30  # nombre minimum de ticks avant d'émettre un signal


@dataclass
class LockedSignal:
    signal_type: str      # "BUY" | "SELL" | "NEUTRAL" | "WAIT"
    signal_label: str
    confidence: int
    advice: str
    why: str
    locked_at: float      # timestamp epoch
    valid_until: float    # timestamp epoch (locked_at + LOCK_DURATION)
    candle_epoch: int     # epoch de la bougie M5 qui a déclenché ce signal
    tick_count_at_lock: int  # nb de ticks au moment du verrou

    @property
    def is_valid(self) -> bool:
        return time.time() < self.valid_until

    @property
    def remaining_seconds(self) -> int:
        return max(0, int(self.valid_until - time.time()))

    @property
    def remaining_label(self) -> str:
        r = self.remaining_seconds
        if r >= 60:
            return f"{r // 60}min {r % 60}s"
        return f"{r}s"

    def to_dict(self) -> dict:
        return {
            "signal_type": self.signal_type,
            "signal_label": self.signal_label,
            "confidence": self.confidence,
            "advice": self.advice,
            "why": self.why,
            "locked_at": self.locked_at,
            "valid_until": self.valid_until,
            "candle_epoch": self.candle_epoch,
            "remaining_seconds": self.remaining_seconds,
            "remaining_label": self.remaining_label,
            "is_valid": self.is_valid,
        }


class SignalLockManager:
    """
    Gère le cycle de vie d'un signal verrouillé.

    Règles :
      1. Un nouveau signal ne peut être émis que si le verrou précédent est expiré
         OU si la bougie M5 a changé (nouvelle clôture).
      2. Un signal "NEUTRAL" ou "WAIT" n'est jamais verrouillé — on continue à chercher.
      3. Un signal BUY/SELL est verrouillé pour LOCK_DURATION_SECONDS.
      4. Si le signal change de direction (BUY → SELL) pendant la validité,
         on invalide immédiatement (protection contre retournement violent).
    """

    def __init__(self):
        self._locked: Optional[LockedSignal] = None
        self._last_candle_epoch: int = 0
        self._tick_count: int = 0
        self._signal_history: list[dict] = []  # max 20 entrées

    def increment_tick(self):
        self._tick_count += 1

    def should_recalculate(self, current_candle_epoch: int) -> bool:
        """
        Retourne True si on doit recalculer le signal.
        Conditions :
          - Pas encore assez de ticks (phase de collecte)
          - Pas de verrou actif
          - Verrou expiré
          - Nouvelle bougie M5 clôturée
        """
        if self._tick_count < MIN_TICKS_BEFORE_SIGNAL:
            return False  # pas encore assez de données

        if self._locked is None:
            return True  # pas encore de signal

        if not self._locked.is_valid:
            return True  # verrou expiré

        if current_candle_epoch > self._last_candle_epoch:
            return True  # nouvelle bougie → nouveau signal autorisé

        return False  # signal encore valide

    def lock(
        self,
        signal_type: str,
        signal_label: str,
        confidence: int,
        advice: str,
        why: str,
        candle_epoch: int,
        duration: int = LOCK_DURATION_SECONDS,
    ):
        """Verrouille un signal pour `duration` secondes."""
        # Ne pas verrouiller les signaux neutres — attendre un vrai signal
        if signal_type in ("NEUTRAL", "WAIT"):
            self._locked = None
            return

        now = time.time()
        self._locked = LockedSignal(
            signal_type=signal_type,
            signal_label=signal_label,
            confidence=confidence,
            advice=advice,
            why=why,
            locked_at=now,
            valid_until=now + duration,
            candle_epoch=candle_epoch,
            tick_count_at_lock=self._tick_count,
        )
        self._last_candle_epoch = candle_epoch

        # Historique
        self._signal_history.append({
            "time": now,
            "type": signal_type,
            "confidence": confidence,
            "candle_epoch": candle_epoch,
        })
        if len(self._signal_history) > 20:
            self._signal_history.pop(0)

        logger.info(
            f"Signal verrouillé : {signal_type} ({confidence}%) "
            f"— valide {duration}s jusqu'à {self._locked.remaining_label}"
        )

    def invalidate_on_reversal(self, new_direction: str):
        """
        Si le marché se retourne violemment (BUY → SELL ou inverse),
        on invalide immédiatement le verrou pour réagir.
        """
        if self._locked and self._locked.is_valid:
            if (self._locked.signal_type == "BUY"  and new_direction == "SELL") or \
               (self._locked.signal_type == "SELL" and new_direction == "BUY"):
                logger.warning(
                    f"Retournement détecté {self._locked.signal_type} → {new_direction} "
                    f"— verrou invalidé"
                )
                self._locked = None

    @property
    def current(self) -> Optional[LockedSignal]:
        if self._locked and self._locked.is_valid:
            return self._locked
        return None

    @property
    def tick_count(self) -> int:
        return self._tick_count

    def get_history(self) -> list[dict]:
        return list(self._signal_history)


# Instance globale partagée
signal_lock = SignalLockManager()
