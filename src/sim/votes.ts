// The Câmara's vote, seat by seat. Every seat's probability is shown before the player
// chooses, and the chance of passing is computed exactly (a Poisson-binomial sum), not
// guessed: the uncertainty is the point.
import { BLOCS } from '../data/politics';
import { heatFor } from './heat';
import { chance, type Rng } from './rng';
import { councilAt } from './rules';
import type { GameState, Project, Vote } from './types';
import { SITES_BY_ID } from '../data/sites';

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface VoteContext {
  /** Extra goodwill from a deal, applied to the lists that asked for it. */
  boost?: number;
  /** Lists the deal was made with (by bloc key); empty means everyone. */
  with?: string[];
  aff?: number;
  floors?: number;
}

export function seatOdds(s: GameState, p: Project, ctx: VoteContext = {}) {
  const site = SITES_BY_ID[p.site];
  const prog = { ...p.prog, aff: ctx.aff ?? p.prog.aff, floors: ctx.floors ?? p.prog.floors };
  const h = heatFor(site, prog, p.units, s.standing, p.mult);
  const evicts = p.once.evicted ? 1 : 0;
  const al = prog.exit === 'al' ? 1 : 0;
  return councilAt(s.month).map((seat) => {
    const b = BLOCS[seat.bloc];
    let x = 0.85 - 0.02 * h.opp + 0.012 * h.support + b.aff * (prog.aff - 0.1) - b.al * al - b.evict * evicts;
    if (site.municipal) x += 0.25; // the city's own land, the city's own programme
    if (ctx.boost && (!ctx.with?.length || ctx.with.includes(seat.bloc))) x += ctx.boost;
    return { bloc: seat.bloc, p: sigmoid(2.2 * (1.3 * seat.lean + x)) };
  });
}

/** P(at least `need` yes votes) for independent seats with the given probabilities. */
export function passProb(ps: number[], need: number): number {
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p);
      next[k + 1] += dist[k] * p;
    }
    dist = next;
  }
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

export const NEED = 9; // of 17

export function castVote(rng: Rng, odds: { bloc: string; p: number }[]): Vote {
  const seats = odds.map((o) => ({ ...o, yes: chance(rng, o.p) }));
  const yes = seats.filter((x) => x.yes).length;
  return { body: 'camara', seats, need: NEED, yes, passed: yes >= NEED };
}

/** The Assembleia Municipal, for plans: summarised as one probability from the Câmara's mood. */
export const assembleiaProb = (camaraP: number) => Math.min(0.97, Math.max(0.05, 0.15 + camaraP * 0.85));
