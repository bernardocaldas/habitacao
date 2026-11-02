"""The simulation: one year at a time, every draw and every area at once.

State per draw and area: the latent free-market rent of a new lease (``m_trend``, the trend
model's quantity before any policy's supply effect), the long-term rental stock relative to
a world without the cap (``ln_supply``), the number of homes on NRAU contracts and on
pre-1990 contracts, and the mean rent of sitting NRAU tenants.

Each year:
1. Landlords respond to last year's expected yield: the supply target is
   ``supply_elasticity × ln(yield)``, reached at ``adjust_speed`` a year. Yield falls with
   the share of the market rent a cap takes away on re-letting, and with the expected rent
   lost to arrears (how often arrears reach the legal trigger × months lost).
2. The market rent of a new lease is ``m_trend × exp(-ln_total_supply / demand_elasticity)``.
3. New leases pay the market rent, except the capped share, which pays at most the
   previous lease's rent updated by the legal coefficient and the cap's allowance.
4. Contracts end at ``turnover`` (plus the bill's free non-renewal), and the homes are
   re-let; sitting tenants' rents follow the legal coefficient.
5. Pre-1990 tenants: out of the NRAU today (legal update only); under the bill, unprotected tenants' rents move to 1/15
   of the VPT a year, and those who cannot pay leave.
6. Rent burdens are log-normal (income and rent dispersion); arrears, eviction filings and
   the share of households above 40% of income follow from them.

Years up to ``last_observed`` are conditioned on INE's medians: the measured new-lease rent
(the capped and free leases together) is set equal to the observed one, which fixes that
year's market shock; ``loglik`` is the density of those shocks under the trend model, the
weight ``calibrate.py`` gives each draw.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.polynomial.hermite_e import hermegauss

from .data import Areas
from .policy import STATUS_QUO, Policy
from .trend import TrendPosterior

# Legal yearly rent update coefficients (Aviso published each autumn from INE's CPI; 2023
# was capped at 2% by Lei 19/2022). From 2027 the prior ``update_coef``.
UPDATE_COEF = {2017: 0.0054, 2018: 0.0112, 2019: 0.0115, 2020: 0.0051, 2021: 0.0,
               2022: 0.0043, 2023: 0.02, 2024: 0.0694, 2025: 0.0216, 2026: 0.0224}

BURDEN_LINE = 0.40  # Eurostat's housing-cost overburden threshold
_GH_X, _GH_W = hermegauss(15)
_GH_W = _GH_W / np.sqrt(2 * np.pi)


_erf = np.frompyfunc(__import__("math").erf, 1, 1)


def norm_cdf(z: np.ndarray) -> np.ndarray:
    return 0.5 * (1 + _erf(np.asarray(z, dtype=float) / np.sqrt(2)).astype(float))


def expected_arrears(mean_log_burden, sd_log_burden, base, slope):
    """E[P(arrears)] over a log-normal burden; logit P = logit(base) + slope × (b - 0.3) × 10."""
    b = np.exp(mean_log_burden[..., None] + sd_log_burden[..., None] * _GH_X)
    lb = np.log(base / (1 - base))[..., None]
    p = 1 / (1 + np.exp(-(lb + slope[..., None] * (b - 0.30) * 10)))
    return (p * _GH_W).sum(-1)


def city_mean_ll(r: np.ndarray, s_eps: np.ndarray, s_year: np.ndarray) -> np.ndarray:
    """log density of the city-wide mean shock, mean(r) ~ N(0, s_year² + s_eps²/N).

    A limited-information likelihood: only the city-wide average of each year's shocks
    weighs a draw. Parish-level departures are absorbed as that year's noise, so 2024-2025
    do not re-estimate each parish's own trend (``alpha``), which would leave a handful of
    draws standing; what the two years can say about the cap is city-wide anyway."""
    n = r.shape[1]
    v = s_year ** 2 + s_eps ** 2 / n
    m = r.mean(1)
    return -0.5 * (np.log(2 * np.pi * v) + m ** 2 / v)


def _previous_lease_rent(hist: dict, coefs: dict, year: int, turnover: np.ndarray) -> np.ndarray:
    """Mean previous rent of a home re-let in ``year`` that was let 1 to 5 years before:
    lease ages are geometric in turnover, truncated at five years, each rent updated by the
    legal coefficients since."""
    num, den = 0.0, 0.0
    for k in range(1, 6):
        w = turnover * (1 - turnover) ** (k - 1)
        rent = hist[year - k]
        for u in range(year - k + 1, year + 1):
            rent = rent * (1 + coefs[u])
        num = num + w * rent
        den = den + w
    return num / den


@dataclass
class Run:
    policy: Policy
    years: np.ndarray
    market: np.ndarray  # (Y, D, N) €/m²/month, market rent of a new lease
    new_lease: np.ndarray  # (Y, D, N) €/m²/month, mean rent of new leases signed
    sitting: np.ndarray  # (Y, D, N) €/m²/month, mean NRAU sitting rent
    nrau_homes: np.ndarray  # (Y, D, N)
    old_homes: np.ndarray  # (Y, D, N)
    overburdened: np.ndarray  # (Y, D, N) renter households above 40% of income
    renters: np.ndarray  # (Y, D, N) renter households (NRAU + pre-1990)
    filings: np.ndarray  # (Y, D, N) eviction filings for arrears
    nonrenewals: np.ndarray  # (Y, D, N) contracts ended by the bill's free non-renewal
    old_exits: np.ndarray  # (Y, D, N) pre-1990 households leaving after the rent update
    extra_homes: np.ndarray  # (Y, D, N) public housing + short lets returned
    loglik: np.ndarray  # (D,)


def simulate(policy: Policy, theta: dict[str, np.ndarray], trend: TrendPosterior, areas: Areas,
             shocks: np.ndarray, effective_year: int = 2027, last_observed: int = 2025,
             start: int = 2024, end: int = 2031) -> Run:
    """Run one policy. ``shocks`` (D, N, end-last_observed) are the future market shocks, shared
    across policies (common random numbers) so differences between policies are not noise."""
    D, N = trend.alpha.shape
    th = {k: v[:, None] for k, v in theta.items()}  # broadcast over areas
    obs = areas.rent_m2
    sale25 = areas.sale_m2[:, areas.year_index(2025)][None, :]

    renters0 = areas.households[None, :] * th["renter_share"]
    old0 = renters0 * th["old_share"]
    nrau0 = renters0 - old0

    # Sitting rents in 2017: contracts started k years before at a market rent that grew at
    # past_growth, each updated by ~1% a year; ages are geometric in turnover.
    tau, g0 = th["turnover"], th["past_growth"]
    ratio = tau / (1 - (1 - tau) * np.exp(-g0) * 1.01)
    sitting = obs[:, areas.year_index(2017)][None, :] * ratio
    for y in range(2018, start):
        sitting = (1 - tau) * sitting * (1 + UPDATE_COEF[y]) + tau * obs[:, areas.year_index(y)][None, :]

    # Rents of the leases signed in each past year, for the cap's reference: a capped re-let
    # is a home let in the previous five years, at the rent of that letting, updated since.
    coefs = dict(UPDATE_COEF)
    lease_hist = {y: np.broadcast_to(obs[:, areas.year_index(y)][None, :], (D, N))
                  for y in range(2017, start)}
    m_trend = np.broadcast_to(obs[:, areas.year_index(start - 1)][None, :], (D, N)).copy()
    ln_supply = np.zeros((D, N))
    ln_yield_prev = np.zeros((D, N))
    nrau, old = nrau0.copy(), old0.copy()
    old_rent = th["old_rent"] * np.ones((D, N))
    old_unprot_rent = old_rent.copy()
    unprot_left = th["old_unprotected"] * old  # unprotected pre-1990 households still there
    loglik = np.zeros(D)
    sig_b = np.sqrt(th["income_sigma"] ** 2 + th["rent_sigma"] ** 2)
    m2 = th["dwelling_m2"]

    years = np.arange(start, end + 1)
    out = {k: np.zeros((len(years), D, N)) for k in (
        "market", "new_lease", "sitting", "nrau_homes", "old_homes", "overburdened", "renters",
        "filings", "nonrenewals", "old_exits", "extra_homes")}

    for i, y in enumerate(years):
        pol = policy if y >= effective_year else STATUS_QUO
        coef = UPDATE_COEF.get(y, None)
        coef = th["update_coef"] if coef is None else coef
        coefs[y] = coef
        income = th["renter_income"] * (1 + th["income_growth"]) ** (y - 2026)
        old_income = th["old_income"] * (1 + th["income_growth"]) ** (y - 2026)

        # 1. supply
        ln_supply = ln_supply + th["adjust_speed"] * (th["supply_elasticity"] * ln_yield_prev - ln_supply)
        years_on = max(0, y - effective_year + 1)
        extra = nrau0 * pol.public_housing_per_year * years_on
        if pol.short_lets_ban and years_on:
            ramp = 1 - (1 - th["adjust_speed"]) ** years_on
            extra = extra + areas.short_lets[None, :] * th["short_let_return"] * ramp
        ln_total = ln_supply + np.log1p(extra / nrau0)

        # 3. who is capped
        sitting_coef = coef if pol.sitting_update else 0.0
        prev_ref = _previous_lease_rent(lease_hist, coefs, y, th["turnover"])
        if pol.cap_extra is None:
            capped_share = np.zeros((D, 1))
            cap_level = np.full((D, N), np.inf)
        else:
            share = th["relet_share"] if pol.cap_scope == "relets" else np.ones_like(th["relet_share"])
            capped_share = share * th["cap_compliance"]
            cap_level = prev_ref * (1 + pol.cap_extra)

        # 2. market rent: observed years fix it from INE's median, later years draw it
        damp = np.exp(-ln_total / th["demand_elasticity"])
        if y <= last_observed:
            meas = obs[:, areas.year_index(y)][None, :]
            sc = capped_share
            market = np.where(meas > cap_level, (meas - sc * cap_level) / (1 - sc), meas)
            new_trend = market / damp
            r = np.log(new_trend / m_trend) - trend.mu[:, None] - trend.alpha
            loglik += city_mean_ll(r, trend.s_eps, trend.s_year)
            m_trend = new_trend
        else:
            m_trend = m_trend * np.exp(trend.mu[:, None] + trend.alpha
                                       + shocks[:, :, y - last_observed - 1])
            market = m_trend * damp
        gap = np.clip(1 - cap_level / market, 0, None)
        new_lease = market - capped_share * market * gap
        lease_hist[y] = new_lease

        # 5. pre-1990 contracts
        old_exits = np.zeros((D, N))
        old_rent = old_rent * (1 + sitting_coef)
        if pol.old_rents_unfrozen:
            if y == effective_year:
                vpt = th["vpt_to_market"] * sale25 * m2
                target = np.maximum(old_rent, vpt / 15 / 12)
                leave = norm_cdf((np.log(target / th["burden_exit"]) - np.log(old_income))
                                 / th["income_sigma"])
                old_exits = unprot_left * leave
                unprot_left = unprot_left - old_exits
                old_unprot_rent = target
            else:
                old_unprot_rent = old_unprot_rent * (1 + coef)
        else:
            old_unprot_rent = old_rent
        old = old - old_exits

        # 4. NRAU contracts
        tau_y = th["turnover"] + (th["extra_turnover"] if pol.free_nonrenewal else 0.0)
        ends = tau_y * nrau
        nonrenewals = th["extra_turnover"] * nrau if pol.free_nonrenewal else np.zeros((D, N))
        stay = nrau - ends
        target_homes = nrau0 * np.exp(ln_supply) + (old0 - old)  # freed pre-1990 homes re-let
        nrau_new = np.maximum(target_homes, stay)
        lets = nrau_new - stay
        sitting = (stay * sitting * (1 + sitting_coef) + lets * new_lease) / nrau_new
        nrau = nrau_new

        # 6. burdens, arrears, evictions
        mlb = np.log(sitting * m2 / income)
        over_nrau = nrau * norm_cdf((mlb - np.log(BURDEN_LINE)) / sig_b)
        lb_prot = np.log(old_rent / old_income)
        lb_unp = np.log(old_unprot_rent / old_income)
        prot = old - unprot_left
        over_old = prot * norm_cdf((lb_prot - np.log(BURDEN_LINE)) / th["income_sigma"])
        # stayers among the unprotected are those under the exit line
        z_exit = (np.log(th["burden_exit"]) - lb_unp) / th["income_sigma"]
        z_line = (np.log(BURDEN_LINE) - lb_unp) / th["income_sigma"]
        if pol.old_rents_unfrozen and y >= effective_year:
            p_stay = np.maximum(norm_cdf(z_exit), 1e-9)
            over_old = over_old + unprot_left * np.clip(norm_cdf(z_exit) - norm_cdf(z_line), 0, None) / p_stay
        else:
            over_old = over_old + unprot_left * (1 - norm_cdf(z_line))
        p_arr = expected_arrears(mlb, sig_b, th["arrears_base"], th["arrears_slope"])
        k = pol.arrears_trigger_months
        p_trigger = p_arr * th["arrears_continue"] ** (k - 1)
        p_trigger_ref = p_arr * th["arrears_continue"] ** (STATUS_QUO.arrears_trigger_months - 1)
        months = th["arrears_months_lost"] - (th["bill_months_saved"] if pol.faster_procedure else 0.0)
        if pol.moratorium:
            months = th["arrears_months_lost"] + th["moratorium_months"]
            filings = np.zeros((D, N))
        else:
            filings = nrau * p_trigger * th["filing_rate"]
        # The landlord's loss comes from tenants who stop paying for good: those reach any
        # trigger, so the bill changes how many months they cost (an earlier trigger is part
        # of ``bill_months_saved``), not how many of them there are. An earlier trigger does
        # add filings against tenants who would have caught up.
        loss = np.clip(p_trigger_ref * months / 12, 0, 0.9)
        loss_ref = np.clip(p_trigger_ref * th["arrears_months_lost"] / 12, 0, 0.9)
        ln_yield_prev = np.log1p(-capped_share * gap) + np.log1p(-loss) - np.log1p(-loss_ref)

        for key, val in (("market", market), ("new_lease", new_lease), ("sitting", sitting),
                         ("nrau_homes", nrau), ("old_homes", old),
                         ("overburdened", over_nrau + over_old), ("renters", nrau + old),
                         ("filings", filings), ("nonrenewals", nonrenewals),
                         ("old_exits", old_exits), ("extra_homes", extra)):
            out[key][i] = val

    return Run(policy=policy, years=years, loglik=loglik, **out)
