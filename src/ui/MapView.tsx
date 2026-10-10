// Lisbon's 24 parishes as an SVG atlas, with the plots on top. Drag to pan, wheel or pinch to
// zoom, or use the buttons; every site is focusable and opens with Enter.
//
// The geography is drawn in world kilometres inside one transformed group; names and markers
// are drawn in screen pixels on top, so they keep their size (never below 11px) at any zoom
// and on any screen. Parish names that would collide with a marker or another name are left
// out until there is room.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPE, type WheelEvent as RWE } from 'react';
import { FREGUESIAS } from '../data/freguesias';
import { PROVENANCE_LABEL, rawPrice } from '../data/precos';
import { SITES } from '../data/sites';
import { rulesAt } from '../sim/rules';
import { siteState, projectById } from '../sim/sim';
import { yearFrac } from '../sim/time';
import type { GameState, L, Project, Site } from '../sim/types';
import { STAGE, eurM2, num } from './format';
import { useT } from './i18n';
import { CITY, LAND_D, NEIGHBOURS, PARISHES, PLACE_LABELS, RIVER_LABELS, WORLD, toWorld, type Pos } from './map-geo';

const DENSITY: Record<string, number> = Object.fromEntries(PARISHES.map((p) => [p.code, FREGUESIAS[p.code].pop / p.area]));

const WATER = '#d5ddef';
const LAND = '#ece9dc';
const RIVER_INK = '#4a5a94';

export type Layer = 'mapa' | 'preco' | 'pop' | 'al' | 'viz' | 'hab' | 'patrimonio';
export const LAYERS: { key: Layer; label: L }[] = [
  { key: 'mapa', label: { pt: 'Mapa', en: 'Map' } },
  { key: 'preco', label: { pt: 'Preço', en: 'Price' } },
  { key: 'pop', label: { pt: 'População', en: 'Population' } },
  { key: 'al', label: { pt: 'Alojamento local', en: 'Short lets' } },
  { key: 'viz', label: { pt: 'Vizinhos', en: 'Residents' } },
  { key: 'hab', label: { pt: 'Direito à habitação', en: 'Housing movement' } },
  { key: 'patrimonio', label: { pt: 'Património', en: 'Heritage' } },
];

const RAMPS: Record<string, string[]> = {
  teal: ['#eef6f4', '#cfe7e1', '#9dcec1', '#5fae9f', '#2f8577', '#245c68'],
  coral: ['#fff2ee', '#ffe2d9', '#f3c2b0', '#e29a83', '#c7745b', '#a3543a'],
  peri: ['#f1f3fb', '#dde3f6', '#bdc7e7', '#a9b9ed', '#7d8fcf', '#4f5f9e'],
  gold: ['#fffaef', '#fdecc9', '#f9d187', '#e5b958', '#c49536', '#8a6a26'],
  green: ['#f1fbf5', '#def5e7', '#b9e6cc', '#9ddcb8', '#5d9a78', '#377455'],
};
const ramp = (name: string, t: number) => {
  const r = RAMPS[name];
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
};

interface LayerSpec {
  value: (code: string) => number;
  fill: (code: string) => string;
  legend: { ramp?: string; lo?: string; hi?: string; title: L; keys?: { color: string; label: L }[]; note?: L };
  fmt: (code: string) => string;
}

