# Short lets and rents: did Lisbon's 2022 freeze move rents?

A study for estimador.pt's housing work. Two questions:

1. **How much of each parish's housing is short lets?** Active registrations in the national
   register (RNAL) over the Censos 2021 classic family dwellings, the ratio Lisbon's own
   regulation (RMAL) uses.
2. **What did Lisbon's suspension of new registrations do to rents?** On 15 April 2022 the
   city stopped taking new short-let registrations in the 14 parishes whose ratio was 2.5% or
   more (Campolide joined in October 2022, Beato in June 2023). We estimate the effect on the
   median rent of new leases (INE, from contracts declared to the tax authority).

Data collection lives in estimador-data (`collect-data housing --source ine` and
`--source rnal`); this folder only reads. It sits here, beside the game's hand-fetched INE
file and dated policy calendar, until the housing work has its own repository.

## Design, fixed before the full run (2 November 2026)

**Estimand.** The average effect of being frozen on log median new-lease rents, in the
frozen parishes, over the frozen windows up to 6 October 2023 (ATT, exposure-weighted).
After that date Law 56/2023 froze new registrations almost everywhere, so the comparison
ends there.

**Treatment.** INE's figures are medians over a window of contracts (a calendar year, or the
12 months to a quarter); a window's exposure is the share of its days after the parish was
frozen (2022 annual: 0.72 for the April parishes).

**Main estimator: a Bayesian factor-model counterfactual** (generalised synthetic control,
Xu 2017; Bayesian version in the spirit of Pang, Liu & Xu 2022). Log rent = parish level +
common random-walk year path + K latent random-walk factors with parish loadings + the
parish's effect times exposure. Parish effects are partially pooled around `tau_mean`
(prior Normal(0, 0.1): within about ±20% at 95%, centred on no effect), with a slope on the
log of the parish's pre-freeze AL ratio (`tau_dose`). Each parish has its own noise level
(medians from few contracts are noisier). K = 0, 1, 2 (Lisbon) and 1, 2, 3 (national), and K = 0 with
parish-specific linear trends; K = 1 is reported first, the others as sensitivity. The factors carry what parish and year
effects cannot: above all tourism's COVID collapse and return, which hit the frozen
parishes hardest and push rents the opposite way from the freeze in 2022.

**Checks, reported whatever they show.**
- Two-way fixed effects with randomisation inference (shuffle which parishes are frozen).
- Placebo: the same design with a fake freeze in April 2019, on 2017-2019 only.
- Without the four parishes already under the 2018-2019 containment zones (Santa Maria
  Maior, Misericórdia, Santo António, São Vicente), where 2022 froze little new.
- Event study: the frozen-minus-never gap year by year, against 2021.
- First stage (register): did new registrations stop? Poisson regression of monthly new
  (surviving) registrations on parish and month effects, an announcement term (15 Dec 2021
  to 14 Apr 2022) and a freeze term (15 Apr 2022 to 6 Oct 2023).

**What we expect.** Small. The freeze stops the flow of new units and removes none, and in
2022 the flow was already low after COVID. Scaled from the literature (Barcelona +1.9% rents
for the average neighbourhood's Airbnb growth, Garcia-López et al. 2020; Los Angeles −2%
rents for −50% listings, Koster et al. 2021; Portugal +3.2% prices per pp of Airbnb share in
Lisbon and Porto parishes, Franco & Santos 2021), 0 to −3%, most likely about −1%. That is
near the noise of a parish median, so the result is reported as an interval, and a null is
a bound, not proof of no effect.

**Known threats.** Displacement into neighbouring unfrozen parishes (the controls) biases
the estimate away from zero in the direction of a rent fall in frozen parishes relative to
controls; the national run's donors outside Lisbon do not share it. Survivors only: the
register lists active registrations, so registration counts by date miss what was later
cancelled (the 2023 proof-of-activity purge and Lisbon's 6,765 cancellations in 2026); the
archive snapshots measure how much. INE suppresses medians from too few contracts, so the
national run keeps parishes with a full series. Other municipalities' own suspensions in
2022-2023 put some donors under treatment; they are to be listed and dropped once known.

## Running it

```bash
# preliminary, anywhere (24 Lisbon parishes, annual):
python run.py lisbon

# full, on a machine that can reach INE and Turismo de Portugal:
cd ~/code/estimador-data
uv run collect-data export-territories --no-json --no-parquet   # if data/territories is missing
uv run collect-data housing --source ine --since 2017
uv run collect-data housing --source rnal
cd ~/code/habitacao/analysis/short-lets
python run.py full --housing-dir ~/code/estimador-data/data/housing \
    [--rents-dir ~/code/estimador-data-housing/data/housing] [--skip-rents]
```

`full` runs the rents model twice: annual 2017-2023 (Metodologia 2021 spliced with 2026,
every parish with a full series; K = 1, 2, 3, plus parish trends, plus a run with donors
outside Lisbon only) and 12-month windows by quarter, 2020Q1-2023Q3 (INE's quarterly series
starts in 2020). The share of homes waits for the Censos table (0012501).

Needs numpy, pandas, pyarrow, pymc (5.x or 6), matplotlib (`requirements.txt`).

## Licences

INE's figures: INE's terms (to confirm, see estimador-data's `SOURCES`). The register:
**conflicting**, so nothing derived from it is published until Turismo de Portugal answers
(estimador-data `docs/housing/rnal-licence-question.md`). Results files here hold parish
aggregates only.
