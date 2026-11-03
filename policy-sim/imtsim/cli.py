"""``imtsim --housing-dir DIR [--tax CSV] [out_dir]``: run the vacant-homes policies (and the
IMT-to-IMI swap when municipal tax data are given) and write summary.{md,json} and
municipios.csv."""
from __future__ import annotations

import argparse
from pathlib import Path

from .data import load
from .report import write


def main() -> None:
    ap = argparse.ArgumentParser(prog="imtsim")
    ap.add_argument("out", nargs="?", default="out-imt")
    ap.add_argument("--housing-dir", required=True, type=Path,
                    help="estimador-data's data/housing (needs ine/census_dwellings_by_occupancy_and_epoch.csv)")
    ap.add_argument("--tax", type=Path, default=None, help="municipal_tax.csv (municipio_code, year, imt_eur, imi_eur, imi_rate)")
    ap.add_argument("--year", type=int, default=None)
    ap.add_argument("--draws", type=int, default=4000)
    a = ap.parse_args()
    m = load(a.housing_dir, a.tax, a.year)
    out = Path(a.out)
    write(m, out, a.draws)
    print((out / "summary.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
