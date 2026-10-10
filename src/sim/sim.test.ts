import { describe, expect, it } from 'vitest';
import geo from '../data/lisboa-freguesias.json';
import { FREGUESIAS } from '../data/freguesias';
import { MANDATES } from '../data/politics';
import { TIMELINE, UNMATCHED_EFFECTS } from '../data/timeline';
import { SITES } from '../data/sites';
import { autoplay } from './bot';
import { landPrice, proForma, unitsOf } from './econ';
import type { Program, Stance } from './types';
import { councilAt, rulesAt } from './rules';
import { defaultProgram, newGame, preview, fileProject, tick, resolve } from './sim';
import { END_MONTH, monthOf } from './time';
import { PAPERS, pressMonth } from './press';
import { agendaHold, passProb, stances } from './votes';

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
  const st = (bloc: string, seats: number, pYes: number, pAbst: number, mayor = false): Stance => ({ bloc, seats, mayor, x: 0, pYes, pAbst, pNo: 1 - pYes - pAbst, why: [] });

  it('passes with more yes than no; abstentions do not count; the mayor breaks a tie', () => {
    expect(passProb([st('a', 7, 1, 0, true), st('b', 10, 0, 1)])).toBeCloseTo(1);
    expect(passProb([st('a', 7, 1, 0, true), st('b', 10, 0, 0)])).toBeCloseTo(0);
    expect(passProb([st('a', 8, 1, 0, true), st('b', 8, 0, 0), st('c', 1, 0, 1)])).toBeCloseTo(1);
    expect(passProb([st('a', 9, 0, 1, true), st('b', 4, 1, 0), st('c', 4, 0, 0)])).toBeCloseTo(0);
    expect(passProb([st('a', 7, 1, 0, true), st('b', 7, 0, 0), st('c', 3, 0.5, 0.5)])).toBeCloseTo(1);
    expect(passProb([st('a', 7, 1, 0, true), st('b', 10, 0.5, 0)])).toBeCloseTo(0.5);
    expect(passProb([st('a', 7, 0.5, 0.5, true), st('b', 10, 0, 1)])).toBeCloseTo(0.5);
  });

  const project = (y: number, mo: number, id: string, prog: Partial<Program> = {}) => {
    const s = newGame(3);
    s.month = monthOf(y, mo);
    const site = SITES.find((x) => x.id === id)!;
    const p = fileProject(s, site.id, { ...defaultProgram(site), ...prog })!;
    return { s, p };
  };

  it('lets every list vote as one, seats adding to 17', () => {
    for (const md of MANDATES) {
      const { s, p } = project(Math.max(2015, md.from[0]), md.from[1] + 0, 'arroios-garagem');
      expect(stances(s, p).reduce((a, x) => a + x.seats, 0)).toBe(17);
      expect(stances(s, p).filter((x) => x.mayor)).toHaveLength(1);
    }
  });

  it('makes an absolute majority easy and a minority executive need the opposition', () => {
    const a = project(2016, 6, 'arroios-garagem');
    expect(passProb(stances(a.s, a.p))).toBeGreaterThan(0.9);
    const b = project(2023, 6, 'arroios-garagem');
    const plain = passProb(stances(b.s, b.p));
    const aff = passProb(stances(b.s, b.p, { aff: 0.25 }));
    const deal = passProb(stances(b.s, b.p, { deals: ['pl'] }));
    expect(plain).toBeLessThan(0.9);
    expect(aff).toBeGreaterThan(plain);
    expect(deal).toBeGreaterThan(plain + 0.1);
  });

  it('keeps contested projects off the agenda before an election and while a new executive settles', () => {
    const { s, p } = project(2025, 7, 'arroios-garagem', { scheme: 'plano', floors: 12 });
    p.mult = { viz: 2, hab: 2 };
    const hold = agendaHold(s, p);
    expect(hold?.kind).toBe('election');
    if (hold?.kind === 'election') expect(hold.until).toBe(monthOf(2025, 11) + 2);
    const n = project(2021, 11, 'arroios-garagem');
    expect(agendaHold(n.s, n.p)?.kind).toBe('new');
  });

  it('turns councillors away from a project in the news', () => {
    const { s, p } = project(2023, 6, 'arroios-garagem');
    const before = passProb(stances(s, p));
    p.story = { kind: 'despejo', m: s.month, until: s.month + 6, sev: 1 };
    expect(passProb(stances(s, p))).toBeLessThan(before - 0.1);
  });
});

describe('press', () => {
  it('runs a story about evictions, from an invented paper, and lets you answer it', () => {
    const s = newGame(11);
    s.month = monthOf(2019, 1);
    const site = SITES.find((x) => x.tenants)!;
    const p = fileProject(s, site.id, defaultProgram(site))!;
    p.once.evicted = true;
    p.vars.evictedM = s.month;
    let d;
    for (let i = 0; i < 36 && !d; i++) {
      s.month++;
      pressMonth(s);
      d = s.decisions.find((x) => x.kind.startsWith('story:'));
    }
    expect(d?.kind).toBe('story:despejo');
    expect(Object.values(PAPERS)).toContain(d!.press!.paper);
    expect(p.story).toBeDefined();
    expect(s.news.at(-1)?.paper).toBe(d!.press!.paper);
    const sev = p.story!.sev;
    s.cash = 10;
    resolve(s, d!.id, 'realojar');
    expect(p.story!.sev).toBeLessThan(sev);
  });

  it('never runs the same story twice about one project', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = autoplay(seed, 'denso');
      const kinds = g.news.filter((n) => n.paper && n.project != null).map((n) => `${n.project}|${n.head.pt}`);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
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
