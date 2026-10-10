// Scripted players, for tests and for tuning the targets (`npm run balance`).
import { SITES_BY_ID } from '../data/sites';
import { rulesAt } from './rules';
import {
  defaultProgram, fileProject, financingPf, hireTeam, isLive, newGame, openSites, preview, resolve, schemesFor, sellProject, teamsBusy, tick,
} from './sim';
import type { Decision, Difficulty, GameState, Program } from './types';

export type Strategy = 'cauteloso' | 'denso' | 'acessivel';

function bestProgram(s: GameState, siteId: string, strategy: Strategy): { prog: Program; score: number } | null {
  const site = SITES_BY_ID[siteId];
  const rules = rulesAt(s.month);
  let best: { prog: Program; score: number } | null = null;
  for (const scheme of schemesFor(site, rules)) {
    if (strategy === 'cauteloso' && scheme === 'plano') continue;
    for (const aff of strategy === 'acessivel' ? [0.25] : [0, 0.25]) {
      if (strategy === 'acessivel' && scheme === 'base' && !site.municipal && schemesFor(site, rules).includes('bonus')) continue;
      const prog: Program = { ...defaultProgram(site, rules), scheme, aff: site.municipal ? defaultProgram(site, rules).aff : aff, pip: strategy === 'cauteloso' };
      const pv = preview(s, siteId, prog);
      if (!pv.canFile) continue;
      const slack = pv.pf.margin - pv.pf.required;
      const pass = pv.camaraP ?? 1;
      const months = pv.steps.reduce((a, x) => a + (x.lo + x.hi) / 2, 0);
      const score = (pv.units * pass * (slack > -0.05 ? 1 : 0.2)) / Math.max(12, months) - pv.heat.opp / 40;
      if (pv.depositM > s.cash - 1) continue;
      const mine = site.mega ? 0.15 / site.mega.phases : 1;
      if (pv.pf.equityM * mine > s.cash + 4) continue;
      if (!best || score > best.score) best = { prog, score };
    }
  }
  return best;
}

function choose(s: GameState, d: Decision, strategy: Strategy): string {
  const open = d.options.filter((o) => !o.disabled);
  const affordable = open.filter((o) => (o.costM ?? 0) <= s.cash + 0.5);
  const ok = affordable.length ? affordable : [...open].sort((a, b) => (a.costM ?? 0) - (b.costM ?? 0));
  const has = (k: string) => ok.find((o) => o.key === k)?.key;
  switch (d.kind) {
    case 'camara': {
      const pd = d.odds?.[1]?.p ?? 0, pa = d.odds?.[0]?.p ?? 0;
      return (pd > pa + 0.05 && has('deal')) || has('votar') || ok[0].key;
    }
    case 'tenants': return (strategy === 'denso' ? has('despejo') : has('negociar')) || ok[0].key;
    case 'pencil': return has('ve') || has('esperar') || ok[0].key;
    case 'capital': return has('socio') || has('esperar') || ok[0].key;
    case 'suit': return has('tribunal') || ok[0].key;
    case 'heritage': return has('aceitar') || ok[0].key;
    case 'refused': return has('rever') || ok[0].key;
    case 'tacit': return strategy === 'denso' ? has('invocar') || ok[0].key : has('esperar') || ok[0].key;
    case 'pip': return has('cortar') || ok[0].key;
    case 'vote': return has('voltar') || ok[0].key;
    case 'annulled': return has('refazer') || ok[0].key;
    case 'card:fundo': return has('recusar') || ok[0].key;
    default: return ok[0]?.key ?? d.options[0].key;
  }
}

export function playMonth(s: GameState, strategy: Strategy) {
  let guard = 0;
  while (s.decisions.length && guard++ < 20) {
    const d = s.decisions[0];
    resolve(s, d.id, choose(s, d, strategy));
  }
  if (s.over) return;
  if (s.teams < 5 && s.cash > 12 && teamsBusy(s) >= s.teams) hireTeam(s);
  // Sell what has been stuck waiting for money for two years.
  for (const p of s.projects) {
    if (p.stage === 'fin' && p.hist.length && s.month - p.hist[p.hist.length - 1].m > 24 && p.phase === 0) sellProject(s, p.id);
  }
  // Keep enough cash for the equity the pipeline will need.
  const committed = s.projects.filter((p) => isLive(p) && p.stage !== 'obra').reduce((a, p) => a + financingPf(s, p).equityM * (SITES_BY_ID[p.site].mega ? 0.15 : 1), 0);
  while (teamsBusy(s) < s.teams && s.cash - 0.6 * committed > 1.5) {
    let pick: { id: string; prog: Program; score: number } | null = null;
    for (const site of openSites(s)) {
      const b = bestProgram(s, site.id, strategy);
      if (b && (!pick || b.score > pick.score)) pick = { id: site.id, ...b };
    }
    if (!pick || !fileProject(s, pick.id, pick.prog)) break;
  }
  tick(s);
}

export function autoplay(seed: number, strategy: Strategy = 'cauteloso', difficulty: Difficulty = 'normal'): GameState {
  const s = newGame(seed, difficulty);
  let guard = 0;
  while (!s.over && guard++ < 400) playMonth(s, strategy);
  while (s.decisions.length) s.decisions.shift();
  return s;
}
