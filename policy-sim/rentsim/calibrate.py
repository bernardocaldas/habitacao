"""From priors to a posterior: sampling-importance-resampling on INE's 2024-2025 rents.

1. Draw ``n_prior`` parameter sets from ``priors.py``, each paired with a draw of the trend
   posterior (fitted on growth up to 2023, before the 2% rule).
2. Run the law as it stands through 2024 and 2025, conditioning each draw on INE's measured
   new-lease medians. The weight of a draw is the density of the market shocks it needs to
   reproduce those medians (``Run.loglik``).
3. Resample ``n_post`` draws by weight. Parameters the 2024-2025 rents say nothing about keep
   their prior; ``prior_vs_posterior`` reports which ones moved.

This is the honest amount of learning available from two years of 24 parishes: the report
states the effective sample size and every parameter's prior and posterior interval.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import Areas
from .model import simulate
from .policy import STATUS_QUO
from .priors import PRIORS, sample_priors
from .trend import TrendPosterior, fit_trend


@dataclass
class Posterior:
    theta: dict[str, np.ndarray]
    trend: TrendPosterior
    prior_theta: dict[str, np.ndarray]
    weights: np.ndarray  # normalised importance weights of the prior draws
    ess: float

    @property
    def draws(self) -> int:
        return self.trend.draws


def calibrate(areas: Areas, rng: np.random.Generator, n_prior: int = 8000, n_post: int = 2000,
              trend_draws: int = 4000) -> Posterior:
    trend_full = fit_trend(areas, rng, draws=trend_draws)
    pick = rng.integers(0, trend_full.draws, n_prior)
    trend = trend_full.subset(pick)
    theta = sample_priors(rng, n_prior)
    shocks = np.zeros((n_prior, areas.n, 1))  # no future years are needed here
    run = simulate(STATUS_QUO, theta, trend, areas, shocks, end=2025)
    ll = run.loglik - run.loglik.max()
    w = np.exp(ll)
    w /= w.sum()
    ess = 1.0 / (w ** 2).sum()
    idx = rng.choice(n_prior, size=n_post, replace=True, p=w)
    return Posterior(theta={k: v[idx] for k, v in theta.items()}, trend=trend.subset(idx),
                     prior_theta=theta, weights=w, ess=float(ess))


def future_shocks(post: Posterior, rng: np.random.Generator, n_areas: int, years: int) -> np.ndarray:
    t = post.trend
    gam = rng.normal(0, 1, (t.draws, 1, years)) * t.s_year[:, None, None]
    eps = rng.normal(0, 1, (t.draws, n_areas, years)) * t.s_eps[:, None, None]
    return gam + eps


def prior_vs_posterior(post: Posterior) -> list[dict]:
    rows = []
    for p in PRIORS:
        pr = np.percentile(post.prior_theta[p.name], [5, 50, 95])
        po = np.percentile(post.theta[p.name], [5, 50, 95])
        width = (pr[2] - pr[0]) or 1.0
        rows.append({"name": p.name, "status": p.status, "prior": pr.tolist(), "posterior": po.tolist(),
                     "shift": float((po[1] - pr[1]) / width),
                     "narrowing": float(1 - (po[2] - po[0]) / width)})
    return rows
