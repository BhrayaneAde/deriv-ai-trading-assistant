"""
Stratégie 3 : Multi-Timeframe (MTF)
═════════════════════════════════════
H1  → direction macro (tendance)
M15 → zone d'entrée (support/résistance, pullback, RSI)
M5  → déclencheur (MACD croise, bougie engulfing)

Score max : 100 pts
  Tendance H1 (EMA50/200)   : 30 pts
  Confirmation M15          : 35 pts
    Pullback S/R ou EMA     : 15 pts
    RSI en zone favorable   : 20 pts
  Déclencheur M5            : 35 pts
    MACD croisement         : 15 pts
    Bougie engulfing/forte  : 20 pts

Seuil : ≥ 70 pts (Moyen), ≥ 80 (Fort), ≥ 90 (Très fort)
"""

from typing import Optional
from app.analysis.strategies.base import StrategySignal, score_label


def run(
    # H1
    ema50_h1: Optional[float],
    ema200_h1: Optional[float],
    # M15
    price_m15: Optional[float],
    ema20_m15: Optional[float],
    support_m15: Optional[float],
    resistance_m15: Optional[float],
    rsi_m15: Optional[float],
    atr_m15: Optional[float],
    # M5
    closes_m5: list[float],
    opens_m5: list[float],
    highs_m5: list[float],
    lows_m5: list[float],
    macd_line_m5: Optional[float],
    macd_signal_m5: Optional[float],
    macd_prev_m5: Optional[float],    # macd_line du tick précédent (pour détecter croisement)
    macd_signal_prev_m5: Optional[float],
) -> StrategySignal:
    """
    Évalue la stratégie MTF sur H1 / M15 / M5.
    """
    MIN_SCORE_ENTRY = 70
    met: list[str] = []
    failed: list[str] = []

    # ──────────────────────────────────────────────
    # 1. TENDANCE H1 — 30 pts
    # ──────────────────────────────────────────────
    h1_score = 0
    macro_dir = "NEUTRAL"

    if ema50_h1 and ema200_h1:
        if ema50_h1 > ema200_h1:
            h1_score = 30
            macro_dir = "BUY"
            met.append(f"H1 — EMA50 > EMA200 → tendance haussière [+30]")
        elif ema50_h1 < ema200_h1:
            h1_score = 30
            macro_dir = "SELL"
            met.append(f"H1 — EMA50 < EMA200 → tendance baissière [+30]")
        else:
            failed.append("H1 — EMA50 ≈ EMA200 — pas de tendance nette [0]")
    else:
        failed.append("H1 — EMA50/200 non disponibles (pas assez de bougies 1h) [0]")

    # Si pas de tendance macro, le signal MTF ne peut pas être fort
    # mais on continue quand même pour afficher le score partiel

    # ──────────────────────────────────────────────
    # 2. CONFIRMATION M15 — 35 pts max
    # ──────────────────────────────────────────────
    m15_score = 0

    # Pullback sur support/résistance ou EMA20 (15 pts)
    pullback_score = 0
    if price_m15 and atr_m15:
        tol = atr_m15 * 0.7
        if macro_dir == "BUY":
            if support_m15 and abs(price_m15 - support_m15) <= tol:
                pullback_score = 15
                met.append(f"M15 — Prix au support {support_m15:.2f} [+15]")
            elif ema20_m15 and abs(price_m15 - ema20_m15) <= tol:
                pullback_score = 12
                met.append(f"M15 — Pullback EMA20 {ema20_m15:.2f} [+12]")
            else:
                failed.append("M15 — Pas de pullback sur support ou EMA [0]")
        else:
            if resistance_m15 and abs(price_m15 - resistance_m15) <= tol:
                pullback_score = 15
                met.append(f"M15 — Prix à la résistance {resistance_m15:.2f} [+15]")
            elif ema20_m15 and abs(price_m15 - ema20_m15) <= tol:
                pullback_score = 12
                met.append(f"M15 — Pullback EMA20 {ema20_m15:.2f} [+12]")
            else:
                failed.append("M15 — Pas de pullback sur résistance ou EMA [0]")
    elif not price_m15:
        failed.append("M15 — Données prix non disponibles [0]")

    # RSI M15 (20 pts)
    rsi_score = 0
    if rsi_m15 is not None:
        if macro_dir == "BUY":
            if rsi_m15 < 35:
                rsi_score = 20; met.append(f"M15 — RSI survendu {rsi_m15:.1f} [+20]")
            elif rsi_m15 < 50:
                rsi_score = 14; met.append(f"M15 — RSI haussier {rsi_m15:.1f} [+14]")
            elif rsi_m15 < 60:
                rsi_score = 8;  met.append(f"M15 — RSI neutre {rsi_m15:.1f} [+8]")
            else:
                rsi_score = 0;  failed.append(f"M15 — RSI {rsi_m15:.1f} trop élevé pour BUY [0]")
        else:
            if rsi_m15 > 65:
                rsi_score = 20; met.append(f"M15 — RSI suracheté {rsi_m15:.1f} [+20]")
            elif rsi_m15 > 50:
                rsi_score = 14; met.append(f"M15 — RSI baissier {rsi_m15:.1f} [+14]")
            elif rsi_m15 > 40:
                rsi_score = 8;  met.append(f"M15 — RSI neutre {rsi_m15:.1f} [+8]")
            else:
                rsi_score = 0;  failed.append(f"M15 — RSI {rsi_m15:.1f} trop bas pour SELL [0]")
    else:
        failed.append("M15 — RSI non disponible [0]")

    m15_score = pullback_score + rsi_score

    # ──────────────────────────────────────────────
    # 3. DÉCLENCHEUR M5 — 35 pts max
    # ──────────────────────────────────────────────
    m5_score = 0

    # MACD croisement M5 (15 pts)
    macd_score = 0
    if (macd_line_m5 is not None and macd_signal_m5 is not None
            and macd_prev_m5 is not None and macd_signal_prev_m5 is not None):
        bullish_cross = (macd_line_m5 > macd_signal_m5 and macd_prev_m5 <= macd_signal_prev_m5)
        bearish_cross = (macd_line_m5 < macd_signal_m5 and macd_prev_m5 >= macd_signal_prev_m5)

        if macro_dir == "BUY" and bullish_cross:
            macd_score = 15
            met.append(f"M5 — MACD croisement haussier ↑ [+15]")
        elif macro_dir == "SELL" and bearish_cross:
            macd_score = 15
            met.append(f"M5 — MACD croisement baissier ↓ [+15]")
        elif macro_dir == "BUY" and macd_line_m5 > 0:
            macd_score = 8
            met.append(f"M5 — MACD positif (pas de croisement) [+8]")
        elif macro_dir == "SELL" and macd_line_m5 < 0:
            macd_score = 8
            met.append(f"M5 — MACD négatif (pas de croisement) [+8]")
        else:
            failed.append("M5 — MACD contra-directionnel [0]")
    else:
        failed.append("M5 — MACD non disponible (pas assez de données) [0]")

    # Bougie engulfing / forte M5 (20 pts)
    engulfing_score = 0
    if len(closes_m5) >= 2 and len(opens_m5) >= 2:
        o, c = opens_m5[-1], closes_m5[-1]
        po, pc = opens_m5[-2], closes_m5[-2]
        h, l = highs_m5[-1], lows_m5[-1]
        body = abs(c - o)
        rng = h - l if h != l else 0.0001

        if macro_dir == "BUY":
            engulfing = c > o and pc < po and c > po and o < pc
            strong    = c > o and body / rng > 0.6
            if engulfing:
                engulfing_score = 20; met.append("M5 — Bullish Engulfing [+20]")
            elif strong:
                engulfing_score = 15; met.append("M5 — Bougie haussière forte [+15]")
            else:
                failed.append("M5 — Pas de bougie de déclenchement haussière [0]")
        else:
            engulfing = c < o and pc > po and c < po and o > pc
            strong    = c < o and body / rng > 0.6
            if engulfing:
                engulfing_score = 20; met.append("M5 — Bearish Engulfing [+20]")
            elif strong:
                engulfing_score = 15; met.append("M5 — Bougie baissière forte [+15]")
            else:
                failed.append("M5 — Pas de bougie de déclenchement baissière [0]")
    else:
        failed.append("M5 — Données OHLC insuffisantes [0]")

    m5_score = macd_score + engulfing_score

    # ──────────────────────────────────────────────
    # SCORE TOTAL
    # ──────────────────────────────────────────────
    total = h1_score + m15_score + m5_score

    # Si direction macro neutre et score H1 = 0, pénaliser
    if macro_dir == "NEUTRAL":
        direction_out = "NEUTRAL"
    else:
        direction_out = macro_dir if total >= MIN_SCORE_ENTRY else "NEUTRAL"

    active = total >= MIN_SCORE_ENTRY and macro_dir != "NEUTRAL"

    if active:
        strength = score_label(total)
        reason = (
            f"Signal MTF {direction_out} — {strength}. "
            f"H1 confirme, M15 valide, M5 déclenche. Score {total}/100."
        )
    else:
        reason = (
            f"Score {total}/100 — "
            + ("tendance H1 absente. " if h1_score == 0 else "")
            + ("confirmation M15 insuffisante. " if m15_score < 15 else "")
            + ("déclencheur M5 absent." if m5_score < 15 else "")
        )

    return StrategySignal(
        name="Multi-Timeframe (H1/M15/M5)",
        direction=direction_out,
        score=total,
        confidence_label=score_label(total),
        entry_reason=reason,
        conditions_met=met,
        conditions_failed=failed,
        active=active,
    )
