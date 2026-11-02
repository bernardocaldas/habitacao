# Rental bill simulator: prototype run

Lisbon, 24 parishes (development geography). Policies take effect in 2027; figures for 2031 or summed over 2027-2031. Median and 90% interval over 2,000 posterior draws (importance-resampled from 8,000 prior draws, effective sample size 5,279).

**Prototype. Most inputs are priors, not data (see docs/POLICY_SIM.md §5); these numbers show what the model does, not what the bill will do. Not for publication.**

## Against the law today

| Policy | New-lease rent | Market rent | Sitting rents | Long-term rental homes | Renters above 40% of income | Eviction filings | Displaced households |
|---|---|---|---|---|---|---|---|
| The bill as approved in generalidade: no cap, eviction after 2 months, no execution step, free non-renewal, pre-1990 rents of unprotected tenants to 1/15 of VPT | +1.8 (-2.9 to +10.7)% | -1.9 (-8.9 to -0.3)% | +5.1 (+0.6 to +14.7)% | +717 (+128 to +3,120) | +4.6 (+1.4 to +9.6) pp | +5,366 (+1,335 to +16,781) | +15,965 (+6,991 to +36,023) |
| Bill, only the end of the 2% rule | +2.5 (-0.8 to +11.2)% | -1.2 (-6.6 to -0.1)% | +2.1 (+0.1 to +7.9)% | +449 (+38 to +2,277) | +0.8 (+0.1 to +2.8) pp | +177 (+11 to +1,157) | +177 (+11 to +1,157) |
| Bill, only the eviction changes (2 months, no execution step) | -0.4 (-2.6 to -0.1)% | -0.4 (-2.8 to -0.1)% | -0.1 (-0.7 to +0.0)% | +170 (+27 to +1,106) | -0.0 (-0.1 to +0.1) pp | +3,828 (+1,006 to +12,603) | +3,828 (+1,006 to +12,603) |
| Bill, only free non-renewal | +0.0 (+0.0 to +0.0)% | +0.0 (+0.0 to +0.0)% | +1.9 (+0.3 to +8.1)% | +0 (+0 to +0) | +0.6 (+0.1 to +2.7) pp | +124 (+13 to +852) | +5,855 (+1,669 to +21,734) |
| Bill, only the pre-1990 rents | +0.0 (+0.0 to +0.1)% | +0.0 (+0.0 to +0.1)% | +0.5 (+0.1 to +1.7)% | +0 (-0 to +0) | +2.6 (+0.3 to +7.3) pp | +321 (+29 to +1,673) | +3,099 (+535 to +8,863) |
| Rent ceiling on every new lease: no rise beyond the legal coefficient | -2.4 (-10.9 to +0.1)% | +1.0 (+0.1 to +6.8)% | -1.7 (-7.4 to -0.2)% | -355 (-2,143 to -41) | -0.7 (-2.9 to -0.1) pp | -136 (-894 to -10) | -136 (-894 to -10) |
| Eviction moratorium for arrears | +1.6 (+0.2 to +12.9)% | +1.9 (+0.3 to +15.1)% | +0.3 (-0.0 to +3.0)% | -707 (-4,899 to -109) | +0.0 (-0.5 to +0.4) pp | -6,458 (-22,325 to -1,316) | -6,458 (-22,325 to -1,316) |
| Public rental housing: +1% of the rental stock a year | -7.7 (-14.2 to -4.1)% | -8.8 (-15.8 to -4.7)% | -3.3 (-6.3 to -1.7)% | +3,545 (+2,734 to +4,399) | -1.2 (-2.5 to -0.5) pp | -152 (-586 to -26) | -152 (-586 to -26) |
| Short lets back to long-term rental | -3.5 (-9.6 to -1.0)% | -3.9 (-10.3 to -1.1)% | -1.7 (-5.1 to -0.5)% | +1,526 (+450 to +4,002) | -0.5 (-1.9 to -0.1) pp | -89 (-446 to -13) | -89 (-446 to -13) |
| Ceiling on every new lease, +1% public housing a year, short lets back | -13.4 (-23.3 to -7.7)% | -11.1 (-21.6 to -5.2)% | -6.7 (-12.6 to -3.5)% | +4,722 (+2,850 to +7,203) | -2.5 (-5.1 to -1.2) pp | -373 (-1,498 to -66) | -373 (-1,498 to -66) |