function layerSpec(layer: Layer, s: GameState, lang: 'pt' | 'en'): LayerSpec | null {
  const year = yearFrac(s.month);
  const codes = Object.keys(FREGUESIAS);
  const norm = (f: (c: string) => number, name: string) => {
    const vals = codes.map(f);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return (c: string) => ramp(name, (f(c) - lo) / Math.max(1e-9, hi - lo));
  };
  switch (layer) {
    case 'preco': {
      // INE's own annual median where it exists; the game's estimate (2015) or scenario after.
      const f = (c: string) => rawPrice(c, year).value;
      const kind = rawPrice('1106', year).kind;
      const tag = kind === 'ine' ? '' : ` (${PROVENANCE_LABEL[kind][lang]})`;
      const vals = codes.map(f);
      return {
        value: f, fill: norm(f, 'teal'), fmt: (c) => eurM2(f(c), lang) + tag,
        legend: {
          ramp: 'teal', lo: eurM2(Math.min(...vals), lang), hi: eurM2(Math.max(...vals), lang),
          title: { pt: `Preço mediano de venda, ${Math.floor(year)}${tag}`, en: `Median sale price, ${Math.floor(year)}${tag}` },
          note: { pt: `Lisboa: ${eurM2(rawPrice('1106', year).value, 'pt')}${kind === 'ine' ? ' · INE' : tag}`, en: `Lisbon: ${eurM2(rawPrice('1106', year).value, 'en')}${kind === 'ine' ? ' · INE' : tag}` },
        },
      };
    }
    case 'pop': {
      const f = (c: string) => DENSITY[c];
      const vals = codes.map(f);
      return {
        value: f, fill: norm(f, 'green'), fmt: (c) => `${num(f(c), lang)} ${lang === 'pt' ? 'hab./km²' : 'per km²'} · ${num(FREGUESIAS[c].pop, lang)} ${lang === 'pt' ? 'residentes' : 'residents'}`,
        legend: { ramp: 'green', lo: num(Math.min(...vals), lang), hi: num(Math.max(...vals), lang), title: { pt: 'Residentes por km² de terra, Censos 2021', en: 'Residents per km² of land, 2021 Census' } },
      };
    }
    case 'al': {
      const r = rulesAt(s.month);
      const closed = (c: string) => r.alFrozen || r.alClosed.includes(c);
      return {
        value: (c) => (closed(c) ? 1 : 0),
        fill: (c) => (closed(c) ? '#e5b958' : '#fcfbf5'),
        fmt: (c) => (closed(c) ? (lang === 'pt' ? 'novos registos suspensos' : 'new registrations suspended') : lang === 'pt' ? 'aberto a novos registos' : 'open to new registrations'),
        legend: { title: { pt: 'Novos registos de alojamento local', en: 'New short-let registrations' }, keys: [{ color: '#fcfbf5', label: { pt: 'Abertos', en: 'Open' } }, { color: '#e5b958', label: { pt: 'Suspensos', en: 'Suspended' } }] },
      };
    }
    case 'viz':
    case 'hab':
    case 'patrimonio': {
      const key = layer === 'patrimonio' ? 'heritage' : layer;
      const f = (c: string) => FREGUESIAS[c][key];
      const name = layer === 'viz' ? 'coral' : layer === 'hab' ? 'peri' : 'gold';
      const title: L = layer === 'viz'
        ? { pt: 'Força das associações de moradores e do património', en: 'Strength of residents’ and heritage groups' }
        : layer === 'hab' ? { pt: 'Força do movimento pelo direito à habitação', en: 'Strength of the right-to-housing movement' }
        : { pt: 'Parte da freguesia em zonas de proteção', en: 'Share of the parish in protection zones' };
      return {
        value: f, fill: (c) => ramp(name, f(c)), fmt: (c) => `${Math.round(f(c) * 100)} / 100`,
        legend: { ramp: name, lo: lang === 'pt' ? 'fraca' : 'weak', hi: lang === 'pt' ? 'forte' : 'strong', title, note: { pt: 'Juízo editorial para o jogo, não uma medição.', en: 'An editorial judgement for the game, not a measurement.' } },
      };
    }
    default:
      return null;
  }
}

type SiteView = { site: Site; p?: Project; state: ReturnType<typeof siteState> };

const MARK = {
  open: { fill: '#fcfbf5', stroke: '#234c40' },
  review: { fill: '#e5b958', stroke: '#8a6a26' },
  fin: { fill: '#fcfbf5', stroke: '#a3543a' },
  obra: { fill: '#a9b9ed', stroke: '#2f4277' },
  done: { fill: '#377455', stroke: '#234c40' },
  dead: { fill: '#dadccf', stroke: '#7f9284' },
};

// ── Text measurement, for label collisions ───────────────────────────────────────────────

const LABEL_FONT = '600 11px Manrope, system-ui, sans-serif';
const PLACE_FONT = '700 11px Manrope, system-ui, sans-serif';
const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, font: string, spacing = 0) {
  const key = font + '|' + text;
  const hit = widthCache.get(key);
  if (hit != null) return hit;
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
  }
  let w = text.length * 6.3;
  if (ctx) { ctx.font = font; w = ctx.measureText(text).width; }
  w += spacing * text.length;
  widthCache.set(key, w);
  return w;
}

