"""Observed inputs, per munícipio.

- Censos 2021 dwellings by form of occupancy (INE 0012501, ``collect-data housing --source
  ine``): usual residence, secondary, vacant for sale or rent, vacant for other reasons.
- INE median sale price and new-lease rent per m² (0012255, 0014698), latest year.
- Municipal property tax: IMT and IMI collected and the IMI rate per munícipio and year, in
  ``municipal_tax/municipal_tax.csv`` (columns ``municipio_code, year, imt_eur, imi_eur,
  imi_rate``). Optional: the vacant-homes module runs without it, the swap needs it.

Files are INE's own CSV extracts (one row per geography and category, ``value`` column).
Munícipios are the 4-digit DTMN codes; NUTS rows and parishes are dropped.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

OCCUPANCY = {
    "1": "usual",
    "2": "secondary",
    "3": "vacant_market",
    "4": "vacant_other",
}


def _rows(path: Path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def _is_municipio(code: str) -> bool:
    return len(code) == 4 and code.isdigit()


def _municipio_code(code: str) -> str:
    """INE's price and rent extracts prefix the DTMN code with the NUTS III code (``1A01106``
    is Lisboa 1106, ``11A1312`` Porto 1312); the Censos tables do not."""
    code = code.strip()
    return code[-4:] if len(code) == 7 and code[-4:].isdigit() else code


def _is_total(r: dict) -> bool:
    """Every category dimension at its total: code ``T`` or label ``Total`` (the sales extract
    codes its total ``H1``)."""
    for k in r:
        if k.startswith("dim_") and not k.endswith("_t"):
            code, label = r[k].strip(), (r.get(k + "_t") or "").strip().lower()
            if code not in ("T", "") and label != "total":
                return False
    return True


def _float(s: str) -> float | None:
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _find(housing_dir: Path, stem: str) -> Path:
    for p in (housing_dir / "ine" / f"{stem}.csv", housing_dir / f"{stem}.csv"):
        if p.exists():
            return p
    raise FileNotFoundError(f"no {stem}.csv under {housing_dir} (or its ine/)")


def census_occupancy(housing_dir: Path) -> dict[str, dict]:
    """Dwellings per munícipio by occupancy, all building epochs, plus vacant-other built
    before 1946 (a rough marker of homes needing major works)."""
    out: dict[str, dict] = {}
    for r in _rows(_find(housing_dir, "census_dwellings_by_occupancy_and_epoch")):
        code = r["geocod"].strip()
        if not _is_municipio(code):
            continue
        rec = out.setdefault(code, {"name": r["geodsg"].strip(), "vacant_other_pre1946": 0.0})
        v = _float(r.get("value")) or 0.0
        occ, epoch = r["dim_3"].strip(), r["dim_4"].strip()
        if epoch == "T":
            rec["total" if occ == "T" else OCCUPANCY[occ]] = v
        elif occ == "4" and epoch in ("01", "02"):
            rec["vacant_other_pre1946"] += v
    return out


def latest_value(housing_dir: Path, stem: str) -> tuple[dict[str, float], str]:
    """Latest period's value per munícipio, all other categories at their total."""
    best: dict[str, tuple[str, float]] = {}
    for r in _rows(_find(housing_dir, stem)):
        code = _municipio_code(r["geocod"])
        if not _is_municipio(code) or not _is_total(r):
            continue
        v = _float(r.get("value"))
        if v is None:
            continue
        per = r["period_code"]
        if code not in best or per > best[code][0]:
            best[code] = (per, v)
    periods = sorted({p for p, _ in best.values()})
    return {c: v for c, (_, v) in best.items()}, (periods[-1] if periods else "")


def municipal_tax(path: Path) -> dict[str, dict[int, dict]]:
    """``{municipio_code: {year: {imt_eur, imi_eur, imi_rate}}}``; blanks become None."""
    out: dict[str, dict[int, dict]] = {}
    for r in _rows(path):
        out.setdefault(r["municipio_code"].strip(), {})[int(r["year"])] = {
            k: _float(r.get(k)) for k in ("imt_eur", "imi_eur", "imi_rate")
        }
    return out


