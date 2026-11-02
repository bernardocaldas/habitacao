"""Every assumed quantity, with a 90% prior interval, its status and where it comes from.

Status:
- ``data_to_come``: a fact INE or another publisher measures; the prior stands in until the
  estimador-data collector delivers the table named in ``replace_with``.
- ``literature``: an effect size taken from published studies, widened for transfer to
  Portugal.
- ``judgement``: no direct evidence; the interval is deliberately wide and the report shows
  how much the result moves with it (``sensitivity`` in ``report.py``).

Shares are logit-normal and positive quantities log-normal, each fitted to the 90% interval.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

Z90 = 1.6448536269514722


@dataclass(frozen=True)
class Prior:
    name: str
    kind: str  # "share" (logit-normal), "positive" (log-normal), "normal"
    lo: float
    hi: float
    status: str
    source: str
    replace_with: str = ""

    def sample(self, rng: np.random.Generator, n: int) -> np.ndarray:
        if self.kind == "share":
            a, b = np.log(self.lo / (1 - self.lo)), np.log(self.hi / (1 - self.hi))
            z = rng.normal((a + b) / 2, (b - a) / (2 * Z90), n)
            return 1 / (1 + np.exp(-z))
        if self.kind == "positive":
            a, b = np.log(self.lo), np.log(self.hi)
            return np.exp(rng.normal((a + b) / 2, (b - a) / (2 * Z90), n))
        if self.kind == "normal":
            return rng.normal((self.lo + self.hi) / 2, (self.hi - self.lo) / (2 * Z90), n)
        raise ValueError(self.kind)


PRIORS: list[Prior] = [
    # --- The rental stock (Lisbon) -------------------------------------------------------
    Prior("renter_share", "share", 0.30, 0.45, "data_to_come",
          "Share of Lisbon's private households that rent; judgement around the city's known "
          "high renter share.", "INE 0012498 (Censos 2021, tenure, by parish)"),
    Prior("old_share", "share", 0.15, 0.35, "data_to_come",
          "Share of rented homes on pre-1990 contracts. Nationally 124,083 private pre-1990 "
          "contracts (IHRU/OHARU study, Nov 2023, from Censos 2021; 151,520 including public "
          "landlords, ECO 23 Feb 2023); Lisbon's share is higher than the national one.",
          "Censos 2021 rented dwellings by contract period (collector: census_rents_by_contract_period)"),
    Prior("old_rent", "positive", 80.0, 230.0, "data_to_come",
          "Monthly rent of a pre-1990 contract, €. Largest Censos 2021 bracket 100-149.99 € "
          "(ECO, 23 Feb 2023).", "Censos 2021 rents by bracket and contract period"),
    Prior("old_unprotected", "share", 0.15, 0.50, "judgement",
          "Share of pre-1990 tenants the bill would let landlords move to 1/15 of the VPT: not "
          "65 or older, not 60%+ disabled, or with income above 64,400 €/year (bill as "
          "reported by Lusa and DECO, Sept-Oct 2026). 21,084 old-rent tenants ever asked for "
          "an income (RABC) certificate (IHRU, 2023).", "Censos 2021 age of tenants on pre-1990 contracts"),
    Prior("old_income", "positive", 700.0, 1400.0, "judgement",
          "Median monthly net income of a household on a pre-1990 contract, €.",
          "synthetic population income sidecar (IRS 2021) once tenure is on it"),
    Prior("renter_income", "positive", 1500.0, 2800.0, "data_to_come",
          "Median monthly net income of a Lisbon renter household, €. Not yet calibrated: the "
          "level of the 40% share depends on it, the differences between policies much less.",
          "INE IRS by município/parish (estimador-data income collector) or the synthetic population"),
    Prior("income_sigma", "positive", 0.45, 0.80, "judgement",
          "Log-sd of renter household income within an area.", "IRS deciles by parish"),
    Prior("dwelling_m2", "positive", 55.0, 85.0, "data_to_come",
          "Useful area of a rented dwelling, m².", "Censos 2021 rented dwellings by area"),
    Prior("vpt_to_market", "share", 0.15, 0.45, "judgement",
          "Tax value (VPT) of a pre-1990 rented dwelling as a share of its market value today. "
          "Most VPTs date from the 2012-2013 general reassessment, with an age discount; Lisbon "
          "sale prices have more than doubled since 2016 (INE).",
          "AT VPT statistics by município, if published"),
    # --- Contracts --------------------------------------------------------------------------
    Prior("turnover", "share", 0.10, 0.20, "judgement",
          "Share of NRAU contracts that end each year (mean tenure 5 to 10 years).",
          "INE new-lease counts / rented stock (collector: rent_new_leases_count)"),
    Prior("extra_turnover", "share", 0.005, 0.06, "judgement",
          "Extra yearly contract endings when landlords may oppose renewal at any term "
          "(today only after three years)."),
    Prior("cap_compliance", "share", 0.20, 0.80, "judgement",
          "Share of re-lets that respect the 2% rule; enforcement rests on registering the "
          "contract with the tax authority. Updated by the 2024-2025 rents (calibrate.py)."),
    Prior("relet_share", "share", 0.50, 0.85, "judgement",
          "Share of new leases that re-let a home let in the previous five years, the homes "
          "the cap covers (Lei 56/2023)."),
    Prior("update_coef", "positive", 0.015, 0.030, "data_to_come",
          "Yearly legal rent update coefficient from 2027 (2.24% for 2026, DECO).",
          "INE CPI without housing, August"),
    # --- Market ----------------------------------------------------------------------------
    Prior("supply_elasticity", "positive", 0.10, 0.80, "literature",
          "Long-run elasticity of the long-term rental stock to the landlord's expected "
          "yield. Rent control cut treated landlords' rental supply by 15% (Diamond, McQuade "
          "& Qian 2019, AER); Catalonia's 2020 cap reduced listed supply (Monràs & "
          "García-Montalvo 2023, J. Public Econ.)."),
    Prior("demand_elasticity", "positive", 0.30, 1.00, "literature",
          "Absolute price elasticity of demand for long-term rental (households doubling up, "
          "leaving the city or buying)."),
    Prior("adjust_speed", "share", 0.15, 0.50, "judgement",
          "Share of the remaining long-run supply response realised each year."),
    Prior("arrears_months_lost", "positive", 6.0, 18.0, "judgement",
          "Months of rent a landlord loses to a tenant who stops paying, today (trigger plus "
          "procedure and execution).", "BNA / Ministry of Justice procedure durations"),
    Prior("bill_months_saved", "positive", 1.5, 6.0, "judgement",
          "Months the bill saves: the trigger at 2 months instead of 3, and no separate "
          "execution step (Lusa, 7 Oct 2026)."),
    # --- Arrears and moves ---------------------------------------------------------------
    Prior("arrears_base", "share", 0.015, 0.06, "judgement",
          "Yearly probability that a renter household falls behind, at a 30% rent burden.",
          "BNA eviction requests per year as a calibration target"),
    Prior("arrears_slope", "positive", 0.15, 0.60, "judgement",
          "Log-odds of falling behind per 10 points of rent burden."),
    Prior("arrears_continue", "share", 0.40, 0.80, "judgement",
          "Probability that arrears run another month, given they have run this one."),
    Prior("filing_rate", "share", 0.20, 0.60, "judgement",
          "Share of arrears past the legal trigger that the landlord takes to eviction."),
    Prior("burden_exit", "share", 0.40, 0.60, "judgement",
          "Rent burden above which a household facing a rise leaves its home."),
    Prior("moratorium_months", "positive", 6.0, 24.0, "judgement",
          "Extra months of rent a landlord expects to lose under an eviction moratorium "
          "(protesters' counterfactual)."),
    Prior("income_growth", "positive", 0.015, 0.045, "judgement",
          "Yearly nominal growth of renter household income from 2026.",
          "INE IRS series by município, 2018-2024"),
    Prior("rent_sigma", "positive", 0.15, 0.35, "judgement",
          "Log-sd of rents within a segment and area (contracts of different ages and sizes)."),
    Prior("past_growth", "positive", 0.02, 0.06, "judgement",
          "Yearly growth of new-lease rents before 2017, used only to age the 2017 stock of "
          "sitting tenants' rents."),
    Prior("short_let_return", "share", 0.05, 0.40, "judgement",
          "Share of short-let homes returning to long-term rental if new short lets are "
          "banned and existing licences lapse (protesters' counterfactual)."),
]

PRIOR_BY_NAME = {p.name: p for p in PRIORS}


def sample_priors(rng: np.random.Generator, n: int) -> dict[str, np.ndarray]:
    return {p.name: p.sample(rng, n) for p in PRIORS}
