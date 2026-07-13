"""
Stratégie 2 : Breakout + Retest
═════════════════════════════════
Le marché sort d'une consolidation, casse un niveau clé,
puis revient le retester avant de continuer.

Score max : 100 pts
  Cassure validée  : 40 pts
  Retest réussi    : 30 pts
  Bougie après RT  : 20 pts
  ATR filtre       : 10 pts

Seuil d'entrée : ≥ 85 pts
"""

from typing import Optional
from app.analysis.strategies.base import StrategySignal, score_label


def _find_consolidation(
    highs: list[float], lows: list[float], window: int = 20
) -> tuple[Optional[float], Optional[float]]:
    """
    Trouve la zone de consolidation (range) sur les N dernières bougies.
    Retourne (résistance, support) ou (None, None).
    """
    if len(highs) < window:
        return None, None
    h = highs[-window:]
    l = lows[-window:]
    return round(max(h), 4), round(min(l), 4)


def run(
    closes: list[float],
    opens: list[float],
    highs: list[float],
    lows: list[float],
    atr: Optional[float],
    atr_mean: Optional[float],   # ATR moyen sur 20 périodes
) -> StrategySignal:
    """
    Évalue la stratégie Breakout + Retest.
    atr_mean : valeur moyenne de l'ATR pour comparer la taille de la cassure.
    """
    MIN_SCORE = 85
    met: list[str] = []
    failed: list[str] = []

    if len(closes) < 5:
        return StrategySignal(
            name="Breakout + Retest",
            direction="NEUTRAL", score=0,
            confidence_label="Insuffisant",
            entry_reason="Données insuffisantes",
            conditions_met=[], conditions_failed=[], active=False,
        )

    price = closes[-1]
    prev_close = closes[-2]

    # Zone de consolidation sur les 20 bougies AVANT la dernière
    resistance, support = _find_consolidation(highs[:-1], lows[:-1], 20)
    if resistance is None or support is None:
        return StrategySignal(
            name="Breakout + Retest",
            direction="NEUTRAL", score=0,
            confidence_label="Insuffisant",
            entry_reason="Zone de consolidation non détectée",
            conditions_met=[], conditions_failed=[], active=False,
        )

    range_size = resistance - support
    atr_ref = atr or (range_size * 0.1)
    atr_mean_ref = atr_mean or atr_ref
    min_breakout = 0.2 * atr_ref   # cassure valide = au moins 0.2 ATR au-delà du niveau

    # ──────────────────────────────────────────────
    # 1. CASSURE VALIDÉE — 40 pts
    # ──────────────────────────────────────────────
    breakout_score = 0
    direction = "NEUTRAL"
    broken_level = 0.0

    if prev_close > resistance + min_breakout:
        breakout_score = 40
        direction = "BUY"
        broken_level = resistance
        met.append(f"Cassure haussière de la résistance {resistance:.2f} [+40]")
    elif prev_close < support - min_breakout:
        breakout_score = 40
        direction = "SELL"
        broken_level = support
        met.append(f"Cassure baissière du support {support:.2f} [+40]")
    else:
        failed.append(
            f"Pas de cassure — prix entre {support:.2f} et {resistance:.2f} "
            f"(min requis : {min_breakout:.4f}) [0]"
        )
        return StrategySignal(
            name="Breakout + Retest",
            direction="NEUTRAL", score=0,
            confidence_label="Insuffisant",
            entry_reason="Pas de cassure détectée — attendre sortie du range",
            conditions_met=met, conditions_failed=failed, active=False,
        )

    # ──────────────────────────────────────────────
    # 2. RETEST DU NIVEAU CASSÉ — 30 pts
    # ──────────────────────────────────────────────
    retest_score = 0
    retest_tolerance = atr_ref * 0.6

    if direction == "BUY":
        # Le prix est revenu tester l'ancienne résistance (maintenant support)
        if abs(price - broken_level) <= retest_tolerance and price >= broken_level - retest_tolerance:
            retest_score = 30
            met.append(f"Retest du niveau {broken_level:.2f} réussi [+30]")
        else:
            failed.append(f"Retest pas encore confirmé (prix {price:.2f}, niveau {broken_level:.2f}) [0]")
    else:
        # Retest de l'ancien support (maintenant résistance)
        if abs(price - broken_level) <= retest_tolerance and price <= broken_level + retest_tolerance:
            retest_score = 30
            met.append(f"Retest du niveau {broken_level:.2f} réussi [+30]")
        else:
            failed.append(f"Retest pas encore confirmé (prix {price:.2f}, niveau {broken_level:.2f}) [0]")

    # ──────────────────────────────────────────────
    # 3. BOUGIE DE CONFIRMATION POST-RETEST — 20 pts
    # ──────────────────────────────────────────────
    candle_score = 0
    if len(closes) >= 2 and retest_score > 0:
        o, c, h, l = opens[-1], closes[-1], highs[-1], lows[-1]
        body = abs(c - o)
        total_range = h - l if h != l else 0.0001

        if direction == "BUY" and c > o and body / total_range > 0.5:
            candle_score = 20
            met.append("Bougie haussière post-retest confirmée [+20]")
        elif direction == "SELL" and c < o and body / total_range > 0.5:
            candle_score = 20
            met.append("Bougie baissière post-retest confirmée [+20]")
        else:
            failed.append("Bougie de confirmation post-retest absente [0]")
    elif retest_score == 0:
        failed.append("Bougie ignorée (retest pas encore confirmé) [0]")
    else:
        failed.append("Données OHLC insuffisantes [0]")

    # ──────────────────────────────────────────────
    # 4. FILTRE ATR — 10 pts
    # Vérifie que la cassure n'est pas sur un mouvement épuisé
    # ──────────────────────────────────────────────
    atr_score = 0
    if atr and atr_mean_ref:
        last_candle_size = abs(closes[-2] - opens[-2]) if len(opens) >= 2 else 0
        if last_candle_size <= 2 * atr_mean_ref:
            atr_score = 10
            met.append(f"ATR normal — mouvement non épuisé [+10]")
        else:
            failed.append(
                f"Dernière bougie ({last_candle_size:.4f}) > 2×ATR "
                f"({2*atr_mean_ref:.4f}) — mouvement peut-être épuisé [0]"
            )
    else:
        atr_score = 5  # partiel si ATR indisponible
        met.append("ATR non disponible — filtre partiel [+5]")

    # ──────────────────────────────────────────────
    # SCORE FINAL
    # ──────────────────────────────────────────────
    total = breakout_score + retest_score + candle_score + atr_score
    active = total >= MIN_SCORE

    if active:
        reason = (
            f"Cassure {direction} de {broken_level:.2f} avec retest confirmé. "
            f"Score {total}/100."
        )
    else:
        reason = (
            f"Score {total}/100 < {MIN_SCORE}. "
            f"{'Retest non encore confirmé — surveiller le niveau ' + str(broken_level) if retest_score == 0 else 'Attendre bougie de confirmation.'}"
        )

    return StrategySignal(
        name="Breakout + Retest",
        direction=direction if active else "NEUTRAL",
        score=total,
        confidence_label=score_label(total),
        entry_reason=reason,
        conditions_met=met,
        conditions_failed=failed,
        active=active,
    )
