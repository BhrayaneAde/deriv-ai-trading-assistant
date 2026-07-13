"""
Calcul du prix cible d'entrée en attente (Pending Order).

Quand le marché n'est pas assez sûr (confiance < 70% ou signal faible),
ce module calcule le prix précis où le trader devrait entrer pour obtenir
≥ 70% de confiance, basé sur :

  1. Niveaux de support / résistance clés
  2. Retracements de Fibonacci (38.2%, 50%, 61.8%)
  3. Bandes de Bollinger (BB lower pour BUY, BB upper pour SELL)
  4. EMA dynamique (EMA20 ou EMA50 comme zone d'appui)
  5. Score de qualité de chaque niveau candidat

Pour chaque candidat on estime la confiance simulée :
  → Si le prix atteint ce niveau, combien de conditions seront remplies ?
  → On garde seulement ceux qui atteindraient ≥ 70%.
"""

from dataclasses import dataclass
from typing import Optional


CONFIDENCE_THRESHOLD = 70  # % minimum requis


@dataclass
class PendingOrder:
    direction: str             # "BUY" | "SELL"
    target_price: float        # prix exact à surveiller
    current_price: float
    distance_pct: float        # % de distance entre prix actuel et cible
    distance_abs: float        # distance absolue
    estimated_confidence: int  # confiance estimée si on entre à ce prix
    level_type: str            # "support" | "resistance" | "fibonacci" | "bb" | "ema"
    level_label: str           # ex : "Support 5min" / "Fibo 61.8%"
    rationale: str             # explication en français
    proximity_alert: bool      # True si prix < 0.3% du niveau
    conditions_at_target: list[str]  # conditions qui seront remplies à ce niveau

    def to_dict(self) -> dict:
        return {
            "direction": self.direction,
            "target_price": self.target_price,
            "current_price": self.current_price,
            "distance_pct": round(self.distance_pct, 3),
            "distance_abs": round(self.distance_abs, 4),
            "estimated_confidence": self.estimated_confidence,
            "level_type": self.level_type,
            "level_label": self.level_label,
            "rationale": self.rationale,
            "proximity_alert": self.proximity_alert,
            "conditions_at_target": self.conditions_at_target,
        }


def _fibonacci_levels(
    swing_high: float,
    swing_low: float,
) -> dict[str, float]:
    """Niveaux de Fibonacci entre swing high et swing low."""
    diff = swing_high - swing_low
    return {
        "23.6%": round(swing_high - 0.236 * diff, 4),
        "38.2%": round(swing_high - 0.382 * diff, 4),
        "50.0%": round(swing_high - 0.500 * diff, 4),
        "61.8%": round(swing_high - 0.618 * diff, 4),
        "78.6%": round(swing_high - 0.786 * diff, 4),
    }