/** Long names on two lines, split at the space nearest the middle. */
function linesOf(name: string): string[] {
  if (name.length <= 13 || !name.includes(' ')) return [name];
  const mid = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) if (name[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [name.slice(0, best), name.slice(best + 1)];
}

interface Box { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// ── View ─────────────────────────────────────────────────────────────────────────────────

interface View { cx: number; cy: number; k: number }
const MAX_ZOOM = 8;

/** Room kept clear around the city in the first view: the attribution sits at the top. */
const margin = (w: number) => (w < 560 ? { x: 8, top: 26, bottom: 10 } : { x: 28, top: 30, bottom: 24 });

/** The scale at which the whole city fits the frame, with a margin. */
function fitScale(w: number, h: number) {
  const m = margin(w);
  return Math.min((w - 2 * m.x) / (CITY.x1 - CITY.x0), (h - m.top - m.bottom) / (CITY.y1 - CITY.y0));
}

function clampView(v: View, w: number, h: number): View {
  const fit = fitScale(w, h);
  const k = Math.max(fit * 0.8, Math.min(fit * MAX_ZOOM, v.k));
  const hw = w / 2 / k, hh = h / 2 / k;
  const span = (lo: number, hi: number, half: number, c: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, c)));
  return { k, cx: span(WORLD.x0, WORLD.x1, hw, v.cx), cy: span(WORLD.y0, WORLD.y1, hh, v.cy) };
}

function home(w: number, h: number): View {
  const k = fitScale(w, h);
  const m = margin(w);
  // Centre the city in the space left between the top and bottom margins.
  return clampView({ k, cx: (CITY.x0 + CITY.x1) / 2, cy: (CITY.y0 + CITY.y1) / 2 - (m.top - m.bottom) / 2 / k }, w, h);
}

