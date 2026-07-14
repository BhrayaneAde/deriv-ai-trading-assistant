"""
Étape 4 du flux : Confirmation structurelle.

Règle professionnelle :
  Un signal n'est confirmé que si les conditions restent vraies
  sur N bougies consécutives (pas juste sur la dernière).

Confirmation BUY :
  - EMA20 > EMA50 sur les 3 dernières bougies
  - RSI > 50 sur les 2 dernières bougies
  - MACD histogram positif sur les 2 dernières bougies
  - Prix au-dessus de l'EMA20 sur les 3 dernières bougies

Confirmation SELL :
  - EMA20 < EMA50 sur les 3 dernières bougies
  - RSI < 50 sur les 2 dernières bougies
  - MACD histogram négatif sur les 2 dernières bougies
  - Prix en-dessous de l'EMA20 sur les 3 dernières bougies

Invalidation :
  Conditions qui annulent immédiatement un signal actif.
"""

from dataclasses import dataclass, field
from typing import Optional

from app.analysis.indicators import ema, macd, rsi


@dataclass
class ConfirmationResult:
    confirmed: bool
    direction: str           # "BUY" | "SELL" | "NEUTRAL"
    score: int               # 0-100 (% des conditions confirmées)
    conditions_ok: list[str]
    conditions_failed: list[str]
    consecutive_candles: int # combien de bougies consécutives confirment

    def to_dict(self) -> dict:
        return {
            "confirmed": self.confirmed,
            "direction": self.direction,
            "score": self.score,
            "conditions_ok": self.conditions_ok,
            "conditions_failed": self.conditions_failed,
            "consecutive_candles": self.consecutive_candles,
        }


@dataclass
class InvalidationResult:
    invalidated: bool
    reason: str
    invalidation_price: Optional[float]  # prix auquel l'invalidation s'est produite

    def to_dict(self) -> dict:
        return {
            "invalidated": self.invalidated,
            "reason": self.reason,
            "invalidation_price": self.invalidation_price,
        }


def check_confirmation(
    closes: list[float],
    highs: list[float],
    lows: list[float],
    direction: str,       # "BUY" | "SELL"
    n_candles: int = 3,   # nombre de bougies consécutives requises
) -> ConfirmationResult:
    """
    Vérifie que les conditions du signal sont vraies sur N bougies consécutives.
    """
    ok = []
    failed = []

    if len(closes) < n_candles + 26:  # 26 pour MACD slow
        return ConfirmationResult(
            confirmed=False, direction=direction, score=0,
            conditions_ok=[], conditions_failed=["Données insuffisantes pour confirmation"],
            consecutive_candles=0,
        )

    # ── Calcul des indicateurs sur les N dernières bougies ──
    # On calcule EMA, RSI, MACD sur sous-séries pour vérifier la consistance

    total_conditions = 0
    passed_conditions = 0
    consecutive = 0

    for i in range(n_candles):
        # Sous-série jusqu'à la bougie i (0 = dernière)
        idx = len(closes) - i
        sub = closes[:idx]
        if len(sub) < 27:
            break

        e20 = ema(sub, 20)
        e50 = ema(sub, 50)
        r14 = rsi(sub, 14)
        m = macd(sub)
        price = sub[-1]

        candle_ok = True

        if direction == "BUY":
            if e20 and e50 and e20 > e50:
                if i == 0: ok.append(f"EMA20 > EMA50 ({e20:.2f} > {e50:.2f})")
            else:
                candle_ok = False
                if i == 0: failed.append(f"EMA20 ≤ EMA50 ({e20:.2f} ≤ {e50:.2f})")

            if r14 and r14 > 45:
                if i == 0: ok.append(f"RSI favorable {r14:.1f} > 45")
            else:
                candle_ok = False
                if i == 0: failed.append(f"RSI défavorable {f'{r14:.1f}' if r14 else 'N/A'} ≤ 45")

            if m["histogram"] and m["histogram"] > 0:
                if i == 0: ok.append(f"MACD histogram positif {m['histogram']:.4f}")
            else:
                candle_ok = False
                if i == 0: failed.append(f"MACD histogram négatif {f"{m['histogram']:.4f}" if m['histogram'] else 'N/A'}")

            if e20 and price > e20:
                if i == 0: ok.append(f"Prix > EMA20 ({price:.2f} > {e20:.2f})")
            else:
                candle_ok = False
                if i == 0: failed.append(f"Prix ≤ EMA20 ({price:.2f} ≤ {f'{e20:.2f}' if e20 else 'N/A'})")

        else:  # SELL
            if e20 and e50 and e20 < e50:
                if i == 0: ok.append(f"EMA20 < EMA50 ({e20:.2f} < {e50:.2f})")
            else:
                candle_ok = False
                if i == 0: failed.append(f"EMA20 ≥ EMA50")

            if r14 and r14 < 55:
                if i == 0: ok.append(f"RSI favorable {r14:.1f} < 55")
            else:
                candle_ok = False
                if i == 0: failed.append(f"RSI défavorable {f'{r14:.1f}' if r14 else 'N/A'} ≥ 55")

            if m["histogram"] and m["histogram"] < 0:
                if i == 0: ok.append(f"MACD histogram négatif {m['histogram']:.4f}")
            else:
                candle_ok = False
                if i == 0: failed.append(f"MACD histogram positif")

            if e20 and price < e20:
                if i == 0: ok.append(f"Prix < EMA20 ({price:.2f} < {e20:.2f})")
            else:
                candle_ok = False
                if i == 0: failed.append(f"Prix ≥ EMA20")

        total_conditions += 4
        if candle_ok:
            passed_conditions += 4
            consecutive += 1
        else:
            break  # On arrête au premier échec consécutif

    score = int((passed_conditions / max(total_conditions, 1)) * 100)
    confirmed = consecutive >= n_candles

    return ConfirmationResult(
        confirmed=confirmed,
        direction=direction if confirmed else "NEUTRAL",
        score=score,
        conditions_ok=ok,
        conditions_failed=failed,
        consecutive_candles=consecutive,
    )


