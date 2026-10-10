// The development economy: what it costs to build, what a finished home is worth, and
// whether a bank will lend on it. Money is in €M, areas in m², unit prices in €/m².
import { AFF_RENT, AL, COST, EURIBOR, at } from '../data/economia';
import { FREGUESIAS } from '../data/freguesias';
import { priceM2, rentM2 } from '../data/precos';
import type { Econ, Program, Rules, Site } from './types';
import { yearFrac } from './time';

/** Gross floor area (ABC) per home, common areas included. */
export const M2_PER_HOME = 95;
/** Share of the gross floor area that is sold or let. */
export const NET = 0.8;

export const econAt = (month: number): Econ => ({
  euribor: at(EURIBOR, month),
  cost: at(COST, month),
  al: at(AL, month),
  affRent: at(AFF_RENT, month),
});

/** The return lenders and the fund want on cost before construction starts. */
export const requiredMargin = (euribor: number) => 0.13 + Math.max(0, euribor - 1) * 0.012;

/** Rehab and conversions keep the existing building; new floors are an extension. */
export const keepsBuilding = (site: Site) => site.kind === 'reab' || site.kind === 'escritorio';

export function abcOf(site: Site, floors: number): number {
  return Math.round(site.lot * site.cov * floors);
}

export function unitsOf(site: Site, floors: number): number {
  return Math.max(2, Math.round(abcOf(site, floors) / M2_PER_HOME));
}

/** What a new (or newly rehabilitated) home sells for, €/m² of saleable area. */
export function saleM2(site: Site, month: number, floors: number): number {
  const base = priceM2(site.fr, yearFrac(month));
  const kind = site.kind === 'reab' ? 1.2 : site.kind === 'escritorio' ? 1.15 : 1.3;
  const river = site.river ? 1.06 : 1;
  const tall = floors >= 16 ? 1.1 : floors >= 9 ? 1.05 : 1;
  return base * kind * river * tall;
}

/** The yield an investor pays for a let building; it rises with rates. */
export const rentYield = (euribor: number) => 0.045 + 0.004 * Math.max(0, euribor);

/** Long-term rent, capitalised: €/m² of saleable area. */
export function rentalM2(site: Site, month: number, e: Econ): number {
  return (rentM2(site.fr, yearFrac(month)) * 12 * 0.85) / rentYield(e.euribor) * (site.kind === 'reab' ? 1.05 : 1.1);
}

/**
 * Capped rent, capitalised: what an affordable home is worth to whoever owns it. Decades of
 * regulated rent, management and maintenance carry a risk premium, which is why the city's
 * affordable-rent concessions drew so few bidders.
 */
export const affordableM2 = (e: Econ) => (e.affRent * 12 * 0.75) / (rentYield(e.euribor) + 0.004);

export type BuildType = { key: string; label: { pt: string; en: string }; costM2: number; months: [number, number] };

export function buildType(site: Site, floors: number): BuildType {
  if (site.kind === 'escritorio') return { key: 'conv', label: { pt: 'Conversão de escritórios', en: 'Office conversion' }, costM2: 620, months: [12, 16] };
  if (site.kind === 'reab') return { key: 'reab', label: { pt: 'Reabilitação', en: 'Rehabilitation' }, costM2: 980, months: [14, 20] };
  if (floors <= 4) return { key: 'baixo', label: { pt: 'Prédio baixo', en: 'Low-rise' }, costM2: 820, months: [16, 20] };
  if (floors <= 8) return { key: 'medio', label: { pt: 'Prédio de média altura', en: 'Mid-rise' }, costM2: 860, months: [20, 26] };
  if (floors <= 15) return { key: 'alto', label: { pt: 'Edifício alto', en: 'High-rise' }, costM2: 960, months: [26, 32] };
  return { key: 'torre', label: { pt: 'Torre', en: 'Tower' }, costM2: 1060, months: [30, 38] };
}

