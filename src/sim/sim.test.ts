import { describe, expect, it } from 'vitest';
import geo from '../data/lisboa-freguesias.json';
import { FREGUESIAS } from '../data/freguesias';
import { MANDATES } from '../data/politics';
import { TIMELINE, UNMATCHED_EFFECTS } from '../data/timeline';
import { SITES } from '../data/sites';
import { autoplay } from './bot';
import { landPrice, proForma, unitsOf } from './econ';
import type { Program } from './types';
import { councilAt, rulesAt } from './rules';
import { defaultProgram, newGame, preview, fileProject, tick, resolve } from './sim';
import { END_MONTH, monthOf } from './time';
import { passProb } from './votes';

type Ring = number[][];
function inside(x: number, y: number, ring: Ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

describe('data', () => {
  it('has the 24 parishes of Lisbon, matching the geometry', () => {
    expect(Object.keys(FREGUESIAS)).toHaveLength(24);
    const codes = (geo as { features: { properties: { code: string } }[] }).features.map((f) => f.properties.code).sort();
    expect(codes).toEqual(Object.keys(FREGUESIAS).sort());
  });

  it('places every site inside its own parish', () => {
    const polys = Object.fromEntries((geo as { features: { properties: { code: string }; geometry: { coordinates: Ring[] } }[] }).features.map((f) => [f.properties.code, f.geometry.coordinates[0]]));
    for (const s of SITES) expect(inside(s.lon, s.lat, polys[s.fr]), s.id).toBe(true);
  });

  it('has unique site ids and sane sizes', () => {
    expect(new Set(SITES.map((s) => s.id)).size).toBe(SITES.length);
    for (const s of SITES) {
      expect(s.maxFloors, s.id).toBeGreaterThanOrEqual(s.floors);
      expect(unitsOf(s, s.floors), s.id).toBeGreaterThan(1);
    }
  });

  it('attaches every game effect to a researched, sourced event', () => {
    expect(UNMATCHED_EFFECTS).toEqual([]);
    for (const ev of TIMELINE) if (!ev.spec) expect(ev.source, ev.head.pt).toMatch(/^https?:\/\//);
  });

  it('seats 17 councillors in every mandate', () => {
    for (const md of MANDATES) {
      expect(Object.values(md.seats).reduce((a, b) => a + b, 0)).toBe(17);
      expect(councilAt(monthOf(Math.max(2015, md.from[0]), md.from[1]))).toHaveLength(17);
    }
  });
});

describe('votes', () => {
  it('computes the chance of a majority exactly', () => {
    expect(passProb(new Array(17).fill(1), 9)).toBeCloseTo(1);
    expect(passProb(new Array(17).fill(0), 9)).toBeCloseTo(0);
    expect(passProb(new Array(17).fill(0.5), 9)).toBeCloseTo(0.5);
    expect(passProb([0.5, 0.5], 1)).toBeCloseTo(0.75);
  });
});

describe('economy', () => {
  const at = (y: number) => monthOf(y, 6);
  const pf = (id: string, y: number, prog?: Partial<Program>) => {
    const site = SITES.find((s) => s.id === id)!;
    const r = rulesAt(at(y));
    return proForma(site, { ...defaultProgram(site), ...prog }, at(y), r, { landM: landPrice(site, at(y), r) });
  };

  it('prices land so that a new purchase earns about the required margin', () => {
    for (const y of [2015, 2019, 2023]) {
      const x = pf('arroios-garagem', y);
      expect(x.margin).toBeGreaterThan(x.required - 0.03);
      expect(x.margin).toBeLessThan(x.required + 0.12);
    }
  });

  it('rewards land bought before the boom', () => {
    const site = SITES.find((s) => s.id === 'arroios-garagem')!;
    const r = rulesAt(at(2019));
    const early = proForma(site, defaultProgram(site), at(2019), r, { landM: landPrice(site, at(2015), rulesAt(at(2015))) });
    expect(early.margin).toBeGreaterThan(pf('arroios-garagem', 2019).margin + 0.2);
  });

  it('makes affordable homes cost margin, and the bonus floor give some back', () => {
    const base = pf('arroios-garagem', 2019);
    const aff = pf('arroios-garagem', 2019, { aff: 0.25 });
    const bonus = pf('arroios-garagem', 2019, { aff: 0.25, scheme: 'bonus', floors: 7 });
    expect(aff.margin).toBeLessThan(base.margin);
    expect(bonus.margin).toBeGreaterThan(aff.margin);
  });

  it('leaves the city’s affordable-rent land short once rates rise', () => {
    expect(pf('marvila-municipal', 2023).pencils).toBe(false);
    expect(pf('marvila-municipal', 2023).margin).toBeLessThan(pf('marvila-municipal', 2019).margin);
  });

  it('keeps every number finite', () => {
    for (const site of SITES) for (const y of [2015, 2022, 2029]) for (const v of Object.values(pf(site.id, y))) if (typeof v === 'number') expect(Number.isFinite(v), site.id).toBe(true);
  });
});

describe('game', () => {
  it('files a project and moves it along', () => {
    const s = newGame(1);
    const site = SITES.find((x) => x.id === 'arroios-garagem')!;
    const pv = preview(s, site.id, defaultProgram(site));
    expect(pv.canFile).toBe(true);
    const p = fileProject(s, site.id, defaultProgram(site))!;
    expect(p.stage).toBe('arq');
    for (let i = 0; i < 40 && !s.over; i++) {
      while (s.decisions.length) resolve(s, s.decisions[0].id, s.decisions[0].options.find((o) => !o.disabled)!.key);
      tick(s);
    }
    expect(s.month).toBeGreaterThan(20);
  });

  it('plays to the end deterministically, with finite numbers', () => {
    const a = autoplay(42);
    const b = autoplay(42);
    expect(a.over).toBeDefined();
    expect(a.month).toBeLessThanOrEqual(END_MONTH);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Number.isFinite(a.cash)).toBe(true);
    expect(a.stats.homes).toBeGreaterThanOrEqual(0);
  });

  it('survives many seeds and strategies without breaking', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const strat of ['cauteloso', 'denso', 'acessivel'] as const) {
        const s = autoplay(seed, strat);
        expect(s.over, `${seed} ${strat}`).toBeDefined();
        expect(Number.isFinite(s.cash)).toBe(true);
        for (const p of s.projects) {
          expect(Number.isFinite(p.left), p.site).toBe(true);
          expect(p.units, p.site).toBeGreaterThan(0);
        }
      }
    }
  });

  it('round-trips through JSON (saves)', () => {
    const s = autoplay(7);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
