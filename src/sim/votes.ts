// The Câmara's vote. Each party or list votes as one (Lisbon's councillors almost always do),
// in favour, abstaining or against. A proposal passes with more votes in favour than against;
// abstentions do not count, and on a tie the mayor's casting vote decides. Before any of that,
// the mayor's executive decides whether the proposal reaches the table at all.
//
// Every list's chances, and the reasons behind them, are shown before the player chooses,
// and the chance of passing is summed exactly over every combination of votes: the
// uncertainty is the point.
import { AGREEMENTS, BLOCS, ELECTIONS, MANDATES, NEW_EXECUTIVE, PRE_ELECTION } from '../data/politics';
import { SITES_BY_ID } from '../data/sites';
import { heatFor } from './heat';
import { rand, type Rng } from './rng';
import { mandateAt } from './rules';
import { END_MONTH, monthOf } from './time';
import type { Ballot, Exit, GameState, L, Project, Stance, Vote } from './types';

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const T = (pt: string, en: string): L => ({ pt, en });
const pc = (x: number) => `${Math.round(x * 100)}%`;
/** Steepness and the width of the abstention band, on the stance scale. */
const K = 3.2;
const C = 0.35;

export interface VoteContext {
  /** Lists you struck a deal with. */
  deals?: string[];
  /** Public benefits offered to the neighbourhood (a facility, public space). */
  benefits?: boolean;
  /** Programme changes to evaluate before agreeing to them. */
  aff?: number;
  floors?: number;
  exit?: Exit;
}

const within = (m: number, from: [number, number], until?: [number, number]) =>
  m >= monthOf(...from) && (!until || m < monthOf(...until));

/** The next local election from this month, if any, and how many months away it is. */
export function nextElection(month: number): { m: number; months: number } | null {
  for (const [y, mo] of ELECTIONS) {
    const m = monthOf(y, mo);
    if (m >= month) return { m, months: m - month };
  }
  return null;
}

/** Months since the current seats took office (a new mayor on the same seats does not count). */
export function executiveAge(month: number): number {
  let since = 0;
  let prev = '';
  for (const md of MANDATES) {
    const start = monthOf(...md.from);
    if (start > month) break;
    const seats = JSON.stringify(md.seats);
    if (seats !== prev) since = start;
    prev = seats;
  }
  return month - since;
}

/** When the executive that follows the next election takes office, and has settled in. */
function afterElection(month: number): number {
  const e = nextElection(month);
  if (!e) return END_MONTH;
  const md = MANDATES.find((x) => monthOf(...x.from) >= e.m);
  return md ? monthOf(...md.from) + NEW_EXECUTIVE : END_MONTH;
}

export function stances(s: GameState, p: Project, ctx: VoteContext = {}): Stance[] {
  const site = SITES_BY_ID[p.site];
  const prog = { ...p.prog, aff: ctx.aff ?? p.prog.aff, floors: ctx.floors ?? p.prog.floors, exit: ctx.exit ?? p.prog.exit };
  const h = heatFor(site, prog, p.units, s.standing, p.mult);
  const md = mandateAt(s.month);
  const e = nextElection(s.month);
  const campaign = !!e && e.months <= PRE_ELECTION && h.opp >= 35;
  const story = p.story && p.story.until > s.month ? p.story : undefined;
  const out: Stance[] = [];
  for (const [bloc, seats] of Object.entries(md.seats)) {
    const b = BLOCS[bloc];
    const mayor = bloc === md.mayorBloc;
    const why: Stance['why'] = [];
    const add = (w: number, label: L) => { if (Math.abs(w) >= 0.02) why.push({ label, w }); };
    add(b.lean, b.lean >= 0 ? T('costuma aprovar projetos privados', 'usually approves private projects') : T('desconfia de projetos privados', 'wary of private projects'));
    if (mayor) add(0.9, T('a proposta é do executivo', 'the executive tabled it'));
    const ag = AGREEMENTS.find((a) => a.bloc === bloc && within(s.month, a.from, a.until));
    if (ag) add(ag.w, ag.label);
    if (site.municipal) add(mayor ? 0.4 : 0.15, T('terreno municipal, programa da Câmara', 'city land, a council programme'));
    add(b.aff * (prog.aff - 0.25), prog.aff >= 0.25 ? T(`${pc(prog.aff)} das casas a renda acessível`, `${pc(prog.aff)} of the homes affordable`) : T('poucas casas a renda acessível', 'few affordable homes'));
    if (prog.exit === 'al') add(-b.al, T('alojamento local', 'short lets'));
    if (p.once.evicted) add(-b.evict, T('despejos', 'evictions'));
    add((-b.local * h.viz) / 100, T('moradores e património contra', 'residents and heritage groups against'));
    add((-b.aff * 0.3 * h.hab) / 100, T('movimento pela habitação contra', 'housing movement against'));
    if (campaign) add(mayor ? -0.35 : -0.3, T('eleições à porta e um projeto polémico', 'elections near, and a contested project'));
    if (story) add(-(mayor ? 0.45 : 0.6) * story.sev, T('o projeto está nas notícias', 'the project is in the news'));
    if (p.inquiry) add(-0.5, T('inquérito do Ministério Público', 'a prosecutor’s inquiry'));
    if (p.once.consultor) add(0.15, T('o teu consultor conhece os corredores', 'your consultant knows the corridors'));
    add((s.standing - 50) / 125, s.standing >= 50 ? T('a tua boa reputação', 'your good standing') : T('a tua má reputação', 'your poor standing'));
    if (ctx.benefits) add(0.25, T('contrapartidas para o bairro', 'public benefits for the area'));
    if (ctx.deals?.includes(bloc)) add(0.6, T('acordo contigo', 'a deal with you'));
    const x = why.reduce((a, r) => a + r.w, 0);
    const pYes = sigmoid(K * (x - C));
    const pNo = sigmoid(K * (-x - C));
    // Every pull counts in x; only the ones worth mentioning are shown.
    const shown = why.filter((r) => Math.abs(r.w) >= 0.1).sort((a, c) => Math.abs(c.w) - Math.abs(a.w));
    out.push({ bloc, seats, mayor, x, pYes, pNo, pAbst: Math.max(0, 1 - pYes - pNo), why: shown.slice(0, 3) });
  }
  return out.sort((a, c) => Number(c.mayor) - Number(a.mayor) || c.seats - a.seats);
}