/** Land, priced as what is left once a buyer has paid to build and taken a margin. */
export function landPrice(site: Site, month: number, rules: Rules): number {
  if (site.municipal) return 0; // a surface right, not a sale
  const e = econAt(month);
  if (site.landM != null) return +(site.landM * Math.max(0.8, priceM2(site.fr, yearFrac(month)) / priceM2(site.fr, 2015))).toFixed(2);
  const abc = abcOf(site, site.floors);
  const value = saleM2(site, month, site.floors) * NET;
  const cost = buildType(site, site.floors).costM2 * e.cost * (1.12 + (keepsBuilding(site) ? rules.ivaReab : rules.ivaNew)) + 70 * e.cost;
  // Competing buyers bid the land up until little more than the required margin is left.
  const residual = Math.max(value * 0.12, (value / (1 + requiredMargin(e.euribor)) - cost) * 0.9);
  return +((abc * residual) / 1e6).toFixed(2);
}

export interface ProForma {
  units: number;
  affUnits: number;
  abc: number;
  type: BuildType;
  valueM2: number;
  revenueM: number;
  hardM: number;
  softM: number;
  ivaM: number;
  feesM: number;
  landM: number;
  interestM: number;
  sunkM: number;
  grantM: number;
  costM: number;
  profitM: number;
  margin: number;
  required: number;
  pencils: boolean;
  /** Cash the developer must put in at groundbreaking. */
  equityM: number;
  euribor: number;
}

export interface ProFormaOpts {
  landM?: number;
  spent?: number;
  /** Fraction of the program this phase builds. */
  share?: number;
  ve?: boolean;
  overrun?: number;
  months?: number;
}

export function proForma(site: Site, prog: Program, month: number, rules: Rules, o: ProFormaOpts = {}): ProForma {
  const e = econAt(month);
  const share = o.share ?? 1;
  const allUnits = unitsOf(site, prog.floors);
  const units = Math.max(1, Math.round(allUnits * share));
  const affUnits = Math.round(units * prog.aff);
  const abc = abcOf(site, prog.floors) * share;
  const type = buildType(site, prog.floors);

  const small = allUnits < 12 ? 1.15 : 1;
  const base = (site.costM2 ?? type.costM2) * small;
  // An extension on top of an existing building costs like new construction.
  const hardM2 = base * e.cost * (o.ve ? 0.93 : 1) * (1 + (o.overrun ?? 0));
  let hardM = (abc * hardM2) / 1e6;
  if (site.toxic) hardM += (site.lot * 220 * e.cost * share) / 1e6;
  const softM = hardM * 0.12;
  const affShare = affUnits / units;
  const vatRate = keepsBuilding(site) ? rules.ivaReab : rules.ivaNew;
  // Housing at controlled cost pays the reduced rate; homes sold on the market do not recover VAT.
  const ivaM = hardM * (vatRate * (1 - affShare) + 0.06 * affShare);
  const feesM = ((abc * 70 * e.cost * rules.fees) / 1e6) * (1 - 0.5 * affShare);
  const landM = (o.landM ?? landPrice(site, month, rules)) * share;
  const months = o.months ?? (type.months[0] + type.months[1]) / 2;
  const loan = 0.7 * (hardM + softM + ivaM + feesM);
  const interestM = loan * ((Math.max(0, e.euribor) + 3) / 100) * (months / 12) * 0.55;
  const sunkM = Math.max(0, o.spent ?? 0) * share;

  const valueM2 = prog.exit === 'arrendamento' ? rentalM2(site, month, e) : prog.exit === 'al' ? saleM2(site, month, prog.floors) * e.al : saleM2(site, month, prog.floors);
  const netArea = abc * NET;
  const marketArea = netArea * (1 - affShare);
  const affArea = netArea * affShare;
  const grantM = rules.prrK > 0 ? (affUnits * rules.prrK) / 1000 : 0;
  const revenueM = (marketArea * valueM2 + affArea * affordableM2(e)) / 1e6 + grantM;

  const costM = hardM + softM + ivaM + feesM + landM + interestM + sunkM;
  const profitM = revenueM - costM;
  const margin = profitM / costM;
  const required = requiredMargin(e.euribor);
  // Banks lend most of the cost and buyers' off-plan deposits fund much of the rest.
  const equityM = Math.max(0, 0.2 * (hardM + softM + ivaM + feesM) + landM * 0.3 - sunkM);
  return {
    units, affUnits, abc, type, valueM2, revenueM, hardM, softM, ivaM, feesM, landM, interestM, sunkM, grantM,
    costM, profitM, margin, required, pencils: margin >= required, equityM, euribor: e.euribor,
  };
}

/** The parish's context, for the UI. */
export const parishOf = (site: Site) => FREGUESIAS[site.fr];
