// The fund behind you reviews the business every two years. Miss a target and it is a
// strike; three strikes (two on the hardest level) and the fund pulls out.
import { END_MONTH, monthOf } from './time';
import type { Difficulty, GameState, L } from './types';

export interface Review {
  m: number;
  kind: 'licensed' | 'started' | 'built';
  n: number;
}

export const REVIEWS: Review[] = [
  { m: monthOf(2017, 1), kind: 'licensed', n: 1 },
  { m: monthOf(2019, 1), kind: 'started', n: 80 },
  { m: monthOf(2021, 1), kind: 'built', n: 100 },
  { m: monthOf(2023, 1), kind: 'built', n: 350 },
  { m: monthOf(2025, 1), kind: 'built', n: 800 },
  { m: monthOf(2027, 1), kind: 'built', n: 1500 },
  { m: monthOf(2029, 1), kind: 'built', n: 2200 },
  { m: END_MONTH, kind: 'built', n: 2600 },
];

export const DIFFICULTY: Record<Difficulty, { cash: number; goal: number; strikes: number; label: L; blurb: L }> = {
  facil: {
    cash: 14, goal: 0.7, strikes: 3,
    label: { pt: 'Fundo paciente', en: 'Patient fund' },
    blurb: { pt: '14 M€ e metas mais baixas.', en: '€14M and lower targets.' },
  },
  normal: {
    cash: 9, goal: 1, strikes: 3,
    label: { pt: 'Promotora', en: 'Developer' },
    blurb: { pt: '9 M€, três avisos.', en: '€9M, three strikes.' },
  },
  dificil: {
    cash: 7, goal: 1.15, strikes: 2,
    label: { pt: 'Teimosia', en: 'Stubborn' },
    blurb: { pt: '7 M€, metas mais altas, dois avisos.', en: '€7M, higher targets, two strikes.' },
  },
};

export const targetOf = (r: Review, d: Difficulty) =>
  r.kind === 'licensed' ? r.n : Math.max(10, Math.round((r.n * DIFFICULTY[d].goal) / 10) * 10);

/** Homes licensed, started and built so far. */
export function progress(s: GameState) {
  let licensed = 0, started = 0, built = s.stats.homes + s.stats.al;
  for (const p of s.projects) {
    if (p.licensed != null) licensed++;
    if (p.broke != null) started += p.units;
  }
  return { licensed, started, built };
}

export function measure(s: GameState, kind: Review['kind']) {
  const pr = progress(s);
  return kind === 'licensed' ? pr.licensed : kind === 'started' ? pr.started : pr.built;
}

export type GoalStatus = 'met' | 'ontrack' | 'risk' | 'behind' | 'early';

/**
 * have: done. sure: under way and due before the deadline. maybe: could still make it.
 */
export function goalStatus(s: GameState) {
  const r = REVIEWS[s.review.i];
  if (!r) return null;
  const need = targetOf(r, s.difficulty);
  const left = r.m - s.month;
  const have = measure(s, r.kind);
  let sure = 0, maybe = 0;
  for (const p of s.projects) {
    if (p.stage === 'done' || p.stage === 'dead' || p.stage === 'sold') continue;
    const remaining = p.units - p.built;
    if (r.kind === 'licensed') {
      if (p.licensed == null && ['esp', 'alvara', 'camara', 'discussao'].includes(p.stage) && p.left <= left) sure++;
      else if (p.licensed == null) maybe++;
    } else if (r.kind === 'started') {
      if (p.broke == null && (p.stage === 'fin' || p.stage === 'alvara')) sure += p.units;
      else if (p.broke == null && p.stage !== 'fin') maybe += p.units;
    } else {
      if (p.stage === 'obra' && p.left <= left && p.prog.exit !== 'al') sure += remaining;
      else if (p.stage !== 'obra' && p.prog.exit !== 'al') maybe += remaining;
    }
  }
  const prev = s.review.i > 0 ? REVIEWS[s.review.i - 1].m : 0;
  const status: GoalStatus = have >= need ? 'met' : have + sure >= need ? 'ontrack' : have + sure + maybe >= need ? 'risk' : s.month - prev < 9 ? 'early' : 'behind';
  return { review: r, need, have, sure, maybe, left, status };
}
