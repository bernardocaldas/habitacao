// The game loop: a month at a time, every live project moves through the Portuguese
// licensing procedure (RJUE), the Câmara votes when it must, the economy decides whether
// a licensed project can be built, and the fund reviews you every two years.
//
// Anything that needs the player becomes a Decision on a queue; the clock waits while the
// queue is not empty.
import { FREGUESIAS } from '../data/freguesias';
import { BLOCS } from '../data/politics';
import { SITES, SITES_BY_ID } from '../data/sites';
import { TIMELINE } from '../data/timeline';
import { proForma, type ProForma, unitsOf, landPrice, buildType, econAt } from './econ';
import { DIFFICULTY, REVIEWS, measure, targetOf } from './goals';
import { heatFor } from './heat';
import { legalDeadline, pathFor, stepsFor } from './path';
import { chance, makeRng, rand, randInt } from './rng';
import { mandateAt, rulesAt } from './rules';
import { END_MONTH, fmtMonth, monthOf, yearOf } from './time';
import type {
  Decision, Difficulty, GameState, L, LogItem, NewsItem, Option, Program, Project, Rules, Scheme, Site, Stage, Stance,
} from './types';
import { LIVE, PRE_CONSTRUCTION } from './types';
import { pressMonth, resolveStory, stepInquiry } from './press';
import { agendaHold, assembleiaProb, castVote, passProb, stances, type VoteContext } from './votes';
import { politicalWeather, resolveCard } from './weather';

export const SAVE_VERSION = 2;
export const START_TEAMS = 3;
export const MAX_TEAMS = 6;
export const TEAM_COST = 0.4;
export const DEBT_LIMIT = -6;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const T = (pt: string, en: string): L => ({ pt, en });
const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------------------------
// New game

export function newGame(seed: number, difficulty: Difficulty = 'normal'): GameState {
  return {
    v: SAVE_VERSION,
    seed,
    rng: makeRng(seed),
    difficulty,
    month: 0,
    cash: DIFFICULTY[difficulty].cash,
    teams: START_TEAMS,
    standing: 50,
    projects: [],
    nextId: 1,
    taken: {},
    cool: {},
    decisions: [],
    news: [],
    log: [],
    review: { i: 0, strikes: 0, passed: 0 },
    weather: { next: 9, last: {} },
    press: { next: 8 },
    stats: {
      homes: 0, aff: 0, rental: 0, al: 0, completed: 0, killed: 0, sold: 0, lawsuits: 0, asks: 0,
      votesWon: 0, votesLost: 0, stories: 0, inquiries: 0, monthsToKeys: [], unitsLost: 0, byYear: {},
    },
    seen: {},
  };
}

// ---------------------------------------------------------------------------------------------
// Queries

/** Your part of the money on a phased district: the fund partner puts up the rest. */
const mineOf = (site: Site) => (site.mega ? 0.15 : 1);
/** Months a promissory contract holds the land price. */
export const CPCV_MONTHS = 24;

export function siteState(s: GameState, site: Site): 'open' | 'taken' | 'cooling' | 'soon' | 'gone' {
  if (s.taken[site.id] != null) return 'taken';
  if (site.from && s.month < monthOf(site.from[0], site.from[1])) return 'soon';
  if (site.until && s.month > monthOf(site.until[0], site.until[1])) return 'gone';
  if (site.municipal && rulesAt(s.month).tenders === 'none') return 'soon';
  if (site.municipal?.scheme === 'coop' && rulesAt(s.month).tenders !== 'coop') return 'soon';
  if (site.municipal?.scheme === 'pra' && rulesAt(s.month).tenders === 'none') return 'soon';
  if ((s.cool[site.id] ?? -1) > s.month) return 'cooling';
  return 'open';
}

export const openSites = (s: GameState) => SITES.filter((x) => siteState(s, x) === 'open');
export const isLive = (p: Project) => LIVE.includes(p.stage);
export const usesTeam = (p: Project) => PRE_CONSTRUCTION.includes(p.stage);
export const teamsBusy = (s: GameState) => s.projects.filter(usesTeam).length;
export const projectById = (s: GameState, id: number) => s.projects.find((p) => p.id === id);

// ---------------------------------------------------------------------------------------------
// Proposals

export function floorsFor(site: Site, scheme: Scheme, rules: Rules): number {
  if (scheme === 'bonus') return Math.min(site.maxFloors, site.floors + rules.affBonus);
  if (scheme === 'plano') return site.maxFloors;
  return site.floors;
}

export function schemesFor(site: Site, rules: Rules): Scheme[] {
  const out: Scheme[] = ['base'];
  if (!site.municipal && !site.mega && rules.affBonus > 0 && site.maxFloors > site.floors) out.push('bonus');
  if (!site.municipal && site.maxFloors > site.floors) out.push('plano');
  return out;
}

export function affOptions(site: Site): number[] {
  if (site.municipal?.scheme === 'coop') return [1];
  if (site.municipal?.scheme === 'pra') return [0.7];
  return [0, 0.1, 0.25, 0.5, 1];
}

export function exitOk(site: Site, exit: Program['exit'], rules: Rules): { ok: boolean; why?: L } {
  if (exit === 'al') {
    if (site.municipal || site.mega) return { ok: false, why: T('Não é possível neste terreno.', 'Not possible on this site.') };
    if (rules.alFrozen) return { ok: false, why: T('Novos registos de alojamento local congelados em todo o país.', 'New short-let registrations frozen nationwide.') };
    if (rules.alClosed.includes(site.fr)) return { ok: false, why: T('Novos registos suspensos nesta freguesia.', 'New registrations suspended in this parish.') };
  }
  if (exit === 'venda' && site.municipal?.scheme === 'pra') return { ok: false, why: T('Terreno municipal: só arrendamento.', 'City land: rent only.') };
  if (exit === 'arrendamento' && site.municipal?.scheme === 'coop') return { ok: false, why: T('As cooperativas compram as casas a custo.', 'The co-operative buys the homes at cost.') };
  return { ok: true };
}

export function defaultProgram(site: Site): Program {
  const aff = affOptions(site)[0];
  return {
    scheme: 'base',
    floors: site.floors,
    aff,
    exit: site.municipal?.scheme === 'pra' ? 'arrendamento' : 'venda',
    pip: false,
  };
}

/** Keep a program inside what the site and the rules allow. */
export function normalise(site: Site, prog: Program, rules: Rules): Program {
  const schemes = schemesFor(site, rules);
  const scheme = schemes.includes(prog.scheme) ? prog.scheme : 'base';
  let aff = affOptions(site).includes(prog.aff) ? prog.aff : affOptions(site)[0];
  if (scheme === 'bonus' && aff < 0.25) aff = 0.25;
  const exit = exitOk(site, prog.exit, rules).ok ? prog.exit : defaultProgram(site).exit;
  return { scheme, floors: floorsFor(site, scheme, rules), aff, exit, pip: prog.pip };
}

export function depositFor(site: Site, landM: number) {
  if (site.municipal) return 0.06;
  return round2((0.1 * landM + 0.04) * mineOf(site));
}

export interface Preview {
  units: number;
  affUnits: number;
  pf: ProForma;
  heat: ReturnType<typeof heatFor>;
  path: ReturnType<typeof pathFor>;
  steps: ReturnType<typeof stepsFor>;
  depositM: number;
  landM: number;
  camaraP?: number;
  /** How each list would vote on it today. */
  camara?: Stance[];
  canFile: boolean;
  why?: L;
}

export function preview(s: GameState, siteId: string, prog0: Program): Preview {
  const site = SITES_BY_ID[siteId];
  const rules = rulesAt(s.month);
  const prog = normalise(site, prog0, rules);
  const path = pathFor(site, prog, rules);
  const units = unitsOf(site, prog.floors);
  const landM = landPrice(site, s.month, rules);
  const pf = proForma(site, prog, s.month, rules, { landM });
  const heat = heatFor(site, prog, units, s.standing);
  const steps = stepsFor(site, prog, path, rules);
  const depositM = depositFor(site, landM);
  let camaraP: number | undefined;
  let camara: Stance[] | undefined;
  if (path.camara) {
    camara = stances(s, ghostProject(s, site, prog, path, units, landM));
    camaraP = passProb(camara);
  }
  let canFile = true;
  let why: L | undefined;
  if (siteState(s, site) !== 'open') { canFile = false; why = T('Este terreno não está disponível.', 'This site is not available.'); }
  else if (teamsBusy(s) >= s.teams) { canFile = false; why = T('Todas as equipas estão ocupadas.', 'Every team is busy.'); }
  else if (s.cash < depositM) { canFile = false; why = T('Não tens dinheiro para o sinal.', 'You cannot pay the deposit.'); }
  else if (site.mega && s.stats.completed < 1) { canFile = false; why = T('O fundo só entra num bairro inteiro depois de acabares um projeto.', 'The fund only backs a whole district once you have finished a project.'); }
  return { units, affUnits: pf.affUnits, pf, heat, path, steps, depositM, landM, camaraP, camara, canFile, why };
}

