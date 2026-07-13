"""
Catalogue des actifs Deriv supportés.
Organisés par famille avec caractéristiques de trading.
"""

from dataclasses import dataclass


@dataclass
class Asset:
    symbol: str          # Symbole Deriv API
    label: str           # Nom affiché
    family: str          # "volatility" | "boom" | "crash" | "step"
    description: str
    # Caractéristiques
    pip_size: float
    typical_spread: float   # spread typique en pips
    # Profil de risque
    risk_profile: str    # "moderate" | "high" | "extreme"
    # Horizon recommandé (minutes)
    min_duration: int    # durée min conseillée (minutes)
    max_duration: int    # durée max conseillée (minutes)
    # Facteur de volatilité (pour calibrer TP/SL)
    volatility_factor: float  # multiplicateur ATR pour TP


ASSETS: dict[str, Asset] = {
    # ── Volatility Indices ──────────────────────────────
    "R_10": Asset(
        symbol="R_10", label="Volatility 10 Index", family="volatility",
        description="Volatilité simulée 10% — mouvements lents, adapté aux débutants",
        pip_size=0.001, typical_spread=0.5,
        risk_profile="moderate",
        min_duration=5, max_duration=240,
        volatility_factor=1.5,
    ),
    "R_25": Asset(
        symbol="R_25", label="Volatility 25 Index", family="volatility",
        description="Volatilité simulée 25% — bon équilibre risque/opportunité",
        pip_size=0.001, typical_spread=0.5,
        risk_profile="moderate",
        min_duration=5, max_duration=180,
        volatility_factor=1.5,
    ),
    "R_50": Asset(
        symbol="R_50", label="Volatility 50 Index", family="volatility",
        description="Volatilité simulée 50% — mouvements fréquents, populaire",
        pip_size=0.01, typical_spread=1.0,
        risk_profile="high",
        min_duration=3, max_duration=120,
        volatility_factor=1.5,
    ),
    "R_75": Asset(
        symbol="R_75", label="Volatility 75 Index", family="volatility",
        description="Volatilité simulée 75% — mouvements rapides",
        pip_size=0.01, typical_spread=1.5,
        risk_profile="high",
        min_duration=2, max_duration=60,
        volatility_factor=1.8,
    ),
    "R_100": Asset(
        symbol="R_100", label="Volatility 100 Index", family="volatility",
        description="Volatilité simulée 100% — très agité, pour traders expérimentés",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=30,
        volatility_factor=2.0,
    ),
    # ── Volatility (1s) ─────────────────────────────────
    "1HZ10V": Asset(
        symbol="1HZ10V", label="Volatility 10 (1s)", family="volatility",
        description="V10 sur ticks de 1 seconde — ultra court terme",
        pip_size=0.001, typical_spread=0.5,
        risk_profile="moderate",
        min_duration=1, max_duration=30,
        volatility_factor=1.5,
    ),
    "1HZ100V": Asset(
        symbol="1HZ100V", label="Volatility 100 (1s)", family="volatility",
        description="V100 sur ticks de 1 seconde — le plus volatil",
        pip_size=0.001, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=15,
        volatility_factor=2.0,
    ),
    # ── Boom Indices ────────────────────────────────────
    "BOOM300N": Asset(
        symbol="BOOM300N", label="Boom 300 Index", family="boom",
        description="Spike haussier environ toutes les 300 ticks — stratégie BUY uniquement",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=60,
        volatility_factor=2.5,
    ),
    "BOOM500": Asset(
        symbol="BOOM500", label="Boom 500 Index", family="boom",
        description="Spike haussier environ toutes les 500 ticks — BUY seulement",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=90,
        volatility_factor=2.5,
    ),
    "BOOM1000": Asset(
        symbol="BOOM1000", label="Boom 1000 Index", family="boom",
        description="Spike haussier environ toutes les 1000 ticks — moins fréquent",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=5, max_duration=120,
        volatility_factor=2.5,
    ),
    # ── Crash Indices ───────────────────────────────────
    "CRASH300N": Asset(
        symbol="CRASH300N", label="Crash 300 Index", family="crash",
        description="Spike baissier environ toutes les 300 ticks — SELL uniquement",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=60,
        volatility_factor=2.5,
    ),
    "CRASH500": Asset(
        symbol="CRASH500", label="Crash 500 Index", family="crash",
        description="Spike baissier environ toutes les 500 ticks — SELL seulement",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=1, max_duration=90,
        volatility_factor=2.5,
    ),
    "CRASH1000": Asset(
        symbol="CRASH1000", label="Crash 1000 Index", family="crash",
        description="Spike baissier environ toutes les 1000 ticks — moins fréquent",
        pip_size=0.01, typical_spread=2.0,
        risk_profile="extreme",
        min_duration=5, max_duration=120,
        volatility_factor=2.5,
    ),
    # ── Step Index ──────────────────────────────────────
    "stpRNG": Asset(
        symbol="stpRNG", label="Step Index", family="step",
        description="Mouvements de 0.1 réguliers — très prévisible, faible spread",
        pip_size=0.1, typical_spread=0.1,
        risk_profile="moderate",
        min_duration=5, max_duration=480,
        volatility_factor=1.2,
    ),
}


def get_asset(symbol: str) -> Asset:
    """Retourne l'asset ou R_50 par défaut."""
    return ASSETS.get(symbol, ASSETS["R_50"])


def get_assets_by_family(family: str) -> list[Asset]:
    return [a for a in ASSETS.values() if a.family == family]
