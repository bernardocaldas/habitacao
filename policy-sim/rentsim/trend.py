"""Bayesian model of new-lease rent growth before the 2% cap, by area.

    g[a, t] = log rent[a, t] - log rent[a, t-1]
    g[a, t] = mu + gamma[t] + alpha[a] + eps[a, t]
    gamma[t] ~ N(0, s_year^2)    city-wide year shocks (one year crosses INE's 2020 splice)
    alpha[a] ~ N(0, s_area^2)    persistent area differences in growth
    eps      ~ N(0, s_eps^2)     area-year noise, INE's sampling error included
    mu ~ N(0.05, 0.10^2); each variance ~ InvGamma(2, 0.002)

Fitted on the growth years up to and including ``last_year`` (default 2023: the cap applies
to contracts from October 2023, so 2024 onwards is held out for ``calibrate.py``). Gibbs
sampling, conjugate at every step, numpy only.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import Areas


@dataclass(frozen=True)
class TrendPosterior:
    mu: np.ndarray  # (D,)
    alpha: np.ndarray  # (D, N)
    s_year: np.ndarray  # (D,)
    s_eps: np.ndarray  # (D,)
    s_area: np.ndarray  # (D,)
    gamma: np.ndarray  # (D, T_fit) fitted year shocks
    fit_years: np.ndarray

    @property
    def draws(self) -> int:
        return len(self.mu)

    def subset(self, idx: np.ndarray) -> "TrendPosterior":
        return TrendPosterior(self.mu[idx], self.alpha[idx], self.s_year[idx], self.s_eps[idx],
                              self.s_area[idx], self.gamma[idx], self.fit_years)

    def simulate_growth(self, rng: np.random.Generator, years: int) -> np.ndarray:
        """Posterior-predictive log growth, shape (D, N, years): new year shocks and noise."""
        d, n = self.alpha.shape
        gam = rng.normal(0, 1, (d, 1, years)) * self.s_year[:, None, None]
        eps = rng.normal(0, 1, (d, n, years)) * self.s_eps[:, None, None]
        return self.mu[:, None, None] + self.alpha[:, :, None] + gam + eps


def growth_matrix(areas: Areas, first_year: int, last_year: int) -> tuple[np.ndarray, np.ndarray]:
    lr = np.log(areas.rent_m2)
    g = lr[:, 1:] - lr[:, :-1]
    gy = areas.years[1:]
    keep = (gy >= first_year) & (gy <= last_year)
    return g[:, keep], gy[keep]


def _inv_gamma(rng, a, b):
    return b / rng.gamma(a)


def fit_trend(areas: Areas, rng: np.random.Generator, draws: int = 4000, burn: int = 1000,
              first_year: int = 2018, last_year: int = 2023) -> TrendPosterior:
    g, gy = growth_matrix(areas, first_year, last_year)
    obs = ~np.isnan(g)
    y = np.where(obs, g, 0.0)
    n_area, n_year = g.shape
    n_obs = obs.sum()
    a0, b0 = 2.0, 0.002
    mu, gamma, alpha = 0.05, np.zeros(n_year), np.zeros(n_area)
    s2, s2y, s2a = 0.003, 0.003, 0.001
    out = {k: [] for k in ("mu", "alpha", "s_year", "s_eps", "s_area", "gamma")}
    for it in range(burn + draws):
        r = y - gamma[None, :] - alpha[:, None]
        prec = 1 / 0.01 + n_obs / s2
        mu = rng.normal((0.05 / 0.01 + (r * obs).sum() / s2) / prec, prec ** -0.5)
        r = y - mu - alpha[:, None]
        n_t = obs.sum(0)
        prec = 1 / s2y + n_t / s2
        gamma = rng.normal(((r * obs).sum(0) / s2) / prec, prec ** -0.5)
        r = y - mu - gamma[None, :]
        n_a = obs.sum(1)
        prec = 1 / s2a + n_a / s2
        alpha = rng.normal(((r * obs).sum(1) / s2) / prec, prec ** -0.5)
        res = (y - mu - gamma[None, :] - alpha[:, None]) * obs
        s2 = _inv_gamma(rng, a0 + n_obs / 2, b0 + (res ** 2).sum() / 2)
        s2y = _inv_gamma(rng, a0 + n_year / 2, b0 + (gamma ** 2).sum() / 2)
        s2a = _inv_gamma(rng, a0 + n_area / 2, b0 + (alpha ** 2).sum() / 2)
        if it >= burn:
            out["mu"].append(mu)
            out["alpha"].append(alpha.copy())
            out["gamma"].append(gamma.copy())
            out["s_eps"].append(np.sqrt(s2))
            out["s_year"].append(np.sqrt(s2y))
            out["s_area"].append(np.sqrt(s2a))
    return TrendPosterior(
        mu=np.array(out["mu"]), alpha=np.array(out["alpha"]), s_year=np.array(out["s_year"]),
        s_eps=np.array(out["s_eps"]), s_area=np.array(out["s_area"]),
        gamma=np.array(out["gamma"]), fit_years=gy)
