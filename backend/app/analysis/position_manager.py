"""
Gestionnaire de position.
Calcule :
  - Take Profit (TP) et Stop Loss (SL) en prix
  - Nombre de lots recommandés
  - Durée estimée de la position
  - Nombre de répétitions (martingale légère ou répétition standard)
  - Message de sortie claire
"""

from dataclasses import dataclass
from typing import Optional

from app.assets import Asset


@dataclass
class PositionPlan:
    # Entrée
    entry_price: float
    direction: str        # "BUY" | "SELL"

    # Sortie
    take_profit: float
    stop_loss: float
    tp_pips: float
    sl_pips: float
    risk_reward: float    # TP/SL ratio

    # Taille
    lot_size: float       # mise par lot en $
    nb_lots: int          # nombre de lots recommandés
    total_stake: float    # lot_size × nb_lots

    # Gains/Pertes potentiels
    potential_gain: float
    potential_loss: float

    # Timing
    min_duration_min: int
    max_duration_min: int
    duration_label: str

    # Répétition
    max_repeats: int
    repeat_advice: str

    # Message global
    exit_message: str
    warning: str

    def to_dict(self) -> dict:
        return {
            "entry_price": self.entry_price,
            "direction": self.direction,
            "take_profit": self.take_profit,
            "stop_loss": self.stop_loss,
            "tp_pips": round(self.tp_pips, 2),
            "sl_pips": round(self.sl_pips, 2),
            "risk_reward": round(self.risk_reward, 2),
            "lot_size": self.lot_size,
            "nb_lots": self.nb_lots,
            "total_stake": self.total_stake,
            "potential_gain": round(self.potential_gain, 2),
            "potential_loss": round(self.potential_loss, 2),
            "duration": {
                "min_minutes": self.min_duration_min,
                "max_minutes": self.max_duration_min,
                "label": self.duration_label,
            },
            "repeat": {
                "max_repeats": self.max_repeats,
                "advice": self.repeat_advice,
            },
            "exit_message": self.exit_message,
            "warning": self.warning,
        }


