"""Inputs: observed series per area, read from files that already carry their sources.

Two loaders:

- ``load_lisbon()``: Lisbon's 24 parishes, from this repository's game data
  (``src/data/fontes/ine.json``: INE new-lease rent and sale medians, RNAL short-let counts,
  Censos 2021 dwelling counts; ``src/data/freguesias.ts``: Censos 2021 households). This is
  the development geography: it is what we hold today without a request to INE.
- ``load_estimador_data(root)``: the output of estimador-data's ``collect-data housing``
  (``data/housing/``), by município. Written against the collector's tidy long format; it
  raises until the files exist, which is the point: the national run waits for the collector.

An ``Areas`` holds only what was observed. Everything assumed lives in ``priors.py``.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
FONTES = REPO / "src" / "data" / "fontes" / "ine.json"
FREGUESIAS_TS = REPO / "src" / "data" / "freguesias.ts"


@dataclass(frozen=True)
class Areas:
    """Observed inputs for N areas over the years in ``years``."""

    codes: list[str]
    names: list[str]
    years: np.ndarray  # (T,) int
    rent_m2: np.ndarray  # (N, T) INE median €/m²/month of new leases, NaN if missing
    sale_m2: np.ndarray  # (N, T) INE median €/m² of dwellings sold, NaN if missing
    households: np.ndarray  # (N,) Censos 2021 private households
    classic_dwellings: np.ndarray  # (N,) Censos 2021 classic dwellings
    short_lets: np.ndarray  # (N,) RNAL active registrations (snapshot)
    sources: dict[str, str]

    @property
    def n(self) -> int:
        return len(self.codes)

    def year_index(self, year: int) -> int:
        return int(np.flatnonzero(self.years == year)[0])


def _households_from_ts(path: Path) -> dict[str, int]:
    text = path.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r"code: '(\d{6})'.*?households: (\d+)", text):
        out[m.group(1)] = int(m.group(2))
    return out


def load_lisbon(fontes: Path = FONTES, freguesias: Path = FREGUESIAS_TS) -> Areas:
    d = json.loads(fontes.read_text(encoding="utf-8"))
    hh = _households_from_ts(freguesias)
    codes = sorted(c for c in d["rent_eur_m2"] if len(c) == 6)
    years = np.arange(2016, 2026)

    def grid(series: dict) -> np.ndarray:
        g = np.full((len(codes), len(years)), np.nan)
        for i, c in enumerate(codes):
            for j, y in enumerate(years):
                v = series.get(c, {}).get(str(y))
                if v is not None:
                    g[i, j] = float(v)
        return g

    missing = [c for c in codes if c not in hh]
    if missing:
        raise ValueError(f"no Censos households for {missing} in {freguesias}")
    return Areas(
        codes=codes,
        names=[d["parish_names"][c] for c in codes],
        years=years,
        rent_m2=grid(d["rent_eur_m2"]),
        sale_m2=grid(d["sale_eur_m2"]),
        households=np.array([hh[c] for c in codes], dtype=float),
        classic_dwellings=np.array(
            [d["al"][c]["classic_dwellings_census2021"] for c in codes], dtype=float),
        short_lets=np.array([d["al"][c]["registrations"] for c in codes], dtype=float),
        sources={
            "rent_m2": "INE 0009631 (2017-2019) spliced with 0014698 (2020-2025), via habitacao src/data/fontes/ine.json",
            "sale_m2": "INE 0010033 (2016-2018) spliced with 0012255 (2019-2025), via habitacao src/data/fontes/ine.json",
            "households": "INE Censos 2021, via habitacao src/data/freguesias.ts",
            "classic_dwellings": "INE Censos 2021, via habitacao src/data/fontes/ine.json",
            "short_lets": "RNAL active registrations, snapshot of 2026-10-10",
        },
    )


def load_estimador_data(root: Path) -> Areas:
    """Município inputs from estimador-data's ``data/housing/`` (collector PR #4).

    Not implemented until the collector has produced its first files: the shapes are
    written down in docs/POLICY_SIM.md §6, and this function must check them against the
    manifest's sha256 rather than guess."""
    manifest = Path(root) / "data" / "housing" / "manifest.json"
    if not manifest.exists():
        raise FileNotFoundError(
            f"{manifest} not found: run `collect-data housing` in estimador-data first")
    raise NotImplementedError("município loader: next step once the collector has run")
