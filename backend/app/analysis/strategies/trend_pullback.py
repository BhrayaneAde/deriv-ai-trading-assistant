"""
Stratégie 1 : Trend + Pullback
═══════════════════════════════
Entrer UNIQUEMENT dans le sens de la tendance,
après un repli (pullback) sur une EMA clé.

Score max : 100 pts
  Tendance EMA50/200  : 30 pts
  Pullback EMA20/50   : 30 pts
  Bougie retournement : 20 pts
  RSI confirmation    : 20 pts

Seuil d'entrée : ≥ 80 pts
"""

from typing import Optional
from app.analysis.strategies.base import StrategySignal, score_label


def _detect_bullish_candle(
    opens: list[float], closes: list[float],
    highs: list[float], lows: list[float],
) -> tuple[bool, str]:
    """Détecte une bougie de retournement haussière sur la dernière bougie."""
    if len(closes) < 2:
        return False, ""

    o, c, h, l = opens[-1], closes[-1], highs[-1], lows[-1]
    prev_o, prev_c = opens[-2], closes[-2]
    body = abs(c - o)
    total_range = h - l if h != l else 0.0001
    lower_wick = min(o, c) - l
    upper_wick = h - max(o, c)

    # Pin Bar haussier (marteau) : longue mèche basse > 2× corps
    if c > o and lower_wick > 2 * body and upper_wick < body:
        return True, "Pin Bar haussier (marteau)"

    # Bullish Engulfing : bougie verte qui englobe la précédente rouge
    if c > o and prev_c < prev_o and c > prev_o and o < prev_c:
        return True, "Bullish Engulfing"

    # Bougie haussière forte (corps > 60% du range)
    if c > o and body / total_range > 0.6:
        return True, "Bougie haussière forte"

    return False, ""


def _detect_bearish_candle(
    opens: list[float], closes: list[float],
    highs: list[float], lows: list[float],
) -> tuple[bool, str]:
    """Détecte une bougie de retournement baissière."""
    if len(closes) < 2:
        return False, ""

    o, c, h, l = opens[-1], closes[-1], highs[-1], lows[-1]
    prev_o, prev_c = opens[-2], closes[-2]
    body = abs(c - o)
    total_range = h - l if h != l else 0.0001
    upper_wick = h - max(o, c)

    # Shooting Star / Pin Bar baissier
    if c < o and upper_wick > 2 * body:
        return True, "Pin Bar baissier (étoile filante)"

    # Bearish Engulfing
    if c < o and prev_c > prev_o and c < prev_o and o > prev_c:
        return True, "Bearish Engulfing"

    # Bougie baissière forte
    if c < o and body / total_range > 0.6:
        return True, "Bougie baissière forte"

    return False, ""


