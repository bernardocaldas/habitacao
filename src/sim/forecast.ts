// The game's own forecast: replay one project a few hundred times from where it stands,
// with the same rules and hazards and a fixed, sensible set of choices, and report how
// often it gets a licence and how long that takes. Uncertainty in view, as on the rest of
// estimador.pt: an interval and a probability, never a single date.
import { fork } from './rng';
import { fileProject, isLive, newGame, resolve, stepProject } from './sim';
import type { Decision, GameState, Program, Project } from './types';

export interface Forecast {
  runs: number;
  pLicence: number;
  licence?: [number, number, number]; // p10, p50, p90 months from now
  pKeys: number;
  keys?: [number, number, number];
  pDead: number;
}

const DEFAULT: Record<string, string[]> = {
  pip: ['avancar'], heritage: ['aceitar'], refused: ['rever'], tacit: ['esperar'], camara: ['votar'],
  vote: ['ok', 'voltar'], suit: ['tribunal'], annulled: ['refazer'], tenants: ['negociar'],
  pencil: ['esperar'], capital: ['esperar'],
};
const choose = (d: Decision) => (DEFAULT[d.kind] ?? []).find((k) => d.options.some((o) => o.key === k && !o.disabled)) ?? d.options.find((o) => !o.disabled)!.key;

const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];

function scratch(s0: GameState, seed: number): GameState {
  const s = newGame(s0.seed, s0.difficulty);
  s.month = s0.month;
  s.standing = s0.standing;
  s.rng = fork(s0.rng, seed);
  s.cash = 1e6;
  s.teams = 99;
  s.stats.completed = s0.stats.completed;
  return s;
}

function run(s: GameState, p: Project, horizon: number) {
  const start = s.month;
  let licence: number | undefined = p.licensed != null ? 0 : undefined;
  for (let m = 0; m < horizon; m++) {
    let guard = 0;
    while (s.decisions.length && guard++ < 12) resolve(s, s.decisions[0].id, choose(s.decisions[0]));
    if (!isLive(p)) break;
    s.month++;
    stepProject(s, p);
    if (licence == null && p.licensed != null) licence = s.month - start;
  }
  return { licence, keys: p.finished ?? (p.built > 0 ? s.month : undefined), dead: p.stage === 'dead', start };
}

function summarise(results: ReturnType<typeof run>[]): Forecast {
  const lic = results.filter((r) => r.licence != null).map((r) => r.licence!).sort((a, b) => a - b);
  const keys = results.filter((r) => r.keys != null).map((r) => r.keys! - r.start).sort((a, b) => a - b);
  const n = results.length;
  return {
    runs: n,
    pLicence: lic.length / n,
    licence: lic.length ? [q(lic, 0.1), q(lic, 0.5), q(lic, 0.9)] : undefined,
    pKeys: keys.length / n,
    keys: keys.length ? [q(keys, 0.1), q(keys, 0.5), q(keys, 0.9)] : undefined,
    pDead: results.filter((r) => r.dead).length / n,
  };
}

/** Forecast for a proposal that has not been filed yet. */
export function forecastProposal(s0: GameState, siteId: string, prog: Program, runs = 200, horizon = 150): Forecast | null {
  const results: ReturnType<typeof run>[] = [];
  for (let i = 0; i < runs; i++) {
    const s = scratch(s0, i);
    const p = fileProject(s, siteId, prog);
    if (!p) return null;
    results.push(run(s, p, horizon));
  }
  return summarise(results);
}

/** Forecast for a live project, from where it stands now. */
export function forecastProject(s0: GameState, p0: Project, runs = 160, horizon = 150): Forecast {
  const results: ReturnType<typeof run>[] = [];
  for (let i = 0; i < runs; i++) {
    const s = scratch(s0, i);
    const p = structuredClone(p0);
    s.projects.push(p);
    s.taken[p.site] = p.id;
    s.decisions = s0.decisions.filter((d) => d.project === p.id).map((d) => structuredClone(d));
    results.push(run(s, p, horizon));
  }
  return summarise(results);
}
