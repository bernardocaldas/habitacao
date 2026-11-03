"""Run every policy on the same prior draws and write the report.

There is nothing to calibrate against yet: these are prior predictive results. Every
comparison is paired (same draws for every policy), so the interval on a difference is the
model's uncertainty about the policy, not noise between runs.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

from .data import Municipios
from .model import above_ceiling, pressure_mask, simulate_swap, simulate_vacancy
from .policy import IMI_CEILING, SWAP_POLICIES, TODAY, VACANCY_POLICIES
from .priors import BY_NAME, PRIORS, sample_priors

SHOW = ["1106", "1312", "1105", "0808", "1512", "1110", "0303", "1308"]  # Lisboa, Porto, Cascais, Loulé, Setúbal, Oeiras, Braga, Matosinhos


def q(x) -> list[float]:
    return [float(v) for v in np.nanpercentile(x, [5, 50, 95])]


def _rank(x: np.ndarray) -> np.ndarray:
    return np.argsort(np.argsort(x)).astype(float)


def sensitivity(theta: dict[str, np.ndarray], y: np.ndarray) -> dict[str, float]:
    ry = _rank(y)
    out = {k: float(np.corrcoef(_rank(v), ry)[0, 1]) for k, v in theta.items() if np.std(v) > 0}
    return dict(sorted(out.items(), key=lambda kv: -abs(kv[1])))


def run_all(m: Municipios, draws: int = 4000, seed: int = 11) -> dict:
    rng = np.random.default_rng(seed)
    th = sample_priors(rng, draws)
    taxable = float(m.vacant_other.sum())
    out: dict = {
        "draws": draws,
        "municipios": m.n,
        "census_2021": {
            "dwellings": float(m.dwellings.sum()),
            "vacant_other": taxable,
            "vacant_market": float(m.vacant_market.sum()),
            "vacant_other_pre1946": float(m.vacant_other_pre1946.sum()),
            "secondary": float(m.secondary.sum()),
        },
        "price_period": m.periods.get("price"), "rent_period": m.periods.get("rent"),
        "price_imputed": int(m.price_imputed.sum()), "rent_imputed": int(m.rent_imputed.sum()),
        "imi_rate_known": int(m.imi_rate_known.sum()),
        "pressure_municipios": [m.name[i] for i in np.flatnonzero(pressure_mask(m))],
        "vacancy": {}, "swap": {}, "priors": [p.__dict__ for p in PRIORS],
    }
    runs = {}
    for p in VACANCY_POLICIES:
        r = simulate_vacancy(p, m, th)
        runs[p.key] = r
        nat_ret = r.returned.sum(1)
        res = {
            "label": p.label,
            "flagged": q(r.flagged.sum(1)),
            "returned_homes": q(nat_ret),
            "returned_share_of_vacant_other_pct": q(100 * nat_ret / taxable),
            "revenue_year1_meur": q(r.revenue[0].sum(1) / 1e6),
            "revenue_avg_meur": q(r.revenue.mean(0).sum(1) / 1e6),
            "stuck_owners_paying": q(r.paying_stuck.sum(1)),
            "year1_surcharge_share_of_rent_pct": q(100 * np.median(r.first_year_share_of_rent, 1)),
            "sensitivity_returned": sensitivity(th, nat_ret),
            "by_municipio": {},
        }
        for c in SHOW:
            if c in m.code:
                i = m.index(c)
                res["by_municipio"][m.name[i]] = {
                    "vacant_other": float(m.vacant_other[i]),
                    "returned_homes": q(r.returned[:, i]),
                    "revenue_avg_meur": q(r.revenue.mean(0)[:, i] / 1e6),
                    "year1_surcharge_share_of_rent_pct": q(100 * r.first_year_share_of_rent[:, i]),
                }
        out["vacancy"][p.key] = res
    if np.isnan(m.imt_eur).all():
        out["swap"] = {"skipped": "no municipal IMT/IMI data loaded (municipal_tax.csv)"}
    else:
        for s in SWAP_POLICIES:
            r = simulate_swap(s, m, th, runs[s.vacancy.key] if s.vacancy else None)
            k = r.known
            w_base = np.where(k, m.imi_eur / m.imi_rate, 0)
            nat_rate = (np.nansum(np.where(k, r.new_rate * w_base, 0), 1) / w_base.sum())
            res = {
                "label": s.label, "municipios_with_data": int(k.sum()), "tax_year": m.tax_year,
                "national_effective_rate_pct": q(100 * nat_rate),
                "municipios_above_ceiling": q(above_ceiling(r).sum(1)),
                "revenue_moved_meur": q(np.nansum(np.where(k, r.revenue_moved, 0), 1) / 1e6),
                "by_municipio": {},
            }
            for c in SHOW:
                if c in m.code and k[m.index(c)]:
                    i = m.index(c)
                    res["by_municipio"][m.name[i]] = {
                        "imi_rate_today_pct": 100 * float(m.imi_rate[i]),
                        "imi_rate_new_pct": q(100 * r.new_rate[:, i]),
                        "imt_saved_eur": q(r.imt_saved[:, i]),
                        "imi_extra_eur_year": q(r.imi_extra[:, i]),
                        "price_change_eur": q(r.price_change[:, i]),
                        "sales_change_pct": q(r.sales_change_pct[:, i]),
                    }
            out["swap"][s.key] = res
            out["swap"][s.key]["_run"] = r
    out["_runs"] = runs
    out["_m"] = m
    return out


def _fmt(v, unit="", nd=0):
    lo, md, hi = v
    f = lambda x: f"{x:,.{nd}f}"
    return f"{f(md)}{unit} ({f(lo)}–{f(hi)})"


def municipio_table(s: dict, path: Path) -> None:
    m: Municipios = s["_m"]
    runs = s["_runs"]
    cols = ["code", "name", "dwellings", "vacant_other", "vacant_market", "price_m2", "rent_m2", "imi_rate"]
    for k in runs:
        cols += [f"{k}_returned_p50", f"{k}_revenue_avg_eur_p50"]
    swaps = {k: v["_run"] for k, v in s["swap"].items() if isinstance(v, dict) and "_run" in v}
    for k in swaps:
        cols += [f"{k}_new_rate_pct_p50"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for i in range(m.n):
            row = [m.code[i], m.name[i], m.dwellings[i], m.vacant_other[i], m.vacant_market[i],
                   round(m.price_m2[i], 1), round(m.rent_m2[i], 2), m.imi_rate[i]]
            for r in runs.values():
                row += [round(float(np.median(r.returned[:, i])), 1),
                        round(float(np.median(r.revenue.mean(0)[:, i])), 0)]
            for r in swaps.values():
                row += ["" if not r.known[i] else round(100 * float(np.median(r.new_rate[:, i])), 3)]
            w.writerow(row)


def markdown(s: dict) -> str:
    c = s["census_2021"]
    L = ["# imtsim: vacant-homes surcharge and the IMT-to-IMI swap", "",
         "Prior predictive results, no calibration: medians with 90% intervals. **Prototype, not for publication.**", "",
         f"Census 2021: {c['dwellings']:,.0f} classic family dwellings in {s['municipios']} munícipios; "
         f"{c['vacant_other']:,.0f} vacant for other reasons ({c['vacant_other_pre1946']:,.0f} in buildings from before 1946), "
         f"{c['vacant_market']:,.0f} vacant for sale or rent. Prices {s['price_period']} (imputed in {s['price_imputed']}), "
         f"rents {s['rent_period']} (imputed in {s['rent_imputed']}). IMI rate for {s['imi_rate_known']} munícipios "
         "(the 0.3% legal minimum where none was communicated; 0.3% assumed where no tax data).", "",
         "## Vacant homes, after three years", "",
         "| Policy | Flagged | Back in use | % of vacant-other | Surcharge, year 1 (M€) | Owners paying who cannot act | Year-1 surcharge, % of a year's rent (median munícipio) |",
         "| --- | --- | --- | --- | --- | --- | --- |"]
    for v in s["vacancy"].values():
        L.append(f"| {v['label']} | {_fmt(v['flagged'])} | {_fmt(v['returned_homes'])} | "
                 f"{_fmt(v['returned_share_of_vacant_other_pct'], '%', 1)} | {_fmt(v['revenue_year1_meur'], '', 1)} | "
                 f"{_fmt(v['stuck_owners_paying'])} | {_fmt(v['year1_surcharge_share_of_rent_pct'], '%', 1)} |")
    L += ["", "Check: the 2021 surcharge raised 7.1 M€ on 10,372 buildings in 25 munícipios (ECO, 9 Mar 2023); "
          f"the 'today' row's year-1 revenue should be of that order: {_fmt(s['vacancy'][TODAY.key]['revenue_year1_meur'], ' M€', 1)}.", ""]
    key = "triple"
    L += [f"What moves the national 'back in use' figure most ({s['vacancy'][key]['label']}), rank correlation:", ""]
    for k, v in list(s["vacancy"][key]["sensitivity_returned"].items())[:5]:
        L.append(f"- `{k}` ({BY_NAME[k].status}): {v:+.2f}")
    L += ["", "### Selected munícipios (ten times IMI in the dearest quarter, half flagged)", "",
          "| Munícipio | Vacant-other | Back in use | Surcharge a year (M€) | Year-1 surcharge, % of rent |", "| --- | --- | --- | --- | --- |"]
    for name, v in s["vacancy"]["tenfold_pressure"]["by_municipio"].items():
        L.append(f"| {name} | {v['vacant_other']:,.0f} | {_fmt(v['returned_homes'])} | {_fmt(v['revenue_avg_meur'], '', 2)} | "
                 f"{_fmt(v['year1_surcharge_share_of_rent_pct'], '%', 0)} |")
    L += ["", "## The swap, each munícipio revenue-neutral", ""]
    if "skipped" in s["swap"]:
        L.append(f"Not run: {s['swap']['skipped']}.")
    else:
        L += ["| Policy | Munícipios with data | National effective IMI rate | Munícipios above 0.45% | IMT moved to IMI (M€) |",
              "| --- | --- | --- | --- | --- |"]
        for v in s["swap"].values():
            L.append(f"| {v['label']} | {v['municipios_with_data']} | {_fmt(v['national_effective_rate_pct'], '%', 2)} | "
                     f"{_fmt(v['municipios_above_ceiling'])} | {_fmt(v['revenue_moved_meur'])} |")
        L += ["", "### Selected munícipios, IMT abolished", "",
              "| Munícipio | IMI today | IMI needed | IMT saved on a typical home (€) | Extra IMI (€/yr) | Price change (€) |",
              "| --- | --- | --- | --- | --- | --- |"]
        for name, v in s["swap"]["imt_zero"]["by_municipio"].items():
            L.append(f"| {name} | {v['imi_rate_today_pct']:.3f}% | {_fmt(v['imi_rate_new_pct'], '%', 2)} | {_fmt(v['imt_saved_eur'])} | "
                     f"{_fmt(v['imi_extra_eur_year'])} | {_fmt(v['price_change_eur'])} |")
    return "\n".join(L) + "\n"


def write(m: Municipios, out: Path, draws: int = 4000) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    s = run_all(m, draws)
    municipio_table(s, out / "municipios.csv")
    (out / "summary.md").write_text(markdown(s), encoding="utf-8")
    clean = {k: v for k, v in s.items() if not k.startswith("_")}
    clean["swap"] = {k: ({kk: vv for kk, vv in v.items() if kk != "_run"} if isinstance(v, dict) else v)
                     for k, v in s["swap"].items()}
    (out / "summary.json").write_text(json.dumps(clean, ensure_ascii=False, indent=1), encoding="utf-8")
    return s
