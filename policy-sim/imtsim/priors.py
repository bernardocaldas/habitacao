"""Every assumed quantity, with a 90% prior interval, a status and a source.

Same conventions as ``rentsim.priors`` (and the same ``Prior`` class): ``data_to_come`` is a
fact someone measures and we have not collected yet, ``literature`` an effect size from
published studies widened for transfer to Portugal, ``judgement`` a deliberately wide guess
whose weight the report shows (``sensitivity``).
"""
from __future__ import annotations

import numpy as np

from rentsim.priors import Prior

PRIORS: list[Prior] = [
    # --- What the tax is levied on ---------------------------------------------------------
    Prior("vpt_to_market", "share", 0.30, 0.75, "judgement",
          "Tax value (VPT) of a vacant dwelling as a share of its market value at today's median "
          "sale price per m². VPTs date mostly from the 2012-13 general reassessment with an age "
          "discount and, per the OECD (Jan 2026), have not been revised since 2015, while prices "
          "more than doubled. Check: the 2021 surcharge raised 7.1 M€ on 10,372 buildings "
          "(684 € each, ECO 9 Mar 2023), i.e. ~114,000 € of VPT per building at +0.6 pp.",
          "AT: urban VPT by munícipio and band (not published; data request)"),
    Prior("dwelling_m2", "positive", 75.0, 115.0, "data_to_come",
          "Useful area of a vacant dwelling, m².",
          "Censos 2021 dwellings by occupancy and useful area (INE)"),
    # --- Who can respond -------------------------------------------------------------------
    Prior("actionable", "share", 0.25, 0.65, "judgement",
          "Share of dwellings vacant 'for other reasons' (Censos 2021) whose owner could let, "
          "sell or live in them within a few years. The rest are stuck: undivided inheritances, "
          "owners in care, major works needed, disputes (Observador, Feb 2023: deaths and "
          "inheritance disputes are the most frequent causes)."),
    Prior("exempt", "share", 0.15, 0.45, "judgement",
          "Of the stuck dwellings, share legally exempt from the surcharge (emigrants' homes, "
          "homes under certified works, holiday or temporary use as declared; JN/Lusa 26 Apr "
          "2024). The rest pay without being able to respond."),
    Prior("market_long_term", "share", 0.10, 0.35, "judgement",
          "Share of dwellings 'vacant for sale or rent' that have been empty more than a year "
          "(the surcharge's threshold); the rest is normal turnover and is never taxed.",
          "a one-off utilities-consumption extract (no contracts / <35 kWh) per munícipio"),
    # --- How strongly they respond ---------------------------------------------------------
    Prior("beta", "positive", 0.10, 1.20, "literature",
          "Response of taxed vacancy to the tax: share back in use = 1 - exp(-beta x dose), "
          "dose = sum over years of the surcharge as a share of a year's market rent. France's "
          "vacancy tax (10-15% of rental value a year) cut vacancy 13% in 2-3 years, more among "
          "the long-term vacant it targets (Segu 2020, J. Public Econ.): beta ~0.4-1.2. "
          "Vancouver's Empty Homes Tax (1% then 3% of assessed value, ~0.3-0.9 of a year's "
          "rent) cut vacancy ~21% (Caracciolo & Miglino 2024): beta ~0.1-0.2. Wide on purpose."),
    Prior("detection_today", "share", 0.02, 0.06, "data_to_come",
          "Share of the taxable vacant stock that munícipios flag today: ~12,776 vacant "
          "buildings (5,729 + 7,047 in pressure zones) in 64 munícipios for IMI 2023 (JN/Lusa, "
          "26 Apr 2024) against 375,118 dwellings vacant for other reasons (Censos 2021). "
          "Buildings and dwellings are different units.",
          "AT count of surcharged buildings by munícipio and year"),
    # --- The swap --------------------------------------------------------------------------
    Prior("sales_semi_elasticity", "positive", 7.0, 20.0, "literature",
          "Fall in sales, %, per percentage point of transfer tax on the price. Toronto's 1.1% "
          "land transfer tax cut sales 15% (Dachis, Duranton & Turner 2012): ~13.6 %/pp."),
    Prior("capitalisation", "share", 0.40, 0.95, "literature",
          "Share of the present value of a recurrent tax change reflected in prices (Oates 1969 "
          "and successors); judgement on the range for Portugal."),
    Prior("discount_rate", "positive", 0.02, 0.05, "judgement",
          "Real discount rate an owner applies to future IMI."),
]

BY_NAME = {p.name: p for p in PRIORS}


def sample_priors(rng: np.random.Generator, n: int) -> dict[str, np.ndarray]:
    return {p.name: p.sample(rng, n) for p in PRIORS}
