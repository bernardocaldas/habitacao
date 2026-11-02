from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from rentsim.calibrate import calibrate, future_shocks
from rentsim.data import load_lisbon
from rentsim.model import expected_arrears, norm_cdf, simulate
from rentsim.policy import ALL_POLICIES, BILL, BILL_PARTS, POLICY_BY_KEY, STATUS_QUO
from rentsim.priors import PRIORS, sample_priors
from rentsim.trend import TrendPosterior, fit_trend


@pytest.fixture(scope="module")
def areas():
    return load_lisbon()


@pytest.fixture(scope="module")
def post(areas):
    return calibrate(areas, np.random.default_rng(7), n_prior=600, n_post=300, trend_draws=800)


def _run(policy, post, areas, theta=None, seed=3):
    shocks = future_shocks(post, np.random.default_rng(seed), areas.n, 6)
    return simulate(policy, theta or post.theta, post.trend, areas, shocks)


class TestData:
    def test_lisbon_inputs(self, areas):
        assert areas.n == 24
        assert 240_000 < areas.households.sum() < 246_000  # Censos 2021: 242,906 households
        assert not np.isnan(areas.rent_m2[:, areas.year_index(2017):]).any()
        assert not np.isnan(areas.sale_m2[:, areas.year_index(2025)]).any()


class TestPriors:
    @pytest.mark.parametrize("prior", PRIORS, ids=lambda p: p.name)
    def test_ninety_percent_inside(self, prior):
        x = prior.sample(np.random.default_rng(0), 40_000)
        inside = ((x >= prior.lo) & (x <= prior.hi)).mean()
        assert 0.88 < inside < 0.92

    def test_every_prior_documented(self):
        for p in PRIORS:
            assert p.status in {"data_to_come", "literature", "judgement"}
            assert p.source
            if p.status == "data_to_come":
                assert p.replace_with, p.name


class TestTrend:
    def test_recovers_growth_on_synthetic_data(self, areas):
        rng = np.random.default_rng(1)
        alpha = rng.normal(0, 0.02, areas.n)
        gamma = rng.normal(0, 0.03, 9)
        g = 0.06 + alpha[:, None] + gamma[None, :] + rng.normal(0, 0.02, (areas.n, 9))
        rent = np.full_like(areas.rent_m2, np.nan)
        rent[:, 0] = 10.0
        rent[:, 1:] = 10.0 * np.exp(np.cumsum(g, axis=1))
        synth = replace(areas, rent_m2=rent)
        t = fit_trend(synth, rng, draws=1500, burn=500, first_year=2017, last_year=2025)
        lo, hi = np.percentile(t.mu, [2.5, 97.5])
        assert lo < 0.06 + gamma.mean() < hi
        assert abs(np.median(t.s_eps) - 0.02) < 0.01


class TestModel:
    def test_norm_cdf(self):
        assert norm_cdf(np.array([0.0]))[0] == pytest.approx(0.5)
        assert norm_cdf(np.array([1.6448536]))[0] == pytest.approx(0.95, abs=1e-6)

    def test_arrears_rise_with_burden(self):
        base, slope = np.array([0.03]), np.array([0.4])
        lo = expected_arrears(np.log(np.array([0.2])), np.array([0.3]), base, slope)
        hi = expected_arrears(np.log(np.array([0.5])), np.array([0.3]), base, slope)
        assert hi[0] > lo[0]

    def test_observed_years_reproduce_ine(self, post, areas):
        run = _run(STATUS_QUO, post, areas)
        for y in (2024, 2025):
            i = int(np.flatnonzero(run.years == y)[0])
            np.testing.assert_allclose(run.new_lease[i], np.broadcast_to(
                areas.rent_m2[:, areas.year_index(y)], run.new_lease[i].shape), rtol=1e-9)

    def test_policies_agree_before_they_start(self, post, areas):
        base = _run(STATUS_QUO, post, areas)
        for pol in ALL_POLICIES:
            run = _run(pol, post, areas)
            pre = run.years < 2027
            for field in ("market", "new_lease", "sitting", "filings", "nrau_homes"):
                np.testing.assert_array_equal(getattr(run, field)[pre], getattr(base, field)[pre])

    def test_no_cap_means_market_rent(self, post, areas):
        run = _run(POLICY_BY_KEY["bill_cap_only"], post, areas)
        on = run.years >= 2027
        np.testing.assert_allclose(run.new_lease[on], run.market[on])

    def test_cap_with_no_compliance_changes_nothing(self, post, areas):
        theta = {**post.theta, "cap_compliance": np.zeros(post.draws)}
        a = _run(STATUS_QUO, post, areas, theta)
        b = _run(POLICY_BY_KEY["bill_cap_only"], post, areas, theta)
        # 2024-2025 are conditioned on INE with zero compliance in both runs
        np.testing.assert_allclose(a.new_lease, b.new_lease)

    def test_moratorium_has_no_filings(self, post, areas):
        run = _run(POLICY_BY_KEY["moratorium"], post, areas)
        assert run.filings[run.years >= 2027].sum() == 0

    def test_only_unfreezing_moves_pre1990_tenants(self, post, areas):
        for pol in ALL_POLICIES:
            run = _run(pol, post, areas)
            moved = run.old_exits.sum() > 0
            assert moved == pol.old_rents_unfrozen, pol.key

    def test_earlier_trigger_files_more(self, post, areas):
        a = _run(STATUS_QUO, post, areas)
        b = _run(replace(STATUS_QUO, key="t2", arrears_trigger_months=2), post, areas)
        on = a.years >= 2027
        assert (b.filings[on].sum((0, 2)) >= a.filings[on].sum((0, 2)) - 1e-6).all()

    def test_homes_are_conserved_without_supply_change(self, post, areas):
        # with no supply response the pre-1990 homes freed by the bill are re-let, not lost
        theta = {**post.theta, "supply_elasticity": np.zeros(post.draws)}
        run = _run(POLICY_BY_KEY["bill_old_rents_only"], post, areas, theta)
        total = run.nrau_homes + run.old_homes
        np.testing.assert_allclose(total, np.broadcast_to(total[0], total.shape), rtol=1e-9)


class TestPolicies:
    def test_bill_is_its_parts(self):
        fields = ("cap_extra", "arrears_trigger_months", "faster_procedure", "free_nonrenewal",
                  "old_rents_unfrozen")
        for f in fields:
            changed = [p for p in BILL_PARTS if getattr(p, f) != getattr(STATUS_QUO, f)]
            assert getattr(BILL, f) != getattr(STATUS_QUO, f)
            assert len(changed) == 1, f
            assert getattr(changed[0], f) == getattr(BILL, f)