def compute_position(
    asset: Asset,
    entry_price: float,
    direction: str,            # "BUY" | "SELL"
    atr_value: Optional[float],
    base_amount: float,        # capital total $
    stake_per_trade: float,    # mise recommandée par trade $
    confidence: int,           # 0-100
    regime: str,               # "calm" | "normal" | "unstable"
) -> PositionPlan:
    """
    Calcule le plan de position complet.

    TP/SL basés sur ATR :
      - SL = 1.5 × ATR (protège le capital)
      - TP = asset.volatility_factor × ATR (adapté à chaque actif)
      - Pour Boom/Crash : TP plus large car spikes importants
    """

    # ── ATR fallback si non disponible ──
    if atr_value is None or atr_value == 0:
        # Estimation grossière : 0.1% du prix pour Volatility, 0.3% pour Boom/Crash
        if asset.family in ("boom", "crash"):
            atr_value = entry_price * 0.003
        else:
            atr_value = entry_price * 0.001

    # ── Calcul TP / SL ──
    sl_multiplier = 1.5
    tp_multiplier = asset.volatility_factor

    # Ajustement selon régime
    if regime == "unstable":
        # Marché instable → SL plus serré, TP plus proche
        sl_multiplier = 1.0
        tp_multiplier = max(asset.volatility_factor * 0.7, 1.0)
    elif regime == "calm":
        # Marché calme → on peut viser plus loin
        tp_multiplier = asset.volatility_factor * 1.2

    # Ajustement selon confiance
    conf_ratio = max(0.6, min(1.0, confidence / 100))
    tp_multiplier *= conf_ratio

    sl_distance = atr_value * sl_multiplier
    tp_distance = atr_value * tp_multiplier

    # Contraintes minimales (éviter TP/SL trop proches du spread)
    min_distance = asset.typical_spread * asset.pip_size * 2
    sl_distance = max(sl_distance, min_distance)
    tp_distance = max(tp_distance, min_distance * 1.5)

    if direction == "BUY":
        take_profit = round(entry_price + tp_distance, 4)
        stop_loss   = round(entry_price - sl_distance, 4)
    else:  # SELL
        take_profit = round(entry_price - tp_distance, 4)
        stop_loss   = round(entry_price + sl_distance, 4)

    tp_pips = tp_distance / asset.pip_size
    sl_pips = sl_distance / asset.pip_size
    rr = round(tp_distance / sl_distance, 2) if sl_distance > 0 else 0

    # ── Taille de position ──
    # Sur Deriv Synthetics, la "mise" correspond au montant engagé
    # On découpe la mise totale en lots de taille fixe
    lot_size = round(max(0.35, stake_per_trade), 2)

    # Nombre de lots selon confiance et R:R
    if rr >= 2.0 and confidence >= 70:
        nb_lots = 2
    elif rr >= 1.5 and confidence >= 60:
        nb_lots = 1
    else:
        nb_lots = 1

    # Boom/Crash : 1 seul lot car spikes imprévisibles
    if asset.family in ("boom", "crash"):
        nb_lots = 1

    total_stake = round(lot_size * nb_lots, 2)

    # Garder total_stake dans la limite du capital autorisé
    max_allowed = base_amount * 0.05  # jamais plus de 5% sur une seule position
    if total_stake > max_allowed:
        total_stake = round(max_allowed, 2)
        lot_size = round(total_stake / nb_lots, 2)

    # ── Gains / Pertes potentiels ──
    # Sur Deriv Synthetics (CFD-like), gain ≈ mise × (TP_distance / entry × levier)
    # Simplification : gain = mise × RR, perte = mise
    potential_gain = round(total_stake * rr, 2)
    potential_loss = round(total_stake, 2)

    # ── Timing ──
    min_dur = asset.min_duration
    max_dur = min(asset.max_duration, 24 * 60)  # max 24h comme demandé

    if max_dur <= 15:
        duration_label = f"{min_dur}–{max_dur} minutes (très court terme)"
    elif max_dur <= 60:
        duration_label = f"{min_dur}–{max_dur} minutes (court terme)"
    elif max_dur <= 240:
        duration_label = f"{min_dur} min–{max_dur // 60}h (intraday)"
    else:
        duration_label = f"{min_dur} min–{max_dur // 60}h (journée)"

    # ── Répétitions ──
    # Combien de fois peut-on répéter la même position sans risquer le capital ?
    # Budget alloué = 10% du capital max pour une série de trades
    budget_series = base_amount * 0.10
    max_repeats = max(1, int(budget_series / total_stake))
    max_repeats = min(max_repeats, 5)  # on ne dépasse pas 5 répétitions consécutives

    if max_repeats >= 3:
        repeat_advice = (
            f"Vous pouvez répéter {max_repeats}x max sur la même direction. "
            f"Arrêtez si 2 SL consécutifs."
        )
    else:
        repeat_advice = (
            f"Répétition limitée ({max_repeats}x). Budget insuffisant pour martingale."
        )

    # ── Message de sortie ──
    if direction == "BUY":
        exit_message = (
            f"Sortir à {take_profit:.2f} (TP +{tp_pips:.0f} pips) "
            f"ou couper à {stop_loss:.2f} (SL -{sl_pips:.0f} pips). "
            f"Gain potentiel : +{potential_gain:.2f}$. "
            f"Perte max : -{potential_loss:.2f}$."
        )
    else:
        exit_message = (
            f"Sortir à {take_profit:.2f} (TP +{tp_pips:.0f} pips) "
            f"ou couper à {stop_loss:.2f} (SL -{sl_pips:.0f} pips). "
            f"Gain potentiel : +{potential_gain:.2f}$. "
            f"Perte max : -{potential_loss:.2f}$."
        )

    # ── Avertissement ──
    warning = ""
    if asset.family == "boom":
        warning = "⚠ Boom : entrez uniquement en BUY. Les spikes haussiers sont imprévisibles — TP serré conseillé."
    elif asset.family == "crash":
        warning = "⚠ Crash : entrez uniquement en SELL. Spikes baissiers violents — ne pas tenir longtemps."
    elif asset.risk_profile == "extreme":
        warning = "⚠ Actif extrêmement volatil — risque de perte totale de la mise en quelques secondes."
    elif regime == "unstable":
        warning = "⚠ Marché instable — SL resserré automatiquement. Restez vigilant."

    return PositionPlan(
        entry_price=entry_price,
        direction=direction,
        take_profit=take_profit,
        stop_loss=stop_loss,
        tp_pips=tp_pips,
        sl_pips=sl_pips,
        risk_reward=rr,
        lot_size=lot_size,
        nb_lots=nb_lots,
        total_stake=total_stake,
        potential_gain=potential_gain,
        potential_loss=potential_loss,
        min_duration_min=min_dur,
        max_duration_min=max_dur,
        duration_label=duration_label,
        max_repeats=max_repeats,
        repeat_advice=repeat_advice,
        exit_message=exit_message,
        warning=warning,
    )