const passes = (yes: number, no: number, mayorYes: boolean) => yes > no || (yes === no && yes > 0 && mayorYes);

/** P(the proposal passes), summed over every combination of the lists' votes. */
export function passProb(st: Stance[]): number {
  let total = 0;
  const walk = (i: number, yes: number, no: number, mayorYes: boolean, pr: number) => {
    if (pr < 1e-12) return;
    if (i === st.length) { if (passes(yes, no, mayorYes)) total += pr; return; }
    const x = st[i];
    walk(i + 1, yes + x.seats, no, mayorYes || x.mayor, pr * x.pYes);
    walk(i + 1, yes, no, mayorYes, pr * x.pAbst);
    walk(i + 1, yes, no + x.seats, mayorYes, pr * x.pNo);
  };
  walk(0, 0, 0, false, 1);
  return Math.min(1, total);
}

export function castVote(rng: Rng, st: Stance[]): Vote {
  const blocs = st.map((x) => {
    const u = rand(rng);
    const ballot: Ballot = u < x.pYes ? 'sim' : u < x.pYes + x.pAbst ? 'abst' : 'nao';
    return { ...x, ballot };
  });
  const sum = (b: Ballot) => blocs.filter((x) => x.ballot === b).reduce((a, x) => a + x.seats, 0);
  const yes = sum('sim'), abst = sum('abst'), no = sum('nao');
  const mayorYes = blocs.some((x) => x.mayor && x.ballot === 'sim');
  const passed = passes(yes, no, mayorYes);
  return { body: 'camara', blocs, yes, abst, no, passed, casting: passed && yes === no };
}

/** The most likely vote for one list, for compact displays. */
export function likely(x: Stance): { ballot: Ballot; p: number } {
  if (x.pYes >= x.pAbst && x.pYes >= x.pNo) return { ballot: 'sim', p: x.pYes };
  return x.pNo >= x.pAbst ? { ballot: 'nao', p: x.pNo } : { ballot: 'abst', p: x.pAbst };
}

export type Hold =
  | { kind: 'new'; until: number }
  | { kind: 'election'; until: number; election: number }
  | { kind: 'executive' };

/**
 * Whether the executive puts the proposal on the agenda now. A new executive takes a couple
 * of months to settle; contested projects wait out an election; and a proposal the mayor's
 * own list would not vote for does not reach the table.
 */
export function agendaHold(s: GameState, p: Project, st: Stance[] = stances(s, p)): Hold | null {
  const age = executiveAge(s.month);
  if (age < NEW_EXECUTIVE && s.month > NEW_EXECUTIVE) return { kind: 'new', until: s.month + NEW_EXECUTIVE - age };
  const site = SITES_BY_ID[p.site];
  const e = nextElection(s.month);
  if (e && e.months <= PRE_ELECTION && !site.municipal) {
    const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
    if (h.opp >= 35) return { kind: 'election', until: afterElection(s.month), election: e.m };
  }
  const mine = st.find((x) => x.mayor);
  if (mine && mine.pYes < 0.5) return { kind: 'executive' };
  return null;
}

/** The Assembleia Municipal, for plans: summarised as one probability from the Câmara's mood. */
export const assembleiaProb = (camaraP: number) => Math.min(0.97, Math.max(0.05, 0.15 + camaraP * 0.85));