export function MapView({ s, selected, onSelect, layer, names }: {
  s: GameState;
  selected: { site?: string; project?: number };
  onSelect: (siteId: string) => void;
  layer: Layer;
  names: boolean;
}) {
  const { t, lang } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const [hoverFr, setHoverFr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; x: number; y: number; dist?: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const spec = layerSpec(layer, s, lang);
  const pending = new Set(s.decisions.map((d) => d.project).filter((x) => x != null));

  // Measure the frame; the first measurement frames the city, later ones keep the centre.
  const last = useRef({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      const prev = last.current;
      if (!w || !h || (prev.w === w && prev.h === h)) return;
      last.current = { w, h };
      setSize({ w, h });
      // Keep the same zoom relative to the city as the frame changes size.
      setView((v) => (v && prev.w ? clampView({ ...v, k: v.k * (fitScale(w, h) / fitScale(prev.w, prev.h)) }, w, h) : home(w, h)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The browser scrolls the page on a wheel unless the listener is active (not passive).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const views: SiteView[] = useMemo(() => SITES.map((site) => {
    const id = s.taken[site.id];
    const p = id != null ? projectById(s, id) : s.projects.filter((x) => x.site === site.id).at(-1);
    return { site, p: p && (p.stage === 'done' || id != null) ? p : undefined, state: siteState(s, site) };
  }), [s, s.month, s.projects.length, s.taken]); // eslint-disable-line react-hooks/exhaustive-deps

  const { w, h } = size;
  const v = view ?? (w && h ? home(w, h) : { cx: 0, cy: 0, k: 1 });
  const tx = w / 2 - v.cx * v.k, ty = h / 2 - v.cy * v.k;
  const screen = (p: Pos): Pos => [p[0] * v.k + tx, p[1] * v.k + ty];
  const zoomRatio = w && h ? v.k / fitScale(w, h) : 1;

  const zoomAt = (f: number, sx = w / 2, sy = h / 2) => setView((old) => {
    const cur = old ?? home(w, h);
    const k = cur.k * f;
    // Keep the world point under (sx, sy) where it is.
    const wx = cur.cx + (sx - w / 2) / cur.k, wy = cur.cy + (sy - h / 2) / cur.k;
    return clampView({ k, cx: wx - (sx - w / 2) / k, cy: wy - (sy - h / 2) / k }, w, h);
  });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onWheel = (e: RWE) => {
    const { x, y } = local(e);
    zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), x, y);
  };
  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined;
    gesture.current = { view: v, x: cx, y: cy, dist, moved: gesture.current?.moved ?? false };
  };
  const onDown = (e: RPE) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    startGesture();
  };
  const onMove = (e: RPE) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const k = g.dist && pts.length > 1 ? g.view.k * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist) : g.view.k;
    if (!g.moved && Math.hypot(cx - g.x, cy - g.y) < 5 && k === g.view.k) return;
    if (!g.moved) {
      g.moved = true;
      moved.current = true;
      setDragging(true);
      setHover(null);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    // The world point that was under the gesture's centre follows it.
    const wx = g.view.cx + (g.x - w / 2) / g.view.k, wy = g.view.cy + (g.y - h / 2) / g.view.k;
    setView(clampView({ k, cx: wx - (cx - w / 2) / k, cy: wy - (cy - h / 2) / k }, w, h));
  };
  const onUp = (e: RPE) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) { startGesture(); return; }
    gesture.current = null;
    setDragging(false);
    // A drag must not end in a click on whatever is under the pointer.
    setTimeout(() => { moved.current = false; }, 0);
  };

  const tipAt = (e: { clientX: number; clientY: number }, title: string, lines: string[]) => {
    if (gesture.current?.moved) return;
    const { x, y } = local(e);
    setHover({ x: Math.min(x + 14, w - 200), y: y + 14 > h - 70 ? y - 70 : y + 14, title, lines });
  };

  // Markers, in screen pixels.
  const marks = views.flatMap(({ site, p, state }) => {
    if (!p && state !== 'open') return [];
    const [x, y] = screen(toWorld(site.lon, site.lat));
    const units = p?.units ?? Math.round((site.lot * site.cov * site.floors) / 95);
    const kind = !p ? 'open' : p.stage === 'done' ? 'done' : p.stage === 'obra' ? 'obra' : p.stage === 'fin' ? 'fin' : p.stage === 'dead' || p.stage === 'sold' ? 'dead' : 'review';
    const small = w < 560 && zoomRatio < 1.6;
    const size = kind === 'open' ? (small ? 12 : 14) : Math.max(small ? 11 : 12, Math.min(small ? 18 : 22, 10 + Math.sqrt(units) / 1.6));
    const floors = p?.prog.floors ?? site.floors;
    const tall = kind === 'obra' || kind === 'done' ? Math.max(8, Math.min(34, floors * 2.5)) : 0;
    return [{ site, p, kind, x, y, size, tall, units }];
  });

  // Labels: parishes, biggest first, then the neighbours' names, each only where it fits.
  const labels = useMemo(() => {
    if (!w || !h) return { parishes: [], places: [], river: null };
    const taken: Box[] = marks.map((m) => ({ x0: m.x - m.size / 2 - 3, y0: m.y - m.size / 2 - m.tall - 3, x1: m.x + m.size / 2 + 3, y1: m.y + m.size / 2 + 3 }));
    const frame: Box = { x0: 4, y0: 22, x1: w - 4, y1: h - 4 }; // the attribution line sits at the top
    const inFrame = (b: Box) => b.x0 >= frame.x0 && b.y0 >= frame.y0 && b.x1 <= frame.x1 && b.y1 <= frame.y1;
    const parishes: { code: string; x: number; y: number; lines: string[] }[] = [];
    if (names) {
      for (const pr of [...PARISHES].sort((a, b) => b.area - a.area)) {
        const lines = linesOf(FREGUESIAS[pr.code].name);
        const bw = Math.max(...lines.map((l) => textWidth(l, LABEL_FONT))) + 6;
        const bh = lines.length * 13 + 2;
        const [ax, ay] = screen(pr.label);
        // The parish must be wide enough on screen to hold most of its name.
        if ((pr.box.x1 - pr.box.x0) * v.k < bw * 0.7) continue;
        // Try the label's best spot, then nearby ones, keeping its centre inside the parish.
        const steps = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2]];
        for (const [i, j] of steps) {
          const x = ax + i * bw * 0.45, y = ay + j * bh * 0.8;
          const b: Box = { x0: x - bw / 2, y0: y - bh / 2, x1: x + bw / 2, y1: y + bh / 2 };
          if (!inFrame(b) || taken.some((o) => overlaps(o, b))) continue;
          if ((i || j) && !pr.contains([(x - tx) / v.k, (y - ty) / v.k])) continue;
          taken.push(b);
          parishes.push({ code: pr.code, x, y, lines });
          break;
        }
      }
    }
    const places: { name: string; x: number; y: number }[] = [];
    for (const pl of PLACE_LABELS) {
      const [x, y] = screen(pl.at);
      const bw = textWidth(pl.name.toUpperCase(), PLACE_FONT, 0.66) + 6;
      const b: Box = { x0: x - bw / 2, y0: y - 8, x1: x + bw / 2, y1: y + 8 };
      if (!inFrame(b) || taken.some((o) => overlaps(o, b))) continue;
      taken.push(b);
      places.push({ name: pl.name, x, y });
    }
    // The river's name goes in the first stretch of open water inside the frame.
    let river: Pos | null = null;
    const rw = textWidth(lang === 'pt' ? 'RIO TEJO' : 'RIVER TAGUS', PLACE_FONT, 0.96) + 8;
    for (const at of RIVER_LABELS) {
      const [x, y] = screen(at);
      const b: Box = { x0: x - rw / 2, y0: y - 9, x1: x + rw / 2, y1: y + 9 };
      if (!inFrame(b) || taken.some((o) => overlaps(o, b))) continue;
      river = [x, y];
      break;
    }
    return { parishes, places, river };
  }, [lang, w, h, v.k, v.cx, v.cy, names, marks.map((m) => `${m.site.id}${m.kind}${m.size}${m.tall}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = w > 0 && h > 0;

  return (
    <div className="hab-map-wrap" ref={wrapRef}>
      {ready && (
        <svg
          className={`hab-map${dragging ? ' dragging' : ''}`}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={lang === 'pt' ? 'Mapa das freguesias de Lisboa com os terrenos' : 'Map of Lisbon’s parishes with the sites'}
          onWheel={onWheel}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={(e) => { if (!pointers.current.has(e.pointerId)) { setHover(null); setHoverFr(null); } }}
        >
          <rect x={0} y={0} width={w} height={h} fill={WATER} />
          <g transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${v.k.toFixed(4)})`}>
            <path d={LAND_D} fill={LAND} />
            {NEIGHBOURS.map((n) => <path key={n.code} d={n.d} className="nb" />)}
            {PARISHES.map(({ code, d }) => (
              <path
                key={code}
                d={d}
                className={`fr${hoverFr === code ? ' hover' : ''}`}
                fill={spec ? spec.fill(code) : FREGUESIAS[code].centro ? '#f7f4e8' : '#fcfbf5'}
                onPointerMove={(e) => {
                  if (gesture.current?.moved) return;
                  setHoverFr(code);
                  const fr = FREGUESIAS[code];
                  tipAt(e, fr.name, spec ? [spec.fmt(code)] : [`${num(fr.pop, lang)} ${lang === 'pt' ? 'residentes (2021)' : 'residents (2021)'}`]);
                }}
              />
            ))}
          </g>
          {labels.river && <text className="river-label" x={labels.river[0]} y={labels.river[1] + 4} textAnchor="middle" fill={RIVER_INK}>{lang === 'pt' ? 'RIO TEJO' : 'RIVER TAGUS'}</text>}
          {labels.places.map((pl) => (
            <text key={pl.name} className="place-label" x={pl.x} y={pl.y + 4} textAnchor="middle">{pl.name.toUpperCase()}</text>
          ))}
          {labels.parishes.map((lb) => (
            <text key={lb.code} className="fr-label" x={lb.x} y={lb.y - ((lb.lines.length - 1) * 13) / 2 + 4} textAnchor="middle">
              {lb.lines.map((l, i) => <tspan key={i} x={lb.x} dy={i ? 13 : 0}>{l}</tspan>)}
            </text>
          ))}
          {marks.map(({ site, p, kind, x, y, size, tall, units }) => {
            const m = MARK[kind as keyof typeof MARK];
            const r = size / 2;
            const sel = selected.site === site.id || (p && selected.project === p.id);
            const alert = p && pending.has(p.id);
            const progress = kind === 'obra' && p ? Math.min(1, p.inStage / Math.max(1, p.inStage + p.left)) : 1;
            const label = `${t(site.name)} · ${FREGUESIAS[site.fr].name} · ${p ? t(STAGE[p.stage]) : lang === 'pt' ? 'disponível' : 'available'}`;
            return (
              <g
                key={site.id}
                className="site"
                tabIndex={0}
                role="button"
                aria-label={label}
                onClick={(e) => { e.stopPropagation(); if (!moved.current) onSelect(site.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(site.id); } }}
                onPointerMove={(e) => {
                  if (gesture.current?.moved) return;
                  e.stopPropagation();
                  setHoverFr(null);
                  tipAt(e, t(site.name), [FREGUESIAS[site.fr].name, p ? `${t(STAGE[p.stage])} · ${p.units} ${lang === 'pt' ? 'casas' : 'homes'}` : `${units} ${lang === 'pt' ? 'casas possíveis' : 'possible homes'}`]);
                }}
              >
                <rect x={x - 14} y={y - 14 - tall} width={28} height={28 + tall} fill="transparent" />
                {tall > 0 && (
                  <g>
                    <rect x={x - r * 0.9} y={y - r - tall} width={r * 1.8} height={tall} fill="#fcfbf5" fillOpacity={0.6} stroke={m.stroke} strokeWidth={1} strokeDasharray={kind === 'obra' ? '3 2' : undefined} />
                    <rect x={x - r * 0.9} y={y - r - tall * progress} width={r * 1.8} height={tall * progress} fill={m.fill} opacity={0.92} />
                    <rect x={x - r * 0.9} y={y - r - tall * progress} width={r * 1.8} height={2} fill={kind === 'done' && p && p.affUnits / p.units >= 0.25 ? '#e5b958' : '#fcfbf5'} />
                  </g>
                )}
                {alert && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#a3543a" strokeWidth={2.5} className="alert" />}
                <rect className="mark" x={x - r} y={y - r} width={size} height={size} rx={r * 0.35} fill={m.fill} stroke={sel ? '#16362e' : m.stroke} strokeWidth={sel ? 3 : 1.5} strokeDasharray={kind === 'fin' ? '3 2' : undefined} />
                {kind === 'open' && <path d={`M${x - r * 0.5},${y}H${x + r * 0.5}M${x},${y - r * 0.5}V${y + r * 0.5}`} stroke="#234c40" strokeWidth={1.5} />}
                {kind === 'dead' && <path d={`M${x - r * 0.5},${y - r * 0.5}L${x + r * 0.5},${y + r * 0.5}M${x + r * 0.5},${y - r * 0.5}L${x - r * 0.5},${y + r * 0.5}`} stroke="#5f7062" strokeWidth={1.5} />}
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div className="hab-tip" style={{ left: Math.max(4, hover.x), top: Math.max(4, hover.y) }}>
          <strong>{hover.title}</strong>
          {hover.lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {spec && (
        <div className="hab-legend">
          <div style={{ fontWeight: 700 }}>{t(spec.legend.title)}</div>
          {spec.legend.ramp && (
            <>
              <div className="hab-legend-ramp">{RAMPS[spec.legend.ramp].map((c) => <span key={c} style={{ background: c }} />)}</div>
              <div className="hab-legend-ends"><span>{spec.legend.lo}</span><span>{spec.legend.hi}</span></div>
            </>
          )}
          {spec.legend.keys && (
            <div className="hab-legend-keys">{spec.legend.keys.map((x) => <span key={x.color}><i style={{ background: x.color }} />{t(x.label)}</span>)}</div>
          )}
          {spec.legend.note && <div className="hab-legend-ends" style={{ marginTop: 4 }}>{t(spec.legend.note)}</div>}
        </div>
      )}
      <div className="hab-zoom">
        <button className="hab-btn" onClick={() => zoomAt(1.5)} aria-label={lang === 'pt' ? 'Aproximar' : 'Zoom in'} disabled={zoomRatio >= MAX_ZOOM - 0.01}>+</button>
        <button className="hab-btn" onClick={() => zoomAt(1 / 1.5)} aria-label={lang === 'pt' ? 'Afastar' : 'Zoom out'}>−</button>
        <button className="hab-btn" onClick={() => setView(home(w, h))} aria-label={lang === 'pt' ? 'Ver a cidade inteira' : 'Show the whole city'} title={lang === 'pt' ? 'Ver a cidade inteira' : 'Show the whole city'}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
      </div>
      <div className="hab-attrib">
        CAOP 2021 · DGT (CC BY 4.0) · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> (ODbL)
      </div>
    </div>
  );
}
