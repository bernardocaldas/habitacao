"""Panels of log median new-lease rents, with each window's exposure to the 2022 freeze.

Two sources:

- ``lisbon_annual()``: the 24 Lisbon parishes, calendar years 2017-2025, from the game's
  hand-fetched INE file (src/data/fontes/ine.json, fetched 2026-10-10). Works anywhere.
- ``ine_panel(housing_dir, freq)``: every parish INE publishes, from estimador-data's
  housing collector (`collect-data housing --source ine`), annual (0009631 spliced with
  0014698) or rolling 12 months by quarter (0014696). Needs the collector's output, which
  only Bernardo's Mac can fetch (INE answers 403 to the cloud).

Rows: code (DICOFRE), name, municipality code, period, window start/end, log_rent,
exposure (share of the window frozen), group (frozen / late / never / donor).
"""
from __future__ import annotations

import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd

import treatment as T

HERE = Path(__file__).resolve().parent
INE_JSON = HERE.parents[1] / "src" / "data" / "fontes" / "ine.json"


def group_of(code: str) -> str:
    if code in T.FROZEN_APRIL_2022:
        return "frozen"
    if code in T.LATE:
        return "late"
    if code in T.NEVER:
        return "never"
    return "donor"


def _rows(code, name, period, start, end, rent):
    return {"code": code, "name": name, "municipality": code[:4], "period": period,
            "start": start, "end": end, "rent": rent, "log_rent": math.log(rent),
            "exposure": T.exposure(code, start, end), "group": group_of(code)}


def lisbon_annual(path: Path = INE_JSON, through: int = 2023) -> pd.DataFrame:
    d = json.loads(path.read_text(encoding="utf-8"))
    names = d["parish_names"]
    rows = []
    for code, series in d["rent_eur_m2"].items():
        if code == "1106":
            continue
        for y, v in series.items():
            if v is None or int(y) > through:
                continue
            rows.append(_rows(code, names[code], y, date(int(y), 1, 1), date(int(y), 12, 31), float(v)))
    return pd.DataFrame(rows)


def lisbon_al_ratio(path: Path = INE_JSON) -> pd.Series:
    """AL / classic dwellings (%) as published at the 2022 freeze for the frozen 14, else the
    game's October 2026 snapshot ratio (after Lisbon's 2026 purge: a lower bound)."""
    d = json.loads(path.read_text(encoding="utf-8"))
    out = {c: float(v["ratio_pct"]) for c, v in d["al"].items() if c != "1106"}
    out.update({c: float(r) for c, (_, r) in T.FROZEN_APRIL_2022.items()})
    return pd.Series(out, name="al_ratio_pct")


# ---------------------------------------------------------------------------------------
# INE tidy files from estimador-data's housing collector
# ---------------------------------------------------------------------------------------

_Q = re.compile(r"(\d)\.?\s*º?\s*Trimestre de (\d{4})", re.I)


def parish_code(geocod: str) -> Optional[str]:
    """The DICOFRE from an INE parish geocode: either a 3-character NUTS III prefix and the
    DICOFRE ('1A0110601', the rents) or the bare DICOFRE ('110601', the Censos tables).
    A DICOFRE is six characters, letters allowed (Barcelos's unions are 0302FA to 0302FH)."""
    g = str(geocod or "").strip().upper()
    d = g[3:] if len(g) == 9 else g if len(g) == 6 else ""
    return d if d.isalnum() and d[:4].isdigit() else None


def window(label: str, freq: str) -> Optional[tuple]:
    if freq == "A":
        m = re.search(r"(20\d{2})", label)
        if not m:
            return None
        y = int(m.group(1))
        return str(y), date(y, 1, 1), date(y, 12, 31)
    m = _Q.search(label)
    if not m:
        return None
    q, y = int(m.group(1)), int(m.group(2))
    end_month = 3 * q
    end = (pd.Timestamp(y, end_month, 1) + pd.offsets.MonthEnd(0)).date()
    start = (pd.Timestamp(end) - pd.DateOffset(years=1) + pd.Timedelta(days=1)).date()
    return f"{y}Q{q}", start, end


def _tidy(path: Path, freq: str) -> pd.DataFrame:
    df = pd.read_parquet(path)
    df["code"] = df["geocod"].map(parish_code)
    df = df.dropna(subset=["code", "value"])
    w = df["period_label"].map(lambda s: window(s, freq))
    df = df[w.notna()].copy()
    df[["period", "start", "end"]] = pd.DataFrame(w[w.notna()].tolist(), index=df.index)
    return df[["code", "geodsg", "period", "start", "end", "value"]]


def ine_panel(housing_dir: Path, freq: str = "Q", through: Optional[date] = None) -> pd.DataFrame:
    ine = housing_dir / "ine"
    if freq == "Q":
        df = _tidy(ine / "rent_new_leases_median_eur_m2_12m.parquet", "Q")
        through = through or date(2023, 9, 30)
    else:
        new = _tidy(ine / "rent_new_leases_median_eur_m2_annual.parquet", "A")
        old = _tidy(ine / "rent_new_leases_median_eur_m2_annual_m2021.parquet", "A")
        old = old[old["period"].astype(int) < 2020]
        df = pd.concat([old, new], ignore_index=True)
        through = through or date(2023, 12, 31)
    df = df[df["end"] <= through]
    dup = df.duplicated(["code", "period"], keep=False)
    if dup.any():
        raise ValueError(f"{int(dup.sum())} rows share a parish and period; the file has another "
                         f"dimension to pick (columns: {list(pd.read_parquet(ine / 'rent_new_leases_median_eur_m2_12m.parquet').columns)})")
    rows = [_rows(r.code, r.geodsg, r.period, r.start, r.end, float(r.value)) for r in df.itertuples()]
    return pd.DataFrame(rows)


def complete_units(panel: pd.DataFrame, pre_until: date = T.IN_FORCE) -> pd.DataFrame:
    """Parishes with a value in every period (INE suppresses medians from too few contracts)."""
    periods = panel["period"].nunique()
    n = panel.groupby("code")["period"].nunique()
    return panel[panel["code"].isin(n[n == periods].index)].copy()
