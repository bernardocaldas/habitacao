// The game's vocabulary. Everything in GameState is plain data (no functions, no classes),
// so a game saves to localStorage as JSON and replays exactly from its seed.
import type { Rng } from './rng';

export type Lang = 'pt' | 'en';
/** A bilingual string. Portuguese is written to the reader as "tu"; English is en-GB. */
export interface L {
  pt: string;
  en: string;
}

// ---------------------------------------------------------------------------------------------
// Places

export interface Freguesia {
  code: string; // DICOFRE, CAOP 2021
  name: string;
  /** Typical height of what is already there, in floors: what "out of scale" is measured against. */
  ctx: number;
  /** 0..1 strength of residents' associations and heritage campaigners against height and density. */
  viz: number;
  /** 0..1 strength of the right-to-housing movement: against evictions, short lets and luxury. */
  hab: number;
  /** 0..1 how much of the parish sits in heritage protection zones (ZEP, classified ensembles). */
  heritage: number;
  /** The historic centre, where short-let demand and archaeology both concentrate. */
  centro?: boolean;
  river?: boolean;
  /** Census 2021 (INE), via the estimador.pt synthetic population v1.0.3. */
  pop: number;
  households: number;
}

export type SiteKind =
  | 'lote' // vacant or underused lot: new build
  | 'reab' // old building to rehabilitate
  | 'armazem' // former industrial land: needs a loteamento or a plan
  | 'escritorio' // offices to convert
  | 'municipal' // city land offered by tender, affordable only
  | 'grande'; // a whole district, built in phases with a fund partner

export interface Site {
  id: string;
  fr: string; // parish code
  lon: number;
  lat: number;
  kind: SiteKind;
  name: L;
  /** What is there now. */
  was: L;
  pitch: L;
  /** Lot area, m². */
  lot: number;
  /** Building footprint as a share of the lot. */
  cov: number;
  /** Floors the plan (PDM) and the street's prevailing height allow without asking for more. */
  floors: number;
  /** The most the city could ever accept, through a detailed plan or an exception. */
  maxFloors: number;
  /** 0..1 heritage sensitivity: protection zone, classified neighbour, archaeology under the floor. */
  heritage?: number;
  /** Households living there on old leases (rehab only). */
  tenants?: number;
  river?: boolean;
  /** Contaminated soil (old gasworks, fuel depots): remediation before anything else. */
  toxic?: boolean;
  /** Inside an approved detailed plan or allotment: prior notice (comunicação prévia) instead of a licence. */
  plan?: boolean;
  /** Municipal land let on a surface right; homes at capped rent only. */
  municipal?: { scheme: 'pra' | 'coop' };
  /** A district built in phases; a fund puts up most of the equity and keeps most of the profit. */
  mega?: { phases: number; share: number };
  from?: [number, number];
  until?: [number, number];
  /** Asking price in €M at 2015 values; otherwise the land is priced as a residual. */
  landM?: number;
  /** Hard cost override, €/m² at 2015 values. */
  costM2?: number;
}

// ---------------------------------------------------------------------------------------------
// Proposals

export type Exit = 'venda' | 'arrendamento' | 'al';
/** base: what the plan allows; bonus: extra floors for affordable homes; plano: a plan or exception for more. */
export type Scheme = 'base' | 'bonus' | 'plano';

export interface Program {
  scheme: Scheme;
  floors: number;
  /** Share of the homes let at capped rent (renda acessível), 0..1. */
  aff: number;
  exit: Exit;
  /** File a prior information request (PIP) first. */
  pip: boolean;
}

export type Stage =
  | 'pip' // pedido de informação prévia
  | 'plano' // a detailed plan or exception, before any licence
  | 'arq' // architecture review (licenciamento)
  | 'cp' // prior notice (comunicação prévia)
  | 'discussao' // public consultation
  | 'camara' // waiting for the Câmara's vote
  | 'esp' // engineering projects (especialidades)
  | 'alvara' // fees and the building permit
  | 'fin' // looking for a construction loan
  | 'obra' // under construction
  | 'done'
  | 'dead'
  | 'sold';

