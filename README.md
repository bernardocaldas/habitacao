# Aguarda parecer

*O tempo que leva pôr casas de pé em Lisboa*

**Jogar: [bernardocaldas.github.io/habitacao](https://bernardocaldas.github.io/habitacao/)**
(English: [?lang=en](https://bernardocaldas.github.io/habitacao/?lang=en))

A game about getting homes built in Lisbon. The sites and the characters are invented; the
laws and the dates they changed are real; the rules are a simplification, and their
assumptions favour density (see "Balance" in `docs/DESIGN.md`). You run a small developer
backed by a fund, from January 2015 to the October 2029 local elections. Pick sites, design
projects, and get them through the licensing procedure (RJUE), heritage opinions, public
consultation, Câmara votes, the courts, Euribor and construction costs. Laws change on the
dates they really changed.

It is inspired by Oliver Sin's San Francisco simulator
[Discretionary Review](https://housing.over.pizza/). The code, rules and text here are
original.

## What is real and what is not

| Real, with a source | Game simplification (and said so in the game) | Invented |
|---|---|---|
| The 24 parishes (CAOP 2021, cut to the shoreline) and their census counts | How strongly residents, the housing movement and heritage weigh in each parish | The 39 sites (archetypes placed in the right parish, at no real address) |
| INE median sale prices and rents by parish, 2016–2025 | How much each party weighs affordable homes, evictions, short lets and neighbours | Characters, the newspapers and every story about your company |
| INE construction cost index, ECB Euribor | Durations and odds of each licensing step | |
| Câmara seats per list, every mandate since 2013; the voting rule (more for than against, abstentions do not count, the mayor's casting vote); the PS–BE and Chega agreements | The pro forma (premiums, soft costs, fees) | |
| 129 dated events (laws, programmes, short-let rules, rates), each with a source | Prices after 2025 (a stated scenario) | |
| Short-let registrations by parish (RNAL) | Agenda holds before elections and after a new executive | |

Sources and their licences are in `src/data/fontes/` and in the game's Rules dialog. The map
geometry (`src/data/lisboa-freguesias.json`, `terra.json`, `vizinhos.json`) combines CAOP 2021
boundaries (DGT, CC BY 4.0) with the OpenStreetMap shoreline (© OpenStreetMap contributors), so
those three files are offered under the Open Database License 1.0; `docs/GEOMETRIA.md` has the
sources and how they were built.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (?lang=en for English)
npm test             # the simulation's tests
npm run typecheck
npm run build        # static build in dist/
npm run balance      # plays 90 scripted games and prints economics by site and year
```

`npm install` needs `legacy-peer-deps` (set in `.npmrc`): npm 10.9 trips over Vitest's optional
peers otherwise.

## Publish

`.github/workflows/pages.yml` runs the tests, builds and publishes `dist/` to GitHub Pages on
every push to `claude/sharp-cerf-wukco0` (and on demand from the Actions tab). Pages has to be
switched on once: Settings → Pages → Build and deployment → Source: GitHub Actions. The build
uses a relative base (`base: './'` in `vite.config.ts`), so it works under `/habitacao/`.
`public/og.png` is the link preview card that `index.html` names.

## Layout

```
src/sim/       the simulation: plain TypeScript, no React, deterministic from a seed
  sim.ts         the monthly loop, the licensing state machine, decisions
  econ.ts        pro forma: costs, VAT, fees, land as a residual, sale/rent/short-let values
  votes.ts       the Câmara: each list votes as one (for, abstain, against), exact odds, the agenda
  heat.ts        who objects, and how loudly
  path.ts        the route a proposal takes and how long each step usually lasts
  rules.ts       rules and the council at any month (a fold over the timeline)
  press.ts       newspaper stories about your projects, the answers, prosecutors' inquiries
  weather.ts     political events: the junta, petitions, rallies, the property fair
  goals.ts       the fund's reviews every two years
  forecast.ts    Monte Carlo forecast shown before and during a project
  bot.ts         scripted players for tests and balance
src/data/      parishes, sites, the Câmara, market series, the timeline
  fontes/        the research: INE/ECB series (ine.json), dated events (cronologia.json)
  precos.ts      GENERATED from fontes/ine.json by scripts/build-precos.py
src/ui/        React interface (map, panels, dialogs), PT and EN
  map-geo.ts     the map's geometry in world kilometres, label anchors (polylabel)
src/styles/    estimador.pt tokens and the game's scoped stylesheet
docs/DESIGN.md the design, the model, the data and the plan for estimador-web
```

To add a law: add the dated event to `src/data/fontes/cronologia.json` (with its source), then
give it a `set` (rule changes) and a `game` line in `EFFECTS` in `src/data/timeline.ts`.

To refresh prices: update `src/data/fontes/ine.json` and run `python3 -I scripts/build-precos.py`.
