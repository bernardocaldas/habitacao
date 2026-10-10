// Lisbon's 24 parishes as an SVG atlas, with the plots on top. Pan with a drag, zoom with
// the wheel or the buttons; every site is focusable and opens with Enter.
import { useMemo, useRef, useState, type PointerEvent as RPE, type WheelEvent as RWE } from 'react';
import geo from '../data/lisboa-freguesias.json';
import { FREGUESIAS } from '../data/freguesias';
import { PROVENANCE_LABEL, rawPrice } from '../data/precos';
import { SITES } from '../data/sites';
import { rulesAt } from '../sim/rules';
import { siteState, projectById } from '../sim/sim';
import { yearFrac } from '../sim/time';
import type { GameState, L, Project, Site } from '../sim/types';
import { STAGE, eurM2, num } from './format';
import { useT } from './i18n';

type Ring = [number, number][];
interface Feature { properties: { code: string; name: string }; geometry: { coordinates: Ring[] } }
const FEATURES = (geo as unknown as { features: Feature[] }).features;

// Equirectangular projection, scaled by cos(latitude) so the city keeps its shape.
const LAT0 = 38.74;
const KX = Math.cos((LAT0 * Math.PI) / 180);
const PAD = 0.006;
const lons = FEATURES.flatMap((f) => f.geometry.coordinates[0].map((p) => p[0]));
const lats = FEATURES.flatMap((f) => f.geometry.coordinates[0].map((p) => p[1]));
const X0 = Math.min(...lons) - PAD, X1 = Math.max(...lons) + PAD;
const Y0 = Math.min(...lats) - PAD, Y1 = Math.max(...lats) + PAD;
const W = 1000;
const S = W / ((X1 - X0) * KX);
const H = Math.round((Y1 - Y0) * S);
export const project = (lon: number, lat: number): [number, number] => [(lon - X0) * KX * S, (Y1 - lat) * S];

const pathOf = (ring: Ring) => 'M' + ring.map(([x, y]) => project(x, y).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
const PATHS = FEATURES.map((f) => ({ code: f.properties.code, d: pathOf(f.geometry.coordinates[0]) }));

function areaKm2(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    a += (xj + xi) * (yj - yi);
  }
  return Math.abs(a / 2) * 111.32 * 111.32 * KX;
}
function centroid(ring: Ring): [number, number] {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const f = xj * yi - xi * yj;
    x += (xi + xj) * f; y += (yi + yj) * f; a += f;
  }
  return [x / (3 * a), y / (3 * a)];
}
const DENSITY: Record<string, number> = Object.fromEntries(FEATURES.map((f) => [f.properties.code, FREGUESIAS[f.properties.code].pop / areaKm2(f.geometry.coordinates[0])]));
const LABELS = FEATURES.map((f) => ({ code: f.properties.code, at: project(...centroid(f.geometry.coordinates[0])) }));

// The Tejo, drawn under the parishes (whose official boundaries reach into the estuary).
const TEJO = [
  [-9.32, 38.693], [-9.237, 38.697], [-9.2, 38.7035], [-9.17, 38.712], [-9.14, 38.716], [-9.12, 38.716],
  [-9.11, 38.73], [-9.1, 38.75], [-9.093, 38.77], [-9.0885, 38.79], [-9.0875, 38.797], [-9.083, 38.805],
  [-9.06, 38.82], [-8.95, 38.84], [-8.95, 38.6], [-9.32, 38.6],
] as Ring;
const TEJO_D = pathOf(TEJO);

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
        legend: { ramp: 'green', lo: num(Math.min(...vals), lang), hi: num(Math.max(...vals), lang), title: { pt: 'Residentes por km², Censos 2021', en: 'Residents per km², 2021 Census' } },
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

