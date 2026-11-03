"""The policies compared. Each is a plain value object; ``model.py`` interprets it.

Vacant homes (CIMI art. 112): a munícipio may triple the IMI rate on a building vacant more
than a year, or multiply it by ten in a *zona de pressão urbanística* and add 20% in each
later year. Today the law exists and few use it; the question is what it would do if used.

The swap: cut IMT by a share and raise each munícipio's IMI rate so that the munícipio's
revenue is unchanged (owner's choice, 3 Nov 2026: neutrality per munícipio). The vacant
surcharge's revenue counts towards that.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class VacancyPolicy:
    key: str
    label: str
    multiplier: float          # rate on a taxed vacant dwelling, as a multiple of the base rate
    yearly_step: float = 0.0   # extra multiplier growth per later year (0.20 in pressure zones)
    detection: float | None = None  # share of the taxable stock flagged; None = today's prior
    scope: str = "all"         # "all" munícipios, or "pressure": the top quarter by price
    years: int = 3


TODAY = VacancyPolicy("today", "The law as applied today (triple IMI, few flagged)", 3.0)
TRIPLE_ENFORCED = VacancyPolicy("triple", "Triple IMI, half the vacant stock flagged", 3.0, detection=0.5)
TRIPLE_FULL = VacancyPolicy("triple_full", "Triple IMI, 90% flagged", 3.0, detection=0.9)
TENFOLD_PRESSURE = VacancyPolicy(
    "tenfold_pressure", "Ten times IMI +20%/year where prices are highest, triple elsewhere, half flagged",
    10.0, yearly_step=0.20, detection=0.5, scope="pressure")
TENFOLD_ALL = VacancyPolicy("tenfold_all", "Ten times IMI +20%/year everywhere, half flagged",
                            10.0, yearly_step=0.20, detection=0.5)

VACANCY_POLICIES = [TODAY, TRIPLE_ENFORCED, TRIPLE_FULL, TENFOLD_PRESSURE, TENFOLD_ALL]
VACANCY_BY_KEY = {p.key: p for p in VACANCY_POLICIES}


@dataclass(frozen=True)
class SwapPolicy:
    key: str
    label: str
    imt_cut: float             # share of IMT removed (1.0 = abolished)
    vacancy: VacancyPolicy | None = None  # surcharge revenue counted towards neutrality


SWAP_POLICIES = [
    SwapPolicy("imt_half", "Halve IMT, IMI makes up the difference", 0.5),
    SwapPolicy("imt_zero", "Abolish IMT, IMI makes up the difference", 1.0),
    SwapPolicy("imt_half_vacancy", "Halve IMT; tenfold vacant surcharge in pressure zones counts", 0.5,
               vacancy=TENFOLD_PRESSURE),
]
SWAP_BY_KEY = {p.key: p for p in SWAP_POLICIES}

IMI_CEILING = 0.0045  # legal maximum urban rate today (CIMI art. 112)