Rents in 2031 (% against the law today); homes in 2031 (NRAU, pre-1990, public and returned short lets); the 40% share in percentage points; filings and displaced households summed over the five years. Displaced = eviction filings + contracts ended by free non-renewal + pre-1990 tenants who leave after the update.

The law today, for scale: new-lease rent 27.3 (18.3 to 40.6) €/m² in 2031, 55.7 (35.8 to 72.7)% of renter households above 40% of income (the share among those still renting in the city: households priced out leave the count), 6,458 (1,316 to 22,325) eviction filings over five years.

## The bill by parish

| Parish | New-lease rent vs today's law | Pre-1990 tenants leaving |
|---|---|---|
| Ajuda | +1.9 (-3.5 to +12.0)% | 74 (12 to 208) |
| Alcântara | +1.8 (-3.5 to +11.8)% | 71 (11 to 205) |
| Beato | +1.3 (-3.2 to +11.0)% | 54 (8 to 166) |
| Benfica | +1.5 (-3.2 to +11.0)% | 160 (23 to 483) |
| Campolide | +1.3 (-3.7 to +10.8)% | 84 (16 to 225) |
| Carnide | +1.0 (-3.2 to +9.8)% | 73 (11 to 219) |
| Lumiar | +1.3 (-2.4 to +9.9)% | 200 (30 to 587) |
| Marvila | +1.7 (-3.6 to +11.3)% | 165 (29 to 456) |
| Olivais | +1.6 (-3.5 to +11.4)% | 128 (17 to 399) |
| São Domingos de Benfica | +1.1 (-3.2 to +10.2)% | 179 (30 to 504) |
| Alvalade | +1.3 (-3.2 to +10.6)% | 169 (29 to 472) |
| Areeiro | +0.9 (-2.7 to +10.0)% | 97 (15 to 284) |
| Arroios | +1.7 (-3.3 to +11.4)% | 153 (23 to 451) |
| Avenidas Novas | +1.6 (-3.8 to +11.0)% | 136 (27 to 358) |
| Belém | +1.6 (-3.2 to +10.7)% | 86 (16 to 236) |
| Campo de Ourique | +1.4 (-3.8 to +11.1)% | 145 (32 to 374) |
| Estrela | +1.6 (-3.8 to +11.5)% | 124 (26 to 322) |
| Misericórdia | +1.5 (-3.8 to +11.0)% | 65 (13 to 169) |
| Parque das Nações | +1.4 (-3.3 to +10.1)% | 136 (33 to 341) |
| Penha de França | +1.5 (-3.5 to +11.4)% | 123 (17 to 381) |
| Santa Clara | +1.6 (-2.6 to +10.9)% | 68 (8 to 234) |
| Santa Maria Maior | +2.0 (-3.5 to +11.7)% | 53 (9 to 147) |
| Santo António | +1.7 (-3.8 to +11.9)% | 84 (23 to 206) |
| São Vicente | +1.4 (-3.3 to +11.0)% | 76 (12 to 217) |

## What the result depends on

Rank correlation of each assumption with the outcome, across draws (the six largest).

- **bill_new_lease_rent_pct**: supply_elasticity (literature) -0.41; cap_compliance (judgement) +0.39; demand_elasticity (literature) +0.19; adjust_speed (judgement) -0.16; arrears_slope (judgement) -0.12; relet_share (judgement) +0.10
- **bill_market_rent_pct**: supply_elasticity (literature) -0.54; cap_compliance (judgement) -0.30; demand_elasticity (literature) +0.30; arrears_slope (judgement) -0.16; adjust_speed (judgement) -0.13; bill_months_saved (judgement) -0.11
- **bill_displaced**: extra_turnover (judgement) +0.67; arrears_slope (judgement) +0.26; dwelling_m2 (data_to_come) +0.25; filing_rate (judgement) +0.25; renter_share (data_to_come) +0.23; renter_income (data_to_come) -0.22

## What 2024-2025 taught the model

| Assumption | Status | Prior 90% | Posterior 90% |
|---|---|---|---|
| cap_compliance | judgement | 0.205 to 0.798 | 0.167 to 0.691 |
| relet_share | judgement | 0.5 to 0.849 | 0.478 to 0.83 |
| supply_elasticity | literature | 0.0975 to 0.809 | 0.0929 to 0.707 |

Every other assumption kept its prior: two years of city-wide rents say nothing about it.
