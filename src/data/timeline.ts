// What the law is, month by month. Every event that changes a rule carries a `set` diff;
// rulesAt() folds them in date order, so adding a law is adding an entry here.
//
// head/body are straight news, checked against the source linked on each event.
// game says, in one or two lines, what changes for the player.
import type { L, Rules } from '../sim/types';

export interface TimelineEvent {
  y: number;
  m: number;
  head: L;
  body?: L[];
  game?: L[];
  set?: Partial<Rules>;
  /** Months added to every live review (a pandemic, a strike). */
  pause?: number;
  source?: string;
  /** Front page: the paper opens and the clock waits. */
  major?: boolean;
  /** After today's date: a scenario, labelled as such. */
  spec?: boolean;
  /** A change of mandate in the Câmara. */
  mandate?: boolean;
}

export const RULE_DEFAULTS: Rules = {
  plan: 1,
  asks: 0.07,
  simplex: false,
  alvara: true,
  alClosed: [],
  alFrozen: false,
  ivaNew: 0.23,
  ivaReab: 0.06,
  affBonus: 1,
  tenders: 'none',
  prrK: 0,
  prrDeadline: 0,
  labour: 1,
  fees: 1,
  tenantShield: 0.3,
  convFree: false,
};

// Filled in from the dated timeline research (see docs/FONTES.md).
export const TIMELINE: TimelineEvent[] = [];
