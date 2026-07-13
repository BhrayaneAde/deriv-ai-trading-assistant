"""
Orchestrateur des 3 stratégies + filtres anti-faux signaux.

Retourne le signal consolidé final avec :
  - Score de chaque stratégie
  - Consensus entre stratégies
  - Score global final
  - Filtres appliqués
"""

from dataclasses import dataclass, field
from typing import Optional

from app.analysis.strategies import trend_pullback, breakout_retest, multi_tf
from app.analysis.strategies.base import StrategySignal, score_label


@dataclass
class ScorerResult:
    # Résultats individuels
    trend_pullback: StrategySignal
    breakout_retest: StrategySignal
    multi_timeframe: StrategySignal

    # Consensus
    final_direction: str    # "BUY" | "SELL" | "NEUTRAL"
    final_score: int        # 0-100
    final_label: str        # "Très fort" | "Fort" | "Moyen" | "Insuffisant"
    strategies_agree: int   # combien de stratégies actives et dans le même sens

    # Filtres anti-faux signaux
    filters_passed: list[str]
    filters_failed: list[str]
    filtered_out: bool      # True = signal bloqué par un filtre

    # Message final
    verdict: str
    enter_now: bool

    def to_dict(self) -> dict:
        return {
            "strategies": {
                "trend_pullback": self.trend_pullback.to_dict(),
                "breakout_retest": self.breakout_retest.to_dict(),
                "multi_timeframe": self.multi_timeframe.to_dict(),
            },
            "consensus": {
                "direction": self.final_direction,
                "score": self.final_score,
                "label": self.final_label,
                "strategies_agree": self.strategies_agree,
            },
            "filters": {
                "passed": self.filters_passed,
                "failed": self.filters_failed,
                "blocked": self.filtered_out,
            },
            "verdict": self.verdict,
            "enter_now": self.enter_now,
        }


