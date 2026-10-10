// Who objects, and how loudly. Two constituencies, each tied to a design lever:
//   viz  residents' associations and heritage campaigners: height, bulk, demolition
//   hab  the right-to-housing movement: evictions, short lets, luxury, too few affordable homes
// Heat runs 0..~120. Standing (0..100) cools or inflames all of it.
import { FREGUESIAS } from '../data/freguesias';
import type { Program, Site } from './types';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface Heat {
  viz: number;
  hab: number;
  opp: number;
  support: number;
  over: number;
}

export function heatFor(site: Site, prog: Program, units: number, standing: number, mult = { viz: 1, hab: 1 }): Heat {
  const fr = FREGUESIAS[site.fr];
  const trustF = 1.25 - standing / 200;
  const over = Math.max(0, prog.floors - fr.ctx) / Math.max(2.5, fr.ctx);
  const size = clamp(Math.log10(Math.max(2, units)) / 3, 0.2, 1.1);
  const allAff = prog.aff >= 0.99;

  let v = 0.2 + 0.42 * Math.min(1, over / 1.5) + 0.3 * size;
  if (site.heritage) v += 0.15 * site.heritage;
  if (site.river) v += 0.08;
  if (site.kind === 'reab' || site.kind === 'escritorio') v *= prog.floors > site.floors ? 0.7 : 0.35;
  const viz = 100 * fr.viz * Math.min(1.2, v) * trustF * mult.viz;

  const short = allAff ? 0 : clamp((0.25 - prog.aff) / 0.25, 0, 1);
  let h = 0.22 + 0.18 * size + 0.4 * short;
  if (site.tenants) h += 0.35;
  if (prog.exit === 'al') h += 0.45;
  if (fr.centro && prog.exit === 'venda' && !prog.aff) h += 0.08;
  if (allAff) h *= 0.15;
  else if (prog.aff >= 0.25) h *= 0.75;
  const hab = 100 * fr.hab * h * trustF * mult.hab;

  const top = Math.max(viz, hab), second = Math.min(viz, hab);
  const opp = top + 0.3 * second;
  const support = (prog.aff >= 0.25 ? 12 : 0) + (allAff ? 16 : 0) + (prog.exit === 'arrendamento' ? 6 : 0) + Math.max(0, standing - 50) / 5;
  return { viz, hab, opp, support, over };
}

export type HeatLevel = 'calmo' | 'atento' | 'zangado' | 'furioso';
export const heatLevel = (h: number): HeatLevel => (h < 15 ? 'calmo' : h < 35 ? 'atento' : h < 60 ? 'zangado' : 'furioso');
