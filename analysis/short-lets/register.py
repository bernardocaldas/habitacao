"""What the short-let register says: short lets as a share of homes per parish, and the
first stage (did new registrations actually stop in the frozen parishes?).

Reads estimador-data's register files (`collect-data housing --source rnal`), which hold no
personal data, and INE's Censos 2021 dwellings (`collect-data housing --source ine`,
indicator 0012501).
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd

import treatment as T
from data import parish_code


def latest(directory: Path, pattern: str) -> Path:
    files = sorted(directory.glob(pattern))
    if not files:
        raise FileNotFoundError(f"no {pattern} in {directory}")
    return files[-1]


def census_dwellings(*housing_dirs: Path) -> pd.Series:
    """Classic family dwellings per parish, Censos 2021 (every occupancy, every building epoch).
    Looks in each directory's ine/ in turn (the register and INE's files may sit apart)."""
    name = "census_dwellings_by_occupancy_and_epoch.parquet"
    found = [d / "ine" / name for d in housing_dirs if (d / "ine" / name).exists()]
    if not found:
        raise FileNotFoundError(f"no ine/{name} under {', '.join(map(str, housing_dirs))}")
    df = pd.read_parquet(found[0])
    labels = [c for c in df.columns if c.startswith("dim_") and c.endswith("_t")]
    for c in labels:
        df = df[df[c].astype(str).str.strip().str.lower() == "total"]
    df["code"] = df["geocod"].map(parish_code)
    return df.dropna(subset=["code"]).groupby("code")["value"].sum().rename("classic_dwellings_2021")


def share_of_homes(records: pd.DataFrame, dwellings: pd.Series, names: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """Active registrations, and their guests, per parish, over the Censos 2021 classic dwellings.

    This is the RMAL's own ratio (AL establishments / classic family dwellings in the latest
    census). Registrations, not homes: a hostel is one registration and many beds, a flat is
    one of each; the guests column shows the difference. Parish codes created by the 2025
    split are not in the census and are listed apart (``in_census`` False)."""
    g = records.dropna(subset=["dicofre"]).groupby("dicofre")
    out = pd.DataFrame({"registrations": g.size()})
    if "guests" in records.columns:
        out["guests"] = g["guests"].sum(min_count=1)
    if "modality" in records.columns:
        flats = records["modality"].fillna("").str.lower().str.contains("apartamento|moradia")
        out["flats_and_houses"] = records[flats].dropna(subset=["dicofre"]).groupby("dicofre").size()
        out["flats_and_houses"] = out["flats_and_houses"].fillna(0).astype(int)
    out = out.join(dwellings, how="outer")
    out["registrations"] = out["registrations"].fillna(0).astype(int)
    out["in_census"] = out["classic_dwellings_2021"].notna()
    out["share_pct"] = 100 * out["registrations"] / out["classic_dwellings_2021"]
    if "flats_and_houses" in out.columns:
        out["flats_share_pct"] = 100 * out["flats_and_houses"] / out["classic_dwellings_2021"]
    out.index.name = "code"
    out = out.reset_index()
    if names is not None:
        out = out.merge(names, on="code", how="left")
    return out.sort_values("share_pct", ascending=False)


def poisson_twfe(counts: pd.DataFrame, terms: Dict[str, np.ndarray], iters: int = 200) -> Dict[str, float]:
    """Poisson regression of monthly counts on parish and month effects plus ``terms``,
    by Newton's method; returns each term's coefficient and a cluster-robust (by parish) SE."""
    units = pd.Categorical(counts["code"])
    months = pd.Categorical(counts["month"])
    y = counts["n"].values.astype(float)
    Xu = np.eye(len(units.categories))[units.codes]
    Xm = np.eye(len(months.categories))[months.codes][:, 1:]
    Xt = np.column_stack([terms[k] for k in terms])
    X = np.column_stack([Xu, Xm, Xt])
    b = np.zeros(X.shape[1])
    b[: Xu.shape[1]] = np.log(np.maximum(counts.groupby("code")["n"].mean().reindex(units.categories).values, 0.01))
    for _ in range(iters):
        mu = np.exp(X @ b)
        grad = X.T @ (y - mu)
        H = X.T @ (X * mu[:, None])
        step = np.linalg.lstsq(H, grad, rcond=None)[0]
        b += step
        if np.max(np.abs(step)) < 1e-9:
            break
    mu = np.exp(X @ b)
    Hinv = np.linalg.pinv(X.T @ (X * mu[:, None]))
    meat = np.zeros_like(Hinv)
    for u in range(len(units.categories)):
        s = (X[units.codes == u] * (y - mu)[units.codes == u][:, None]).sum(axis=0)
        meat += np.outer(s, s)
    V = Hinv @ meat @ Hinv
    k0 = Xu.shape[1] + Xm.shape[1]
    out = {}
    for j, name in enumerate(terms):
        out[name] = float(b[k0 + j])
        out[name + "_se"] = float(np.sqrt(V[k0 + j, k0 + j]))
        out[name + "_pct"] = float(np.expm1(b[k0 + j]) * 100)
    return out


def first_stage(panel: pd.DataFrame, start: str = "2019-01", end: str = "2023-09") -> Dict:
    """New (surviving) registrations per month in Lisbon's parishes, frozen against never-frozen.

    ``panel`` is estimador-data's rnal_parish_month file. Terms: the announcement window
    (15 Dec 2021 to 14 Apr 2022, when owners rushed to register before the rule) and the
    freeze (15 Apr 2022 to 6 Oct 2023), both for the frozen 14 only; Campolide and Beato
    are left out. Survivors only: a registration made and later cancelled is not counted,
    which biases old months down, the same way in both groups only if cancellations hit
    them alike (the 2026 purge did not; read with the archive snapshots)."""
    p = panel[panel["dicofre"].str.startswith("1106")].rename(columns={"dicofre": "code", "new_registrations": "n"})
    p = p[(p["month"] >= start) & (p["month"] <= end)]
    p = p[p["code"].isin(list(T.FROZEN_APRIL_2022) + list(T.NEVER))].copy()
    frozen = p["code"].isin(T.FROZEN_APRIL_2022).values.astype(float)
    m = pd.PeriodIndex(p["month"], freq="M")
    ann = ((m >= pd.Period(T.ANNOUNCED, "M")) & (m < pd.Period(T.IN_FORCE, "M"))).astype(float)
    post = ((m >= pd.Period(T.IN_FORCE, "M")) & (m <= pd.Period(T.CLEAN_UNTIL, "M"))).astype(float)
    fit = poisson_twfe(p, {"announcement": frozen * ann, "freeze": frozen * post})
    monthly = p.assign(group=np.where(frozen > 0, "frozen", "never")).groupby(["month", "group"])["n"].sum().unstack()
    return {"fit": fit, "monthly": monthly.reset_index()}
