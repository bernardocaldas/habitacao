from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from imtsim.data import load
from imtsim.model import imt_permanent_home, simulate_swap, simulate_vacancy
from imtsim.policy import (IMI_CEILING, SWAP_BY_KEY, TENFOLD_ALL, TENFOLD_PRESSURE, TODAY,
                           TRIPLE_ENFORCED, TRIPLE_FULL, VacancyPolicy)
from imtsim.priors import PRIORS, sample_priors
from imtsim.report import run_all, write

FIX = Path(__file__).parent / "fixtures" / "imtsim"


@pytest.fixture(scope="module")
def m():
    return load(FIX, FIX / "municipal_tax.csv")


@pytest.fixture(scope="module")
def th():
    return sample_priors(np.random.default_rng(1), 2000)


def test_load_municipios_only(m):
    assert m.code == ["0808", "0901", "1105", "1106", "1312"]
    i = m.index("1106")
    assert m.vacant_other[i] == 20000 and m.vacant_market[i] == 30000
    assert m.vacant_other_pre1946[i] == 2000
    assert m.price_m2[i] == 4500  # latest year, total category
    assert m.price_imputed[m.index("0901")] and m.rent_imputed[m.index("0901")]
    assert m.imi_rate_known.sum() == 4 and m.imi_rate[m.index("0901")] == 0.003


def test_imt_schedule():
    assert imt_permanent_home(np.array([100_000.0]))[0] == 0
    assert imt_permanent_home(np.array([250_000.0]))[0] == pytest.approx(7_042, abs=2)
    assert imt_permanent_home(np.array([800_000.0]))[0] == pytest.approx(48_000)
    assert imt_permanent_home(np.array([2_000_000.0]))[0] == pytest.approx(150_000)


def test_priors_cover_their_intervals():
    rng = np.random.default_rng(0)
    for p in PRIORS:
        x = p.sample(rng, 40_000)
        assert np.mean((x >= p.lo) & (x <= p.hi)) == pytest.approx(0.90, abs=0.01), p.name


def test_more_enforcement_more_homes_and_never_more_than_flagged(m, th):
    r = {p.key: simulate_vacancy(p, m, th) for p in (TODAY, TRIPLE_ENFORCED, TRIPLE_FULL, TENFOLD_ALL)}
    assert (r["triple"].returned.sum(1) > r["today"].returned.sum(1)).mean() > 0.95
    assert (r["triple_full"].returned >= r["triple"].returned - 1e-9).all()
    assert (r["tenfold_all"].returned >= r["triple"].returned - 1e-9).all()
    for v in r.values():
        assert (v.returned <= v.flagged + 1e-9).all()
        assert (v.revenue >= 0).all()


def test_pressure_scope_only_hits_dear_municipios(m, th):
    r = simulate_vacancy(TENFOLD_PRESSURE, m, th)
    hot = r.multiplier[0] > 3
    assert hot.sum() >= 1 and not hot.all()
    assert np.allclose(r.multiplier[1][hot], 12.0)


def test_no_surcharge_no_response(m, th):
    r = simulate_vacancy(VacancyPolicy("none", "none", 1.0, detection=0.5), m, th)
    assert np.allclose(r.returned, 0) and np.allclose(r.revenue, 0)


def test_swap_is_revenue_neutral_per_municipio(m, th):
    r = simulate_swap(SWAP_BY_KEY["imt_zero"], m, th)
    k = r.known
    base = m.imi_eur[k] / m.imi_rate[k]
    new_revenue = r.new_rate[:, k] * base
    assert np.allclose(new_revenue, m.imi_eur[k] + m.imt_eur[k])
    i = m.index("1106")  # Lisbon: IMT twice IMI, so the rate triples
    assert np.allclose(r.new_rate[:, i], 0.003 * (1 + 275.5 / 137.6))
    assert (r.new_rate[:, i] > IMI_CEILING).all()
    assert not k[m.index("0901")]


def test_vacant_revenue_lowers_the_needed_rate(m, th):
    plain = simulate_swap(SWAP_BY_KEY["imt_half"], m, th)
    v = simulate_vacancy(TENFOLD_PRESSURE, m, th)
    combo = simulate_swap(SWAP_BY_KEY["imt_half_vacancy"], m, th, v)
    assert (combo.new_rate[:, plain.known] <= plain.new_rate[:, plain.known] + 1e-12).all()


def test_report_runs(tmp_path, m):
    s = write(m, tmp_path, draws=500)
    assert (tmp_path / "summary.md").read_text().startswith("# imtsim")
    assert (tmp_path / "municipios.csv").exists()
    assert "imt_zero" in s["swap"]


def test_report_without_tax_skips_swap(tmp_path):
    s = run_all(load(FIX), draws=300)
    assert "skipped" in s["swap"]
