# Aguarda parecer: design

*Revised 10 October 2026.*

## The idea

Oliver Sin's [Discretionary Review](https://housing.over.pizza/) turns San Francisco's
entitlement process into a city-builder: you are a developer, the law changes on its real
dates, and the game teaches by making you live through it. This is the same idea for Lisbon,
built for estimador.pt's house rule: *uncertainty in view*. Every decision shows its odds,
every forecast is an interval, and every fact carries a source.

The headline, a statement in the site's voice: **O tempo que leva pôr casas de pé em
Lisboa.** The game measures it by letting the player find out: in the first playtests, a
40-home building on an old garage in Arroios takes 12 to 23 months to license and 42 to 66
months to hand over keys (80% interval).

## Core loop

- **Time**: one tick is a month, January 2015 to October 2029 (the local elections). Five
  speeds; the clock stops for decisions and for front pages.
- **Player**: a small developer (*promotora*) backed by a fund. Cash (€9M on normal), three
  teams (each project in licensing takes one; up to six), standing 0–100.
- **Goal**: the fund reviews every two years: 1 licensed project by January 2017, 80 homes
  started by 2019, then 100 / 350 / 800 / 1,300 / 1,900 built, and 2,300 by October 2029.
  Three strikes and the fund leaves (two on the hardest level). The progress bar shows done /
  sure / possible, as in the original.
