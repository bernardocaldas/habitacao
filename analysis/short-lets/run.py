"""Run the short-lets study.

    python run.py lisbon                      # 24 Lisbon parishes, annual, from the game's INE file
    python run.py full --housing-dir ~/code/estimador-data/data/housing
                                              # every parish INE publishes, quarterly, plus the register

Writes results/<mode>/: results.json, per_parish.csv, event_study.csv and figures. With
``full`` it also writes the share of homes per parish and the first stage from the register.
Nothing written here holds record-level register data.
"""
from __future__ import annotations

import argparse
import json
import warnings
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

import data as Dt
import model as M
import treatment as T

HERE = Path(__file__).resolve().parent


def _clean(o):
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items() if k not in ("idata", "per_parish")}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    if isinstance(o, (date, pd.Timestamp)):
        return str(o)
    return o


def counterfactual_figure(panel, fit, out: Path, title: str):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    post = fit["idata"].posterior
    codes = sorted(panel["code"].unique())
    periods = fit["periods"]
    _, _, Y, D = M._matrices(panel)
    tau = post["tau"].values.reshape(-1, len(codes))
    groups = panel.drop_duplicates("code").set_index("code")["group"].reindex(codes)
    fr = groups.eq("frozen").values
    # observed mean of frozen parishes vs the same minus the estimated effect
    obs = np.nanmean(Y[fr], axis=0)
    cf = np.nanmean(Y[fr][None] - tau[:, fr][:, :, None] * D[fr][None], axis=1)
    lo, md, hi = np.quantile(cf, [0.05, 0.5, 0.95], axis=0)
    nev = np.nanmean(Y[groups.eq("never").values], axis=0)
    x = np.arange(len(periods))
    fig, ax = plt.subplots(figsize=(7.5, 4.2), dpi=150)
    ax.fill_between(x, np.exp(lo), np.exp(hi), color="#ffd400", alpha=0.9, lw=0, label="Without the freeze, 90% interval")
    ax.plot(x, np.exp(md), color="#111", lw=1, ls=(0, (2, 2)))
    ax.plot(x, np.exp(obs), color="#111", lw=2, marker="s", ms=4, label="Frozen parishes, observed")
    ax.plot(x, np.exp(nev), color="#8a8a8a", lw=1.5, marker="o", ms=3, label="Never-frozen parishes")
    ax.axvline(x[[i for i, p in enumerate(periods) if str(p) >= "2022"][0]] - 0.5, color="#5e5e5e", lw=0.8)
    ax.set_xticks(x, periods, rotation=0 if len(x) < 12 else 90, fontsize=8)
    ax.set_ylabel("Median rent of new leases, €/m² (geometric mean)", fontsize=8)
    ax.set_title(title, fontsize=10, loc="left")
    ax.legend(frameon=False, fontsize=8)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def run_rents(panel, out: Path, label: str, dose, ks=(0, 1, 2), draws=1000, tune=2000, n_perm=5000):
    res = {"label": label, "units": int(panel["code"].nunique()),
           "groups": panel.drop_duplicates("code")["group"].value_counts().to_dict(),
           "periods": sorted(panel["period"].unique())}
    res["event_study"] = M.event_study(panel).to_dict("records")
    pd.DataFrame(res["event_study"]).to_csv(out / "event_study.csv", index=False)
    res["twfe_ri"] = M.randomisation_inference(panel, n_perm=n_perm)
    res["placebo_2019_ri"] = M.randomisation_inference(M.placebo_panel(panel), n_perm=n_perm)
    res["drop_already_contained"] = M.randomisation_inference(
        panel[~panel["code"].isin(T.ALREADY_CONTAINED)], n_perm=n_perm)
    res["bayes"] = {}
    best = None
    for k in ks:
        fit = M.bayes_factor_model(panel, k=k, dose=dose, draws=draws, tune=tune)
        res["bayes"][f"k{k}"] = _clean(fit)
        fit["per_parish"].assign(k=k).to_csv(out / f"per_parish_k{k}.csv", index=False)
        if k == 1 or best is None:
            best = fit
    fit = M.bayes_factor_model(panel, k=0, dose=dose, draws=draws, tune=tune, trends=True)
    res["bayes"]["k0_trends"] = _clean(fit)
    fit["per_parish"].assign(k="0+trends").to_csv(out / "per_parish_k0_trends.csv", index=False)
    counterfactual_figure(panel, best, out / "counterfactual.png",
                          f"{label}: frozen parishes against their modelled path without the freeze")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["lisbon", "full"])
    ap.add_argument("--housing-dir", type=Path, help="estimador-data's data/housing (register and Censos files)")
    ap.add_argument("--rents-dir", type=Path, help="where ine/rent_*.parquet live, if not under --housing-dir")
    ap.add_argument("--skip-rents", action="store_true", help="register parts only")
    ap.add_argument("--quick", action="store_true", help="fewer draws and permutations (smoke test)")
    a = ap.parse_args()
    warnings.filterwarnings("ignore")
    out = HERE / "results" / a.mode
    out.mkdir(parents=True, exist_ok=True)
    kw = dict(draws=300, tune=600, n_perm=300, ks=(1,)) if a.quick else {}
    results = {"run_on": date.today().isoformat(), "mode": a.mode}

    if a.mode == "lisbon":
        panel = Dt.lisbon_annual()
        results["rents"] = run_rents(panel, out, "Lisbon, annual 2017-2023", Dt.lisbon_al_ratio(), **kw)
    else:
        if not a.housing_dir:
            ap.error("full needs --housing-dir")
        out.mkdir(parents=True, exist_ok=True)
        import register as Rg
        hd = a.housing_dir.expanduser()
        rd = (a.rents_dir or a.housing_dir).expanduser()
        # 1. the register: the first stage, and the share of homes once the Censos table is in
        rnal = hd / "rnal"
        recs = pd.read_parquet(Rg.latest(rnal, "rnal_live_*.parquet"))
        fs = Rg.first_stage(pd.read_parquet(Rg.latest(rnal, "rnal_parish_month_*.parquet")))
        fs["monthly"].to_csv(out / "first_stage_monthly.csv", index=False)
        results["first_stage"] = fs["fit"]
        ratio = None
        try:
            dw = Rg.census_dwellings(hd, rd)
        except FileNotFoundError as e:
            results["share_of_homes"] = f"skipped: {e}"
        else:
            share = Rg.share_of_homes(recs, dw)
            share.to_csv(out / "share_of_homes_by_parish.csv", index=False)
            inc = share["in_census"]
            results["share_of_homes"] = {
                "parishes": int(inc.sum()), "registrations": int(recs.shape[0]),
                "registrations_matched": int(share.loc[inc, "registrations"].sum()),
                "not_in_census_codes": int((~inc).sum()),
                "national_pct": float(100 * share.loc[inc, "registrations"].sum()
                                      / share.loc[inc, "classic_dwellings_2021"].sum()),
                "parishes_over_10pct": int((share["share_pct"] >= 10).sum()),
                "parishes_over_2_5pct": int((share["share_pct"] >= 2.5).sum()),
            }
            ratio = share.set_index("code")["share_pct"]
        if ratio is None:  # the dose for the frozen 14 is the ratio published at the freeze
            ratio = pd.Series({c: float(r) for c, (_, r) in T.FROZEN_APRIL_2022.items()})
        if not a.skip_rents:
            sub = {k: v for k, v in kw.items() if k != "ks"}
            # 2a. annual 2017-2023: every parish with a full series, Lisbon's against the rest
            pa = Dt.complete_units(Dt.ine_panel(rd, "A"))
            results["rents_annual"] = run_rents(pa, out, "All parishes with a full series, annual 2017-2023",
                                                ratio, ks=(1, 2, 3), **sub)
            # spillover check: donors outside Lisbon only (the never-frozen Lisbon parishes are
            # neighbours, where displaced short lets would have gone)
            nout = out / "no_lisbon_controls"
            nout.mkdir(exist_ok=True)
            results["rents_annual_no_lisbon_controls"] = run_rents(
                pa[pa["group"] != "never"], nout, "Annual, donors outside Lisbon only", ratio, ks=(1,), **sub)
            # 2b. 12-month windows by quarter, 2020Q1-2023Q3 (INE's quarterly series starts in 2020)
            pq = Dt.complete_units(Dt.ine_panel(rd, "Q"))
            qout = out / "quarterly"
            qout.mkdir(exist_ok=True)
            results["rents_quarterly"] = run_rents(pq, qout, "All parishes with a full series, 12-month windows to 2023Q3",
                                                   ratio, ks=(1, 2), **sub)
    (out / "results.json").write_text(json.dumps(_clean(results), indent=1, ensure_ascii=False, default=str))
    print(json.dumps(_clean(results), indent=1, ensure_ascii=False, default=str)[:4000])


if __name__ == "__main__":
    main()
