# What would the rental bill do? A policy simulator for Portugal's rental market

*Design doc and prototype, 2 November 2026. Code in `policy-sim/`; prototype results in
`policy-sim/results/lisbon-prototype-2026-11-02.md`. Status: prototype on Lisbon's 24 parishes,
most inputs still priors. Not for publication.*

## 1. The question

The government's rental bill (approved in generalidade on 30 September 2026, now in committee)
changes four things at once, and the October protests argue about all four in the same breath.
Supporters say freeing rents and speeding evictions brings homes back to the market and lowers
rents for newcomers; opponents say it raises rents for people who move and puts thousands out of
their homes. Both claims are about magnitudes, and both can be true at once for different
households.

The simulator answers one question per measure and per counterfactual: **against the law as it
stands, how much would this change new-lease rents, sitting tenants' rents, the number of homes
let long term, the share of renters above 40% of their income, and the number of households
forced to move, by município, with a 90% interval?** It does not answer whether the bill is good.

## 2. What is being compared

**The law today.**
- The 2% rule (Lei 56/2023, Mais Habitação, from October 2023): a new lease on a home let in
  the previous five years may not exceed the previous rent, updated by the legal coefficients,
  plus 2%.
- Eviction for arrears from three months, plus a separate execution step.
- Landlords may oppose the first renewal only after three years.
- Pre-1990 contracts kept out of the NRAU (Lei 56/2023): no transition to a market rent, only
  the yearly legal update, which the model applies.
- Legal update coefficient: 2.24% for 2026.

**The bill**, as reported by Lusa (via Lisboa Para Pessoas, 7 Oct), DECO PROteste (1 Oct) and
JN (27 Sept). The committee can still change it, and the PSD–Chega agreement of 30 September
commits four changes we have not yet seen.
- No cap on new leases: rents are set by the parties.
- Eviction after two months of arrears, or the 4th payment more than 8 days late in 12 months
  (5th in 18).
- The separate execution step is removed.
- Landlords may oppose renewal at any term.
- Pre-1990 rents: tenants 65 or older with income under 64,400 €/year, or 60%+ disabled, keep
  their rent. Others can be moved to 1/15 of the VPT a year, with five years of stability after
  the transition.
- Advance rents: up to three. Deposits: no limit.
- Preference right: after three years instead of two.
- A Fundo de Emergência Habitacional is announced (IAS for six months, income under 2,760 €).
  Whether it is in the bill text is disputed.

**The bill, one measure at a time:** the cap, the eviction changes, free non-renewal, the
pre-1990 rents. This shows which measure does what.

**The housing movement's counterfactuals:**
- a rent ceiling on every new lease (no rise beyond the legal coefficient, first lets
  included);
- an eviction moratorium for arrears;
- public rental housing at +1% of the rental stock a year;
- short lets returned to long-term rental;
- the three supply-side demands together.

