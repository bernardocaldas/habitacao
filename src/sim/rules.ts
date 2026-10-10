// What the law is this month, and who sits in the Câmara.
import { BLOCS, MANDATES, type Mandate } from '../data/politics';
import { RULE_DEFAULTS, TIMELINE } from '../data/timeline';
import { monthOf } from './time';
import type { Rules, Seat } from './types';

const cache = new Map<number, Rules>();

/** Fold every timeline event up to this month into the rule set. */
export function rulesAt(month: number): Rules {
  const hit = cache.get(month);
  if (hit) return hit;
  const r: Rules = { ...RULE_DEFAULTS, alClosed: [...RULE_DEFAULTS.alClosed] };
  for (const ev of TIMELINE) {
    if (ev.set && monthOf(ev.y, ev.m) <= month) Object.assign(r, ev.set);
  }
  cache.set(month, r);
  return r;
}

export function mandateAt(month: number): Mandate {
  let cur = MANDATES[0];
  for (const md of MANDATES) if (monthOf(md.from[0], md.from[1]) <= month) cur = md;
  return cur;
}

/** The 17 seats, mayor's list first, each with its list's lean. */
export function councilAt(month: number): Seat[] {
  const md = mandateAt(month);
  const order = Object.entries(md.seats).sort((a, b) => (a[0] === md.mayorBloc ? -1 : b[0] === md.mayorBloc ? 1 : b[1] - a[1]));
  const seats: Seat[] = [];
  for (const [bloc, n] of order) {
    for (let i = 0; i < n; i++) {
      // Members of one list vote nearly alike; a small spread keeps the roll call honest.
      const spread = n > 1 ? (i / (n - 1) - 0.5) * 0.16 : 0;
      seats.push({ bloc, lean: BLOCS[bloc].lean + spread });
    }
  }
  return seats;
}