function ghostProject(s: GameState, site: Site, prog: Program, path: Project['path'], units: number, landM: number): Project {
  return {
    id: -1, site: site.id, prog, units, affUnits: Math.round(units * prog.aff), abc: 0, path, stage: 'arq', left: 0, inStage: 0,
    filed: s.month, landM, spent: 0, repaid: 0, mult: { viz: 1, hab: 1 }, once: {}, built: 0, phase: 0, late: 0, asks: 0,
    hist: [], costOverrun: 0, meetings: 0, vars: {},
  };
}

// ---------------------------------------------------------------------------------------------
// Logging

export function log(s: GameState, text: L, project?: number, tone: LogItem['tone'] = 'neutral') {
  s.log.push({ m: s.month, text, project, tone });
  if (s.log.length > 600) s.log.splice(0, s.log.length - 600);
}

export function news(s: GameState, item: Omit<NewsItem, 'm'>) {
  s.news.push({ m: s.month, ...item });
  if (s.news.length > 300) s.news.splice(0, s.news.length - 300);
}

let decisionSeq = 1;
export function decide(s: GameState, d: Omit<Decision, 'id'>) {
  const id = Math.max(decisionSeq, ...s.decisions.map((x) => x.id + 1));
  decisionSeq = id + 1;
  s.decisions.push({ id, ...d });
}

const siteName = (p: Project) => SITES_BY_ID[p.site].name;
const nameOf = (p: Project): L => siteName(p);
const inNamed = (p: Project, pt: string, en: string): L => T(`${nameOf(p).pt}: ${pt}`, `${nameOf(p).en}: ${en}`);

// ---------------------------------------------------------------------------------------------
// Actions

export function fileProject(s: GameState, siteId: string, prog0: Program): Project | null {
  const pv = preview(s, siteId, prog0);
  if (!pv.canFile) return null;
  const site = SITES_BY_ID[siteId];
  const rules = rulesAt(s.month);
  const prog = normalise(site, prog0, rules);
  const p: Project = {
    id: s.nextId++, site: siteId, prog, units: pv.units, affUnits: pv.affUnits, abc: pv.pf.abc, path: pv.path,
    stage: 'arq', left: 0, inStage: 0, filed: s.month, landM: pv.landM, spent: pv.depositM, repaid: 0,
    mult: { viz: 1, hab: 1 }, once: { simplex: rules.simplex }, vars: {}, built: 0, phase: 0, late: 0, asks: 0, hist: [],
    costOverrun: 0, meetings: 0,
  };
  s.cash -= pv.depositM;
  s.projects.push(p);
  s.taken[siteId] = p.id;
  log(s, inNamed(p, `contrato-promessa assinado, sinal de ${fmtM(pv.depositM, 'pt')}.`, `promissory contract signed, ${fmtM(pv.depositM, 'en')} deposit.`), p.id);
  enter(s, p, nextStage(p));
  return p;
}

export function hireTeam(s: GameState): boolean {
  if (s.teams >= MAX_TEAMS || s.cash < TEAM_COST) return false;
  s.teams++;
  s.cash -= TEAM_COST;
  log(s, T(`Contrataste uma nova equipa (${s.teams}).`, `You hired a new team (${s.teams}).`));
  return true;
}

export const meetingCost = (p: Project) => round2(0.02 + p.units * 0.0003);

/** Information sessions with residents: twice per project at most. */
export function meetResidents(s: GameState, id: number): boolean {
  const p = projectById(s, id);
  if (!p || !usesTeam(p) || p.meetings >= 2) return false;
  const c = meetingCost(p);
  if (s.cash < c) return false;
  s.cash -= c;
  p.spent += c;
  p.meetings++;
  p.mult.viz *= 0.88;
  p.mult.hab *= 0.92;
  s.standing = clamp(s.standing + 1, 0, 100);
  log(s, inNamed(p, 'sessão de esclarecimento com os moradores.', 'information session with residents.'), p.id);
  return true;
}

export function saleValue(s: GameState, p: Project): number {
  const site = SITES_BY_ID[p.site];
  const left = (p.units - p.built) / p.units;
  if (p.licensed == null) return round2(p.spent * 0.4 * left);
  const pf = financingPf(s, p);
  return round2(Math.max(p.spent * 0.5 * left, p.spent * 0.8 * left + Math.max(0, pf.profitM) * 0.25 * mineOf(site)));
}

export function sellProject(s: GameState, id: number): boolean {
  const p = projectById(s, id);
  if (!p || !isLive(p) || p.stage === 'obra') return false;
  const v = saleValue(s, p);
  s.cash += v;
  p.stage = 'sold';
  s.stats.sold++;
  release(s, p, 6);
  log(s, inNamed(p, `vendeste o projeto por ${fmtM(v, 'pt')}.`, `you sold the project for ${fmtM(v, 'en')}.`), p.id);
  return true;
}

export function abandonProject(s: GameState, id: number): boolean {
  const p = projectById(s, id);
  if (!p || !isLive(p) || p.stage === 'obra') return false;
  kill(s, p, T('desististe.', 'you walked away.'));
  return true;
}

function kill(s: GameState, p: Project, why: L) {
  p.stage = 'dead';
  s.stats.killed++;
  s.stats.unitsLost += p.units - p.built;
  release(s, p, 9);
  log(s, T(`${nameOf(p).pt}: ${why.pt}`, `${nameOf(p).en}: ${why.en}`), p.id, 'bad');
  s.decisions = s.decisions.filter((d) => d.project !== p.id);
}

function release(s: GameState, p: Project, months: number) {
  delete s.taken[p.site];
  s.cool[p.site] = s.month + months;
  p.suit = undefined;
}

// ---------------------------------------------------------------------------------------------
// Stages

const ORDER: Record<Project['path']['route'], Stage[]> = {
  lic: ['pip', 'arq', 'discussao', 'camara', 'esp', 'alvara', 'fin'],
  cp: ['cp', 'esp', 'alvara', 'fin'],
  plano: ['pip', 'plano', 'discussao', 'camara', 'arq', 'esp', 'alvara', 'fin'],
};

function needed(p: Project, st: Stage, rules: Rules): boolean {
  switch (st) {
    case 'pip': return p.path.pip;
    case 'discussao': return p.path.discussao;
    case 'camara': return p.path.camara;
    case 'alvara': return rules.alvara;
    default: return true;
  }
}

/** The stages this project goes through, in order, under the rules in force now. */
export function routeStages(p: Project, rules: Rules): Stage[] {
  const out = ORDER[p.path.route].filter((st) => needed(p, st, rules) || p.once[`did_${st}`]);
  return [...out, 'obra'];
}

function nextStage(p: Project, rules: Rules = rulesAt(p.filed)): Stage {
  for (const st of ORDER[p.path.route]) if (!p.once[`did_${st}`] && needed(p, st, rules)) return st;
  return 'fin';
}

function drawMonths(s: GameState, p: Project, st: Stage, rules: Rules): number {
  if (st === 'fin') return 0;
  const site = SITES_BY_ID[p.site];
  const steps = stepsFor(site, p.prog, p.path, rules);
  let key: string = st;
  if (st === 'esp' && p.path.route === 'cp') return randInt(s.rng, 1, 2);
  if (st === 'obra') key = 'obra';
  const step = steps.find((x) => x.key === key);
  if (!step) return 1;
  let m = randInt(s.rng, step.lo, step.hi);
  if (st === 'obra' && site.mega) m = randInt(s.rng, 26, 34) + (p.phase === 0 && site.toxic ? randInt(s.rng, 8, 14) : 0);
  if (st === 'obra' && site.toxic && !site.mega) m += randInt(s.rng, 3, 5);
  return Math.max(1, m);
}

function enter(s: GameState, p: Project, st: Stage) {
  const rules = rulesAt(s.month);
  p.stage = st;
  p.inStage = 0;
  p.left = drawMonths(s, p, st, rules);
  p.hist.push({ m: s.month, stage: st });
  if (st === 'esp' && p.licensed == null) onLicensed(s, p);
}

function proceed(s: GameState, p: Project) {
  p.once[`did_${p.stage}`] = true;
  enter(s, p, nextStage(p, rulesAt(s.month)));
}

function onLicensed(s: GameState, p: Project) {
  p.licensed = s.month;
  log(s, inNamed(p, 'projeto aprovado. Tens licença.', 'project approved. You have a licence.'), p.id, 'good');
  maybeSued(s, p);
  if (p.path.tenants && !p.once.tenants) tenantsDecision(s, p);
}

// ---------------------------------------------------------------------------------------------
// The monthly step for one project

function carry(p: Project): number {
  const site = SITES_BY_ID[p.site];
  return round2((p.landM * 0.003 + 0.008 + Math.min(0.03, p.units * 0.00005)) * mineOf(site) * 1000) / 1000;
}