def check_invalidation(
    current_price: float,
    signal_direction: str,   # "BUY" | "SELL"
    entry_price: float,
    stop_loss: Optional[float],
    support: Optional[float],
    resistance: Optional[float],
    ema20: Optional[float],
    ema50: Optional[float],
    rsi14: Optional[float],
    macd_histogram: Optional[float],
    atr: Optional[float],
) -> InvalidationResult:
    """
    Vérifie tick par tick si les conditions d'invalidation sont réunies.
    Appelé à chaque tick pendant qu'un signal est verrouillé.

    Conditions d'invalidation BUY :
      - Prix casse le stop loss
      - Prix casse le support clé (- 0.5 × ATR)
      - Croisement EMA inverse confirmé (EMA20 < EMA50)
      - RSI < 35 (momentum cassé)
      - MACD histogram négatif après avoir été positif

    Conditions d'invalidation SELL :
      - Inverse
    """
    if signal_direction == "BUY":
        # Stop loss cassé
        if stop_loss and current_price < stop_loss:
            return InvalidationResult(
                invalidated=True,
                reason=f"🚨 Stop Loss cassé — prix {current_price:.2f} < SL {stop_loss:.2f}",
                invalidation_price=current_price,
            )
        # Support cassé
        if support and atr and current_price < support - atr * 0.5:
            return InvalidationResult(
                invalidated=True,
                reason=f"🚨 Support {support:.2f} cassé — prix {current_price:.2f}",
                invalidation_price=current_price,
            )
        # Croisement EMA inverse
        if ema20 and ema50 and ema20 < ema50 * 0.9995:
            return InvalidationResult(
                invalidated=True,
                reason=f"⚠ EMA20 ({ema20:.2f}) < EMA50 ({ema50:.2f}) — tendance inversée",
                invalidation_price=current_price,
            )
        # RSI cassé
        if rsi14 and rsi14 < 32:
            return InvalidationResult(
                invalidated=True,
                reason=f"⚠ RSI {rsi14:.1f} — momentum BUY cassé",
                invalidation_price=current_price,
            )

    else:  # SELL
        if stop_loss and current_price > stop_loss:
            return InvalidationResult(
                invalidated=True,
                reason=f"🚨 Stop Loss cassé — prix {current_price:.2f} > SL {stop_loss:.2f}",
                invalidation_price=current_price,
            )
        if resistance and atr and current_price > resistance + atr * 0.5:
            return InvalidationResult(
                invalidated=True,
                reason=f"🚨 Résistance {resistance:.2f} cassée — prix {current_price:.2f}",
                invalidation_price=current_price,
            )
        if ema20 and ema50 and ema20 > ema50 * 1.0005:
            return InvalidationResult(
                invalidated=True,
                reason=f"⚠ EMA20 ({ema20:.2f}) > EMA50 ({ema50:.2f}) — tendance inversée",
                invalidation_price=current_price,
            )
        if rsi14 and rsi14 > 68:
            return InvalidationResult(
                invalidated=True,
                reason=f"⚠ RSI {rsi14:.1f} — momentum SELL cassé",
                invalidation_price=current_price,
            )

    return InvalidationResult(
        invalidated=False,
        reason="Signal actif — conditions maintenues",
        invalidation_price=None,
    )