Not modelled yet: advance rents and deposits, the preference right, the emergency fund, tax
changes (DECO's summary mentions a 10% IRS rate. Unverified), golden visas.

## 3. What the evidence says, and how it enters

Effect sizes from the literature enter as **priors**, widened for transfer to Portugal, never
as point values.

| Mechanism | Evidence | How it enters |
|---|---|---|
| Caps shrink rental supply | Diamond, McQuade & Qian (2019, AER): San Francisco's 1994 expansion cut treated landlords' rental supply by 15% and raised citywide rents 5.1%. Monràs & García-Montalvo (2023, J. Public Econ.): Catalonia's 2020 cap lowered rents and listed supply. Kholodilin (2024, J. Housing Econ.) reviews ~200 studies. | `supply_elasticity` 0.1–0.8 (rental stock to landlord yield) |
| Caps help sitting tenants stay | DMQ 2019: covered tenants much more likely to stay at their address | turnover; the cap's gap at re-letting |
| Lifting caps raises values and neighbouring rents | Autor, Palmer & Pathak (2014, JPE), Cambridge decontrol | yield → supply → market rent |
| Slow courts shrink rental markets | Casas-Arce & Saiz (2010, J. Law Econ.): slower eviction, smaller rental sector | months lost to arrears → yield → supply |
| Evictions harm tenants | Collinson et al. (2024, QJE) | counted as displacement; harm not modelled |

Two things the literature cannot give us are measured from Portuguese data instead:
- how much the 2% rule is obeyed (`cap_compliance`), from INE's 2024–2025 rents;
- how often arrears reach the trigger, to be calibrated on BNA filings.

## 4. The model

Annual steps 2024–2031, every posterior draw and every area at once (numpy, ~4 s for 2,000
draws × 24 parishes × 10 policies). Full equations in `policy-sim/rentsim/model.py`. The core:

1. **Market rent trend** (`trend.py`). A Bayesian hierarchical model of log growth in INE's
   new-lease median rent, by area: `g[a,t] = mu + gamma[t] + alpha[a] + eps`.
   - `gamma[t]` are city-wide year shocks; `alpha[a]` are persistent area differences.
   - Fitted by Gibbs sampling on 2018–2023, before the 2% rule.
   - Forecasts draw new year shocks and noise.
2. **Supply.** Landlords move the long-term rental stock toward `supply_elasticity ×
   ln(expected yield)`, at `adjust_speed` a year. Expected yield falls with:
   - the share of the market rent a cap takes away on re-letting (`capped share × compliance
     × gap`);
   - the expected rent lost to tenants who stop paying (months lost × how often).

   Public housing and returned short lets add homes directly.
3. **Market rent** = trend × `exp(−ln supply / demand_elasticity)`.
4. **New leases.**
   - Free leases pay the market rent.
   - Capped leases pay at most the previous lease's rent (of a letting 1–5 years before)
     updated by the coefficients, plus the cap's allowance.
   - Compliance is partial.
5. **Contracts** end at `turnover`, plus the bill's free non-renewal. The homes are re-let.
   Sitting rents follow the legal coefficient.
6. **Pre-1990 tenants.** Under the bill, unprotected tenants' rent moves to VPT/15/12. Those
   whose burden would pass `burden_exit` leave, and their homes are re-let at market.
7. **Burdens.** Rent burdens are log-normal (income and rent dispersion). From them come:
   - the share above 40% (Eurostat's overburden line);
   - arrears (logistic in burden);
   - eviction filings (arrears that run to the trigger × the filing rate).

   An earlier trigger files against tenants who would have caught up. It does not change how
   many stop paying for good.

**Calibration (`calibrate.py`): sampling–importance–resampling.**
- Each prior draw, paired with a trend-posterior draw, runs the law today through 2024–2025.
- In those years the model's measured new-lease rent (capped and free leases together) is set
  equal to INE's median. Given the draw's compliance and supply, this fixes the market shock
  each year must have had.
- A draw's weight is the density of those shocks under the trend model.
- The likelihood uses the city-wide mean shock only, so two years of data cannot re-fit each
  parish's trend (a full parish likelihood left 23 effective draws of 4,000).
- Effective sample size in the prototype: ~5,300 of 8,000. The 2024–2025 rents nudge
  `cap_compliance` down, and every other parameter keeps its prior. The report prints prior
  and posterior side by side.

**Comparisons are paired.** Every policy runs on the same draws and the same future market
shocks, so an interval on a difference is uncertainty about the effect, not simulation noise.

## 5. Inputs: what is data and what is assumed

Data the prototype uses:
- INE new-lease median rents (0009631 spliced with 0014698) and sale medians (0010033 /
  0012255) by Lisbon parish, 2016–2025;
- Censos 2021 households and classic dwellings;
- RNAL short-let registrations.

All three come from this repository's `src/data/fontes/`, with no new request to INE.

Each of the 29 priors in `rentsim/priors.py` carries a 90% interval, a status and a source.
- `data_to_come` (6) names the table that will replace it: renter share, pre-1990 share and
  rents, renter income, dwelling area, update coefficient.
- `literature` (2): supply and demand elasticities.
- `judgement` (21): no direct evidence yet. Some name a table that would inform them (turnover
  from new-lease counts, arrears from BNA filings). The report ranks which of them drive each
  result.

## 6. Data the full version needs (estimador-data, `collect-data housing`)

Already in the collector (PR #4): new-lease rents and sale prices by município, quarterly and
annual; the construction cost index; Censos 2021 tenure × household size and type,
overcrowding, dwellings by occupancy; BPstat housing credit.

On the collector's unresolved list, needed here:
- **new-lease counts:** turnover, and the weight of each median;
- **Censos 2021 rents by contract period:** the pre-1990 share and its rents, and sitting
  vs new rents. This replaces 4 priors;
- vacant dwellings: the supply that could return.

To add (ask the collector thread):
- BNA / Ministry of Justice eviction filings by year and district: the calibration target
  for arrears;
- Eurostat `ilc_lvho07c` (overburden by tenure): the calibration target for the 40% share.
  Licence verified;
- AT VPT statistics, if published;
- IRS income by município (already in estimador-data's income collector).

The município loader (`data.load_estimador_data`) refuses to run until `data/housing/
manifest.json` exists, and will check its sha256s.

## 7. What the prototype says, and why not to quote it yet

From `results/lisbon-prototype-2026-11-02.md` (Lisbon, policies from 2027, 2031 or 2027–2031
against today's law):

**The bill moves money between groups more than it moves the market.**
- The median market rent of a new lease falls about 2% (90%: −9% to −0.3%). Supply responds
  to free rents and faster evictions.
- Movers who would have been capped pay more, so the mean new lease is +2% (−3% to +11%).
- Sitting tenants pay +5% (+0.6% to +15%), through non-renewals that reset rents to market.

**Displacement is the large term.** About 16,000 households (7,000 to 36,000) face a forced
move over five years, counting:
- eviction filings (+5,400);
- free non-renewals (+5,900);
- pre-1990 tenants who cannot pay the update (+3,100).

Filings are an upper bound on evictions. The largest driver of the interval is how much free
non-renewal raises turnover, which is a pure judgement today.

**The eviction changes alone** lower rents by about 0.4% and add about 3,800 filings. Most of
those filings are against tenants who would have caught up at month three.

**The movement's supply measures** lower rents more than the bill does.
- Public housing at 1% of stock a year: −9% market rent.
- Short lets back to long-term rental: −4%.
- The ceiling alone lowers new-lease rents (−2%) but shrinks supply and raises the market rent
  for everyone uncapped (+1%).
- The moratorium removes filings and raises market rents (+2%, interval to +15%).

**Why not to quote it.**
- The level of the 40% share (56% of Lisbon renters) is not calibrated. Neither are the
  absolute filing counts.
- The trend extrapolates 2018–2023 growth (~7% a year), with no mean reversion, interest
  rates or incomes.
- One rent per segment and area; one income distribution for all renters.
- Free non-renewal gives landlords option value that the model does not count as yield.

## 8. Validation before anything is published

Pre-registered, in this order, each written before it is run:

1. **Back-cast the 2% rule.** Fit to 2023 by município, predict 2024–2026 quarterly new-lease
   rents (0014696) under the rule, and score against a no-cap twin. This is also the test of
   whether `cap_compliance` is identified at all.
2. **Back-cast the 2012 NRAU reform** (Lei 31/2012: the first transition of old rents,
   faster eviction through the BNA). Predict 2013–2016 eviction filings and rents.
3. **Calibration targets.**
   - BNA filings by district, 2019–2025 (level and trend);
   - Eurostat overburden by tenure (level);
   - Censos 2021 rents by contract period (sitting vs new).
4. **Prior sensitivity.** Every published headline states which assumptions drive it.
   - A result whose sign flips across a prior's interval is published as "uncertain in
     direction", not as a number.

## 9. Plan

| Step | What | Where | Needs |
|---|---|---|---|
| 0 (done) | Prototype on Lisbon, 10 policies, calibration, report, tests | `policy-sim/` | — |
| 1 | Município geography (308) from the collector's files; hierarchical trend by NUTS III | `policy-sim` + estimador-data | collector's first live run on the Mac |
| 2 | Calibration targets: BNA filings, Eurostat overburden, Censos rents by contract period | estimador-data | three series added to the collector |
| 3 | Backtests 1–2 above, pre-registered | `policy-sim/docs` | step 1 |
| 4 | Households from the synthetic population (tenure heads, income sidecar) instead of one log-normal per area | estimador-microsynthesis | tenure heads trained (doc 61) |
| 5 | Mean-reverting market with incomes and Euribor (BPstat) | `policy-sim` | step 1 |
| 6 | Track the committee text; re-run on the final law | — | the published text |
| 7 | An estimador.pt note: each claim in the debate, with the model's band | estimador-web | Bernardo's editorial call |

When the module outgrows this repository it moves to its own model repo (`estimador-housing`,
as the housing proposal suggests), unchanged.

## 10. Open questions for Bernardo

- Repository: the prototype lives in `habitacao/policy-sim/` because creating a new repository
  is yours to do. Do you want `estimador-housing` now?
- Scope: Lisbon and Porto first (where the cap binds), or national from step 1?
- Counterfactuals: are the five we picked the movement's demands as you read them? Rent
  ceilings in the Catalan style (an index by area) would be a sixth.
