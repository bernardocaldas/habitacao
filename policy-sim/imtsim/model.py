"""The two models. Arrays are (draws, munícipios) unless noted.

Vacant homes. The taxable stock of a munícipio is its dwellings vacant for other reasons
(Censos 2021) plus the long-term share of those vacant for sale or rent. A share ``detection``
of it is flagged. Flagged owners who can act ("actionable") respond to the surcharge as a
share of a year's market rent; the rest either pay (stuck) or are exempt. The response is
1 - exp(-beta x dose), dose = the surcharges so far as shares of a year's rent. The
surcharge is paid on whoever is still vacant on 1 January of each year.

The swap. Each munícipio's taxable IMI base is its IMI revenue over its rate; the rate that
replaces a share of its IMT (net of any vacant surcharge revenue) follows. A typical home at
the munícipio's median price per m² then gains the IMT a buyer no longer pays and pays more
IMI every year; its price moves by the capitalised difference, and sales by the literature's
semi-elasticity.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import Municipios
from .policy import IMI_CEILING, SwapPolicy, VacancyPolicy

PRESSURE_QUANTILE = 0.75  # stand-in for the zonas de pressão urbanística (list not collected)

# IMT 2026, permanent home (OE 2026 proposal as reported by ECO and Doutor Finanças).
IMT_HPP_MARGINAL = [(106_346, 0.0), (145_470, 0.02), (198_347, 0.05), (330_539, 0.07), (660_982, 0.08)]
IMT_HPP_FLAT = [(1_150_853, 0.06), (float("inf"), 0.075)]


def imt_permanent_home(price: np.ndarray) -> np.ndarray:
    """IMT on a permanent home bought by a buyer without the young-buyer exemption."""
    price = np.asarray(price, float)
    tax = np.zeros_like(price)
    lo = 0.0
    for hi, rate in IMT_HPP_MARGINAL:
        tax += rate * np.clip(price - lo, 0, hi - lo)
        lo = hi
    over = price > IMT_HPP_MARGINAL[-1][0]
    flat = np.where(price <= IMT_HPP_FLAT[0][0], IMT_HPP_FLAT[0][1], IMT_HPP_FLAT[1][1])
    return np.where(over, price * flat, tax)


def pressure_mask(m: Municipios) -> np.ndarray:
    return m.price_m2 >= np.quantile(m.price_m2, PRESSURE_QUANTILE)


@dataclass
class VacancyRun:
    policy: VacancyPolicy
    flagged: np.ndarray           # (D, N) dwellings flagged
    returned: np.ndarray          # (D, N) back in use by the last year
    revenue: np.ndarray           # (Y, D, N) surcharge collected, €
    paying_stuck: np.ndarray      # (D, N) owners who pay but cannot respond
    first_year_share_of_rent: np.ndarray  # (D, N) year-1 surcharge / a year's rent
    multiplier: np.ndarray        # (Y, N)


def simulate_vacancy(policy: VacancyPolicy, m: Municipios, th: dict[str, np.ndarray]) -> VacancyRun:
    D, N, Y = len(th["beta"]), m.n, policy.years
    col = lambda k: th[k][:, None]
    detection = col("detection_today") if policy.detection is None else np.full((D, 1), policy.detection)
    act_other = detection * col("actionable") * m.vacant_other
    act_market = detection * col("market_long_term") * m.vacant_market
    actionable = act_other + act_market
    stuck_paying = detection * (1 - col("actionable")) * (1 - col("exempt")) * m.vacant_other

    hot = pressure_mask(m) if policy.scope == "pressure" else np.ones(N, bool)
    years = np.arange(Y)[:, None]
    mult = np.where(hot, policy.multiplier * (1 + policy.yearly_step) ** years, 3.0)  # (Y, N)
    value = col("vpt_to_market") * m.price_m2 * col("dwelling_m2")      # VPT, €
    rent_year = 12 * m.rent_m2 * col("dwelling_m2")                    # € / year
    surcharge = (mult[:, None, :] - 1) * m.imi_rate * value[None]       # (Y, D, N) € per dwelling
    share = surcharge / rent_year[None]
    dose_before = np.concatenate([np.zeros((1, D, N)), np.cumsum(share, 0)[:-1]], 0)
    still_vacant = actionable[None] * np.exp(-col("beta")[None] * dose_before)
    revenue = surcharge * (still_vacant + stuck_paying[None])
    returned = actionable * (1 - np.exp(-col("beta") * share.sum(0)))
    return VacancyRun(policy, actionable + detection * (1 - col("actionable")) * m.vacant_other,
                      returned, revenue, stuck_paying, share[0], mult)


@dataclass
class SwapRun:
    policy: SwapPolicy
    known: np.ndarray             # (N,) munícipios with IMT, IMI and rate
    new_rate: np.ndarray          # (D, N) urban IMI rate that keeps revenue unchanged
    imt_saved: np.ndarray         # (D, N) € a buyer of a typical home no longer pays
    imi_extra: np.ndarray         # (D, N) € a year more IMI on that home
    price_change: np.ndarray      # (D, N) € change in its price, capitalised
    sales_change_pct: np.ndarray  # (D, N)
    revenue_moved: np.ndarray     # (D, N) € a year shifted from IMT to IMI


def simulate_swap(policy: SwapPolicy, m: Municipios, th: dict[str, np.ndarray],
                  vacancy: VacancyRun | None = None) -> SwapRun:
    known = ~np.isnan(m.imt_eur) & ~np.isnan(m.imi_eur) & m.imi_rate_known & (m.imi_eur > 0)
    col = lambda k: th[k][:, None]
    base = np.where(known, m.imi_eur, np.nan) / m.imi_rate             # taxable VPT, €
    offset = 0.0 if vacancy is None else vacancy.revenue.mean(0)       # € a year, (D, N)
    moved = policy.imt_cut * np.nan_to_num(m.imt_eur) - offset
    D = len(th["beta"])
    moved = np.broadcast_to(moved, (D, m.n)).copy()
    new_rate = m.imi_rate + moved / base
    home = m.price_m2 * col("dwelling_m2")                              # market value, €
    imt_saved = policy.imt_cut * imt_permanent_home(home)
    imi_extra = (new_rate - m.imi_rate) * col("vpt_to_market") * home
    price_change = col("capitalisation") * (imt_saved - imi_extra / col("discount_rate"))
    sales = col("sales_semi_elasticity") * 100 * imt_saved / home
    return SwapRun(policy, known, new_rate, imt_saved, imi_extra, price_change, sales, moved)


def above_ceiling(run: SwapRun) -> np.ndarray:
    return (run.new_rate > IMI_CEILING + 1e-12) & run.known
