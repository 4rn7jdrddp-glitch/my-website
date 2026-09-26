// Prepares the simplified Caribbean geography used by the 3D scene and the static SVG fallback.
// Source: Natural Earth 1:10m Admin 0 map units (public domain, https://www.naturalearthdata.com/).
// Run once with `npm run geo`; the output (src/data/map.json) is committed.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.natural-earth', 'ne_10m_admin0.geojson');
const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson';

// Map window (degrees) and equirectangular projection centre.
export const BBOX = { w: -90, e: -54, s: 4.5, n: 27 };
export const LON0 = -72;
export const LAT0 = 16;
const COS = Math.cos((LAT0 * Math.PI) / 180);

const MAINLAND = new Set(['USA', 'MEX', 'BLZ', 'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'COL', 'VEN', 'GUY', 'SUR', 'FRA', 'BRA']);
const BONAIRE = [-68.27, 12.18];
const FORCE_KEEP = [BONAIRE, [-63.23, 17.63], [-62.97, 17.49]]; // Bonaire, Saba, Sint Eustatius

async function load() {
  if (!fs.existsSync(CACHE)) {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    console.log('Downloading Natural Earth data…');
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
}

// Sutherland–Hodgman clip of a ring against the bbox rectangle.
function clipRing(ring) {
  const edges = [
    (p) => p[0] >= BBOX.w, (p) => p[0] <= BBOX.e, (p) => p[1] >= BBOX.s, (p) => p[1] <= BBOX.n,
  ];
  const cut = [
    (a, b) => lerpAt(a, b, 0, BBOX.w), (a, b) => lerpAt(a, b, 0, BBOX.e),
    (a, b) => lerpAt(a, b, 1, BBOX.s), (a, b) => lerpAt(a, b, 1, BBOX.n),
  ];
  let out = ring;
  for (let i = 0; i < 4; i++) {
    const input = out;
    out = [];
    if (!input.length) break;
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const inCur = edges[i](cur);
      const inPrev = edges[i](prev);
      if (inCur) {
        if (!inPrev) out.push(cut[i](prev, cur));
        out.push(cur);
      } else if (inPrev) out.push(cut[i](prev, cur));
    }
  }
  return out;
}
function lerpAt(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function area(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return Math.abs(s / 2);
}

function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = len < 1e-8
        ? Math.hypot(points[i][0] - ax, points[i][1] - ay)
        : Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function contains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const project = ([lon, lat]) => [+((lon - LON0) * COS).toFixed(3), +(-(lat - LAT0)).toFixed(3)];

function build(features, { minArea, tol }) {
  const polys = [];
  for (const f of features) {
    const code = f.properties.ADM0_A3;
    const g = f.geometry;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of list) {
      const outer = poly[0];
      const clipped = clipRing(outer);
      if (clipped.length < 3) continue;
      const a = area(clipped);
      const isBonaire = contains(outer, BONAIRE);
      const forced = FORCE_KEEP.some((p) => contains(outer, p));
      if (a < minArea && !forced) continue;
      let ring = simplify([...clipped, clipped[0]], a < 0.05 ? tol / 4 : tol).slice(0, -1);
      if (ring.length < 4) ring = clipped;
      const kind = isBonaire ? 'b' : MAINLAND.has(code) && a > 2 ? 'm' : 'i';
      polys.push({ k: kind, r: ring.map(project).flat() });
    }
  }
  return polys;
}

const data = await load();
const features = data.features.filter((f) => {
  let hit = false;
  const walk = (a) => { if (typeof a[0] === 'number') { if (a[0] > BBOX.w - 2 && a[0] < BBOX.e + 2 && a[1] > BBOX.s - 2 && a[1] < BBOX.n + 2) hit = true; return; } a.forEach(walk); };
  walk(f.geometry.coordinates);
  return hit;
});

const out = {
  source: 'Natural Earth 1:10m Admin 0 map units (public domain)',
  bbox: BBOX, lon0: LON0, lat0: LAT0, cos: +COS.toFixed(6),
  size: { x0: project([BBOX.w, 0])[0], x1: project([BBOX.e, 0])[0], z0: project([0, BBOX.n])[1], z1: project([0, BBOX.s])[1] },
  hi: build(features, { minArea: 0.0008, tol: 0.012 }),
  lo: build(features, { minArea: 0.004, tol: 0.035 }),
};
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'map.json'), JSON.stringify(out));
const pts = (s) => s.reduce((n, p) => n + p.r.length / 2, 0);
console.log(`hi: ${out.hi.length} polygons / ${pts(out.hi)} pts; lo: ${out.lo.length} / ${pts(out.lo)}`);
