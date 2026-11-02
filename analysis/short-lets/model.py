"""Estimators of the 2022 freeze's effect on log new-lease rents.

1. ``bayes_factor_model``: the main estimator. A Bayesian counterfactual in the family of
   generalised synthetic control (Xu 2017; Pang, Liu & Xu 2022): every parish's log rent is
   a parish level, a common year path and K latent factors with parish loadings, plus the
   effect of the freeze times the window's exposure. Controls in every period and frozen
   parishes before the freeze pin down the factors; what is left in the frozen parishes'
   frozen windows is the effect. Parish effects are partially pooled around a mean
   (``tau_mean``), with an optional slope on the parish's pre-freeze AL ratio (``tau_dose``).
   Noise is parish-specific (medians from few contracts are noisier).
2. ``twfe`` with randomisation inference: the plain two-way fixed-effects contrast, and its
   distribution when the frozen label is shuffled across parishes (Fisher; the honest test
   with 14 treated and 8 controls).
3. ``event_study``: year-by-year gaps, frozen minus never, relative to 2021, to see the
   pre-trends the factor model must absorb (tourism's COVID collapse hit the frozen
   parishes hardest, and its 2022 return pushes the other way from the freeze).
"""
from __future__ import annotations

from typing import Dict, Optional

import numpy as np
import pandas as pd


def _matrices(panel: pd.DataFrame):
    codes = sorted(panel["code"].unique())
    periods = sorted(panel["period"].unique())
    Y = panel.pivot(index="code", columns="period", values="log_rent").reindex(index=codes, columns=periods)
    D = panel.pivot(index="code", columns="period", values="exposure").reindex(index=codes, columns=periods).fillna(0.0)
    return codes, periods, Y.values, D.values


def bayes_factor_model(panel: pd.DataFrame, k: int = 1, dose: Optional[pd.Series] = None,
                       draws: int = 1000, tune: int = 1500, chains: int = 4, seed: int = 0,
                       treated_groups=("frozen", "late"), trends: bool = False) -> Dict:
    import pymc as pm

    codes, periods, Y, D = _matrices(panel)
    N, Tn = Y.shape
    groups = panel.drop_duplicates("code").set_index("code")["group"].reindex(codes)
    is_treated = groups.isin(treated_groups).values
    D = D * is_treated[:, None]
    obs = ~np.isnan(Y)
    ii, tt = np.nonzero(obs)
    ybar = np.nanmean(Y)
    t_idx = np.array([np.flatnonzero(is_treated)]).ravel()
    z = None
    if dose is not None:
        z = np.log(dose.reindex(codes).astype(float).clip(lower=0.1)).values
        z = (z - np.nanmean(z[is_treated])) / np.nanstd(z[is_treated])
        z = np.nan_to_num(z)

    with pm.Model() as m:
        alpha = pm.Normal("alpha", ybar, 0.5, shape=N)
        s_delta = pm.HalfNormal("s_delta", 0.15)
        delta = pm.Deterministic("delta", pm.math.concatenate(
            [pm.math.zeros(1), pm.math.cumsum(pm.Normal("d_step", 0, 1, shape=Tn - 1) * s_delta)]))
        mu = alpha[ii] + delta[tt]
        if trends:  # parish-specific linear trends, centred on the last pre-freeze period
            pre_last = max(j for j, p in enumerate(periods) if not (D[:, j] > 0).any())
            gamma = pm.Normal("gamma", 0, 0.03, shape=N)
            mu = mu + gamma[ii] * (tt - pre_last)
        if k > 0:
            s_f = pm.HalfNormal("s_f", 0.1)
            f_steps = pm.Normal("f_step", 0, 1, shape=(Tn - 1, k))
            F = pm.math.concatenate([pm.math.zeros((1, k)), pm.math.cumsum(f_steps * s_f, axis=0)], axis=0)
            lam = pm.Normal("lam", 0, 1, shape=(N, k))
            mu = mu + (lam[ii] * F[tt]).sum(axis=-1)
        tau_mean = pm.Normal("tau_mean", 0, 0.1)  # prior: within +-20% at 95%, centred on no effect
        tau_sd = pm.HalfNormal("tau_sd", 0.05)
        tau_raw = pm.Normal("tau_raw", 0, 1, shape=N)
        tau_lin = tau_mean + tau_sd * tau_raw
        if z is not None:
            tau_dose = pm.Normal("tau_dose", 0, 0.05)
            tau_lin = tau_lin + tau_dose * z
        tau = pm.Deterministic("tau", tau_lin * is_treated)
        mu = mu + tau[ii] * D[ii, tt]
        # parish noise: log-normal around a common scale (non-centred, no funnel)
        log_s0 = pm.Normal("log_s0", np.log(0.04), 0.7)
        s_sig = pm.HalfNormal("s_sig", 0.5)
        sigma = pm.Deterministic("sigma", pm.math.exp(log_s0 + s_sig * pm.Normal("sig_raw", 0, 1, shape=N)))
        pm.Normal("y", mu, sigma[ii], observed=Y[ii, tt])
        idata = pm.sample(draws=draws, tune=tune, chains=chains, random_seed=seed,
                          target_accept=0.95, progressbar=False)

    post = idata.posterior
    checked = ["tau_mean", "tau_sd", "tau", "alpha", "delta"] + (["tau_dose"] if z is not None else [])
    rhat_max = max(float(np.nanmax(split_rhat(post[v].values))) for v in checked)
    tm = post["tau_mean"].values.ravel()
    # the average effect over the frozen windows actually observed (ATT, exposure-weighted)
    tau_draws = post["tau"].values.reshape(-1, N)
    w = (D * obs)[is_treated].sum(axis=1)
    att = (tau_draws[:, is_treated] * w).sum(axis=1) / w.sum()
    per = pd.DataFrame({
        "code": np.array(codes)[is_treated],
        "median": np.median(tau_draws[:, is_treated], axis=0),
        "lo90": np.quantile(tau_draws[:, is_treated], 0.05, axis=0),
        "hi90": np.quantile(tau_draws[:, is_treated], 0.95, axis=0),
    })
    diverging = int(idata.sample_stats["diverging"].values.sum())
    return {
        "k": k, "trends": trends, "n_units": N, "n_treated": int(is_treated.sum()), "periods": periods,
        "tau_mean": _q(tm), "att_exposure_weighted": _q(att),
        "p_tau_mean_negative": float((tm < 0).mean()),
        "tau_dose": _q(post["tau_dose"].values.ravel()) if z is not None else None,
        "per_parish": per, "diverging": diverging, "rhat_max": rhat_max, "idata": idata,
    }


