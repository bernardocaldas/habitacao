# What would a real tax on vacant homes do? And what IMI rate would replace IMT?

*Design note for `policy-sim/imtsim`, 3 November 2026. Research behind it (rules, revenue,
literature, sources): [Less IMT, more IMI](https://claude.ai/artifact/251v4xbRAcUAQAt11BC3fn).
Status: prototype, prior predictive only. Not for publication.*

## Questions

1. **Vacant homes.** The law already lets a munícipio triple the IMI on a building vacant for
   more than a year, or multiply it by ten (plus 20% a year) in a *zona de pressão urbanística*.
   About 13,000 buildings in 64 munícipios were surcharged for IMI 2023, against 375,118
   dwellings the 2021 census found vacant "for other reasons". If munícipios used the rule,
   how many homes would come back into use, how much would it raise, and how many owners would
   pay without being able to do anything about it?
2. **The swap.** If IMT were cut (halved, abolished), what urban IMI rate would keep each
   munícipio's revenue unchanged? Owner's choice (3 Nov 2026): neutrality per munícipio, not
   national. How many would pass today's 0.45% ceiling, and what does a typical buyer gain and
   a typical owner pay?

## Model

Unit: munícipio (308). Arrays are draws x munícipios; every policy runs on the same draws.

**Vacant homes** (`simulate_vacancy`). Taxable stock = vacant for other reasons + the
long-term share of vacant for sale or rent. A share `detection` is flagged (policy lever; today
~2–6%). Flagged owners split into actionable (can let, sell or move in), stuck-and-paying and
stuck-and-exempt. Year y's surcharge per dwelling is `(k_y − 1) × rate × VPT`, with VPT =
`vpt_to_market × price/m² × m²`; its weight is that surcharge over a year's market rent. The
actionable share back in use is `1 − exp(−beta × cumulative weight)`. Revenue is paid by
whoever is still vacant on 1 January.

**Swap** (`simulate_swap`). Taxable base = IMI revenue / rate; new rate = rate + (cut × IMT −
vacant surcharge revenue) / base. A typical home at the munícipio's median price per m² saves
the IMT on purchase (2026 permanent-home schedule) and pays the extra IMI each year; its price
moves by `capitalisation × (IMT saved − extra IMI / discount rate)`; sales move by the
Dachis–Duranton–Turner semi-elasticity times the IMT removed, in pp of the price.

## Priors (`imtsim/priors.py`)

| Prior | 90% interval | Status | Comes from |
| --- | --- | --- | --- |
| vpt_to_market | 0.30–0.75 | judgement | 2012-13 reassessment, prices doubled since; AT data request |
| dwelling_m2 | 75–115 | data to come | Censos area by occupancy |
| actionable | 0.25–0.65 | judgement | inheritances, works, care homes |
| exempt (of stuck) | 0.15–0.45 | judgement | legal exemptions |
| market_long_term | 0.10–0.35 | judgement | utilities consumption extract |
| beta | 0.10–1.20 | literature | Segú 2020 (France), Caracciolo & Miglino 2024 (Vancouver) |
| detection_today | 0.02–0.06 | data to come | AT surcharged buildings by munícipio |
| sales_semi_elasticity | 7–20 %/pp | literature | Dachis, Duranton & Turner 2012 |
| capitalisation | 0.40–0.95 | literature | Oates 1969 and successors |
| discount_rate | 2–5% | judgement | |

## Data

- INE Censos 2021, 0012501 (dwellings by occupancy and building epoch, per parish and
  munícipio): already collected by estimador-data's housing collector.
- INE median sale price (0012255) and new-lease rent (0014698) per m², per munícipio: collected.
- Municipal IMT, IMI and IMI rate per year (`municipal_tax.csv`): being located (DGAL, AT).

## Not modelled

Rents, repair costs of homes in poor condition, the pressure-zone list (stand-in: the dearest
quarter of munícipios by price), owners selling to escape the surcharge (counted as "back in
use"), revenue volatility over the cycle (needs the 2014–2025 series), household income.

## Checks

- The "today" policy's year-1 surcharge revenue should be of the order of 2021's 7.1 M€.
- Tests (`tests/test_imtsim.py`): IMT schedule, revenue neutrality per munícipio, monotonicity
  in enforcement and multiplier, no surcharge means no response, pressure scope.