export const PRE_CONSTRUCTION: Stage[] = ['pip', 'plano', 'arq', 'cp', 'discussao', 'camara', 'esp', 'alvara'];
export const LIVE: Stage[] = [...PRE_CONSTRUCTION, 'fin', 'obra'];

export interface Path {
  route: 'cp' | 'lic' | 'plano';
  pip: boolean;
  /** Binding opinion from the heritage authority. */
  heritage: boolean;
  /** Port and river authorities (APL, APA). */
  river: boolean;
  /** Public consultation (allotments, plans). */
  discussao: boolean;
  /** Needs a vote of the 17-member Câmara. */
  camara: boolean;
  /** Needs the Assembleia Municipal too (plans). */
  assembleia: boolean;
  tenants: boolean;
}

export interface Project {
  id: number;
  site: string;
  prog: Program;
  units: number;
  affUnits: number;
  abc: number; // gross floor area, m²
  path: Path;
  stage: Stage;
  /** Months left in the current stage. */
  left: number;
  /** Months spent in the current stage. */
  inStage: number;
  filed: number;
  licensed?: number;
  broke?: number;
  finished?: number;
  /** Land price locked at purchase, €M. */
  landM: number;
  /** Money spent so far on studies, fees, lawyers and carry, €M. Repaid by the construction loan. */
  spent: number;
  repaid: number;
  mult: { viz: number; hab: number };
  /** One-off markers (each mishap happens at most once per project). */
  once: Record<string, boolean>;
  /** Numbers a pending outcome needs later (a floor limit under appeal). */
  vars: Record<string, number>;
  /** A pending court case: months left, and whether it suspends the licence. */
  suit?: { left: number; suspends: boolean; by: 'viz' | 'hab' | 'mp' };
  /** Units already delivered (phased districts). */
  built: number;
  phase: number;
  /** Months the city has been late (Simplex deadlines). */
  late: number;
  tacit?: boolean;
  /** Elements requested by the city so far. */
  asks: number;
  hist: { m: number; stage: Stage }[];
  costOverrun: number;
  veDone?: boolean;
  /** Locked at groundbreaking: off-plan sales fix the price, the bank fixes the loan. */
  deal?: { revenueM: number; loanM: number; mineM: number; profitM: number; hardM: number; units: number; affUnits: number };
  /** Share of the profit a partner fund takes, when one was brought in. */
  partner?: number;
  /** Months until the next "does not add up" review. */
  finWait?: number;
  /** A newspaper story about this project: while it runs, councillors keep their distance. */
  story?: { kind: string; m: number; until: number; sev: number };
  /** A prosecutor's inquiry: the bank waits until it closes. */
  inquiry?: { left: number };
  /** Community sessions held. */
  meetings: number;
}

// ---------------------------------------------------------------------------------------------
// Rules, politics, the economy

export interface Rules {
  /** Multiplier on review times at the city. */
  plan: number;
  /** Monthly chance the city asks for more elements while reviewing architecture. */
  asks: number;
  /** Simplex Urbanístico: one request for elements only, legal deadlines, tacit approval. */
  simplex: boolean;
  /** A building permit (alvará) is still issued as a separate step. */
  alvara: boolean;
  /** Short lets: parishes where new registrations are refused. */
  alClosed: string[];
  /** Short lets frozen nationwide outside low-density areas. */
  alFrozen: boolean;
  /** VAT on new-build construction for housing (the rate the developer cannot recover). */
  ivaNew: number;
  /** VAT on rehabilitation inside urban rehabilitation areas (ARU). */
  ivaReab: number;
  /** Extra floors the city grants for at least 25% affordable homes. */
  affBonus: number;
  /** Municipal tenders: sites let on surface rights for capped rents. */
  tenders: 'none' | 'pra' | 'coop';
  /** Grants per affordable home under the recovery plan (PRR / 1.º Direito), €K; 0 when closed. */
  prrK: number;
  /** Months of construction left that still count before the recovery-plan deadline. */
  prrDeadline: number;
  /** Labour shortage: multiplier on construction time. */
  labour: number;
  /** Municipal fees (TRIU and compensations) multiplier. */
  fees: number;
  /** Legal tenant protection: how hard it is to empty a building for works. */
  tenantShield: number;
  /** Change of use from offices to housing without a licence. */
  convFree: boolean;
}