def run(
    closes: list[float],
    opens: list[float],
    highs: list[float],
    lows: list[float],
    ema20: Optional[float],
    ema50: Optional[float],
    ema200: Optional[float],
    rsi14: Optional[float],
    atr: Optional[float],
) -> StrategySignal:
    """
    Évalue la stratégie Trend + Pullback.
    Tendance : EMA50 vs EMA200 si disponible, sinon EMA20 vs EMA50.
    """
    MIN_SCORE = 80
    met: list[str] = []
    failed: list[str] = []
    price = closes[-1] if closes else 0

    # ──────────────────────────────────────────────
    # 1. TENDANCE — 30 pts
    # EMA50/200 si dispo, sinon EMA20/50 (fallback pour peu de bougies)
    # ──────────────────────────────────────────────
    trend_score = 0
    trend_dir = "NEUTRAL"

    if ema50 and ema200:
        if ema50 > ema200:
            trend_score = 30; trend_dir = "BUY"
            met.append(f"Tendance haussière : EMA50 ({ema50:.2f}) > EMA200 ({ema200:.2f}) [+30]")
        elif ema50 < ema200:
            trend_score = 30; trend_dir = "SELL"
            met.append(f"Tendance baissière : EMA50 ({ema50:.2f}) < EMA200 ({ema200:.2f}) [+30]")
        else:
            failed.append("EMA50 ≈ EMA200 — tendance neutre [0]")
    elif ema20 and ema50:
        # Fallback : EMA20 vs EMA50 (moins de bougies requises)
        if ema20 > ema50:
            trend_score = 20; trend_dir = "BUY"   # 20 pts car moins fiable
            met.append(f"Tendance haussière (fallback) : EMA20 ({ema20:.2f}) > EMA50 ({ema50:.2f}) [+20]")
        elif ema20 < ema50:
            trend_score = 20; trend_dir = "SELL"
            met.append(f"Tendance baissière (fallback) : EMA20 ({ema20:.2f}) < EMA50 ({ema50:.2f}) [+20]")
        else:
            failed.append("EMA20 ≈ EMA50 — tendance neutre [0]")
    else:
        failed.append("EMA non disponibles [0]")

    if trend_dir == "NEUTRAL":
        return StrategySignal(
            name="Trend + Pullback",
            direction="NEUTRAL",
            score=0,
            confidence_label="Insuffisant",
            entry_reason="Pas de tendance claire — attendre",
            conditions_met=met,
            conditions_failed=failed,
            active=False,
        )

    # ──────────────────────────────────────────────
    # 2. PULLBACK sur EMA — 30 pts
    # ──────────────────────────────────────────────
    pullback_score = 0
    pullback_label = ""

    if ema20 and atr:
        tolerance = atr * 1.2   # 1.2xATR — couvre les pullbacks typiques des Synthetics
        if abs(price - ema20) <= tolerance:
            pullback_score = 30
            pullback_label = f"EMA20 ({ema20:.2f})"
        elif ema50 and abs(price - ema50) <= atr * 1.5:
            pullback_score = 25
            pullback_label = f"EMA50 ({ema50:.2f})"

    if pullback_score > 0:
        met.append(f"Pullback sur {pullback_label} [+{pullback_score}]")
    else:
        failed.append(
            f"Pas de pullback détecté sur EMA — prix trop loin "
            f"(EMA20={ema20 or 0:.2f}) [0]"
        )

    # ──────────────────────────────────────────────
    # 3. BOUGIE DE CONFIRMATION — 20 pts
    # ──────────────────────────────────────────────
    candle_score = 0
    if len(opens) >= 2 and len(closes) >= 2:
        if trend_dir == "BUY":
            detected, label = _detect_bullish_candle(opens, closes, highs, lows)
        else:
            detected, label = _detect_bearish_candle(opens, closes, highs, lows)

        if detected:
            candle_score = 20
            met.append(f"Bougie de confirmation : {label} [+20]")
        else:
            failed.append("Aucune bougie de retournement détectée [0]")
    else:
        failed.append("Données OHLC insuffisantes pour analyse chandelier [0]")

    # ──────────────────────────────────────────────
    # 4. RSI CONFIRMATION — 20 pts
    # ──────────────────────────────────────────────
    rsi_score = 0
    if rsi14 is not None:
        if trend_dir == "BUY":
            if rsi14 < 35:
                rsi_score = 20
                met.append(f"RSI survendu {rsi14:.1f} — rebond attendu [+20]")
            elif 35 <= rsi14 <= 55:
                rsi_score = 15
                met.append(f"RSI favorable pour achat {rsi14:.1f} [+15]")
            elif rsi14 > 55:
                rsi_score = 5
                met.append(f"RSI > 50 mais momentum fort {rsi14:.1f} [+5]")
            if rsi14 > 70:
                rsi_score = 0
                failed.append(f"RSI suracheté {rsi14:.1f} — contra-indicatif pour BUY [0]")
        else:
            if rsi14 > 65:
                rsi_score = 20
                met.append(f"RSI suracheté {rsi14:.1f} — retournement attendu [+20]")
            elif 45 <= rsi14 <= 65:
                rsi_score = 15
                met.append(f"RSI favorable pour vente {rsi14:.1f} [+15]")
            elif rsi14 < 45:
                rsi_score = 5
                met.append(f"RSI < 50 mais momentum baissier {rsi14:.1f} [+5]")
            if rsi14 < 30:
                rsi_score = 0
                failed.append(f"RSI survendu {rsi14:.1f} — contra-indicatif pour SELL [0]")
    else:
        failed.append("RSI non disponible [0]")

    # ──────────────────────────────────────────────
    # SCORE FINAL
    # ──────────────────────────────────────────────
    total = trend_score + pullback_score + candle_score + rsi_score
    active = total >= MIN_SCORE

    if active:
        rsi_str = f"{rsi14:.1f}" if rsi14 is not None else "N/A"
        reason = (
            f"Tendance {trend_dir} confirmée — pullback sur {pullback_label or 'EMA'} "
            f"avec RSI {rsi_str}. Score {total}/100."
        )
    else:
        reason = (
            f"Score insuffisant ({total}/100 < {MIN_SCORE}). "
            "Attendre pullback sur EMA ou confirmation de bougie."
        )

    return StrategySignal(
        name="Trend + Pullback",
        direction=trend_dir if active else "NEUTRAL",
        score=total,
        confidence_label=score_label(total),
        entry_reason=reason,
        conditions_met=met,
        conditions_failed=failed,
        active=active,
    )