export function stepProject(s: GameState, p: Project) {
  const rules = rulesAt(s.month);
  const site = SITES_BY_ID[p.site];
  if (usesTeam(p)) {
    const c = carry(p);
    s.cash -= c;
    p.spent += c;
  }
  stepInquiry(s, p);
  if (p.suit) {
    p.suit.left--;
    if (p.suit.left <= 0) { settleSuit(s, p); return; }
  }
  if (p.stage === 'fin') { financing(s, p); return; }
  if (p.stage === 'obra' && p.suit?.suspends) return; // works halted by an injunction

  hazards(s, p, rules, site);
  p.inStage++;
  p.left--;

  // Simplex: the city has a legal deadline; past it, the applicant may treat silence as approval.
  if (p.stage === 'arq' && p.once.simplex && !p.once.tacitAsked && p.left > 0 && p.inStage >= legalDeadline(p.units)) {
    p.once.tacitAsked = true;
    tacitDecision(s, p);
    return;
  }
  if (p.left <= 0) endOfStage(s, p, rules, site);
}

function hazards(s: GameState, p: Project, rules: Rules, site: Site) {
  const fr = FREGUESIAS[site.fr];
  const r = s.rng;
  if (p.stage === 'arq' && p.inStage >= 1) {
    const max = rules.simplex && p.once.simplex ? 1 : 4;
    if (p.asks < max && chance(r, rules.asks * (p.once.pipOk ? 0.5 : 1))) {
      const add = randInt(r, 2, 4);
      p.left += add;
      p.asks++;
      s.stats.asks++;
      log(s, inNamed(p, `a Câmara pede elementos adicionais (+${add} meses).`, `the city asks for more documents (+${add} months).`), p.id, 'bad');
      if (p.asks === 3) news(s, { head: T(`Terceiro pedido de elementos para ${nameOf(p).pt}`, `Third request for documents on ${nameOf(p).en}`), real: false, project: p.id });
    }
    if (!p.once.newOfficer && chance(r, 0.02)) {
      p.once.newOfficer = true;
      p.left += 2;
      log(s, inNamed(p, 'o processo mudou de técnico e volta ao início da pilha (+2 meses).', 'the file changed hands and went back to the bottom of the pile (+2 months).'), p.id, 'bad');
    }
  }
  if ((p.stage === 'camara' || p.stage === 'discussao') && !p.once.postponed && chance(r, 0.06)) {
    p.once.postponed = true;
    p.left += 1;
    log(s, inNamed(p, 'reunião adiada por falta de tempo na ordem de trabalhos (+1 mês).', 'meeting postponed, the agenda ran out of time (+1 month).'), p.id);
  }
  if (p.stage === 'discussao' && p.inStage === 0) {
    const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
    if (h.opp >= 40) {
      p.mult.viz *= 1.08;
      p.mult.hab *= 1.08;
      news(s, { head: T(`Centenas de participações contra o projeto ${nameOf(p).pt}`, `Hundreds of objections filed against ${nameOf(p).en}`), real: false, project: p.id });
    }
  }
  if (p.stage === 'esp' && !p.once.specBack && chance(r, 0.04)) {
    p.once.specBack = true;
    p.left += randInt(r, 1, 2);
    log(s, inNamed(p, 'o projeto de estabilidade volta para correções.', 'the structural project comes back for corrections.'), p.id);
  }
  if (p.stage === 'obra') {
    const arch = Math.max(site.heritage ?? 0, fr.centro ? 0.6 : 0);
    if (!p.once.arch && arch >= 0.5 && p.inStage < 8 && chance(r, 0.05 * arch)) {
      p.once.arch = true;
      const add = randInt(r, 3, 8);
      p.left += add;
      p.costOverrun += 0.03;
      log(s, inNamed(p, `achados arqueológicos na escavação (+${add} meses).`, `archaeological finds in the dig (+${add} months).`), p.id, 'bad');
      news(s, { head: T(`Arqueólogos encontram vestígios em obra de ${fr.name}`, `Archaeologists find remains on a ${fr.name} site`), real: false, project: p.id });
    }
    if (!p.once.contractor && chance(r, 0.006)) {
      p.once.contractor = true;
      p.left += randInt(r, 4, 6);
      p.costOverrun += 0.04;
      log(s, inNamed(p, 'o empreiteiro entrou em insolvência; é preciso outro.', 'the contractor went bust; you need another.'), p.id, 'bad');
    }
    if (!p.once.overrun && chance(r, 0.01)) {
      p.once.overrun = true;
      p.costOverrun += 0.05;
      log(s, inNamed(p, 'derrapagem nos custos da obra (+5%).', 'construction costs overrun (+5%).'), p.id, 'bad');
    }
  }
}

function endOfStage(s: GameState, p: Project, rules: Rules, site: Site) {
  switch (p.stage) {
    case 'pip': return pipOutcome(s, p, site);
    case 'arq':
    case 'cp': {
      if (p.once.doomed) return kill(s, p, T('o tribunal confirmou o indeferimento.', 'the court upheld the refusal.'));
      if (p.once.herAppeal && !p.once.herAppealDone) {
        p.once.herAppealDone = true;
        if (p.once.herWin) log(s, inNamed(p, 'ganhaste o recurso contra o parecer do Património.', 'you won the appeal against the heritage opinion.'), p.id, 'good');
        else {
          cutFloors(s, p, p.vars.herCut);
          log(s, inNamed(p, `perdeste o recurso: ficam ${p.prog.floors} pisos.`, `you lost the appeal: ${p.prog.floors} floors it is.`), p.id, 'bad');
        }
      }
      if (p.path.heritage && !p.once.her) {
        p.once.her = true;
        if (heritageObjects(s, p, site)) return;
      }
      if (p.stage === 'arq' && !p.path.camara && !p.once.staff) {
        p.once.staff = true;
        if (staffRejects(s, p, site)) return;
      }
      return proceed(s, p);
    }
    case 'plano':
    case 'discussao':
    case 'esp':
    case 'alvara':
      return proceed(s, p);
    case 'camara':
      return camaraDecision(s, p);
    case 'obra':
      return complete(s, p, rules);
  }
}

// ---------------------------------------------------------------------------------------------
// Prior information request