export interface Seat {
  bloc: string; // key into BLOCS
  lean: number; // -1..1, toward approving private projects
}

export interface Econ {
  euribor: number; // %, 12-month
  cost: number; // construction cost index, 2015 = 1
  al: number; // short-let value relative to a sale
  affRent: number; // capped rent, €/m²/month
}

// ---------------------------------------------------------------------------------------------
// Decisions and news

export interface Option {
  key: string;
  label: L;
  hint?: L;
  costM?: number;
  disabled?: boolean;
}

export type Ballot = 'sim' | 'abst' | 'nao';

/** How one party or list is likely to vote on a project, and why. */
export interface Stance {
  bloc: string;
  seats: number;
  /** The mayor's own list, which also sets the agenda. */
  mayor: boolean;
  x: number;
  pYes: number;
  pAbst: number;
  pNo: number;
  /** The strongest reasons, signed (positive pulls toward yes), strongest first. */
  why: { label: L; w: number }[];
}

/** A roll call: each list votes as one; more yes than no passes, the mayor breaks a tie. */
export interface Vote {
  body: 'camara';
  blocs: (Stance & { ballot: Ballot })[];
  yes: number;
  abst: number;
  no: number;
  passed: boolean;
  /** Passed on the mayor's casting vote. */
  casting: boolean;
}

export interface Decision {
  id: number;
  kind: string;
  project?: number;
  title: L;
  lines: L[];
  options: Option[];
  /** Probability of the good outcome, shown before the choice when there is one. */
  odds?: { label: L; p: number }[];
  vote?: Vote;
  /** Each list's likely vote, shown before the choice. */
  stances?: Stance[];
  /** A front page: the (invented) paper, its headline and lede. */
  press?: { paper: string; head: L; lede: L };
  real?: L;
  tone?: 'good' | 'bad' | 'neutral';
  data?: Record<string, number | string | boolean>;
}

export interface NewsItem {
  m: number;
  head: L;
  body?: Partial<L>;
  /** What it changes in the game. */
  game?: L[];
  real: boolean;
  source?: string;
  major?: boolean;
  project?: number;
  /** The invented paper that ran a story about you. */
  paper?: string;
}

export interface LogItem {
  m: number;
  text: L;
  project?: number;
  tone?: 'good' | 'bad' | 'neutral';
}

export interface Stats {
  homes: number;
  aff: number;
  rental: number;
  al: number;
  completed: number;
  killed: number;
  sold: number;
  lawsuits: number;
  asks: number;
  votesWon: number;
  votesLost: number;
  stories: number;
  inquiries: number;
  monthsToKeys: number[];
  unitsLost: number;
  byYear: Record<number, number>;
}

export type Difficulty = 'facil' | 'normal' | 'dificil';

export interface GameState {
  v: number;
  seed: number;
  rng: Rng;
  difficulty: Difficulty;
  month: number;
  cash: number; // €M
  teams: number;
  standing: number; // 0..100
  projects: Project[];
  nextId: number;
  taken: Record<string, number>; // site → project id
  cool: Record<string, number>; // site → month it reopens
  decisions: Decision[];
  news: NewsItem[];
  log: LogItem[];
  review: { i: number; strikes: number; passed: number };
  weather: { next: number; last: Record<string, number> };
  /** The next month a newspaper may run a story about you. */
  press: { next: number };
  stats: Stats;
  over?: { kind: 'fired' | 'broke' | 'survived' | 'won'; m: number };
  seen: Record<string, boolean>;
}
