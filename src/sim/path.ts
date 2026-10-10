// The road a proposal takes, fixed when it is filed, and how long each step usually lasts.
import { FREGUESIAS } from '../data/freguesias';
import { buildType, unitsOf } from './econ';
import type { L, Path, Program, Rules, Site } from './types';

export function pathFor(site: Site, prog: Program, rules: Rules): Path {
  const units = unitsOf(site, prog.floors);
  const plano = prog.scheme === 'plano' || (site.kind === 'grande' && !site.plan);
  const conv = site.kind === 'escritorio' && rules.convFree && prog.floors <= site.floors;
  const route: Path['route'] = plano ? 'plano' : (site.plan && prog.scheme === 'base') || conv ? 'cp' : 'lic';
  const discussao = plano || site.kind === 'armazem' || site.kind === 'grande' || units >= 150;
  return {
    route,
    pip: prog.pip && route !== 'cp',
    heritage: (site.heritage ?? 0) >= 0.3,
    river: !!site.river && (site.kind === 'lote' || site.kind === 'armazem' || site.kind === 'grande'),
    discussao,
    camara: plano || discussao || !!site.municipal || units >= 60 || prog.scheme === 'bonus',
    assembleia: plano,
    tenants: (site.tenants ?? 0) > 0,
  };
}

export interface Step {
  key: string;
  label: L;
  lo: number;
  hi: number;
}

const ARQ = (units: number): [number, number] => (units <= 20 ? [7, 12] : units <= 100 ? [10, 16] : [13, 20]);

/** Base months for each step, before the city's mishaps. Used for previews and to draw durations. */
export function stepsFor(site: Site, prog: Program, path: Path, rules: Rules): Step[] {
  const units = unitsOf(site, prog.floors);
  const k = rules.plan;
  const s: Step[] = [];
  const r = (lo: number, hi: number, f = k): [number, number] => [Math.max(1, Math.round(lo * f)), Math.max(1, Math.round(hi * f))];
  if (path.pip) s.push({ key: 'pip', label: { pt: 'Pedido de informação prévia', en: 'Prior information request (PIP)' }, ...lohi(r(4, 7)) });
  if (path.route === 'plano') s.push({ key: 'plano', label: { pt: 'Plano de pormenor ou exceção', en: 'Detailed plan or exception' }, ...lohi(r(18, 30, Math.max(0.85, k))) });
  if (path.route === 'cp') s.push({ key: 'cp', label: { pt: 'Comunicação prévia', en: 'Prior notice' }, ...lohi(r(1, 3)) });
  else {
    const [a, b] = ARQ(units);
    let lo = a, hi = b;
    if (path.heritage) { lo += 3; hi += 6; }
    if (path.river) { lo += 1; hi += 3; }
    if (path.route === 'plano') { lo = Math.round(lo * 0.7); hi = Math.round(hi * 0.7); }
    s.push({ key: 'arq', label: { pt: 'Projeto de arquitetura', en: 'Architecture review' }, ...lohi(r(lo, hi)) });
  }
  if (path.discussao) s.push({ key: 'discussao', label: { pt: 'Discussão pública', en: 'Public consultation' }, lo: 1, hi: 2 });
  if (path.camara) s.push({ key: 'camara', label: { pt: 'Votação na Câmara', en: 'Câmara vote' }, lo: 1, hi: 3 });
  s.push({ key: 'esp', label: { pt: 'Especialidades', en: 'Engineering projects' }, ...lohi(r(3, 6)) });
  if (rules.alvara) s.push({ key: 'alvara', label: { pt: 'Taxas e alvará', en: 'Fees and permit' }, ...lohi(r(1, 3)) });
  const bt = buildType(site, prog.floors);
  s.push({ key: 'obra', label: { pt: `Obra: ${bt.label.pt.toLowerCase()}`, en: `Construction: ${bt.label.en.toLowerCase()}` }, lo: Math.round(bt.months[0] * rules.labour), hi: Math.round(bt.months[1] * rules.labour) });
  return s;
}

const lohi = ([lo, hi]: [number, number]) => ({ lo, hi });

/** Legal deadline for an architecture decision once the Simplex applies, in months. */
export const legalDeadline = (units: number) => (units <= 20 ? 4 : units <= 100 ? 5 : 7);

export const isOverScale = (site: Site, floors: number) => floors > FREGUESIAS[site.fr].ctx + 1;