def split_rhat(x: np.ndarray) -> np.ndarray:
    """Split R-hat (Gelman et al. 2013) over the leading (chain, draw) axes."""
    c, n = x.shape[:2]
    h = n // 2
    s = np.concatenate([x[:, :h], x[:, h:2 * h]], axis=0)
    w = s.var(axis=1, ddof=1).mean(axis=0)
    b = h * s.mean(axis=1).var(axis=0, ddof=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.sqrt(((h - 1) / h * w + b / h) / w)


def _q(x: np.ndarray) -> Dict[str, float]:
    return {"median": float(np.median(x)), "lo90": float(np.quantile(x, 0.05)),
            "hi90": float(np.quantile(x, 0.95)), "pct_median": float(np.expm1(np.median(x)) * 100),
            "pct_lo90": float(np.expm1(np.quantile(x, 0.05)) * 100),
            "pct_hi90": float(np.expm1(np.quantile(x, 0.95)) * 100)}


def twfe(panel: pd.DataFrame, treated_groups=("frozen", "late")) -> float:
    """Exposure coefficient in log_rent ~ parish + period + exposure (OLS, within transform)."""
    p = panel.copy()
    p["d"] = np.where(p["group"].isin(treated_groups), p["exposure"], 0.0)
    for col in ("log_rent", "d"):
        p[col + "_w"] = (p[col] - p.groupby("code")[col].transform("mean")
                         - p.groupby("period")[col].transform("mean") + p[col].mean())
    return float((p["log_rent_w"] * p["d_w"]).sum() / (p["d_w"] ** 2).sum())


def randomisation_inference(panel: pd.DataFrame, n_perm: int = 5000, seed: int = 0) -> Dict:
    """Shuffle which parishes are frozen (keeping the dates); where does the real estimate sit?"""
    rng = np.random.default_rng(seed)
    real = twfe(panel)
    units = panel.drop_duplicates("code")[["code", "group"]]
    codes = units["code"].values
    treated = units["group"].isin(["frozen", "late"]).values
    # each treated parish's exposure path, reassigned to a random parish
    exp = panel.pivot(index="code", columns="period", values="exposure").reindex(codes)
    paths = exp.values[treated]
    draws = []
    for _ in range(n_perm):
        pick = rng.choice(len(codes), size=treated.sum(), replace=False)
        newexp = np.zeros_like(exp.values)
        newexp[pick] = paths
        p = panel.copy()
        m = pd.DataFrame(newexp, index=pd.Index(codes, name="code"),
                         columns=pd.Index(exp.columns, name="period")).stack().rename("exposure").reset_index()
        p = p.drop(columns=["exposure"]).merge(m, on=["code", "period"])
        p["group"] = np.where(p["code"].isin(codes[pick]), "frozen", "never")
        draws.append(twfe(p))
    draws = np.array(draws)
    return {"twfe": real, "twfe_pct": float(np.expm1(real) * 100),
            "p_two_sided": float((np.abs(draws) >= abs(real)).mean()),
            "perm_lo90": float(np.quantile(draws, 0.05)), "perm_hi90": float(np.quantile(draws, 0.95))}


def event_study(panel: pd.DataFrame, base: str = "2021") -> pd.DataFrame:
    g = panel[panel["group"].isin(["frozen", "never"])]
    m = g.groupby(["period", "group"])["log_rent"].mean().unstack()
    gap = m["frozen"] - m["never"]
    gap = gap - gap.get(base, 0.0)
    return pd.DataFrame({"period": gap.index, "gap_log": gap.values, "gap_pct": np.expm1(gap.values) * 100})


def placebo_panel(panel: pd.DataFrame, shift_years: int = 3, last_year: int = 2019) -> pd.DataFrame:
    """The same design moved back in time, on pre-COVID years only: a fake freeze in April
    2019 (with the real treated set) should find nothing."""
    import treatment as T
    from datetime import date

    p = panel[panel["end"] <= date(last_year, 12, 31)].copy()
    fake = date(T.IN_FORCE.year - shift_years, T.IN_FORCE.month, T.IN_FORCE.day)

    def ex(r):
        if r["group"] not in ("frozen", "late") or fake > r["end"]:
            return 0.0
        lo = max(r["start"], fake)
        return ((r["end"] - lo).days + 1) / ((r["end"] - r["start"]).days + 1)

    p["exposure"] = p.apply(ex, axis=1)
    return p