def _estimate_confidence_at_price(
    target: float,
    direction: int,         # +1 BUY, -1 SELL
    current_price: float,
    ema20: Optional[float],
    ema50: Optional[float],
    rsi14: Optional[float],
    macd_line: Optional[float],
    bb_lower: Optional[float],
    bb_upper: Optional[float],
    support: Optional[float],
    resistance: Optional[float],
    atr: Optional[float],
) -> tuple[int, list[str]]:
    """
    Simule la confiance si le prix atteint `target`.
    Retourne (confiance_estimée, liste_conditions).
    """
    bull = 0
    bear = 0
    conditions = []

    # EMA : si le prix recule vers EMA20/50, c'est un niveau de rebond
    if direction == 1:  # BUY
        if ema20 and abs(target - ema20) / current_price < 0.003:
            bull += 2; conditions.append(f"Prix sur EMA20 ({ema20:.2f}) — zone de rebond")
        elif ema50 and abs(target - ema50) / current_price < 0.005:
            bull += 2; conditions.append(f"Prix sur EMA50 ({ema50:.2f}) — support dynamique")
        if support and abs(target - support) / current_price < 0.003:
            bull += 2; conditions.append(f"Prix au support clé ({support:.2f})")
        if bb_lower and abs(target - bb_lower) / current_price < 0.003:
            bull += 1; conditions.append(f"Prix sur BB basse ({bb_lower:.2f}) — rebond statistique")
        # RSI : si le prix baisse vers ce niveau, RSI sera plus bas → favorable pour BUY
        if rsi14:
            proj_rsi = max(20, rsi14 - (current_price - target) / current_price * 200)
            if proj_rsi < 40:
                bull += 2; conditions.append(f"RSI projeté ~{proj_rsi:.0f} (survendu à ce niveau)")
            elif proj_rsi < 50:
                bull += 1; conditions.append(f"RSI projeté ~{proj_rsi:.0f} (haussier potentiel)")
        if macd_line and macd_line > 0:
            bull += 1; conditions.append("MACD reste positif")

    else:  # SELL
        if ema20 and abs(target - ema20) / current_price < 0.003:
            bear += 2; conditions.append(f"Prix sur EMA20 ({ema20:.2f}) — zone de rejet")
        elif ema50 and abs(target - ema50) / current_price < 0.005:
            bear += 2; conditions.append(f"Prix sur EMA50 ({ema50:.2f}) — résistance dynamique")
        if resistance and abs(target - resistance) / current_price < 0.003:
            bear += 2; conditions.append(f"Prix à la résistance clé ({resistance:.2f})")
        if bb_upper and abs(target - bb_upper) / current_price < 0.003:
            bear += 1; conditions.append(f"Prix sur BB haute ({bb_upper:.2f}) — rejet statistique")
        if rsi14:
            proj_rsi = min(80, rsi14 + (target - current_price) / current_price * 200)
            if proj_rsi > 65:
                bear += 2; conditions.append(f"RSI projeté ~{proj_rsi:.0f} (suracheté à ce niveau)")
            elif proj_rsi > 55:
                bear += 1; conditions.append(f"RSI projeté ~{proj_rsi:.0f} (baissier potentiel)")
        if macd_line and macd_line < 0:
            bear += 1; conditions.append("MACD reste négatif")

    total = bull + bear if direction == 1 else bear + bull
    dominant = bull if direction == 1 else bear
    if total == 0:
        return 0, conditions
    conf = min(int((dominant / total) * 100), 95)
    return conf, conditions


