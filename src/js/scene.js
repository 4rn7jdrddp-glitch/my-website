// Scroll-driven 3D scene: one renderer, one scene graph, five narrative states
// (hero → region → services → process → contact) blended by native page scroll.
import * as THREE from 'three';

const COL = {
  ocean: 0x071e28, sea: 0x0f3a48, orange: 0xf26a36, apricot: 0xffb68e, paper: 0xf7f4ee,
  petrol: 0x24565b, land: 0x2f6b6f, landSide: 0x163d44, main: 0x1a484f, mainSide: 0x0f2f36,
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export async function startScene({ canvas, labels, data, state }) {
  const mobile = matchMedia('(max-width: 820px)').matches;
  const res = await fetch(data.assets + 'map.json');
  if (!res.ok) throw new Error('map data unavailable');
  const map = await res.json();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setClearColor(COL.ocean);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COL.ocean, 26, 62);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);

  const B = V(data.bonaire[0], 0, data.bonaire[1]);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xfff0e4, 0x0a2733, 1.5));
  const sun = new THREE.DirectionalLight(0xffdcc6, 2.1);
  sun.position.set(-8, 18, -10);
  scene.add(sun);
  const bonaireLight = new THREE.PointLight(COL.orange, 10, 7, 1.6);
  bonaireLight.position.copy(B).add(V(0, 1.1, 0));
  scene.add(bonaireLight);

  // ---------- ocean + graticule ----------
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector2(B.x, B.z) },
      uA: { value: new THREE.Color(COL.ocean) },
      uB: { value: new THREE.Color(COL.sea) },
      uO: { value: new THREE.Color(COL.orange) },
      uTime: { value: 0 },
    },
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec2 uCenter; uniform vec3 uA; uniform vec3 uB; uniform vec3 uO; uniform float uTime; varying vec2 vP;
      void main(){ float d = distance(vP, uCenter);
        vec3 c = mix(uB, uA, smoothstep(0.0, 20.0, d));
        float ring = smoothstep(0.92, 1.0, sin(d * 5.0 - uTime * 1.1)) * (1.0 - smoothstep(0.4, 3.2, d));
        c += uO * ring * 0.08;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.02;
  scene.add(ocean);

  const gratPts = [];
  const { x0, x1, z0, z1 } = map.size;
  for (let x = Math.ceil(x0 / 2.4) * 2.4; x <= x1; x += 2.4) gratPts.push(x, 0, z0 - 4, x, 0, z1 + 4);
  for (let z = Math.ceil(z0 / 2.4) * 2.4; z <= z1; z += 2.4) gratPts.push(x0 - 4, 0, z, x1 + 4, 0, z);
  const gratGeo = new THREE.BufferGeometry();
  gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPts, 3));
  const grat = new THREE.LineSegments(gratGeo, new THREE.LineBasicMaterial({ color: COL.petrol, transparent: true, opacity: 0.32 }));
  scene.add(grat);

  // ---------- land ----------
  const buckets = { i: [], m: [], b: [] };
  for (const p of mobile ? map.lo : map.hi) {
    const pts = [];
    for (let i = 0; i < p.r.length; i += 2) pts.push(new THREE.Vector2(p.r[i], -p.r[i + 1]));
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
    const depth = p.k === 'b' ? 0.3 : p.k === 'm' ? 0.07 : 0.15;
    const bevel = !mobile && p.k !== 'm';
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth, curveSegments: 1, bevelEnabled: bevel, bevelThickness: 0.05, bevelSize: 0.012, bevelSegments: 1,
    });
    g.rotateX(-Math.PI / 2);
    buckets[p.k].push(g.index ? g.toNonIndexed() : g);
  }
  const mergeGroups = (geoms, groupIndex) => {
    const pos = [], nor = [];
    for (const g of geoms) {
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      for (const grp of g.groups) {
        if (grp.materialIndex !== groupIndex) continue;
        for (let j = grp.start * 3; j < (grp.start + grp.count) * 3; j++) { pos.push(P[j]); nor.push(N[j]); }
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  };
  const landMesh = (geoms, top, side, extra = {}) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(mergeGroups(geoms, 0), new THREE.MeshStandardMaterial({ color: top, roughness: 0.85, metalness: 0, flatShading: true, ...extra })));
    grp.add(new THREE.Mesh(mergeGroups(geoms, 1), new THREE.MeshStandardMaterial({ color: side, roughness: 0.9, metalness: 0, ...extra })));
    geoms.forEach((g) => g.dispose());
    return grp;
  };
  scene.add(landMesh(buckets.m, COL.main, COL.mainSide));
  scene.add(landMesh(buckets.i, COL.land, COL.landSide));
  scene.add(landMesh(buckets.b, COL.orange, 0xb8481f, { emissive: COL.orange, emissiveIntensity: 0.55 }));

  // ---------- glow sprite texture ----------
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glow = (color, size, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size);
    return s;
  };

  // ---------- Bonaire beacon ----------
  const beacon = new THREE.Group();
  beacon.position.copy(B);
  scene.add(beacon);
  const bGlow = glow(COL.orange, 2.4, 0.85);
  bGlow.position.y = 0.4;
  beacon.add(bGlow);
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.37, 64), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.userData.phase = i / 3;
    beacon.add(m);
    return m;
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.9, depthWrite: false }));
  beam.position.y = 0.5;
  beacon.add(beam);

  // ---------- regional connections (working area, not offices) ----------
  const TUBE = mobile ? 40 : 64;
  const RADIAL = 5;
  const arcs = data.targets.map(({ region, p }, i) => {
    const start = V(B.x, 0.32, B.z);
    const end = V(p[0], 0.16, p[1]);
    const d = start.distanceTo(end);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = 0.5 + d * 0.3;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const mat = new THREE.MeshBasicMaterial({ color: COL.apricot, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBE, mobile ? 0.034 : 0.022, RADIAL, false), mat);
    mesh.geometry.setDrawRange(0, 0);
    scene.add(mesh);
    const dotMat = new THREE.MeshBasicMaterial({ color: COL.apricot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const dot = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.15, 32), dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.copy(end).setY(0.19);
    scene.add(dot);
    const pulse = glow(COL.paper, 0.55, 0);
    scene.add(pulse);
    return { region, curve, mesh, mat, dot, dotMat, pulse, end, draw: 0, strength: 0, delay: 0.25 + i * 0.07 };
  });

  // Secondary links between neighbouring places: the calm regional network of the closing scene.
  const netMat = new THREE.MeshBasicMaterial({ color: COL.paper, transparent: true, opacity: 0, depthWrite: false });
  const net = new THREE.Group();
  const done = new Set();
  arcs.forEach((a, i) => {
    let best = -1, bd = Infinity;
    arcs.forEach((b, j) => { if (i !== j) { const d = a.end.distanceTo(b.end); if (d < bd) { bd = d; best = j; } } });
    const key = [i, best].sort().join('-');
    if (best < 0 || done.has(key) || bd > 9) return;
    done.add(key);
    const s = a.end.clone().setY(0.18), e = arcs[best].end.clone().setY(0.18);
    const m = s.clone().lerp(e, 0.5); m.y = 0.3 + bd * 0.18;
    net.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(s, m, e), 24, 0.012, 4, false), netMat));
  });
  scene.add(net);

  // ---------- particles (depth + parallax) ----------
  let dust = null;
  if (!mobile) {
    const n = 420, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - 0.5) * 44; arr[i * 3 + 1] = 1.2 + Math.random() * 9; arr[i * 3 + 2] = (Math.random() - 0.5) * 30; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: COL.apricot, size: 0.045, transparent: true, opacity: 0.35, depthWrite: false }));
    scene.add(dust);
  }

  // ---------- services: four layers ordered above Bonaire ----------
  const services = new THREE.Group();
  services.position.copy(B);
  scene.add(services);
  const fade = []; // [material, baseOpacity, groupKey]
  const track = (mat, base, key) => { mat.transparent = true; mat.depthWrite = false; fade.push([mat, base, key]); return mat; };
  const std = (color, base, key, extra = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra }), base, key);
  const basic = (color, base, key) => track(new THREE.MeshBasicMaterial({ color }), base, key);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 5.6, 6), basic(COL.orange, 0.9, 'services'));
  spine.position.y = 2.8;
  services.add(spine);

  const LAYER_W = 3.4, LAYER_D = 2.3;
  const layers = [0, 1, 2, 3].map((i) => {
    const g = new THREE.Group();
    const key = `layer${i}`;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(LAYER_W, 0.04, LAYER_D), std(COL.petrol, 0.55, key));
    g.add(plate);
    const edgeMat = basic(COL.paper, 0.5, key);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), edgeMat);
    g.add(edges);
    const accent = [];
    if (i === 0) {
      // Supplier market: a grid of suppliers, one selected.
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const chosen = r === 1 && c === 3;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, chosen ? 0.36 : 0.14, 16), chosen ? std(COL.orange, 1, key, { emissive: COL.orange, emissiveIntensity: 0.4 }) : std(COL.paper, 0.75, key));
        m.position.set(-1.2 + c * 0.6, (chosen ? 0.18 : 0.07) + 0.02, -0.6 + r * 0.6);
        g.add(m);
        if (chosen) accent.push(m);
      }
    } else if (i === 1) {
      // System: connected components.
      const nodes = [[-0.9, -0.35], [0.9, -0.45], [0, 0.5], [0, -0.2]];
      nodes.forEach(([x, z], k) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(k === 3 ? 0.36 : 0.5, k === 3 ? 0.36 : 0.22, k === 3 ? 0.36 : 0.5), k === 3 ? std(COL.orange, 1, key, { emissive: COL.orange, emissiveIntensity: 0.35 }) : std(COL.paper, 0.8, key));
        m.position.set(x, 0.14 + (k === 3 ? 0.08 : 0), z);
        g.add(m);
        if (k === 3) accent.push(m);
      });
      const lp = [];
      [[0, 3], [1, 3], [2, 3], [0, 2], [1, 2]].forEach(([a, b]) => lp.push(nodes[a][0], 0.12, nodes[a][1], nodes[b][0], 0.12, nodes[b][1]));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      g.add(new THREE.LineSegments(lg, basic(COL.apricot, 0.9, key)));
    } else if (i === 2) {
      // Documents, analysed with a scanning line and reviewed by people.
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.64), std(COL.paper, 0.85, key));
        m.position.set(-1.1 + k * 0.52, 0.05 + k * 0.035, 0);
        m.rotation.y = (k - 2) * 0.05;
        g.add(m);
      }
      const scan = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.9), basic(COL.orange, 1, key));
      scan.position.set(-1.3, 0.28, 0);
      scan.userData.scan = true;
      g.add(scan);
      accent.push(scan);
      const review = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 32), std(COL.apricot, 0.95, key));
      review.rotation.x = -Math.PI / 2;
      review.position.set(1.35, 0.1, -0.75);
      g.add(review);
    } else {
      // Team: people around shared knowledge.
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32), std(COL.orange, 1, key, { emissive: COL.orange, emissiveIntensity: 0.35 }));
      core.position.y = 0.07;
      g.add(core);
      accent.push(core);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), std(COL.paper, 0.85, key));
        m.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.62);
        g.add(m);
      }
    }
    const ordered = V(0, 1.3 + i * 1.15, 0);
    const scattered = V((Math.random() - 0.5) * 7, 0.6 + Math.random() * 5, (Math.random() - 0.5) * 6);
    services.add(g);
    return { g, key, edgeMat, accent, ordered, scattered, spin: (Math.random() - 0.5) * 1.6, active: 0 };
  });

  // ---------- process: four milestones from objective to agreement ----------
  const process = new THREE.Group();
  scene.add(process);
  const MS = [V(1.7, 0.9, -1.0), V(3.5, 1.5, -2.1), V(5.3, 2.1, -2.8), V(7.1, 2.7, -3.1)].map((v) => v.add(B));
  const path = new THREE.CatmullRomCurve3([V(B.x, 0.34, B.z), ...MS], false, 'centripetal');
  const lengths = path.getLengths(400);
  const total = lengths[lengths.length - 1];
  const msU = MS.map((_, i) => lengths[Math.round(((i + 1) / 4) * 400)] / total);
  const PATH_SEG = 160;
  const pathGeo = new THREE.TubeGeometry(path, PATH_SEG, 0.02, 6, false);
  process.add(new THREE.Mesh(pathGeo, basic(COL.paper, 0.28, 'process')));
  const progGeo = new THREE.TubeGeometry(path, PATH_SEG, 0.034, 6, false);
  const progMesh = new THREE.Mesh(progGeo, basic(COL.orange, 1, 'process'));
  process.add(progMesh);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), basic(COL.orange, 1, 'process'));
  const orbGlow = glow(COL.orange, 1.6, 0);
  const orbLight = new THREE.PointLight(COL.orange, 0, 5, 1.6);
  process.add(orb, orbGlow, orbLight);
  const milestones = MS.map((p, i) => {
    const g = new THREE.Group();
    g.position.copy(p);
    process.add(g);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, p.y, 6), basic(COL.paper, 0.35, 'process'));
    stem.position.y = -p.y / 2;
    g.add(stem);
    const base = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), basic(COL.apricot, 0.6, 'process'));
    base.material.side = THREE.DoubleSide;
    base.rotation.x = -Math.PI / 2;
    base.position.y = -p.y + 0.02;
    g.add(base);
    const mat = std(COL.paper, 0.95, 'process', { emissive: COL.orange, emissiveIntensity: 0 });
    const cap = new THREE.Group();
    if (i === 0) {
      [0.2, 0.32].forEach((r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 8, 48), mat); t.rotation.x = -Math.PI / 2; cap.add(t); });
    } else if (i === 1) {
      cap.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.46, 0.46, 0.46)), basic(COL.apricot, 0.9, 'process')));
      cap.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat));
    } else if (i === 2) {
      [-0.32, 0, 0.32].forEach((x) => { const o = new THREE.Mesh(new THREE.OctahedronGeometry(x === 0 ? 0.2 : 0.11), x === 0 ? mat : std(COL.paper, 0.45, 'process')); o.position.x = x; cap.add(o); });
    } else {
      const t1 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 10, 40), mat);
      const t2 = t1.clone();
      t1.position.x = -0.1; t2.position.x = 0.1; t2.rotation.y = Math.PI / 2;
      cap.add(t1, t2);
    }
    cap.position.y = 0.3;
    g.add(cap);
    return { g, cap, mat, lit: 0 };
  });

  // ---------- HTML label for Bonaire ----------
  const label = document.createElement('span');
  label.className = 'map-label';
  label.textContent = data.bonaireLabel;
  labels.append(label);

  // ---------- scroll → narrative state ----------
  const els = {
    hero: document.getElementById('top'),
    region: document.getElementById('region'),
    services: document.getElementById('services'),
    process: document.getElementById('approach'),
    contact: document.getElementById('contact'),
  };
  const ORDER = ['hero', 'region', 'services', 'process', 'contact'];
  let ranges = [];
  function measure() {
    const vh = innerHeight;
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const r = (el, a, bOff) => { const t = top(el); return [t + a * vh, Math.max(t + a * vh, t + el.offsetHeight - bOff * vh)]; };
    ranges = [
      [0, 0],
      r(els.region, -0.05, 1),
      r(els.services, -0.35, 0.9),
      r(els.process, -0.35, 0.9),
      [top(els.contact) - 0.55 * vh, Infinity],
    ];
  }
  function weights(y) {
    const w = { hero: 0, region: 0, services: 0, process: 0, contact: 0 };
    const local = { hero: 0, region: 0, services: 0, process: 0, contact: 0 };
    for (let i = 0; i < ranges.length; i++) {
      const [a, b] = ranges[i];
      const k = ORDER[i];
      if (y >= a && y <= b) { w[k] = 1; local[k] = b > a && isFinite(b) ? (y - a) / (b - a) : 0; return { w, local }; }
      const next = ranges[i + 1];
      if (next && y > b && y < next[0]) {
        const t = smooth(clamp01((y - b) / (next[0] - b)));
        w[k] = 1 - t; w[ORDER[i + 1]] = t;
        local[k] = 1; local[ORDER[i + 1]] = 0;
        return { w, local };
      }
    }
    w.hero = 1;
    return { w, local };
  }

  // Camera poses per state: position, target, horizontal/vertical composition shift.
  const wide = () => innerWidth >= 1024;
  function pose(k, t) {
    const far = wide() ? 1 : 1.45;
    const sx = wide() ? 1 : 0;
    const sy = wide() ? 0 : 1;
    switch (k) {
      case 'hero': {
        const T = V(0.2, 0, 0.8);
        return { p: T.clone().add(V(0, 20, 16.5).multiplyScalar(far)), t: T, sx: 0.17 * sx, sy: 0.16 * sy };
      }
      case 'region': {
        const T = B.clone().add(V(-2.2, 0, -1.6));
        const off = V(-0.6, 13.5, 11).lerp(V(-0.2, 10.5, 8.2), smooth(t)).multiplyScalar(far);
        return { p: T.clone().add(off), t: T, sx: 0.2 * sx, sy: 0.2 * sy };
      }
      case 'services': {
        const c = B.clone().add(V(0, 2.8, 0));
        const ang = -0.55 + t * 0.7;
        const rad = 11.5 * far;
        return { p: c.clone().add(V(Math.sin(ang) * rad, 3.4 * far, Math.cos(ang) * rad)), t: c, sx: -0.27 * sx, sy: 0.22 * sy };
      }
      case 'process': {
        if (!wide()) {
          const T = MS[0].clone().lerp(MS[3], 0.25 + 0.5 * smooth(t)).add(V(0, -0.8, 0));
          return { p: T.clone().add(V(-1.5, 9, 9.5)), t: T, sx: 0, sy: 0.2 };
        }
        const T = MS[0].clone().lerp(MS[3], smooth(t)).add(V(-0.4, -0.5, 0));
        return { p: T.clone().add(V(-2.2, 5.2, 8.6).multiplyScalar(far)), t: T, sx: 0.22 * sx, sy: 0.22 * sy };
      }
      default: {
        const T = B.clone().add(wide() ? V(2.0, 0, -4.6) : V(0, 0, -1.8));
        return { p: T.clone().add(V(3, 17, 15).multiplyScalar(far)), t: T, sx: -0.04 * sx, sy: 0.18 * sy };
      }
    }
  }

  // ---------- runtime ----------
  const cam = { p: V(0, 30, 30), t: V(0, 0, 0), sx: 0, sy: 0 };
  let first = true;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const finePointer = matchMedia('(pointer: fine)').matches;
  if (finePointer) addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  let W = 0, H = 0;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.6));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.9 ? 50 : 36;
    measure();
  }

  let time = 0, intro = 0, svcSel = 0, stepU = msU[0];
  const tmp = V(0, 0, 0);

  function frame(dt) {
    const motion = state.motion;
    const k = motion ? 1 : 1e6; // no easing when motion is off
    if (motion) time += dt;
    intro = motion ? Math.min(1, intro + dt / 2.6) : 1;

    const { w, local } = weights(scrollY);
    // blend the two active poses
    const target = { p: V(0, 0, 0), t: V(0, 0, 0), sx: 0, sy: 0 };
    for (const key of ORDER) {
      if (!w[key]) continue;
      const q = pose(key, local[key]);
      target.p.addScaledVector(q.p, w[key]);
      target.t.addScaledVector(q.t, w[key]);
      target.sx += q.sx * w[key];
      target.sy += q.sy * w[key];
    }
    if (first) { cam.p.copy(target.p).add(V(0, 6, 6)); cam.t.copy(target.t); cam.sx = target.sx; cam.sy = target.sy; first = false; if (!motion) cam.p.copy(target.p); }
    const kk = 2.4;
    cam.p.x = damp(cam.p.x, target.p.x, kk * k, dt); cam.p.y = damp(cam.p.y, target.p.y, kk * k, dt); cam.p.z = damp(cam.p.z, target.p.z, kk * k, dt);
    cam.t.x = damp(cam.t.x, target.t.x, kk * k, dt); cam.t.y = damp(cam.t.y, target.t.y, kk * k, dt); cam.t.z = damp(cam.t.z, target.t.z, kk * k, dt);
    cam.sx = damp(cam.sx, target.sx, kk * k, dt); cam.sy = damp(cam.sy, target.sy, kk * k, dt);

    // gentle cursor response (camera only; the page content stays still)
    const pf = motion && finePointer ? 1 : 0;
    pointer.sx = damp(pointer.sx, pointer.x * pf, 2, dt);
    pointer.sy = damp(pointer.sy, pointer.y * pf, 2, dt);
    const par = 0.5 + 0.5 * w.hero;
    camera.position.copy(cam.p);
    camera.lookAt(cam.t);
    tmp.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(tmp, pointer.sx * 0.9 * par);
    tmp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(tmp, -pointer.sy * 0.5 * par);
    camera.lookAt(cam.t);
    camera.setViewOffset(W, H, -cam.sx * W, cam.sy * H, W, H);

    oceanMat.uniforms.uTime.value = time;
    if (dust) { dust.rotation.y = time * 0.006; dust.position.y = Math.sin(time * 0.2) * 0.15; }

    // Bonaire beacon
    rings.forEach((r) => {
      const ph = motion ? (time * 0.35 + r.userData.phase) % 1 : r.userData.phase;
      r.scale.setScalar(1 + ph * 3.2);
      r.material.opacity = (1 - ph) * 0.55;
    });
    beam.scale.y = 0.6 + 0.4 * (w.hero + w.region + w.contact);
    bGlow.material.opacity = 0.65 + (motion ? Math.sin(time * 1.6) * 0.12 : 0);

    // arcs: working-area connections
    const sel = state.region;
    arcs.forEach((a, i) => {
      const isSel = a.region === sel;
      const want = w.hero * 0.5 + w.region * (isSel ? 1 : 0.14) + w.services * 0.06 + w.process * 0.04 + w.contact * 0.8;
      a.strength = damp(a.strength, want, 3 * k, dt);
      const drawT = clamp01((intro * 2.6 - a.delay) / 1.2);
      a.draw = motion ? smooth(drawT) : 1;
      const segs = Math.floor(a.draw * TUBE);
      a.mesh.geometry.setDrawRange(0, segs * RADIAL * 6);
      a.mat.opacity = a.strength * 0.95;
      const hot = isSel ? w.region : 0;
      a.mat.color.setHex(COL.apricot).lerp(new THREE.Color(COL.orange), hot);
      a.dotMat.opacity = a.strength * (a.draw > 0.98 ? 1 : 0);
      a.dotMat.color.copy(a.mat.color);
      a.dot.scale.setScalar(1 + hot * 0.6);
      if (motion && a.strength > 0.2) {
        const u = (time * 0.18 + i * 0.137) % 1;
        a.pulse.position.copy(a.curve.getPoint(u));
        a.pulse.material.opacity = a.strength * Math.sin(u * Math.PI) * 0.9 * a.draw;
      } else a.pulse.material.opacity = 0;
    });
    netMat.opacity = w.contact * 0.3;
    net.visible = w.contact > 0.01;

    // services layers
    svcSel = damp(svcSel, state.service, 4 * k, dt);
    services.visible = w.services > 0.01;
    const assemble = smooth(w.services);
    layers.forEach((L, i) => {
      L.active = damp(L.active, state.service === i ? 1 : 0, 5 * k, dt);
      L.g.position.lerpVectors(L.scattered, L.ordered, assemble);
      L.g.position.y += L.active * 0.3;
      L.g.rotation.y = (1 - assemble) * L.spin + (motion ? Math.sin(time * 0.3 + i) * 0.03 : 0);
      L.edgeMat.color.setHex(COL.paper).lerp(new THREE.Color(COL.orange), L.active);
      L.accent.forEach((m) => {
        if (m.userData.scan) m.position.x = motion ? -1.3 + ((time * 0.5) % 1) * 2.6 : 0;
      });
    });
    fade.forEach(([mat, base, key]) => {
      let f = 0;
      if (key === 'services') f = w.services;
      else if (key === 'process') f = w.process;
      else f = w.services * (0.28 + 0.72 * layers[+key.slice(5)].active);
      mat.opacity = base * f;
      mat.visible = f > 0.005;
    });

    // process path
    process.visible = w.process > 0.01;
    stepU = damp(stepU, msU[state.step], 2.2 * k, dt);
    progMesh.geometry.setDrawRange(0, Math.floor(stepU * PATH_SEG) * 6 * 6);
    const op = path.getPointAt(Math.min(0.999, stepU));
    orb.position.copy(op);
    orbGlow.position.copy(op);
    orbGlow.material.opacity = w.process * 0.9;
    orbLight.position.copy(op).add(V(0, 0.4, 0));
    orbLight.intensity = w.process * 8;
    milestones.forEach((m, i) => {
      const lit = state.step === i ? 1 : 0;
      m.lit = damp(m.lit, lit, 5 * k, dt);
      const passed = i < state.step;
      m.mat.color.setHex(passed ? COL.apricot : COL.paper).lerp(new THREE.Color(COL.orange), m.lit);
      m.mat.emissiveIntensity = m.lit * 0.6;
      m.cap.scale.setScalar(1 + m.lit * 0.3);
      if (motion) m.cap.rotation.y += dt * (0.2 + m.lit * 0.6);
    });

    // Bonaire label
    const lv = clamp01((wide() ? w.hero : 0) + w.region + w.contact);
    tmp.copy(B).setY(0.55).project(camera);
    const visible = lv > 0.3 && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    label.style.opacity = visible ? String(lv) : '0';
    label.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp.y) / 2) * H - 18}px) translate(-50%, -100%)`;

    renderer.render(scene, camera);
  }

  // ---------- loop control: pause off-screen, in hidden tabs, and when motion is off ----------
  const visibleScenes = new Set();
  let raf = 0, last = performance.now();
  const isVisible = () => visibleScenes.size > 0 && !document.hidden;
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!isVisible()) return;
    frame(dt);
    if (state.motion) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (!raf && isVisible()) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visibleScenes.add(e.target) : visibleScenes.delete(e.target)));
    kick();
  });
  Object.values(els).forEach((el) => el && io.observe(el));
  document.addEventListener('visibilitychange', kick);
  addEventListener('scroll', () => { if (!state.motion) kick(); }, { passive: true });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { resize(); kick(); }); });
  new ResizeObserver(() => measure()).observe(document.body);
  state.listeners.add(() => kick());

  resize();
  frame(0.016);
  kick();
  return { kick };
}
