// The map's geometry, prepared once: Lisbon's 24 parishes (CAOP 2021, clipped to the
// shoreline), the land around them and the neighbouring municipalities. World coordinates are
// kilometres on an equirectangular projection scaled by cos(latitude), so a kilometre is the
// same length in both directions and the city keeps its shape.
//
// Boundaries: CAOP 2021, DGT (CC BY 4.0), modified. Shoreline: © OpenStreetMap contributors
// (ODbL 1.0); the three geometry files are offered under the ODbL. docs/GEOMETRIA.md has the
// sources and the processing.
import parishGeo from '../data/lisboa-freguesias.json';
import landGeo from '../data/terra.json';
import neighbourGeo from '../data/vizinhos.json';

export type Pos = [number, number];
type Ring = Pos[];
type Poly = Ring[];
interface Geometry { type: string; coordinates: unknown }
interface Feature { properties: { code?: string; name?: string }; geometry: Geometry }

const polysOf = (g: Geometry): Poly[] => (g.type === 'Polygon' ? [g.coordinates as Poly] : (g.coordinates as Poly[]));

const LON0 = -9.32;
const LAT1 = 38.84;
const KM = 111.32;
const KX = Math.cos((38.74 * Math.PI) / 180);

/** Longitude and latitude to world kilometres (x east, y south). */
export const toWorld = (lon: number, lat: number): Pos => [(lon - LON0) * KX * KM, (LAT1 - lat) * KM];

/** The whole drawable world: the land layer's box. */
export const WORLD = { x0: 0, y0: 0, x1: toWorld(-8.95, 38.62)[0], y1: toWorld(-8.95, 38.62)[1] };

const ringD = (ring: Ring) => 'M' + ring.map(([lon, lat]) => toWorld(lon, lat).map((v) => v.toFixed(3)).join(',')).join('L') + 'Z';
const featureD = (g: Geometry) => polysOf(g).map((poly) => poly.map(ringD).join('')).join('');

function ringArea(ring: Pos[]) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

function segDist2(px: number, py: number, a: Pos, b: Pos) {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}

/** Distance from a point to the polygon's edge, positive inside. */
function signedDist(x: number, y: number, poly: Pos[][]) {
  let inside = false;
  let min = Infinity;
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      min = Math.min(min, segDist2(x, y, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(min);
}

/** The point inside a polygon farthest from its edge (polylabel), where a label reads best. */
export function poleOf(poly: Pos[][], precision = 0.03): Pos {
  const outer = poly[0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const size = Math.min(x1 - x0, y1 - y0);
  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, h: number): Cell => { const d = signedDist(x, y, poly); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  const queue: Cell[] = [];
  let h = size / 2;
  for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) queue.push(cell(x + h, y + h, h));
  let best = cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
  while (queue.length) {
    let i = 0;
    for (let j = 1; j < queue.length; j++) if (queue[j].max > queue[i].max) i = j;
    const c = queue.splice(i, 1)[0];
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    h = c.h / 2;
    queue.push(cell(c.x - h, c.y - h, h), cell(c.x + h, c.y - h, h), cell(c.x - h, c.y + h, h), cell(c.x + h, c.y + h, h));
  }
  return [best.x, best.y];
}

const worldPoly = (poly: Poly): Pos[][] => poly.map((ring) => ring.map(([lon, lat]) => toWorld(lon, lat)));

function insidePoly(x: number, y: number, poly: Pos[][]) {
  let ins = false;
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) ins = !ins;
    }
  }
  return ins;
}

export interface Parish {
  code: string;
  /** Whether a world point lies inside the parish. */
  contains: (p: Pos) => boolean;
  d: string;
  /** Land area, km². */
  area: number;
  /** Where its name goes. */
  label: Pos;
  box: { x0: number; y0: number; x1: number; y1: number };
}

export const PARISHES: Parish[] = (parishGeo as unknown as { features: Feature[] }).features.map((f) => {
  const polys = polysOf(f.geometry).map(worldPoly);
  const main = polys.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const xs = main[0].map((p) => p[0]), ys = main[0].map((p) => p[1]);
  return {
    code: f.properties.code!,
    contains: ([x, y]: Pos) => polys.some((poly) => insidePoly(x, y, poly)),
    d: featureD(f.geometry),
    area: polys.reduce((a, poly) => a + ringArea(poly[0]) - poly.slice(1).reduce((h, r) => h + ringArea(r), 0), 0),
    label: poleOf(main),
    box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
  };
});

/** The city's extent, for the first view. */
export const CITY = PARISHES.reduce(
  (a, p) => ({ x0: Math.min(a.x0, p.box.x0), y0: Math.min(a.y0, p.box.y0), x1: Math.max(a.x1, p.box.x1), y1: Math.max(a.y1, p.box.y1) }),
  { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
);

export const LAND_D = (landGeo as unknown as { features: Feature[] }).features.map((f) => featureD(f.geometry)).join('');
export const NEIGHBOURS = (neighbourGeo as unknown as { features: Feature[] }).features.map((f) => ({ code: f.properties.code!, name: f.properties.name!, d: featureD(f.geometry) }));

/** Where the neighbours' names sit: chosen by hand, in open land near the city. */
export const PLACE_LABELS: { name: string; at: Pos }[] = [
  { name: 'Oeiras', at: toWorld(-9.262, 38.722) },
  { name: 'Amadora', at: toWorld(-9.238, 38.765) },
  { name: 'Odivelas', at: toWorld(-9.186, 38.801) },
  { name: 'Loures', at: toWorld(-9.13, 38.818) },
  { name: 'Almada', at: toWorld(-9.18, 38.662) },
  { name: 'Seixal', at: toWorld(-9.115, 38.637) },
  { name: 'Barreiro', at: toWorld(-9.065, 38.656) },
];
/** Places in the estuary where the river's name can go, in order of preference. */
export const RIVER_LABELS: Pos[] = [toWorld(-9.075, 38.705), toWorld(-9.13, 38.698), toWorld(-9.19, 38.689), toWorld(-9.075, 38.745), toWorld(-9.066, 38.78)];