- **Proposal**: on a site, choose *how much* (what the plan allows / +2 floors for at least
  25% affordable homes / a detailed plan up to the site's maximum), *how many affordable
  homes* (0–100%), *what happens after* (sell / let / short lets), and whether to file a
  *pedido de informação prévia* first. The preview shows the road with month ranges, the
  Câmara's odds, a Monte Carlo forecast, who will object, and today's pro forma.
- **Deposit**: signing the *contrato-promessa* pays 10% of the land and locks its price for
  24 months; after that the seller claws back half of any rise. Speed pays.

## The procedure (RJUE, before and after the Simplex)

| San Francisco (original) | Lisbon (this game) |
|---|---|
| Pre-application meeting | *Pedido de informação prévia* (PIP): 4–7 months; a favourable one locks the rules and halves later risks |
| Zoning / height limits | PDM floors as of right (*cércea*); +2 floors with ≥25% affordable; a *plano de pormenor* for more |
| CEQA studies, appeals | *Projeto de arquitetura* review (7–20 months, ×0.85 after the Simplex) with *pedidos de elementos* (each +2–4 months; only one after March 2024) |
| Historic resource evaluation | Binding opinion of the heritage authority in protection zones: accept fewer floors, redesign, or appeal |
| Waterfront / port | Port and environment authorities on riverside sites |
| Planning Commission / Board | *Discussão pública* for allotments and plans; a vote of the 17-member Câmara (and the Assembleia Municipal for plans) |
| Permit appeals, CEQA suits | *Ação administrativa* and *providência cautelar* in the administrative courts: residents over height and heritage, tenants over evictions and short lets, the public prosecutor over heritage |
| SB 35 / SB 423 streamlining | *Comunicação prévia* inside approved plans; from 4 March 2024 tacit approval (*deferimento tácito*) when the city misses its legal deadline (lenders then want 2 points more margin, and courts are likelier) |
| Building permits | *Especialidades* (3–6 months) and the *alvará* (1–3 months, abolished March 2024) |
| Tenants on site | Old leases: negotiate and rehouse, terminate for deep works (cheap, but courts, headlines and councillors remember), or rehabilitate with the tenants in place |

Construction then takes 12–38 months by building type, with archaeology in the historic
centre, contractor insolvency and overruns as one-off hazards.

## Politics

- **The Câmara**: 17 seats, real results per mandate (2013 PS 11; 2017 PS 8; 2021 Novos
  Tempos 7 and PS/Livre 7; 2025 PSD/CDS/IL 8, PS-led 6, Chega 2, CDU 1). Each seat votes yes
  with `sigmoid(2.2·(1.3·lean + x))`, where `x` falls with opposition heat and rises with
  support, affordable homes (weighted by each list's sensitivity), and falls with short lets
  and evictions. Nine votes pass. The odds are computed exactly and shown before every vote,
  for each option on the table (accept the opposition's ask, offer public benefits, go as is,
  pull it from the agenda). The lists' leanings are a game simplification and the Rulebook
  says so.
- **Opposition**: two constituencies per parish (editorial, 0–1): residents and heritage
  (height, bulk, protected places) and the right-to-housing movement (evictions, short lets,
  luxury, too few affordable homes). Standing cools or inflames both.
- **Political weather**: every 7–11 months a card: the junta president wants a meeting, a
  petition against the *mamarracho*, a rally, the property fair, a foreign fund wanting your
  licence, your case officer on sick leave, the press, noise complaints.

## The economy

Money in €M, areas in m² of gross floor area (95 m² per home, 80% saleable).

- **Value**: INE parish median sale price (smoothed over three years for play) × 1.3 for new
  build (1.2 rehab, 1.15 conversions), ×1.06 riverfront, more for tall buildings. Rent exit:
  INE rents capitalised at a yield that rises with Euribor. Short lets: a multiple of the sale
  value (boom, COVID collapse, recovery), and only where the rules of the day allow.
- **Affordable homes**: capped rent capitalised with a risk premium, which is why the city's
  concessions struggled. Recovery-plan grants (€40K per affordable home finished before
  August 2026) from July 2021.
- **Costs**: base €/m² by building type × INE's construction cost index, +12% soft costs,
  VAT (23% on new build is a cost because home sales are VAT-exempt; 6% for rehabilitation
  and, from July 2026, for new housing), municipal fees, interest during construction.
- **Land**: priced as 95% of the residual of a plain project at today's prices, so a fair
  purchase earns about the required margin; buying before a boom, or building faster, is how
  you make money.
- **Financing**: the required margin is 13% plus 1.2 points per point of Euribor above 1%.
  Equity at groundbreaking is 20% of build costs plus 30% of the land, less what you have
  already spent; a fund partner can put up 60% for half the profit. Off-plan sales lock the
  revenue at groundbreaking.

Lisbon's story differs from San Francisco's: prices rose through the 2022–23 rate shock, so
market housing kept paying; what stopped working was capped-rent housing on market terms.
The economy reproduces that (see the tests in `src/sim/sim.test.ts`).

## History as the rule engine

`rulesAt(month)` folds every dated event's `set` into the defaults. The research behind the
events is `src/data/fontes/cronologia.json`: 129 events from 2012 to October 2026, each with
a source and a confidence rating, in Portuguese and English. Twenty-one change the rules,
among them the Programa Renda Acessível tenders (June 2017, ended December 2022), the
short-let containment zones (November 2018, November 2019), the 14 → 15 → 16 parish
suspensions (2022–23), Mais Habitação (October 2023), the Simplex (March 2024), the citywide
short-let freeze (November 2024) and the new regulation (December 2025), co-operative land
(2024), 6% VAT on construction (July 2026) and the new RJUE (October 2026). Front pages print
the real headline, a translation of the facts, *what changes for you*, and the source.

## Data

| Series | Source | Notes |
|---|---|---|
| Parish geometry, population, households | CAOP 2021 (DGT), Censos 2021 (INE), via estimador.pt's synthetic population v1.0.3 | CC BY 4.0 |
| Median sale €/m² by parish | INE 0010033 (to 2018), 0012255 (from 2019), 0012234 (12 months to 2026 Q1) | two methodologies spliced |
| Median rent €/m² of new leases | INE 0009631 (to 2019), 0014698 (from 2020), 0014696 | starts in 2017 |
| Construction cost index | INE 0011748 | national |
| Euribor 12M | ECB | monthly anchors matched to annual averages |
| Short-let registrations | Turismo de Portugal, RNAL (October 2026 snapshot) | counts only |
| Câmara seats | official results | |

2015 prices (and 2015–16 rents) are backcast and labelled as estimates; prices after the last
INE point follow a stated scenario (+5% a year for sales, +3% for rents), labelled as such on
the map and in the tables.

## Balance (first pass)

`npm run balance`, 30 seeds per strategy, normal difficulty:

| Strategy | Homes, median (p10–p90) | Outcome |
|---|---|---|
| Dense: plans and districts | 4,800 (3,500–5,600) | wins 30 of 30 |
| Cautious: PIP, as of right | 2,000 (1,600–2,250) | mostly survives with strikes |
| Affordable: bonus floors, 25% | 1,400 (800–2,300) | mostly fired; wins 3 |

A human who mixes strategies sits between. Open questions for tuning: whether dense play
should face more risk (court, Assembleia), and whether affordable-led play needs more
municipal land or a stronger political dividend.

## Bringing it into estimador-web

The simulation is plain TypeScript with no dependencies; the interface is React 19 with one
scoped stylesheet that uses estimador.pt's own tokens, so it can move across as a section
the way `/populacao/miniatura` did.

1. Route: `src/app/[locale]/habitacao/page.tsx` for a section entrance, and the game at
   `/habitacao/aguarda-parecer` as a client component (`'use client'`, mounted with
   `next/dynamic`, `ssr: false`, since it reads `localStorage` and `window`).
2. Copy `src/sim`, `src/data` and `src/ui` to `src/lib/habitacao/` and
   `src/components/habitacao/`; copy `habitacao.css` next to them (drop `tokens.css`, the
   tokens already exist; IBM Plex Sans is already self-hosted).
3. Page header: the "Explainer with its own world" kind (`<PageHero>` then the game), and the
   chrome rules (`<SiteFooter>`, `siteTitle()`, `<RevisedDate>`).
4. Copy: the game's PT/EN strings stay in the module (they are data-heavy); the page title,
   description and navigation go to `messages/*.json` (`nav.housing`).
5. Follow estimador-web's "Adding a New Section" checklist (navigation, footer, sitemap,
   `staticwebapp.config.json` redirects for `/habitacao`, OG card, `/sobre` status list).
6. Methodology: `/habitacao/metodologia` from this document's model and data sections, with
   the licence notes (INE and DGT data CC BY 4.0; the game's outputs CC BY-NC 4.0).

## Decisions for the owner

- The name (*Aguarda parecer*) and whether housing becomes its own section or lives under
  Economia.
- Whether the sites should stay invented archetypes (current) or include named real cases
  with case files, as the original does (more educational, more fact-checking).
- Difficulty targets and the balance above.
