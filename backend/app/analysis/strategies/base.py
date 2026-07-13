"""
Classes de base partagées par toutes les stratégies.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StrategySignal:
    name: str                    # nom de la stratégie
    direction: str               # "BUY" | "SELL" | "NEUTRAL"
    score: int                   # 0-100
    confidence_label: str        # "Très fort" | "Fort" | "Moyen" | "Faible"
    entry_reason: str            # pourquoi entrer (ou pas)
    conditions_met: list[str]    # conditions validées
    conditions_failed: list[str] # conditions non validées
    active: bool                 # score >= seuil minimum

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "direction": self.direction,
            "score": self.score,
            "confidence_label": self.confidence_label,
            "entry_reason": self.entry_reason,
            "conditions_met": self.conditions_met,
            "conditions_failed": self.conditions_failed,
            "active": self.active,
        }


def score_label(score: int) -> str:
    if score >= 90: return "Très fort"
    if score >= 80: return "Fort"
    if score >= 70: return "Moyen"
    return "Insuffisant"