def compute_pending_orders(
    current_price: float,
    direction: int,            # +1 = cherche entrée BUY, -1 = SELL, 0 = les deux
    ema20: Optional[float],
    ema50: Optional[float],
    rsi14: Optional[float],
    macd_line: Optional[float],
    bb_lower: Optional[float],
    bb_upper: Optional[float],
    bb_middle: Optional[float],
    support: Optional[float],
    resistance: Optional[float],
    swing_high: Optional[float],
    swing_low: Optional[float],
    atr: Optional[float],
    current_confidence: int,
) -> list[PendingOrder]:
    """
    Calcule les niveaux candidats pour un ordre en attente avec ≥70% confiance.
    Retourne une liste triée par confiance estimée décroissante.
    """
    candidates: list[PendingOrder] = []

    # Directions à analyser
    dirs = []
    if direction >= 0:
        dirs.append((1, "BUY"))
    if direction <= 0:
        dirs.append((-1, "SELL"))

    for dir_val, dir_label in dirs:
        levels: list[tuple[float, str, str]] = []  # (price, type, label)

        # ── Niveaux structurels ──
        if support and dir_val == 1:
            levels.append((support, "support", "Support clé (30 bougies)"))
        if resistance and dir_val == -1:
            levels.append((resistance, "resistance", "Résistance clé (30 bougies)"))

        # ── Bollinger Bands ──
        if bb_lower and dir_val == 1:
            levels.append((bb_lower, "bb", f"BB Basse ({bb_lower:.2f})"))
        if bb_upper and dir_val == -1:
            levels.append((bb_upper, "bb", f"BB Haute ({bb_upper:.2f})"))
        if bb_middle:
            levels.append((bb_middle, "bb", f"BB Médiane ({bb_middle:.2f})"))

        # ── EMA dynamiques ──
        if ema20:
            levels.append((ema20, "ema", f"EMA20 ({ema20:.2f})"))
        if ema50:
            levels.append((ema50, "ema", f"EMA50 ({ema50:.2f})"))

        # ── Fibonacci (si swing disponible) ──
        if swing_high and swing_low and swing_high > swing_low:
            fibs = _fibonacci_levels(swing_high, swing_low)
            for fib_label, fib_price in fibs.items():
                # Pour BUY : niveaux de retracement sous le prix actuel
                # Pour SELL : niveaux au-dessus du prix actuel
                if dir_val == 1 and fib_price < current_price:
                    levels.append((fib_price, "fibonacci", f"Fibo {fib_label}"))
                elif dir_val == -1 and fib_price > current_price:
                    levels.append((fib_price, "fibonacci", f"Fibo {fib_label}"))

        # ── Évaluer chaque candidat ──
        for target_price, level_type, level_label in levels:
            if target_price <= 0:
                continue

            # Filtrage directionnel :
            # BUY → on attend que le prix descende vers le niveau
            # SELL → on attend que le prix monte vers le niveau
            if dir_val == 1 and target_price >= current_price * 1.001:
                continue  # niveau trop haut pour un BUY en attente
            if dir_val == -1 and target_price <= current_price * 0.999:
                continue  # niveau trop bas pour un SELL en attente

            est_conf, conditions = _estimate_confidence_at_price(
                target=target_price,
                direction=dir_val,
                current_price=current_price,
                ema20=ema20,
                ema50=ema50,
                rsi14=rsi14,
                macd_line=macd_line,
                bb_lower=bb_lower,
                bb_upper=bb_upper,
                support=support,
                resistance=resistance,
                atr=atr,
            )

            # On ne garde que les niveaux ≥ seuil ET meilleurs que le signal actuel
            if est_conf < CONFIDENCE_THRESHOLD:
                continue

            dist_abs = abs(current_price - target_price)
            dist_pct = (dist_abs / current_price) * 100
            proximity = dist_pct < 0.3

            # Construction du message
            if dir_val == 1:
                rationale = (
                    f"Attendre que le prix recule vers {target_price:.2f} "
                    f"({dist_pct:.2f}% plus bas). "
                    f"Ce niveau est un {level_label} — zone de rebond probable. "
                    f"Confiance estimée à ce niveau : {est_conf}%."
                )
            else:
                rationale = (
                    f"Attendre que le prix remonte vers {target_price:.2f} "
                    f"({dist_pct:.2f}% plus haut). "
                    f"Ce niveau est un {level_label} — zone de rejet probable. "
                    f"Confiance estimée à ce niveau : {est_conf}%."
                )

            candidates.append(PendingOrder(
                direction=dir_label,
                target_price=target_price,
                current_price=current_price,
                distance_pct=dist_pct,
                distance_abs=dist_abs,
                estimated_confidence=est_conf,
                level_type=level_type,
                level_label=level_label,
                rationale=rationale,
                proximity_alert=proximity,
                conditions_at_target=conditions,
            ))

    # Trier : d'abord les alertes de proximité, puis par confiance décroissante
    candidates.sort(key=lambda x: (-int(x.proximity_alert), -x.estimated_confidence, x.distance_pct))

    # Dédoublonnage : garder 1 niveau par type maximum
    seen_types: set[str] = set()
    unique: list[PendingOrder] = []
    for c in candidates:
        key = f"{c.direction}_{c.level_type}"
        if key not in seen_types:
            seen_types.add(key)
            unique.append(c)

    return unique[:4]  # max 4 suggestions
