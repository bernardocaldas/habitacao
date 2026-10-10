// `npm run balance`: economics by site and year, then many scripted games per strategy.
// Prints tables; asserts nothing. Use it after changing prices, costs, rules or targets.
import { it } from 'vitest';
import { SITES } from '../src/data/sites';
import { autoplay, type Strategy } from '../src/sim/bot';
import { landPrice, proForma } from '../src/sim/econ';
import { REVIEWS, targetOf } from '../src/sim/goals';
import { rulesAt } from '../src/sim/rules';
import { defaultProgram } from '../src/sim/sim';
import { monthOf } from '../src/sim/time';

const YEARS = [2015, 2017, 2019, 2021, 2023, 2025, 2027];

it('economics by site', () => {
  const rows: string[] = [];
  rows.push(['site'.padEnd(22), ...YEARS.map((y) => String(y).padStart(13))].join(''));
  for (const site of SITES) {
    const prog = defaultProgram(site);
    const cells = YEARS.map((y) => {
      const m = monthOf(y, 6);
      const r = rulesAt(m);
      const land = landPrice(site, m, r);
      const pf = proForma(site, prog, m, r, { landM: land, share: site.mega ? 1 / site.mega.phases : 1 });
      const land15 = landPrice(site, monthOf(2015, 6), rulesAt(monthOf(2015, 6)));
      const locked = proForma(site, prog, m, r, { landM: land15, share: site.mega ? 1 / site.mega.phases : 1 });
      return `${(pf.margin * 100).toFixed(0).padStart(4)}/${(locked.margin * 100).toFixed(0).padStart(4)}${pf.pencils ? '✓' : ' '}`.padStart(13);
    });
    rows.push([site.id.slice(0, 21).padEnd(22), ...cells].join(''));
  }
  console.log('margin % (land at today’s price / land bought in 2015), ✓ = pencils\n' + rows.join('\n'));
});

it('scripted games', () => {
  const N = 30;
  for (const strat of ['cauteloso', 'denso', 'acessivel'] as Strategy[]) {
    const homes: number[] = [], over: Record<string, number> = {}, passed: number[] = [], cash: number[] = [], firstFail: number[] = [];
    for (let seed = 1; seed <= N; seed++) {
      const s = autoplay(seed, strat);
      homes.push(s.stats.homes);
      over[s.over!.kind] = (over[s.over!.kind] ?? 0) + 1;
      passed.push(s.review.passed);
      cash.push(s.cash);
      firstFail.push(s.review.i - s.review.passed > 0 ? s.review.i : 99);
    }
    homes.sort((a, b) => a - b);
    const q = (xs: number[], p: number) => xs[Math.floor(p * (xs.length - 1))];
    console.log(`${strat.padEnd(10)} homes p10 ${q(homes, 0.1)} p50 ${q(homes, 0.5)} p90 ${q(homes, 0.9)} | outcomes ${JSON.stringify(over)} | reviews passed avg ${(passed.reduce((a, b) => a + b, 0) / N).toFixed(1)} | cash p50 ${q([...cash].sort((a, b) => a - b), 0.5).toFixed(1)}`);
  }
  console.log('targets:', REVIEWS.map((r) => `${r.m}:${r.kind}:${targetOf(r, 'normal')}`).join('  '));
});
