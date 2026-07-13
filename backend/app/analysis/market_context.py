"""
Étape 1 du flux : Contexte du marché.

Détermine AVANT toute analyse :
  - La phase de marché (tendance, range, breakout, consolidation)
  - La structure (Higher Highs/Lows ou Lower Highs/Lows)
  - Le régime de volatilité global
  - Les niveaux structurels clés (swing H/L)

Le contexte ne change pas à chaque tick.
Il est recalculé à chaque nouvelle bougie M15.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class MarketContext:
    # Phase
    phase: str           # "trending_up" | "trending_down" | "ranging" | "breakout" | "unknown"
    phase_label: str     # texte lisible
    phase_strength: int  # 0-100

    # Structure de marché (HH/HL ou LH/LL)
    structure: str       # "bullish" | "bearish" | "mixed" | "unknown"
    structure_label: str
    last_hh: Optional[float]   # dernier Higher High
    last_hl: Optional[float]   # dernier Higher Low
    last_lh: Optional[float]   # dernier Lower High
    last_ll: Optional[float]   # dernier Lower Low

    # Niveaux structurels (swing sur 50 bougies)
    swing_high: Optional[float]
    swing_low: Optional[float]
    range_size: Optional[float]  # distance entre swing H et L

    # Volatilité globale
    volatility: str      # "low" | "medium" | "high" | "extreme"
    volatility_label: str
    atr_pct: Optional[float]

    # Durée estimée de la phase (en bougies)
    phase_duration: int  # depuis combien de bougies cette phase dure

    def to_dict(self) -> dict:
        return {
            "phase": self.phase,
            "phase_label": self.phase_label,
            "phase_strength": self.phase_strength,
            "structure": self.structure,
            "structure_label": self.structure_label,
            "levels": {
                "swing_high": self.swing_high,
                "swing_low": self.swing_low,
                "range_size": self.range_size,
                "last_hh": self.last_hh,
                "last_hl": self.last_hl,
                "last_lh": self.last_lh,
                "last_ll": self.last_ll,
            },
            "volatility": {
                "regime": self.volatility,
                "label": self.volatility_label,
                "atr_pct": self.atr_pct,
            },
            "phase_duration": self.phase_duration,
        }


def _find_swings(highs: list[float], lows: list[float], window: int = 3):
    """
    Détecte les pivots (swing highs et swing lows).
    Un pivot high = high[i] > max des `window` voisins de chaque côté.
    """
    pivot_highs = []
    pivot_lows = []
    n = len(highs)

    for i in range(window, n - window):
        if all(highs[i] >= highs[j] for j in range(i - window, i + window + 1) if j != i):
            pivot_highs.append((i, highs[i]))
        if all(lows[i] <= lows[j] for j in range(i - window, i + window + 1) if j != i):
            pivot_lows.append((i, lows[i]))

    return pivot_highs, pivot_lows


def _detect_structure(
    pivot_highs: list[tuple],
    pivot_lows: list[tuple],
) -> tuple[str, str, Optional[float], Optional[float], Optional[float], Optional[float]]:
    """
    Détermine la structure HH/HL (bullish) ou LH/LL (bearish).
    Retourne (structure, label, last_hh, last_hl, last_lh, last_ll)
    """
    if len(pivot_highs) < 2 or len(pivot_lows) < 2:
        return "unknown", "Structure inconnue", None, None, None, None

    # 2 derniers pivots hauts et bas
    ph1, ph2 = pivot_highs[-2][1], pivot_highs[-1][1]
    pl1, pl2 = pivot_lows[-2][1], pivot_lows[-1][1]

    hh = ph2 > ph1   # Higher High
    hl = pl2 > pl1   # Higher Low
    lh = ph2 < ph1   # Lower High
    ll = pl2 < pl1   # Lower Low

    last_hh = ph2 if hh else None
    last_hl = pl2 if hl else None
    last_lh = ph2 if lh else None
    last_ll = pl2 if ll else None

    if hh and hl:
        return "bullish", "Structure haussière (HH + HL)", last_hh, last_hl, None, None
    elif lh and ll:
        return "bearish", "Structure baissière (LH + LL)", None, None, last_lh, last_ll
    elif hh and ll:
        return "mixed", "Structure mixte (HH + LL)", last_hh, None, None, last_ll
    elif lh and hl:
        return "mixed", "Structure mixte (LH + HL)", None, last_hl, last_lh, None
    else:
        return "mixed", "Structure indéterminée", None, None, None, None


def _detect_phase(
    closes: list[float],
    ema20: Optional[float],
    ema50: Optional[float],
    atr: Optional[float],
    swing_high: Optional[float],
    swing_low: Optional[float],
    structure: str,
) -> tuple[str, str, int, int]:
    """
    Détermine la phase du marché.
    Retourne (phase, label, strength, duration)
    """
    if len(closes) < 20:
        return "unknown", "Données insuffisantes", 0, 0

    price = closes[-1]

    # Durée de la tendance : combien de bougies depuis le dernier pivot
    # Estimation simple : bougies consécutives au-dessus/sous EMA20
    if ema20:
        above = sum(1 for c in closes[-20:] if c > ema20)
        below = sum(1 for c in closes[-20:] if c < ema20)
        duration = max(above, below)
    else:
        duration = 0

    # Range check : si range < 1.5 × ATR sur 20 bougies → ranging
    if swing_high and swing_low and atr:
        range_size = swing_high - swing_low
        if range_size < atr * 3:
            return "ranging", "Marché en range (consolidation)", 40, duration

    # Breakout : prix vient de casser swing_high ou swing_low
    if swing_high and atr and price > swing_high - atr * 0.3:
        return "breakout", "Breakout haussier en cours ⚡", 85, duration
    if swing_low and atr and price < swing_low + atr * 0.3:
        return "breakout", "Breakdown baissier en cours ⚡", 85, duration

    # Tendance basée sur structure
    if structure == "bullish" and ema20 and ema50 and ema20 > ema50:
        strength = min(int(((ema20 - ema50) / ema50) * 1000), 100)
        return "trending_up", "Tendance haussière confirmée ↑", max(strength, 60), duration
    if structure == "bearish" and ema20 and ema50 and ema20 < ema50:
        strength = min(int(((ema50 - ema20) / ema50) * 1000), 100)
        return "trending_down", "Tendance baissière confirmée ↓", max(strength, 60), duration

    return "ranging", "Marché sans direction claire", 30, duration


def _volatility_level(atr_pct: Optional[float]) -> tuple[str, str]:
    if atr_pct is None:
        return "unknown", "Inconnue"
    if atr_pct < 0.03:
        return "low",     "Faible — conditions calmes"
    elif atr_pct < 0.10:
        return "medium",  "Modérée — conditions normales"
    elif atr_pct < 0.25:
        return "high",    "Élevée — prudence recommandée"
    else:
        return "extreme", "Extrême ⚠ — risque maximal"


def compute_market_context(
    closes: list[float],
    highs: list[float],
    lows: list[float],
    ema20: Optional[float],
    ema50: Optional[float],
    atr_val: Optional[float],
    price: float,
) -> MarketContext:
    """
    Calcule le contexte complet du marché à partir des bougies M15.
    """
    if len(closes) < 10:
        return MarketContext(
            phase="unknown", phase_label="Données insuffisantes", phase_strength=0,
            structure="unknown", structure_label="Données insuffisantes",
            last_hh=None, last_hl=None, last_lh=None, last_ll=None,
            swing_high=None, swing_low=None, range_size=None,
            volatility="unknown", volatility_label="Inconnue", atr_pct=None,
            phase_duration=0,
        )

    # Swing high/low global (50 dernières bougies)
    window = min(50, len(closes))
    swing_high = max(highs[-window:])
    swing_low  = min(lows[-window:])
    range_size = round(swing_high - swing_low, 4)

    # ATR en %
    atr_pct = round((atr_val / price) * 100, 4) if atr_val and price else None

    # Pivots et structure
    pivot_highs, pivot_lows = _find_swings(highs, lows, window=3)
    structure, struct_label, last_hh, last_hl, last_lh, last_ll = _detect_structure(
        pivot_highs, pivot_lows
    )

    # Phase
    phase, phase_label, phase_strength, phase_duration = _detect_phase(
        closes=closes, ema20=ema20, ema50=ema50,
        atr=atr_val, swing_high=swing_high, swing_low=swing_low,
        structure=structure,
    )

    vol_regime, vol_label = _volatility_level(atr_pct)

    return MarketContext(
        phase=phase,
        phase_label=phase_label,
        phase_strength=phase_strength,
        structure=structure,
        structure_label=struct_label,
        last_hh=last_hh, last_hl=last_hl,
        last_lh=last_lh, last_ll=last_ll,
        swing_high=round(swing_high, 4),
        swing_low=round(swing_low, 4),
        range_size=range_size,
        volatility=vol_regime,
        volatility_label=vol_label,
        atr_pct=atr_pct,
        phase_duration=phase_duration,
    )
