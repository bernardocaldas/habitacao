"""Rental regimes as data: the law today, the bill, the bill one measure at a time, and the
counterfactuals the housing movement asks for.

Sources for the bill (as approved in generalidade on 30 Sept 2026, now in committee, so the
text can still change): Lusa via Lisboa Para Pessoas (7 Oct 2026), DECO PROteste (1 Oct
2026), JN (27 Sept 2026). The cap today: Lei 56/2023 (Mais Habitação), from October 2023.
"""
from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Policy:
    key: str
    label: str
    # Cap on the rent of a new lease, relative to the previous lease's rent:
    #   None = free; otherwise the rent may not exceed previous × (1 + update coef) × (1 + cap_extra).
    cap_extra: float | None = 0.02
    cap_scope: str = "relets"  # "relets" (homes let in the last 5 years) or "all" new leases
    sitting_update: bool = True  # sitting tenants' rents follow the legal coefficient
    arrears_trigger_months: int = 3  # months of arrears that open an eviction
    faster_procedure: bool = False  # the bill's removal of the separate execution step
    moratorium: bool = False  # no evictions for arrears at all
    free_nonrenewal: bool = False  # landlords may oppose renewal at any term
    old_rents_unfrozen: bool = False  # pre-1990 rents of unprotected tenants to 1/15 of VPT
    # (today these contracts stay out of the NRAU; their rent follows only the legal coefficient)
    public_housing_per_year: float = 0.0  # new public rental homes, share of the rental stock
    short_lets_ban: bool = False  # short lets return to long-term rental (share is a prior)

    def describe(self) -> str:
        return self.label


STATUS_QUO = Policy("status_quo", "The law today: 2% rule on re-lets, eviction after 3 months' arrears, pre-1990 contracts kept out of the NRAU")

BILL = replace(
    STATUS_QUO, key="bill",
    label="The bill as approved in generalidade: no cap, eviction after 2 months, no execution step, "
          "free non-renewal, pre-1990 rents of unprotected tenants to 1/15 of VPT",
    cap_extra=None, arrears_trigger_months=2, faster_procedure=True, free_nonrenewal=True,
    old_rents_unfrozen=True)

BILL_PARTS = [
    replace(STATUS_QUO, key="bill_cap_only", label="Bill, only the end of the 2% rule", cap_extra=None),
    replace(STATUS_QUO, key="bill_evictions_only",
            label="Bill, only the eviction changes (2 months, no execution step)",
            arrears_trigger_months=2, faster_procedure=True),
    replace(STATUS_QUO, key="bill_nonrenewal_only",
            label="Bill, only free non-renewal", free_nonrenewal=True),
    replace(STATUS_QUO, key="bill_old_rents_only",
            label="Bill, only the pre-1990 rents", old_rents_unfrozen=True),
]

COUNTERFACTUALS = [
    replace(STATUS_QUO, key="ceiling",
            label="Rent ceiling on every new lease: no rise beyond the legal coefficient",
            cap_extra=0.0, cap_scope="all"),
    replace(STATUS_QUO, key="moratorium", label="Eviction moratorium for arrears", moratorium=True),
    replace(STATUS_QUO, key="public_housing",
            label="Public rental housing: +1% of the rental stock a year", public_housing_per_year=0.01),
    replace(STATUS_QUO, key="short_lets", label="Short lets back to long-term rental", short_lets_ban=True),
    replace(STATUS_QUO, key="movement_package",
            label="Ceiling on every new lease, +1% public housing a year, short lets back",
            cap_extra=0.0, cap_scope="all", public_housing_per_year=0.01, short_lets_ban=True),
]

ALL_POLICIES = [STATUS_QUO, BILL, *BILL_PARTS, *COUNTERFACTUALS]
POLICY_BY_KEY = {p.key: p for p in ALL_POLICIES}