@dataclass
class Municipios:
    code: list[str]
    name: list[str]
    dwellings: np.ndarray
    usual: np.ndarray
    secondary: np.ndarray
    vacant_market: np.ndarray
    vacant_other: np.ndarray
    vacant_other_pre1946: np.ndarray
    price_m2: np.ndarray      # median sale price, € per m² (imputed where INE suppresses it)
    rent_m2: np.ndarray       # median new-lease rent, € per m² per month (imputed likewise)
    price_imputed: np.ndarray
    rent_imputed: np.ndarray
    imi_rate: np.ndarray      # urban IMI rate set by the munícipio (0.003 where unknown)
    imi_rate_known: np.ndarray
    imt_eur: np.ndarray       # NaN where unknown
    imi_eur: np.ndarray
    tax_year: int | None = None
    periods: dict = field(default_factory=dict)

    @property
    def n(self) -> int:
        return len(self.code)

    def index(self, code: str) -> int:
        return self.code.index(code)


def load(housing_dir: Path, tax_csv: Path | None = None, tax_year: int | None = None) -> Municipios:
    housing_dir = Path(housing_dir)
    occ = census_occupancy(housing_dir)
    price, p_per = latest_value(housing_dir, "sales_median_eur_m2_annual")
    rent, r_per = latest_value(housing_dir, "rent_new_leases_median_eur_m2_annual")
    codes = sorted(occ)
    arr = lambda key: np.array([occ[c].get(key, 0.0) for c in codes], float)
    p = np.array([price.get(c, np.nan) for c in codes])
    r = np.array([rent.get(c, np.nan) for c in codes])
    p_imp, r_imp = np.isnan(p), np.isnan(r)
    # Impute missing prices from the national median; missing rents from the price through
    # the median rent-to-price ratio where both are known (small munícipios, suppressed cells).
    p = np.where(p_imp, np.nanmedian(p), p)
    both = ~p_imp & ~r_imp
    ratio = float(np.median(r[both] / p[both])) if both.any() else 0.005
    r = np.where(r_imp, p * ratio, r)

    rate = np.full(len(codes), 0.003)
    known = np.zeros(len(codes), bool)
    imt = np.full(len(codes), np.nan)
    imi = np.full(len(codes), np.nan)
    if tax_csv is not None:
        tax = municipal_tax(Path(tax_csv))
        years = sorted({y for d in tax.values() for y in d})
        tax_year = tax_year or (years[-1] if years else None)
        for i, c in enumerate(codes):
            row = tax.get(c, {}).get(tax_year) if tax_year else None
            if not row:
                continue
            if row["imi_rate"]:
                rate[i] = row["imi_rate"] if row["imi_rate"] < 0.05 else row["imi_rate"] / 100
                known[i] = True
            elif row["imi_eur"]:
                # No rate communicated: by law the AT applies the 0.3% minimum.
                rate[i], known[i] = 0.003, True
            imt[i] = row["imt_eur"] if row["imt_eur"] is not None else np.nan
            imi[i] = row["imi_eur"] if row["imi_eur"] is not None else np.nan
    return Municipios(
        code=codes, name=[occ[c]["name"] for c in codes], dwellings=arr("total"), usual=arr("usual"),
        secondary=arr("secondary"), vacant_market=arr("vacant_market"), vacant_other=arr("vacant_other"),
        vacant_other_pre1946=arr("vacant_other_pre1946"), price_m2=p, rent_m2=r,
        price_imputed=p_imp, rent_imputed=r_imp, imi_rate=rate, imi_rate_known=known,
        imt_eur=imt, imi_eur=imi, tax_year=tax_year, periods={"price": p_per, "rent": r_per},
    )