function pipOutcome(s: GameState, p: Project, site: Site) {
  const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
  const pr = clamp(0.92 - 0.18 * Math.min(1.5, h.over) - h.viz / 300, 0.2, 0.95);
  if (chance(s.rng, pr)) {
    p.once.pipOk = true;
    log(s, inNamed(p, 'informação prévia favorável: as regras ficam fixadas.', 'favourable prior information: the rules are locked in.'), p.id, 'good');
    return proceed(s, p);
  }
  decide(s, {
    kind: 'pip', project: p.id, tone: 'bad',
    title: T('Informação prévia desfavorável', 'Unfavourable prior information'),
    lines: [
      T(`A Câmara diz que ${p.prog.floors} pisos não cabem em ${FREGUESIAS[site.fr].name}.`, `The city says ${p.prog.floors} floors do not fit in ${FREGUESIAS[site.fr].name}.`),
      T('Podes ajustar o projeto ao parecer ou avançar e arriscar um indeferimento.', 'You can fit the project to the opinion, or carry on and risk a refusal.'),
    ],
    options: [
      { key: 'cortar', label: T(`Ajustar para ${site.floors} pisos`, `Cut to ${site.floors} floors`), hint: T('Menos casas, aprovação mais provável.', 'Fewer homes, approval likelier.') },
      { key: 'avancar', label: T('Avançar assim', 'Carry on as is'), hint: T('O risco de indeferimento sobe.', 'The risk of refusal rises.') },
      { key: 'desistir', label: T('Desistir', 'Walk away'), hint: T('Perdes o sinal.', 'You lose the deposit.') },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Heritage authority (binding opinion)

function heritageObjects(s: GameState, p: Project, site: Site): boolean {
  const fr = FREGUESIAS[site.fr];
  const overH = Math.max(0, p.prog.floors - fr.ctx) / Math.max(2, fr.ctx);
  let pr = clamp((site.heritage ?? 0) * (0.15 + 0.6 * overH) + (site.kind === 'reab' && p.prog.floors > site.floors ? 0.2 : 0), 0.04, 0.75);
  if (p.once.pipOk) pr *= 0.6;
  if (p.once.herSoft) pr *= 0.45;
  if (!chance(s.rng, pr)) {
    log(s, inNamed(p, 'parecer favorável do Património Cultural.', 'favourable opinion from the heritage authority.'), p.id, 'good');
    return false;
  }
  const cut = Math.max(fr.ctx, site.kind === 'reab' ? site.floors : p.prog.floors - 2);
  decide(s, {
    kind: 'heritage', project: p.id, tone: 'bad', data: { cut },
    title: T('O Património Cultural exige alterações', 'The heritage authority demands changes'),
    lines: [
      T(`O parecer é vinculativo: o projeto não pode ter mais de ${cut} pisos nesta zona de proteção.`, `The opinion is binding: no more than ${cut} floors in this protection zone.`),
      T('Podes aceitar, redesenhar e voltar a submeter, ou recorrer.', 'You can accept, redesign and resubmit, or appeal.'),
    ],
    real: T('Em zonas de proteção de imóveis classificados, o parecer da tutela do património é obrigatório e vinculativo.', 'In protection zones around classified buildings, the heritage authority’s opinion is mandatory and binding.'),
    options: [
      { key: 'aceitar', label: T(`Aceitar: ${cut} pisos`, `Accept: ${cut} floors`) },
      { key: 'redesenhar', label: T('Redesenhar e submeter de novo', 'Redesign and resubmit'), costM: 0.08, hint: T('Mais 3 a 4 meses; é provável que passe.', '3 to 4 more months; likely to pass.') },
      { key: 'recorrer', label: T('Recorrer', 'Appeal'), costM: 0.1, hint: T('8 a 14 meses; cerca de 1 em 3 vence.', '8 to 14 months; about 1 in 3 wins.') },
    ],
    odds: [{ label: T('Recurso com sucesso', 'Appeal succeeds'), p: 0.35 }],
  });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Refusal by the city's planners (projects that do not go to a vote)

function staffRejects(s: GameState, p: Project, site: Site): boolean {
  const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
  let pr = clamp(0.02 + 0.1 * h.over + h.viz / 500, 0, 0.35);
  if (p.once.pipOk) pr *= 0.4;
  if (p.once.pipBad) pr += 0.15;
  if (!chance(s.rng, pr)) return false;
  decide(s, {
    kind: 'refused', project: p.id, tone: 'bad',
    title: T('Projeto de indeferimento', 'Draft refusal'),
    lines: [
      T('Os serviços propõem indeferir: excesso de volume face à envolvente.', 'The planners propose to refuse: too much bulk for the surroundings.'),
      T('Tens audiência prévia para responder antes da decisão final.', 'You get a hearing (audiência prévia) to respond before the final decision.'),
    ],
    options: [
      { key: 'rever', label: T('Responder com o projeto revisto', 'Respond with a revised design'), hint: T('Menos um piso, mais 3 meses.', 'One floor fewer, 3 more months.') },
      { key: 'tribunal', label: T('Deixar indeferir e impugnar em tribunal', 'Let it be refused and go to court'), costM: 0.12, hint: T('14 a 24 meses; cerca de 1 em 3 vence.', '14 to 24 months; about 1 in 3 wins.') },
      { key: 'desistir', label: T('Desistir', 'Walk away') },
    ],
    odds: [{ label: T('Vitória em tribunal', 'Court win'), p: 0.35 }],
  });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Simplex: tacit approval

function tacitDecision(s: GameState, p: Project) {
  decide(s, {
    kind: 'tacit', project: p.id, tone: 'neutral',
    title: T('A Câmara passou o prazo', 'The city missed its deadline'),
    lines: [
      T(`Passaram ${p.inStage} meses sem decisão. Com o Simplex Urbanístico, o silêncio vale como aprovação.`, `${p.inStage} months without a decision. Under the Simplex reform, silence counts as approval.`),
      T('Os bancos desconfiam de licenças tácitas e a Câmara pode contestá-las mais tarde.', 'Banks are wary of tacit licences, and the city may contest them later.'),
    ],
    real: T('O Decreto-Lei 10/2024 (em vigor desde 4 de março de 2024) prevê o deferimento tácito quando a Câmara não decide no prazo legal.', 'Decree-Law 10/2024 (in force since 4 March 2024) provides for tacit approval when the city does not decide within the legal deadline.'),
    options: [
      { key: 'invocar', label: T('Invocar o deferimento tácito', 'Claim tacit approval'), hint: T('Avanças já; o financiamento exige mais margem.', 'You move on now; lenders want a bigger margin.') },
      { key: 'esperar', label: T('Esperar pela decisão expressa', 'Wait for a formal decision') },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// The Câmara

export function contrapartidas(p: Project) {
  return round2(0.25 + p.units * 0.004);
}

interface Ask { bloc: string; kind: 'aff' | 'floors' | 'al' | 'cash'; aff?: number; floors?: number; costM?: number; label: L }

/** What one list asks for its support: its own priorities, in order. */
function askOf(p: Project, st: Stance): Ask {
  const site = SITES_BY_ID[p.site];
  const fr = FREGUESIAS[site.fr];
  const b = BLOCS[st.bloc];
  const with_ = (pt: string, en: string) => T(`Acordo com ${b.name}: ${pt}`, `Deal with ${b.name}: ${en}`);
  if (p.prog.exit === 'al' && b.al >= 0.3) return { bloc: b.key, kind: 'al', label: with_('nada de alojamento local, as casas vão para venda', 'no short lets, the homes are sold') };
  const target = b.aff >= 1.2 ? 0.5 : 0.25;
  if (b.aff >= 0.6 && !site.municipal && p.prog.aff < target) {
    const aff = p.prog.aff < 0.25 ? 0.25 : target;
    return { bloc: b.key, kind: 'aff', aff, label: with_(`${pct(aff)} das casas a renda acessível`, `${pct(aff)} of the homes affordable`) };
  }
  if (b.local >= 0.5 && p.prog.floors > Math.max(fr.ctx, 2) && site.kind !== 'reab') {
    return { bloc: b.key, kind: 'floors', floors: p.prog.floors - 1, label: with_(`um piso a menos (${p.prog.floors - 1})`, `one floor fewer (${p.prog.floors - 1})`) };
  }
  return { bloc: b.key, kind: 'cash', costM: round2(contrapartidas(p) * 0.5), label: with_('uma obra no bairro que os seus vereadores pedem', 'a local project its councillors ask for') };
}

const dealCtx = (a: Ask): VoteContext => ({ deals: [a.bloc], aff: a.aff, floors: a.floors, exit: a.kind === 'al' ? 'venda' : undefined });

/** The margin the bank would see today if the deal's terms were in the licence. */
function dealMargin(s: GameState, p: Project, a: Ask) {
  const site = SITES_BY_ID[p.site];
  const prog = { ...p.prog, aff: a.aff ?? p.prog.aff, floors: a.floors ?? p.prog.floors, exit: a.kind === 'al' ? 'venda' as const : p.prog.exit };
  const after = financingPf(s, { ...p, prog, units: unitsOf(site, prog.floors) });
  return { before: financingPf(s, p).margin, after: after.margin, required: after.required };
}

const dealData = (s: GameState, p: Project, a: Ask) => {
  const m = dealMargin(s, p, a);
  return { [`k_${a.bloc}`]: a.kind, [`a_${a.bloc}`]: a.aff ?? -1, [`f_${a.bloc}`]: a.floors ?? -1, [`m_${a.bloc}`]: m.after, required: m.required };
};

function dealHint(s: GameState, p: Project, a: Ask, pass: number): L {
  if (a.kind === 'cash') return chanceHint(pass);
  const m = dealMargin(s, p, a);
  return T(`${chanceHint(pass).pt}. Margem prevista: ${pct(m.before)} → ${pct(m.after)} (o banco pede ${pct(m.required)}).`,
    `${chanceHint(pass).en}. Expected margin: ${pct(m.before)} → ${pct(m.after)} (the bank wants ${pct(m.required)}).`);
}

function applyDeal(s: GameState, p: Project, d: Decision, bloc: string) {
  const kind = String(d.data?.[`k_${bloc}`]);
  if (kind === 'aff') reprogram(s, p, { ...p.prog, aff: Number(d.data?.[`a_${bloc}`]) });
  if (kind === 'floors') cutFloors(s, p, Number(d.data?.[`f_${bloc}`]));
  if (kind === 'al') reprogram(s, p, { ...p.prog, exit: 'venda' });
  log(s, inNamed(p, `acordo com ${BLOCS[bloc].name} antes da votação.`, `a deal with ${BLOCS[bloc].name} before the vote.`), p.id);
}

const chanceHint = (x: number) => T(`Probabilidade de aprovação: ${pct(x)}`, `Chance of approval: ${pct(x)}`);

/** The rule, and what it means for this executive. */
function camaraLines(s: GameState): L[] {
  const md = mandateAt(s.month);
  const n = md.seats[md.mayorBloc];
  const list = BLOCS[md.mayorBloc].name;
  return [
    T(`${md.mayor} (${list}) preside. Uma proposta passa com mais votos a favor do que contra: as abstenções não contam e, num empate, decide o voto de qualidade do presidente.`,
      `${md.mayor} (${list}) chairs. A proposal passes with more votes for than against: abstentions do not count, and a tie goes to the mayor’s casting vote.`),
    n >= 9
      ? T(`A lista do presidente tem ${n} dos 17 lugares: se votar a favor, passa.`, `The mayor’s list holds ${n} of the 17 seats: if it votes yes, it passes.`)
      : T(`A lista do presidente tem ${n} dos 17 lugares: precisa que a oposição se abstenha ou vote a favor.`, `The mayor’s list holds ${n} of the 17 seats: it needs the opposition to abstain or vote yes.`),
  ];
}

const RULE_REAL = T(
  'As deliberações da Câmara tomam-se por maioria dos votos: as abstenções não contam e o presidente tem voto de qualidade em caso de empate. Já no mandato iniciado em 2025, um loteamento municipal de 243 casas no Alto do Lumiar foi aprovado com votos contra do Livre e do BE, abstenção do PS e do PCP e votos a favor do Chega e da coligação.',
  'Council decisions are taken by a majority of votes cast: abstentions do not count and the mayor has the casting vote on a tie. In the term that began in 2025, a city allotment of 243 homes in Alto do Lumiar passed with Livre and BE against, PS and PCP abstaining, and Chega and the coalition in favour.',
);

function camaraDecision(s: GameState, p: Project) {
  const st = stances(s, p);
  const hold = agendaHold(s, p, st);
  if (hold && hold.kind !== 'executive') {
    p.left = Math.max(1, hold.until - s.month);
    p.vars.holdUntil = hold.until;
    if (hold.kind === 'new') {
      log(s, inNamed(p, `o novo executivo ainda não agenda votações de urbanismo (até ${fmtMonth(hold.until, 'pt')}).`, `the new executive is not yet scheduling planning votes (until ${fmtMonth(hold.until, 'en')}).`), p.id);
      return;
    }
    decide(s, {
      kind: 'hold', project: p.id, tone: 'bad',
      title: T('Fica para depois das eleições', 'It waits until after the election'),
      lines: [
        T(`Há eleições autárquicas em ${fmtMonth(hold.election, 'pt')}. Com moradores e ativistas contra, nenhum executivo leva este projeto a votos agora.`, `There are local elections in ${fmtMonth(hold.election, 'en')}. With residents and activists against it, no executive will table this project now.`),
        T(`Volta à ordem de trabalhos quando o novo executivo se instalar, por volta de ${fmtMonth(hold.until, 'pt')}. Até lá, pagas os custos de ter a equipa à espera.`, `It returns to the agenda once the new executive settles in, around ${fmtMonth(hold.until, 'en')}. Until then, you pay for a team that waits.`),
      ],
      options: [
        { key: 'esperar', label: T('Esperar', 'Wait') },
        { key: 'desistir', label: T('Desistir', 'Walk away') },
      ],
    });
    return;
  }
  p.vars.holdUntil = -1;
  if (hold?.kind === 'executive') return executiveDecision(s, p, st);

  const pAs = passProb(st);
  const deals = st.filter((x) => !x.mayor).map((x) => askOf(p, x))
    .map((a) => ({ a, p: passProb(stances(s, p, dealCtx(a))) }))
    .filter((x) => x.p > pAs + 0.03)
    .sort((a, b) => b.p - a.p)
    .slice(0, 2);
  const pBen = passProb(stances(s, p, { benefits: true }));
  const options: Option[] = [
    { key: 'votar', label: T('Ir a votos assim', 'Go to the vote as is'), hint: chanceHint(pAs) },
    ...deals.map((x) => ({ key: `deal:${x.a.bloc}`, label: x.a.label, costM: x.a.costM, hint: dealHint(s, p, x.a, x.p) })),
    { key: 'cash', label: T('Oferecer contrapartidas ao bairro (equipamento, espaço público)', 'Offer public benefits (a facility, public space)'), costM: contrapartidas(p), hint: T(`${chanceHint(pBen).pt}. Pode parecer troca de favores.`, `${chanceHint(pBen).en}. It may look like trading favours.`) },
    { key: 'adiar', label: T('Retirar da ordem de trabalhos e negociar', 'Pull it from the agenda and negotiate'), hint: T('Mais 2 meses; acalma os ânimos.', '2 more months; cools tempers.'), disabled: !!p.once.adiado },
  ];
  decide(s, {
    kind: 'camara', project: p.id, tone: 'neutral', data: Object.assign({}, ...deals.map((x) => dealData(s, p, x.a))),
    title: T('Vai à reunião de Câmara', 'Up for a Câmara vote'),
    lines: camaraLines(s),
    stances: st,
    odds: [{ label: T('Aprovação, assim', 'Approval, as is'), p: pAs }, ...(deals[0] ? [{ label: T('Aprovação, com o melhor acordo', 'Approval, with the best deal'), p: deals[0].p }] : [])],
    real: RULE_REAL,
    options,
  });
}

/** The mayor's own list would not vote for it, so it does not reach the table. */
function executiveDecision(s: GameState, p: Project, st: Stance[]) {
  const mine = st.find((x) => x.mayor)!;
  const ask = askOf(p, mine);
  const after = stances(s, p, dealCtx(ask));
  const tabled = (after.find((x) => x.mayor)?.pYes ?? 0) >= 0.5;
  const reasons = mine.why.filter((x) => x.w < 0).map((x) => x.label);
  decide(s, {
    kind: 'agenda', project: p.id, tone: 'bad', data: dealData(s, p, ask),
    title: T('O executivo não leva o projeto a votos', 'The executive will not table the project'),
    lines: [
      T(`É o presidente quem faz a ordem de trabalhos, e a lista dele (${BLOCS[mine.bloc].name}) não votaria a favor${reasons.length ? `: ${reasons.map((r) => r.pt).join(', ')}` : ''}.`,
        `The mayor sets the agenda, and the mayor’s list (${BLOCS[mine.bloc].name}) would not vote for it${reasons.length ? `: ${reasons.map((r) => r.en).join(', ')}` : ''}.`),
    ],
    stances: st,
    options: [
      { key: `deal:${ask.bloc}`, label: ask.label, costM: ask.costM, disabled: !tabled, hint: tabled ? dealHint(s, p, ask, passProb(after)) : T('Nem assim chega.', 'Not even that is enough.') },
      { key: 'esperar', label: T('Esperar que o ambiente mude', 'Wait for the mood to change'), hint: T('Mais 3 meses; as histórias esquecem-se, os ânimos acalmam.', '3 more months; stories fade, tempers cool.') },
      { key: 'desistir', label: T('Desistir', 'Walk away') },
    ],
  });
}

function runVote(s: GameState, p: Project, ctx: VoteContext) {
  const st = stances(s, p, ctx);
  const vote = castVote(s.rng, st);
  let assembleiaOk = true;
  const lines: L[] = [T(`${vote.yes} a favor, ${vote.abst} ${vote.abst === 1 ? 'abstenção' : 'abstenções'}, ${vote.no} contra.`, `${vote.yes} for, ${vote.abst} ${vote.abst === 1 ? 'abstention' : 'abstentions'}, ${vote.no} against.`)];
  if (vote.casting) lines.push(T('Empate: decidiu o voto de qualidade do presidente.', 'A tie: the mayor’s casting vote decided it.'));
  if (vote.passed && p.path.assembleia) {
    assembleiaOk = chance(s.rng, assembleiaProb(passProb(st)));
    lines.push(assembleiaOk
      ? T('A Assembleia Municipal aprovou o plano.', 'The Municipal Assembly approved the plan.')
      : T('A Assembleia Municipal chumbou o plano.', 'The Municipal Assembly voted the plan down.'));
  }
  const passed = vote.passed && assembleiaOk;
  if (passed && ctx.benefits) { p.once.cash = true; p.vars.cashM = s.month; }
  if (passed) s.stats.votesWon++; else s.stats.votesLost++;
  decide(s, {
    kind: 'vote', project: p.id, tone: passed ? 'good' : 'bad', vote, data: { passed },
    title: passed ? T('Aprovado em Câmara', 'Approved by the Câmara') : T('Chumbado', 'Voted down'),
    lines,
    options: passed
      ? [{ key: 'ok', label: T('Continuar', 'Continue') }]
      : [
          { key: 'voltar', label: T('Rever e voltar a votos', 'Revise and go back to the vote'), hint: T('Menos um piso, mais renda acessível, 4 meses.', 'One floor fewer, more affordable homes, 4 months.') },
          { key: 'desistir', label: T('Desistir', 'Walk away') },
        ],
  });
}

// ---------------------------------------------------------------------------------------------
// Courts

function maybeSued(s: GameState, p: Project) {
  const site = SITES_BY_ID[p.site];
  const fr = FREGUESIAS[site.fr];
  const h = heatFor(site, p.prog, p.units, s.standing, p.mult);
  // Residents and heritage groups sue over height, bulk and protected places; tenants' groups
  // over evictions and short lets. A plain building that fits its street rarely ends in court.
  const tall = h.over > 0.15 || (site.heritage ?? 0) >= 0.5 || p.path.route === 'plano';
  let viz = clamp((h.viz - 30) / 70, 0, 0.4) * (tall ? 1 : 0.25);
  if (fr.viz >= 0.75) viz *= 1.3;
  const hab = p.prog.exit === 'al' || p.once.evicted ? clamp((h.hab - 30) / 70, 0, 0.35) : 0;
  let pr = viz + hab;
  if (p.path.route === 'plano') pr += 0.1;
  const mp = (site.heritage ?? 0) >= 0.6 && h.over > 0.3 ? 0.08 : 0;
  pr += mp;
  if (p.tacit) pr += 0.1;
  if (!chance(s.rng, pr)) return;
  const by = mp > 0 && chance(s.rng, mp / pr) ? 'mp' : viz >= hab ? 'viz' : 'hab';
  p.suit = { left: randInt(s.rng, 12, 24), suspends: chance(s.rng, 0.45), by };
  s.stats.lawsuits++;
  const who: L = by === 'mp' ? T('O Ministério Público', 'The public prosecutor') : by === 'viz' ? T('Uma associação de moradores', 'A residents’ association') : T('Uma associação de inquilinos', 'A tenants’ association');
  news(s, { head: T(`${who.pt} leva ${nameOf(p).pt} a tribunal`, `${who.en} takes ${nameOf(p).en} to court`), real: false, project: p.id });
  decide(s, {
    kind: 'suit', project: p.id, tone: 'bad',
    title: T('Ação no tribunal administrativo', 'Case in the administrative court'),
    lines: [
      T(`${who.pt} pede a anulação da licença.`, `${who.en} asks the court to annul the licence.`),
      p.suit.suspends
        ? T('Foi aceite uma providência cautelar: nada avança até haver decisão.', 'An injunction was granted: nothing moves until there is a ruling.')
        : T('Sem providência cautelar: podes continuar, mas o banco espera pela sentença.', 'No injunction: you can carry on, but the bank waits for the ruling.'),
    ],
    options: [
      { key: 'acordo', label: T('Negociar um acordo', 'Negotiate a settlement'), costM: round2(0.15 + p.units * 0.003), hint: by === 'viz' ? T('Fica resolvido em 2 meses; provavelmente perdes um piso.', 'Settled in 2 months; you probably lose a floor.') : T('Fica resolvido em 2 meses.', 'Settled in 2 months.') },
      { key: 'tribunal', label: T('Defender em tribunal', 'Fight it in court'), costM: 0.12, hint: T(`Cerca de ${pct(p.tacit ? 0.6 : 0.75)} de hipóteses de ganhar.`, `About ${pct(p.tacit ? 0.6 : 0.75)} chance of winning.`) },
    ],
    odds: [{ label: T('Ganhar em tribunal', 'Win in court'), p: p.tacit ? 0.6 : 0.75 }],
  });
}

function settleSuit(s: GameState, p: Project) {
  const suit = p.suit!;
  p.suit = undefined;
  if (p.once.settled) {
    log(s, inNamed(p, 'acordo homologado; o processo termina.', 'settlement approved; the case is closed.'), p.id, 'good');
    return;
  }
  if (chance(s.rng, p.tacit ? 0.6 : 0.75)) {
    log(s, inNamed(p, 'o tribunal deu-te razão.', 'the court ruled in your favour.'), p.id, 'good');
    return;
  }
  const site = SITES_BY_ID[p.site];
  news(s, { head: T(`Tribunal anula licença de ${nameOf(p).pt}`, `Court annuls the licence for ${nameOf(p).en}`), real: false, project: p.id });
  if (p.stage === 'obra') {
    // Too late to undo the building; the court orders changes and a fine.
    s.cash -= 0.3;
    log(s, inNamed(p, 'licença anulada com a obra em curso: alterações e coima.', 'licence annulled mid-construction: changes and a fine.'), p.id, 'bad');
    return;
  }
  decide(s, {
    kind: 'annulled', project: p.id, tone: 'bad', data: { by: suit.by },
    title: T('Licença anulada', 'Licence annulled'),
    lines: [T('O tribunal anulou a licença. Para continuar, tens de voltar a licenciar um projeto mais pequeno.', 'The court annulled the licence. To carry on, you must license a smaller project.')],
    options: [
      { key: 'refazer', label: T(`Voltar à arquitetura com ${Math.max(FREGUESIAS[site.fr].ctx, p.prog.floors - 2)} pisos`, `Back to architecture with ${Math.max(FREGUESIAS[site.fr].ctx, p.prog.floors - 2)} floors`), costM: 0.2 },
      { key: 'desistir', label: T('Desistir', 'Walk away') },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Tenants

function tenantsDecision(s: GameState, p: Project) {
  const site = SITES_BY_ID[p.site];
  const n = site.tenants ?? 0;
  const rules = rulesAt(s.month);
  decide(s, {
    kind: 'tenants', project: p.id, tone: 'neutral', data: { n },
    title: T(`${n} famílias vivem no prédio`, `${n} households live in the building`),
    lines: [
      T('Têm contratos antigos com rendas baixas. As obras profundas exigem o prédio vazio ou um plano para quem fica.', 'They hold old leases at low rents. Deep works need the building empty, or a plan for those who stay.'),
      T(`A lei protege sobretudo quem tem mais de 65 anos ou incapacidade; contestar um despejo é cada vez mais fácil (proteção: ${pct(rules.tenantShield)}).`, `The law mostly protects over-65s and people with disabilities; contesting an eviction keeps getting easier (protection: ${pct(rules.tenantShield)}).`),
    ],
    options: [
      { key: 'negociar', label: T('Negociar indemnizações e realojamento', 'Negotiate compensation and rehousing'), costM: round2(n * 0.04), hint: T('Mais 3 meses; ninguém fica sem casa.', '3 more months; nobody is left homeless.') },
      { key: 'despejo', label: T('Denunciar os contratos para obras profundas', 'Terminate the leases for deep works'), costM: round2(n * 0.012), hint: T(`Barato, mas pode acabar em tribunal (${pct(rules.tenantShield)}) e nas notícias.`, `Cheap, but may end in court (${pct(rules.tenantShield)}) and in the news.`) },
      { key: 'manter', label: T('Reabilitar com os inquilinos lá dentro', 'Rehabilitate with the tenants in place'), hint: T(`${n} casas ficam com as rendas antigas; mais 2 meses de obra.`, `${n} homes keep their old rents; 2 more months of works.`) },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Financing

/** The pro forma a lender looks at today: land already partly paid, money already spent. */
export function financingPf(s: GameState, p: Project): ProForma {
  const site = SITES_BY_ID[p.site];
  const rules = rulesAt(s.month);
  const phases = site.mega?.phases ?? 1;
  // Past the promissory contract's deadline, the seller claws back half of any rise in value.
  let landM = p.landM;
  if (!site.municipal && s.month - p.filed > CPCV_MONTHS) landM += 0.5 * Math.max(0, landPrice(site, s.month, rules) - p.landM);
  return proForma(site, p.prog, s.month, rules, {
    landM: landM * (site.mega ? 1 : 0.9),
    spent: p.spent - p.repaid,
    share: 1 / phases,
    ve: p.veDone,
  });
}

function financing(s: GameState, p: Project) {
  if (p.suit) return; // lenders wait for the ruling
  if (p.inquiry) {
    if (!p.once.inqBank) { p.once.inqBank = true; log(s, inNamed(p, 'com um inquérito aberto, o banco não assina.', 'with an inquiry open, the bank will not sign.'), p.id, 'bad'); }
    return;
  }
  if (p.finWait && p.finWait > 0) { p.finWait--; return; }
  const site = SITES_BY_ID[p.site];
  const pf = financingPf(s, p);
  const extra = p.tacit ? 0.02 : 0;
  const coop = site.municipal?.scheme === 'coop';
  if (!coop && pf.margin < pf.required + extra) {
    p.finWait = 6;
    pencilDecision(s, p, pf, extra);
    return;
  }
  const mine = mineOf(site) * (p.partner ? 0.4 : 1);
  const need = pf.equityM * mine;
  if (s.cash < need) {
    p.finWait = 4;
    capitalDecision(s, p, need);
    return;
  }
  breakGround(s, p, pf, mine);
}

function breakGround(s: GameState, p: Project, pf: ProForma, mine: number) {
  const site = SITES_BY_ID[p.site];
  const rules = rulesAt(s.month);
  const equity = pf.equityM * mine;
  s.cash -= equity;
  const coop = site.municipal?.scheme === 'coop';
  // Co-operatives buy at cost; the builder's reward is a fee.
  const revenueM = coop ? pf.costM * 1.06 : pf.revenueM;
  const loanM = pf.costM - pf.sunkM - pf.equityM;
  const profitM = revenueM - pf.costM;
  const share = (site.mega ? site.mega.share : 1) * (p.partner ? 1 - p.partner : 1);
  // What comes back to you at the keys: your equity, the sunk costs, your share of profit.
  const mineM = equity + pf.sunkM + share * profitM;
  p.deal = { revenueM, loanM, mineM, profitM, hardM: pf.hardM, units: pf.units, affUnits: pf.affUnits };
  p.repaid = p.spent;
  p.broke = p.broke ?? s.month;
  p.left = 0;
  enter(s, p, 'obra');
  p.left = Math.round(p.left * rules.labour);
  if (p.once.kept) p.left += 2;
  log(s, inNamed(p, `primeira pedra. Investiste ${fmtM(equity, 'pt')}; o banco empresta ${fmtM(loanM, 'pt')}.`, `ground broken. You put in ${fmtM(equity, 'en')}; the bank lends ${fmtM(loanM, 'en')}.`), p.id, 'good');
}

function pencilDecision(s: GameState, p: Project, pf: ProForma, extra: number) {
  const site = SITES_BY_ID[p.site];
  const options: Option[] = [
    { key: 'esperar', label: T('Esperar que as contas fechem', 'Wait for the numbers to work'), hint: T('Voltas a olhar daqui a 6 meses.', 'You look again in 6 months.') },
  ];
  if (!p.veDone) options.push({ key: 've', label: T('Rever o projeto para baixar custos', 'Value-engineer the design'), costM: 0.1, hint: T('Obra 7% mais barata.', 'Construction 7% cheaper.') });
  if (p.prog.aff > 0 && !site.municipal) options.push({ key: 'menosaff', label: T('Reduzir a renda acessível', 'Cut the affordable share'), hint: T('Alteração à licença: 3 a 5 meses, e os vereadores vão lembrar-se.', 'A licence amendment: 3 to 5 months, and councillors will remember.') });
  options.push({ key: 'vender', label: T('Vender o projeto licenciado', 'Sell the licensed project'), hint: T(`Recebes cerca de ${fmtM(saleValue(s, p), 'pt')}.`, `You get about ${fmtM(saleValue(s, p), 'en')}.`) });
  options.push({ key: 'desistir', label: T('Desistir', 'Walk away') });
  decide(s, {
    kind: 'pencil', project: p.id, tone: 'bad',
    title: T('As contas não fecham', 'The numbers do not work'),
    lines: [
      T(`Margem prevista: ${pct(pf.margin)}. O banco e o fundo pedem ${pct(pf.required + extra)}.`, `Expected margin: ${pct(pf.margin)}. The bank and the fund want ${pct(pf.required + extra)}.`),
      T(`Euribor a ${pf.euribor.toFixed(2).replace('.', ',')}%, custos de construção ${pct(econAt(s.month).cost - 1)} acima de 2015.`, `Euribor at ${pf.euribor.toFixed(2)}%, construction costs ${pct(econAt(s.month).cost - 1)} above 2015.`),
    ],
    options,
  });
}

function capitalDecision(s: GameState, p: Project, need: number) {
  decide(s, {
    kind: 'capital', project: p.id, tone: 'bad', data: { need },
    title: T('Falta capital para arrancar', 'Not enough capital to start'),
    lines: [T(`Precisas de ${fmtM(need, 'pt')} de capital próprio e tens ${fmtM(s.cash, 'pt')}.`, `You need ${fmtM(need, 'en')} of equity and have ${fmtM(s.cash, 'en')}.`)],
    options: [
      { key: 'esperar', label: T('Esperar', 'Wait'), hint: T('Voltas a tentar daqui a 4 meses.', 'Try again in 4 months.') },
      { key: 'socio', label: T('Trazer um fundo como sócio', 'Bring in a fund as partner'), hint: T('Põe 60% do capital e fica com metade do lucro.', 'Puts up 60% of the equity and takes half the profit.'), disabled: !!p.partner },
      { key: 'vender', label: T('Vender o projeto', 'Sell the project'), hint: T(`Recebes cerca de ${fmtM(saleValue(s, p), 'pt')}.`, `You get about ${fmtM(saleValue(s, p), 'en')}.`) },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Completion

function complete(s: GameState, p: Project, rules: Rules) {
  const site = SITES_BY_ID[p.site];
  const d = p.deal!;
  let cash = d.mineM - d.hardM * p.costOverrun * mineOf(site);
  let exit = p.prog.exit;
  if (exit === 'al' && (rules.alFrozen || rules.alClosed.includes(site.fr))) {
    // The registration is refused at the end: sell instead, at a sale price.
    const e = econAt(s.month);
    cash -= (d.revenueM - d.revenueM / e.al) * (p.partner ? 1 - p.partner : 1);
    exit = 'venda';
    p.prog = { ...p.prog, exit };
    news(s, { head: T(`Sem registo de alojamento local, ${nameOf(p).pt} vai para venda`, `Refused a short-let registration, ${nameOf(p).en} goes on sale`), real: false, project: p.id });
  }
  s.cash += cash;
  const units = d.units, aff = d.affUnits;
  p.built += units;
  if (exit === 'al') {
    s.stats.al += units;
    s.standing = clamp(s.standing - 3, 0, 100);
  } else {
    s.stats.homes += units;
    s.stats.aff += aff;
    if (exit === 'arrendamento') s.stats.rental += units;
    s.stats.byYear[yearOf(s.month)] = (s.stats.byYear[yearOf(s.month)] ?? 0) + units;
    s.standing = clamp(s.standing + (aff / units >= 0.25 ? 3 : 1), 0, 100);
  }
  const what = exit === 'al'
    ? T(`${units} apartamentos de alojamento local`, `${units} short-let flats`)
    : T(`${units} casas${aff ? `, ${aff} a renda acessível` : ''}`, `${units} homes${aff ? `, ${aff} affordable` : ''}`);
  log(s, inNamed(p, `chaves entregues: ${what.pt}. ${cash >= 0 ? 'Recebes' : 'Perdes'} ${fmtM(Math.abs(cash), 'pt')}.`, `keys handed over: ${what.en}. You ${cash >= 0 ? 'receive' : 'lose'} ${fmtM(Math.abs(cash), 'en')}.`), p.id, 'good');
  news(s, { head: T(`Novas casas em ${FREGUESIAS[site.fr].name}: ${what.pt}`, `New homes in ${FREGUESIAS[site.fr].name}: ${what.en}`), real: false, project: p.id });
  p.deal = undefined;
  if (site.mega && p.phase < site.mega.phases - 1) {
    p.phase++;
    p.repaid = p.spent;
    p.finWait = 0;
    enter(s, p, 'fin');
    return;
  }
  p.stage = 'done';
  p.finished = s.month;
  s.stats.completed++;
  s.stats.monthsToKeys.push(s.month - p.filed);
}

// ---------------------------------------------------------------------------------------------
// Resolving decisions

export function resolve(s: GameState, id: number, key: string) {
  const i = s.decisions.findIndex((d) => d.id === id);
  if (i < 0) return;
  const d = s.decisions[i];
  const opt = d.options.find((o) => o.key === key);
  if (!opt || opt.disabled) return;
  s.decisions.splice(i, 1);
  if (opt.costM) s.cash -= opt.costM;
  const p = d.project != null ? projectById(s, d.project) : undefined;
  if (p && opt.costM) p.spent += opt.costM;
  if (d.kind.startsWith('card:')) return resolveCard(s, d, key);
  if (d.kind.startsWith('story:')) return resolveStory(s, d, key);
  if (d.kind === 'review' || d.kind === 'info') return;
  if (!p || !isLive(p)) return;
  const site = SITES_BY_ID[p.site];
  const fr = FREGUESIAS[site.fr];
  const r = s.rng;
  switch (d.kind) {
    case 'pip':
      if (key === 'cortar') { reprogram(s, p, { ...p.prog, scheme: 'base', floors: site.floors }); p.once.pipOk = true; proceed(s, p); }
      else if (key === 'avancar') { p.once.pipBad = true; proceed(s, p); }
      else kill(s, p, T('desististe depois da informação prévia.', 'you walked away after the prior information.'));
      return;
    case 'heritage': {
      const cut = Number(d.data?.cut);
      if (key === 'aceitar') { cutFloors(s, p, cut); endOfStage(s, p, rulesAt(s.month), site); }
      else if (key === 'redesenhar') { p.once.her = false; p.once.herSoft = true; p.left = randInt(r, 3, 4); }
      else { p.once.herAppeal = true; p.once.herWin = chance(r, 0.35); p.vars.herCut = cut; p.left = randInt(r, 8, 14); }
      return;
    }
    case 'refused':
      if (key === 'rever') { cutFloors(s, p, Math.max(fr.ctx, p.prog.floors - 1)); p.left = 3; }
      else if (key === 'tribunal') {
        p.left = randInt(r, 14, 24);
        p.once.doomed = !chance(r, 0.35);
        log(s, inNamed(p, 'impugnação em curso no tribunal administrativo.', 'challenge under way in the administrative court.'), p.id);
      } else kill(s, p, T('indeferido.', 'refused.'));
      return;
    case 'tacit':
      if (key === 'invocar') {
        p.tacit = true;
        p.once.her = true;
        p.once.staff = true;
        s.standing = clamp(s.standing - 1, 0, 100);
        log(s, inNamed(p, 'invocaste o deferimento tácito.', 'you claimed tacit approval.'), p.id);
        proceed(s, p);
      }
      return;
    case 'camara':
    case 'agenda': {
      if (key === 'adiar') {
        p.once.adiado = true;
        p.mult.viz *= 0.9; p.mult.hab *= 0.9; s.standing = clamp(s.standing + 1, 0, 100);
        p.left = 2;
        return;
      }
      if (key === 'esperar') { p.mult.viz *= 0.92; p.mult.hab *= 0.92; p.left = 3; return; }
      if (key === 'desistir') return kill(s, p, T('o executivo nunca o levou a votos.', 'the executive never tabled it.'));
      if (key.startsWith('deal:')) {
        const bloc = key.slice(5);
        applyDeal(s, p, d, bloc);
        return runVote(s, p, { deals: [bloc] });
      }
      if (key === 'cash') return runVote(s, p, { benefits: true });
      return runVote(s, p, {});
    }
    case 'hold':
      if (key === 'desistir') kill(s, p, T('cansaste-te de esperar pelas eleições.', 'you tired of waiting for the election.'));
      return;
    case 'vote':
      if (d.data?.passed) return proceed(s, p);
      if (key === 'voltar') {
        cutFloors(s, p, Math.max(fr.ctx, p.prog.floors - 1));
        if (!site.municipal && p.prog.aff < 0.5) reprogram(s, p, { ...p.prog, aff: p.prog.aff < 0.25 ? 0.25 : 0.5 });
        p.mult.viz *= 0.85; p.mult.hab *= 0.85;
        p.left = 4;
        return;
      }
      return kill(s, p, T('chumbado em Câmara.', 'voted down by the Câmara.'));
    case 'suit':
      if (!p.suit) return;
      if (key === 'acordo') {
        p.once.settled = true;
        p.suit.left = 2;
        p.suit.suspends = false;
        if (p.suit.by === 'viz' && p.prog.floors > fr.ctx && site.kind !== 'reab') cutFloors(s, p, p.prog.floors - 1);
        s.standing = clamp(s.standing + 1, 0, 100);
      }
      return;
    case 'annulled':
      if (key === 'refazer') {
        cutFloors(s, p, Math.max(fr.ctx, p.prog.floors - 2));
        for (const k of ['did_arq', 'did_camara', 'did_discussao', 'did_esp', 'did_alvara', 'her', 'staff']) delete p.once[k];
        p.licensed = undefined;
        p.tacit = false;
        enter(s, p, 'arq');
      } else kill(s, p, T('licença anulada.', 'licence annulled.'));
      return;
    case 'tenants': {
      p.once.tenants = true;
      const n = Number(d.data?.n);
      if (key === 'negociar') { p.mult.hab *= 0.85; p.left += 3; }
      else if (key === 'despejo') {
        p.once.evicted = true;
        p.vars.evictedM = s.month;
        p.mult.hab *= 1.6;
        s.standing = clamp(s.standing - 6, 0, 100);
        news(s, { head: T(`Despejos em ${fr.name}: ${n} famílias recebem cartas para sair`, `Evictions in ${fr.name}: ${n} households told to leave`), real: false, project: p.id });
        if (chance(r, rulesAt(s.month).tenantShield)) {
          p.suit = { left: randInt(r, 6, 14), suspends: true, by: 'hab' };
          s.stats.lawsuits++;
          log(s, inNamed(p, 'os inquilinos contestaram em tribunal; a obra fica à espera.', 'the tenants went to court; works must wait.'), p.id, 'bad');
        }
      } else {
        p.once.kept = true;
        p.mult.hab *= 0.6;
        s.standing = clamp(s.standing + 4, 0, 100);
        p.units = Math.max(1, p.units - n);
        p.affUnits = Math.min(p.affUnits, p.units);
      }
      return;
    }
    case 'pencil':
      if (key === 've') { p.veDone = true; p.finWait = 0; }
      else if (key === 'menosaff') {
        reprogram(s, p, { ...p.prog, aff: Math.max(0, p.prog.aff >= 0.5 ? 0.25 : p.prog.aff >= 0.25 ? 0.1 : 0) });
        p.mult.hab *= 1.2;
        s.standing = clamp(s.standing - 2, 0, 100);
        p.stage = 'alvara';
        p.left = randInt(r, 3, 5);
        p.inStage = 0;
        p.finWait = 0;
        p.hist.push({ m: s.month, stage: 'alvara' });
      } else if (key === 'vender') sellProject(s, p.id);
      else if (key === 'desistir') kill(s, p, T('as contas não fecharam.', 'the numbers never worked.'));
      return;
    case 'capital':
      if (key === 'socio') { p.partner = 0.5; p.finWait = 0; log(s, inNamed(p, 'um fundo entra como sócio.', 'a fund comes in as partner.'), p.id); }
      else if (key === 'vender') sellProject(s, p.id);
      return;
  }
}

export function reprogram(s: GameState, p: Project, prog: Program) {
  const site = SITES_BY_ID[p.site];
  const before = p.units;
  p.prog = prog;
  p.units = unitsOf(site, prog.floors) - (p.once.kept ? site.tenants ?? 0 : 0);
  p.affUnits = Math.round(p.units * prog.aff);
  if (p.units < before) s.stats.unitsLost += before - p.units;
}

export function cutFloors(s: GameState, p: Project, floors: number) {
  if (floors >= p.prog.floors) return;
  reprogram(s, p, { ...p.prog, floors });
}

// ---------------------------------------------------------------------------------------------
// The month

export function tick(s: GameState) {
  if (s.over || s.decisions.length) return;
  s.month++;

  for (const ev of TIMELINE) {
    if (monthOf(ev.y, ev.m) !== s.month) continue;
    news(s, { head: ev.head, body: ev.body, game: ev.game, real: !ev.spec, source: ev.source, major: ev.major });
    if (ev.pause) for (const p of s.projects) if (usesTeam(p)) p.left += ev.pause;
  }

  s.cash -= 0.035 + 0.025 * Math.max(0, s.teams - START_TEAMS);
  if (s.cash < 0) s.cash *= 1.006;

  for (const p of s.projects) if (isLive(p)) stepProject(s, p);

  pressMonth(s);
  if (!s.decisions.some((d) => d.kind.startsWith('story:'))) politicalWeather(s);
  investorReview(s);
  if (s.cash < DEBT_LIMIT) {
    s.over = { kind: 'broke', m: s.month };
    log(s, T('Os bancos executaram as garantias.', 'The banks called in the guarantees.'), undefined, 'bad');
  }
  // The last review falls on the last month: passing it wins the game.
  if (!s.over && s.month >= END_MONTH) s.over = { kind: s.seen.lastReviewPassed ? 'won' : 'survived', m: s.month };
}

function investorReview(s: GameState) {
  const r = REVIEWS[s.review.i];
  if (!r || s.month < r.m) return;
  const need = targetOf(r, s.difficulty);
  const have = measure(s, r.kind);
  const final = s.review.i === REVIEWS.length - 1;
  s.review.i++;
  const what = r.kind === 'licensed' ? T('projeto licenciado', 'licensed project') : r.kind === 'started' ? T('casas em obra', 'homes started') : T('casas construídas', 'homes built');
  if (have >= need) {
    s.review.passed++;
    s.seen.lastReviewPassed = true;
    if (!final) s.cash += 3;
    decide(s, {
      kind: 'review', tone: 'good',
      title: T('Revisão do fundo: aprovada', 'Fund review: passed'),
      lines: [
        T(`Meta: ${need} ${what.pt}. Tens ${have}.`, `Target: ${need} ${what.en}. You have ${have}.`),
        final ? T('Chegaste às autárquicas de 2029 com as contas em dia.', 'You reached the 2029 local elections on target.') : T('O fundo liberta mais 3 M€.', 'The fund releases another €3M.'),
      ],
      options: [{ key: 'ok', label: T('Continuar', 'Continue') }],
    });
  } else {
    s.review.strikes++;
    s.seen.lastReviewPassed = false;
    const max = DIFFICULTY[s.difficulty].strikes;
    const out = s.review.strikes >= max;
    decide(s, {
      kind: 'review', tone: 'bad',
      title: out ? T('O fundo retira-se', 'The fund pulls out') : T('Revisão do fundo: aviso', 'Fund review: strike'),
      lines: [
        T(`Meta: ${need} ${what.pt}. Tens ${have}.`, `Target: ${need} ${what.en}. You have ${have}.`),
        out ? T('Sem mais capital, a promotora fecha portas.', 'With no more capital, the company closes.') : T(`Aviso ${s.review.strikes} de ${max}.`, `Strike ${s.review.strikes} of ${max}.`),
      ],
      options: [{ key: 'ok', label: T('Continuar', 'Continue') }],
    });
    if (out) s.over = { kind: 'fired', m: s.month };
  }
}

// ---------------------------------------------------------------------------------------------
// Formatting helpers shared with the UI

export const pct = (x: number) => `${Math.round(x * 100)}%`.replace('-', '\u2212');

export function fmtM(m: number, lang: 'pt' | 'en'): string {
  const a = Math.abs(m);
  const sign = m < 0 ? '−' : '';
  const s = a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : (a * 1000).toFixed(0);
  const unit = a >= 1 ? (lang === 'pt' ? ' M€' : 'M') : lang === 'pt' ? ' mil €' : 'K';
  const num = lang === 'pt' ? s.replace('.', ',') : s;
  return lang === 'pt' ? `${sign}${num}${unit}` : `${sign}€${num}${unit}`;
}

export { fmtMonth, buildType };
export const randomSeed = () => Math.floor(rand(makeRng(Date.now() >>> 0)) * 2 ** 31);
