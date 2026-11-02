"""Run every policy on the same posterior draws and summarise against the law today.

Every comparison is paired: each draw runs every policy with the same parameters and the
same future market shocks, so an interval on a difference is the model's uncertainty about
the policy's effect, not noise between runs.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .calibrate import Posterior, calibrate, future_shocks, prior_vs_posterior
from .data import Areas, load_lisbon
from .model import Run, simulate
from .policy import ALL_POLICIES, STATUS_QUO
from .priors import PRIORS

EFFECTIVE_YEAR = 2027
END = 2031


def q(x: np.ndarray) -> list[float]:
    return [float(v) for v in np.percentile(x, [5, 50, 95])]


def _city(run: Run, field: str, year: int | None = None, cumulative: bool = False) -> np.ndarray:
    arr = getattr(run, field)  # (Y, D, N)
    if cumulative:
        sel = run.years >= EFFECTIVE_YEAR
        return arr[sel].sum(axis=(0, 2))
    i = int(np.flatnonzero(run.years == (year or END))[0])
    return arr[i].sum(axis=1)


def _city_rent(run: Run, field: str, weight: str = "nrau_homes", year: int = END) -> np.ndarray:
    i = int(np.flatnonzero(run.years == year)[0])
    w = getattr(run, weight)[i]
    return (getattr(run, field)[i] * w).sum(1) / w.sum(1)


def metrics(run: Run, base: Run) -> dict:
    def pct(a, b):
        return 100 * (a / b - 1)

    def homes(r):
        return _city(r, "nrau_homes") + _city(r, "old_homes") + _city(r, "extra_homes")

    def share(r):
        return 100 * _city(r, "overburdened") / _city(r, "renters")

    disp = lambda r: (_city(r, "filings", cumulative=True) + _city(r, "nonrenewals", cumulative=True)
                      + _city(r, "old_exits", cumulative=True))
    return {
        "market_rent_2031_eur_m2": q(_city_rent(run, "market")),
        "market_rent_vs_today_law_pct": q(pct(_city_rent(run, "market"), _city_rent(base, "market"))),
        "new_lease_rent_2031_eur_m2": q(_city_rent(run, "new_lease")),
        "new_lease_rent_vs_today_law_pct": q(pct(_city_rent(run, "new_lease"), _city_rent(base, "new_lease"))),
        "sitting_rent_vs_today_law_pct": q(pct(_city_rent(run, "sitting"), _city_rent(base, "sitting"))),
        "rental_homes_vs_today_law": q(homes(run) - homes(base)),
        "overburdened_2031": q(_city(run, "overburdened")),
        "overburdened_share_2031_pct": q(share(run)),
        "overburdened_share_vs_today_law_pp": q(share(run) - share(base)),
        "eviction_filings_2027_2031": q(_city(run, "filings", cumulative=True)),
        "eviction_filings_vs_today_law": q(_city(run, "filings", cumulative=True)
                                           - _city(base, "filings", cumulative=True)),
        "nonrenewals_2027_2031": q(_city(run, "nonrenewals", cumulative=True)),
        "pre1990_exits_2027_2031": q(_city(run, "old_exits", cumulative=True)),
        "displaced_vs_today_law": q(disp(run) - disp(base)),
    }


def _rank(x):
    r = np.empty_like(x)
    r[np.argsort(x)] = np.arange(len(x))
    return r


def sensitivity(post: Posterior, outcome: np.ndarray, top: int = 6) -> list[dict]:
    ro = _rank(outcome)
    rows = []
    for p in PRIORS:
        v = post.theta[p.name]
        if np.ptp(v) == 0:
            continue
        rows.append({"name": p.name, "status": p.status,
                     "rank_corr": float(np.corrcoef(_rank(v), ro)[0, 1])})
    rows.sort(key=lambda r: -abs(r["rank_corr"]))
    return rows[:top]


@dataclass
class Result:
    areas: Areas
    post: Posterior
    runs: dict[str, Run]


def run_all(seed: int = 20261102, n_prior: int = 8000, n_post: int = 2000) -> Result:
    rng = np.random.default_rng(seed)
    areas = load_lisbon()
    post = calibrate(areas, rng, n_prior=n_prior, n_post=n_post)
    shocks = future_shocks(post, rng, areas.n, END - 2025)
    runs = {p.key: simulate(p, post.theta, post.trend, areas, shocks,
                            effective_year=EFFECTIVE_YEAR, end=END) for p in ALL_POLICIES}
    return Result(areas, post, runs)


def summarise(res: Result) -> dict:
    base = res.runs[STATUS_QUO.key]
    bill = res.runs["bill"]
    i = int(np.flatnonzero(bill.years == END)[0])
    parish = []
    for a, (code, name) in enumerate(zip(res.areas.codes, res.areas.names)):
        parish.append({
            "code": code, "name": name,
            "new_lease_rent_vs_today_law_pct": q(100 * (bill.new_lease[i, :, a] / base.new_lease[i, :, a] - 1)),
            "pre1990_exits_2027_2031": q(bill.old_exits[bill.years >= EFFECTIVE_YEAR, :, a].sum(0)),
        })
    return {
        "geography": "Lisbon, 24 parishes (development geography)",
        "effective_year": EFFECTIVE_YEAR, "horizon": END,
        "draws": res.post.draws, "prior_draws": len(res.post.weights),
        "effective_sample_size": res.post.ess,
        "policies": {k: {"label": r.policy.label, **metrics(r, base)} for k, r in res.runs.items()},
        "bill_by_parish": parish,
        "sensitivity": {
            "bill_new_lease_rent_pct": sensitivity(
                res.post, _city_rent(bill, "new_lease") / _city_rent(base, "new_lease")),
            "bill_market_rent_pct": sensitivity(
                res.post, _city_rent(bill, "market") / _city_rent(base, "market")),
            "bill_displaced": sensitivity(res.post, (
                _city(bill, "filings", cumulative=True) + _city(bill, "nonrenewals", cumulative=True)
                + _city(bill, "old_exits", cumulative=True)) - _city(base, "filings", cumulative=True)),
        },
        "calibration": prior_vs_posterior(res.post),
        "trend": {"mu": q(res.post.trend.mu), "s_year": q(res.post.trend.s_year),
                  "s_area": q(res.post.trend.s_area), "s_eps": q(res.post.trend.s_eps)},
        "sources": res.areas.sources,
    }


def _fmt(iv, nd=0, signed=False):
    f = (lambda v: f"{v:+,.{nd}f}") if signed else (lambda v: f"{v:,.{nd}f}")
    return f"{f(iv[1])} ({f(iv[0])} to {f(iv[2])})"


def markdown(s: dict) -> str:
    lines = [
        "# Rental bill simulator: prototype run",
        "",
        f"{s['geography']}. Policies take effect in {s['effective_year']}; figures for {s['horizon']} "
        f"or summed over {s['effective_year']}-{s['horizon']}. Median and 90% interval over "
        f"{s['draws']:,} posterior draws (importance-resampled from {s['prior_draws']:,} prior draws, "
        f"effective sample size {s['effective_sample_size']:,.0f}).",
        "",
        "**Prototype. Most inputs are priors, not data (see docs/POLICY_SIM.md §5); these numbers "
        "show what the model does, not what the bill will do. Not for publication.**",
        "",
        "## Against the law today",
        "",
        "| Policy | New-lease rent | Market rent | Sitting rents | Long-term rental homes | Renters above 40% of income | Eviction filings | Displaced households |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for k, m in s["policies"].items():
        if k == "status_quo":
            continue
        lines.append(
            f"| {m['label']} | {_fmt(m['new_lease_rent_vs_today_law_pct'], 1, True)}% "
            f"| {_fmt(m['market_rent_vs_today_law_pct'], 1, True)}% "
            f"| {_fmt(m['sitting_rent_vs_today_law_pct'], 1, True)}% "
            f"| {_fmt(m['rental_homes_vs_today_law'], 0, True)} "
            f"| {_fmt(m['overburdened_share_vs_today_law_pp'], 1, True)} pp "
            f"| {_fmt(m['eviction_filings_vs_today_law'], 0, True)} "
            f"| {_fmt(m['displaced_vs_today_law'], 0, True)} |")
    sq = s["policies"]["status_quo"]
    lines += [
        "",
        "Rents in " + str(s["horizon"]) + " (% against the law today); homes in " + str(s["horizon"])
        + " (NRAU, pre-1990, public and returned short lets); the 40% share in percentage points; filings and displaced households summed over the five years. Displaced = eviction "
        "filings + contracts ended by free non-renewal + pre-1990 tenants who leave after the update.",
        "",
        f"The law today, for scale: new-lease rent {_fmt(sq['new_lease_rent_2031_eur_m2'], 1)} €/m² in {s['horizon']}, "
        f"{_fmt(sq['overburdened_share_2031_pct'], 1)}% of renter households above 40% of income "
        f"(the share among those still renting in the city: households priced out leave the count), "
        f"{_fmt(sq['eviction_filings_2027_2031'])} eviction filings over five years.",
        "",
        "## The bill by parish",
        "",
        "| Parish | New-lease rent vs today's law | Pre-1990 tenants leaving |",
        "|---|---|---|",
    ]
    for p in s["bill_by_parish"]:
        lines.append(f"| {p['name']} | {_fmt(p['new_lease_rent_vs_today_law_pct'], 1, True)}% "
                     f"| {_fmt(p['pre1990_exits_2027_2031'])} |")
    lines += ["", "## What the result depends on", "",
              "Rank correlation of each assumption with the outcome, across draws (the six largest).", ""]
    for key, rows in s["sensitivity"].items():
        lines.append(f"- **{key}**: " + "; ".join(
            f"{r['name']} ({r['status']}) {r['rank_corr']:+.2f}" for r in rows))
    lines += ["", "## What 2024-2025 taught the model", "",
              "| Assumption | Status | Prior 90% | Posterior 90% |", "|---|---|---|---|"]
    for r in s["calibration"]:
        if abs(r["shift"]) > 0.05 or r["narrowing"] > 0.1:
            lines.append(f"| {r['name']} | {r['status']} | {r['prior'][0]:.3g} to {r['prior'][2]:.3g} "
                         f"| {r['posterior'][0]:.3g} to {r['posterior'][2]:.3g} |")
    lines.append("")
    lines.append("Every other assumption kept its prior: two years of city-wide rents say nothing about it.")
    lines.append("")
    return "\n".join(lines)


def write(out_dir: Path, seed: int = 20261102) -> dict:
    res = run_all(seed=seed)
    s = summarise(res)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "summary.json").write_text(json.dumps(s, indent=1, ensure_ascii=False), encoding="utf-8")
    (out_dir / "summary.md").write_text(markdown(s), encoding="utf-8")
    return s