def run_all(
    # Données complètes par TF
    closes_h1: list[float], opens_h1: list[float],
    highs_h1: list[float], lows_h1: list[float],
    ema50_h1: Optional[float], ema200_h1: Optional[float],

    closes_m15: list[float], opens_m15: list[float],
    highs_m15: list[float], lows_m15: list[float],
    ema20_m15: Optional[float], ema50_m15: Optional[float],
    ema200_m15: Optional[float],
    rsi_m15: Optional[float],
    support_m15: Optional[float], resistance_m15: Optional[float],
    atr_m15: Optional[float], atr_mean_m15: Optional[float],

    closes_m5: list[float], opens_m5: list[float],
    highs_m5: list[float], lows_m5: list[float],
    ema20_m5: Optional[float], ema50_m5: Optional[float],
    ema200_m5: Optional[float],
    rsi_m5: Optional[float],
    macd_line_m5: Optional[float], macd_signal_m5: Optional[float],
    macd_prev_m5: Optional[float], macd_signal_prev_m5: Optional[float],
    atr_m5: Optional[float],

    current_price: float,
) -> ScorerResult:

    filters_passed: list[str] = []
    filters_failed: list[str] = []

    # ── Stratégie 1 : Trend + Pullback (sur M15) ──
    sig1 = trend_pullback.run(
        closes=closes_m15, opens=opens_m15,
        highs=highs_m15, lows=lows_m15,
        ema20=ema20_m15, ema50=ema50_m15, ema200=ema200_m15,
        rsi14=rsi_m15, atr=atr_m15,
    )

    # ── Stratégie 2 : Breakout + Retest (sur M15) ──
    sig2 = breakout_retest.run(
        closes=closes_m15, opens=opens_m15,
        highs=highs_m15, lows=lows_m15,
        atr=atr_m15, atr_mean=atr_mean_m15,
    )

    # ── Stratégie 3 : Multi-TF (H1 + M15 + M5) ──
    sig3 = multi_tf.run(
        ema50_h1=ema50_h1, ema200_h1=ema200_h1,
        price_m15=closes_m15[-1] if closes_m15 else None,
        ema20_m15=ema20_m15,
        support_m15=support_m15, resistance_m15=resistance_m15,
        rsi_m15=rsi_m15, atr_m15=atr_m15,
        closes_m5=closes_m5, opens_m5=opens_m5,
        highs_m5=highs_m5, lows_m5=lows_m5,
        macd_line_m5=macd_line_m5, macd_signal_m5=macd_signal_m5,
        macd_prev_m5=macd_prev_m5, macd_signal_prev_m5=macd_signal_prev_m5,
    )

    # ── Consensus ──
    active_sigs = [s for s in [sig1, sig2, sig3] if s.active]
    buy_sigs  = [s for s in active_sigs if s.direction == "BUY"]
    sell_sigs = [s for s in active_sigs if s.direction == "SELL"]

    if len(buy_sigs) >= 2:
        final_dir = "BUY"
        agree = len(buy_sigs)
        avg_score = int(sum(s.score for s in buy_sigs) / len(buy_sigs))
    elif len(sell_sigs) >= 2:
        final_dir = "SELL"
        agree = len(sell_sigs)
        avg_score = int(sum(s.score for s in sell_sigs) / len(sell_sigs))
    elif len(active_sigs) == 1:
        final_dir = active_sigs[0].direction
        agree = 1
        avg_score = active_sigs[0].score
    else:
        final_dir = "NEUTRAL"
        agree = 0
        avg_score = 0

    # Bonus si 3/3 stratégies d'accord
    if agree == 3:
        avg_score = min(avg_score + 5, 100)
        filters_passed.append("3/3 stratégies concordent (+5 bonus)")

    # ── Filtres anti-faux signaux ──
    filtered_out = False

    # Filtre 1 : Mouvement épuisé (dernière bougie M15 > 2×ATR moyen)
    if atr_mean_m15 and len(closes_m15) >= 2 and len(opens_m15) >= 2:
        last_body = abs(closes_m15[-1] - opens_m15[-1])
        if last_body > 2 * atr_mean_m15:
            filters_failed.append(
                f"⚠ Bougie M15 trop grande ({last_body:.4f} > 2×ATR {2*atr_mean_m15:.4f}) "
                "— mouvement potentiellement épuisé"
            )
            filtered_out = True
        else:
            filters_passed.append("Taille bougie M15 normale (< 2×ATR)")

    # Filtre 2 : Prix entre deux niveaux sans direction (range étroit)
    if support_m15 and resistance_m15 and atr_m15:
        range_size = resistance_m15 - support_m15
        if range_size < atr_m15 * 1.5:
            filters_failed.append(
                f"⚠ Range trop étroit ({range_size:.4f} < 1.5×ATR) — marché en consolidation"
            )
            filtered_out = True
        else:
            filters_passed.append(f"Range suffisant ({range_size:.4f} ≥ 1.5×ATR)")

    # Filtre 3 : Indicateurs contradictoires (MACD vs tendance H1)
    if sig3.direction != "NEUTRAL" and sig1.direction != "NEUTRAL":
        if sig1.direction != sig3.direction:
            filters_failed.append(
                f"⚠ Contradiction : Trend+Pullback dit {sig1.direction} "
                f"mais MTF dit {sig3.direction}"
            )
            # Pas de blocage total — juste un avertissement, réduction du score
            avg_score = max(0, avg_score - 10)
        else:
            filters_passed.append(f"Stratégie 1 et 3 concordent ({sig1.direction})")

    # Filtre 4 : Consensus insuffisant
    if agree < 2 and final_dir != "NEUTRAL":
        filters_failed.append(
            f"⚠ Seulement 1/3 stratégie active — signal non confirmé"
        )
        filtered_out = True
    elif agree >= 2:
        filters_passed.append(f"{agree}/3 stratégies actives et concordantes")

    # ── Verdict final ──
    final_label = score_label(avg_score)
    enter_now = not filtered_out and final_dir != "NEUTRAL" and avg_score >= 70

    if filtered_out:
        verdict = (
            f"🚫 Signal {final_dir} BLOQUÉ par les filtres. "
            f"Raisons : {' | '.join(filters_failed[:2])}. Attendre."
        )
    elif enter_now:
        verdict = (
            f"✅ Signal {final_dir} — {final_label} ({avg_score}/100). "
            f"{agree}/3 stratégies confirment. Conditions réunies."
        )
    else:
        verdict = (
            f"⏳ Signal insuffisant ({avg_score}/100 — {agree}/3 stratégies). "
            "Attendre que 2+ stratégies se synchronisent."
        )

    return ScorerResult(
        trend_pullback=sig1,
        breakout_retest=sig2,
        multi_timeframe=sig3,
        final_direction=final_dir,
        final_score=avg_score,
        final_label=final_label,
        strategies_agree=agree,
        filters_passed=filters_passed,
        filters_failed=filters_failed,
        filtered_out=filtered_out,
        verdict=verdict,
        enter_now=enter_now,
    )