export function MapView({ s, selected, onSelect, layer, names }: {
  s: GameState;
  selected: { site?: string; project?: number };
  onSelect: (siteId: string) => void;
  layer: Layer;
  names: boolean;
}) {
  const { t, lang } = useT();
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const [hoverFr, setHoverFr] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const spec = layerSpec(layer, s, lang);
  const pending = new Set(s.decisions.map((d) => d.project).filter((x) => x != null));

  const views: SiteView[] = useMemo(() => SITES.map((site) => {
    const id = s.taken[site.id];
    const p = id != null ? projectById(s, id) : s.projects.filter((x) => x.site === site.id).at(-1);
    return { site, p: p && (p.stage === 'done' || id != null) ? p : undefined, state: siteState(s, site) };
  }), [s, s.month, s.projects.length, s.taken]); // eslint-disable-line react-hooks/exhaustive-deps

  const toSvg = (cx: number, cy: number) => {
    const el = svgRef.current!;
    const r = el.getBoundingClientRect();
    const sc = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2;
    return [(cx - r.left - ox) / sc, (cy - r.top - oy) / sc];
  };
  const zoomAt = (f: number, sx = W / 2, sy = H / 2) => setView((v) => {
    const k = Math.max(1, Math.min(6, v.k * f));
    const x = sx - ((sx - v.x) * k) / v.k, y = sy - ((sy - v.y) * k) / v.k;
    return clampView({ x, y, k });
  });
  const clampView = (v: { x: number; y: number; k: number }) => ({
    k: v.k,
    x: Math.min(0, Math.max(W - W * v.k, v.x)),
    y: Math.min(0, Math.max(H - H * v.k, v.y)),
  });

  const onWheel = (e: RWE) => {
    const [sx, sy] = toSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy);
  };
  const onDown = (e: RPE) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onMove = (e: RPE) => {
    const d = drag.current;
    if (!d) return;
    const el = svgRef.current!.getBoundingClientRect();
    const sc = Math.min(el.width / W, el.height / H);
    const dx = (e.clientX - d.x) / sc, dy = (e.clientY - d.y) / sc;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView((v) => clampView({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onUp = () => { setTimeout(() => (drag.current = null), 0); };

  const tipAt = (e: { clientX: number; clientY: number }, title: string, lines: string[]) => {
    const r = svgRef.current!.parentElement!.getBoundingClientRect();
    setHover({ x: e.clientX - r.left + 14, y: e.clientY - r.top + 14, title, lines });
  };

  const k = view.k;
  return (
    <div className="hab-map-wrap">
      <svg
        ref={svgRef}
        className={`hab-map${drag.current?.moved ? ' dragging' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={lang === 'pt' ? 'Mapa das freguesias de Lisboa com os terrenos' : 'Map of Lisbon’s parishes with the sites'}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { drag.current = null; setHover(null); setHoverFr(null); }}
      >
        <rect x={0} y={0} width={W} height={H} fill="#ece9dc" />
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <path d={TEJO_D} fill="#d7def3" />
          {PATHS.map(({ code, d }) => (
            <path
              key={code}
              d={d}
              className={`fr${hoverFr === code ? ' hover' : ''}`}
              fill={spec ? spec.fill(code) : FREGUESIAS[code].centro ? '#f7f4e8' : '#fcfbf5'}
              onPointerMove={(e) => {
                if (drag.current?.moved) return;
                setHoverFr(code);
                const fr = FREGUESIAS[code];
                tipAt(e, fr.name, spec ? [spec.fmt(code)] : [`${num(fr.pop, lang)} ${lang === 'pt' ? 'residentes (2021)' : 'residents (2021)'}`]);
              }}
            />
          ))}
          {names && LABELS.map(({ code, at }) => (
            <text key={code} className="fr-label" x={at[0]} y={at[1]} textAnchor="middle" style={{ fontSize: 11 / k }}>
              {FREGUESIAS[code].name}
            </text>
          ))}
          {views.map(({ site, p, state }) => {
            if (!p && state !== 'open') return null;
            const [x, y] = project(site.lon, site.lat);
            const units = p?.units ?? Math.round((site.lot * site.cov * site.floors) / 95);
            const r = (4 + Math.sqrt(units) / 1.7) / Math.sqrt(k);
            const kind = !p ? 'open' : p.stage === 'done' ? 'done' : p.stage === 'obra' ? 'obra' : p.stage === 'fin' ? 'fin' : p.stage === 'dead' || p.stage === 'sold' ? 'dead' : 'review';
            const m = MARK[kind];
            const sel = selected.site === site.id || (p && selected.project === p.id);
            const alert = p && pending.has(p.id);
            const floors = p?.prog.floors ?? site.floors;
            const tall = (kind === 'obra' || kind === 'done') ? (floors * 2.6) / Math.sqrt(k) : 0;
            const progress = kind === 'obra' && p ? Math.min(1, p.inStage / Math.max(1, p.inStage + p.left)) : 1;
            const label = `${t(site.name)} · ${FREGUESIAS[site.fr].name} · ${p ? t(STAGE[p.stage]) : lang === 'pt' ? 'disponível' : 'available'}`;
            return (
              <g
                key={site.id}
                className="site"
                tabIndex={0}
                role="button"
                aria-label={label}
                onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSelect(site.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(site.id); } }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  setHoverFr(null);
                  tipAt(e, t(site.name), [FREGUESIAS[site.fr].name, p ? `${t(STAGE[p.stage])} · ${p.units} ${lang === 'pt' ? 'casas' : 'homes'}` : `${units} ${lang === 'pt' ? 'casas possíveis' : 'possible homes'}`]);
                }}
              >
                {tall > 0 && (
                  <g>
                    <rect x={x - r * 0.9} y={y - tall} width={r * 1.8} height={tall} fill="none" stroke={m.stroke} strokeWidth={1 / k} strokeDasharray={kind === 'obra' ? `${3 / k} ${2 / k}` : undefined} />
                    <rect x={x - r * 0.9} y={y - tall * progress} width={r * 1.8} height={tall * progress} fill={m.fill} opacity={0.9} />
                    <rect x={x - r * 0.9} y={y - tall * progress} width={r * 1.8} height={1.6 / k} fill={kind === 'done' && p && p.affUnits / p.units >= 0.25 ? '#e5b958' : '#fcfbf5'} />
                  </g>
                )}
                {alert && <circle cx={x} cy={y} r={r + 5 / k} fill="none" stroke="#a3543a" strokeWidth={2.5 / k} />}
                <rect className="mark" x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * 0.35} fill={m.fill} stroke={sel ? '#16362e' : m.stroke} strokeWidth={(sel ? 3 : 1.5) / k} strokeDasharray={kind === 'fin' ? `${3 / k} ${2 / k}` : undefined} />
                {kind === 'open' && <path d={`M${x - r * 0.5},${y}H${x + r * 0.5}M${x},${y - r * 0.5}V${y + r * 0.5}`} stroke="#234c40" strokeWidth={1.5 / k} />}
                {kind === 'dead' && <path d={`M${x - r * 0.5},${y - r * 0.5}L${x + r * 0.5},${y + r * 0.5}M${x + r * 0.5},${y - r * 0.5}L${x - r * 0.5},${y + r * 0.5}`} stroke="#7f9284" strokeWidth={1.5 / k} />}
              </g>
            );
          })}
        </g>
      </svg>
      {hover && (
        <div className="hab-tip" style={{ left: hover.x, top: hover.y }}>
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
        <button className="hab-btn" onClick={() => zoomAt(1.4)} aria-label={lang === 'pt' ? 'Aproximar' : 'Zoom in'}>+</button>
        <button className="hab-btn" onClick={() => zoomAt(1 / 1.4)} aria-label={lang === 'pt' ? 'Afastar' : 'Zoom out'}>−</button>
      </div>
    </div>
  );
}
