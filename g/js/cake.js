// Galaxy birthday cake, candles, starfield, orbit rings, particle number, fireworks, smoke.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function glowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function drawStar(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function drawFlower(g, x, y, r, color) {
  g.save(); g.translate(x, y); g.rotate(rand(0, 6));
  g.fillStyle = color; g.globalAlpha = 0.85;
  for (let k = 0; k < 5; k++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = '#f2c46b'; g.beginPath(); g.arc(0, 0, r * 0.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(120,150,90,.7)';
  for (const a of [0.6, 2.4]) { g.beginPath(); g.ellipse(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1, r * 0.18, r * 0.42, a, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function cakeTexture(p) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, p.top); grd.addColorStop(1, p.bottom);
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  // soft nebula clouds
  for (let i = 0; i < 70; i++) {
    const x = rand(0, c.width), y = rand(0, c.height), r = rand(40, 180);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = pick(p.nebula);
    rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // painted flowers (warm theme)
  for (let i = 0; i < (p.flowers ? 26 : 0); i++) drawFlower(g, rand(0, c.width), rand(40, c.height - 40), rand(14, 26), pick(p.flowers));
  // gold leaf flecks
  for (let i = 0; i < (p.flecks ?? 700); i++) {
    g.fillStyle = `rgba(255,${rand(190, 225) | 0},${rand(110, 160) | 0},${rand(0.4, 1)})`;
    g.beginPath();
    g.ellipse(rand(0, c.width), rand(0, c.height), rand(1, 5), rand(1, 3), rand(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  // candy dots
  for (let i = 0; i < (p.dotCount ?? 160); i++) {
    g.fillStyle = pick(p.dots);
    g.globalAlpha = rand(0.6, 1);
    g.beginPath(); g.arc(rand(0, c.width), rand(0, c.height), rand(3, 12), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = p.gold;
  for (let i = 0; i < (p.stars ?? 40); i++) drawStar(g, rand(0, c.width), rand(0, c.height), rand(7, 18));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Warm, homely default: vanilla sponge, peach/rose watercolour, little painted flowers, caramel drips.
export const WARM_PALETTE = {
  top: '#fff3e2', bottom: '#f6dfbf',
  nebula: ['#f3b49c', '#f7d3a1', '#f2c2c8', '#e8b98a'],
  gold: '#e7b65c',
  dots: ['#ffd9a0', '#ffb89a', '#ffe9c8', '#f6a6a0', '#ffcf7a'],
  flowers: ['#f19c94', '#f6c1c7', '#ffffff', '#f3b97a'],
  flecks: 260, dotCount: 40, stars: 0,
  candles: ['#fbe3d4', '#fff1c1', '#f6d0c8', '#e9e0f5', '#d9eedd'],
  frosting: '#fffaf0', drip: '#c98a4b', plate: '#f4ece2', glow: 0.2,
  scene: { bgTop: '#2a1812', bgBottom: '#0c0706', fog: '#140c09', stars: [0.06, 0.12], hemi: ['#ffe2c4', '#2a160f'], key: '#ffd9b0', rim: '#ff9e7a' },
};
export const GALAXY_PALETTE = {
  top: '#2c2f86', bottom: '#11164a',
  nebula: ['#7b5cff', '#ff7ac8', '#4cc9ff', '#9b6bff'],
  gold: '#ffd479',
  dots: ['#ffd479', '#ff8fb1', '#8fd3ff', '#ffffff', '#b69cff'],
  candles: ['#ffd6e0', '#fff1c1', '#cde7ff', '#e3d5ff', '#d7f5e3'],
  frosting: '#fff1dc', drip: '#fff1dc', plate: '#c9cde8', glow: 0.22,
  scene: { bgTop: '#0d0f2e', bgBottom: '#05061a', fog: '#05061a', stars: [0.55, 0.72], hemi: ['#a9b4ff', '#1a1030'], key: '#ffe9d0', rim: '#8a7dff' },
};
// Romantic rose theme (520 / anniversaries / partners)
export const ROSE_PALETTE = {
  top: '#fde7ea', bottom: '#f6c9cf',
  nebula: ['#f59aa8', '#fbc4cc', '#f7b0bd', '#ffd6dc'],
  gold: '#f1b45f',
  dots: ['#ffc2cc', '#ff9db0', '#ffe3e8', '#f7a6b8', '#ffd9a0'],
  flowers: ['#e9667c', '#ffffff', '#f6a5b4', '#c94a63'],
  flecks: 220, dotCount: 30, stars: 0,
  candles: ['#ffe0e6', '#fff1f3', '#f8c7d0', '#fde2cf', '#f1d6f0'],
  frosting: '#fff5f6', drip: '#b8434f', plate: '#f7e9ec', glow: 0.2,
  scene: { bgTop: '#2b1018', bgBottom: '#0d0508', fog: '#150810', stars: [0.93, 0.99], hemi: ['#ffd6de', '#2a0f18'], key: '#ffd0d8', rim: '#ff7f9a' },
};
export const DEFAULT_PALETTE = WARM_PALETTE;
export const THEMES = { warm: WARM_PALETTE, galaxy: GALAXY_PALETTE, rose: ROSE_PALETTE };

const flameVert = /* glsl */`
  attribute float aLit; attribute float aPhase;
  uniform float uTime; uniform float uSize; uniform float uScale; uniform float uMin;
  varying float vLit; varying float vFlick;
  void main() {
    float f = 0.82 + 0.18 * sin(uTime * 11.0 + aPhase) * sin(uTime * 6.7 + aPhase * 1.7);
    vec3 p = position; p.y += 0.012 * f;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = max(uSize * f * uScale / -mv.z, uMin) * aLit; // stays visible from far away
    vLit = aLit; vFlick = f;
    gl_Position = projectionMatrix * mv;
  }`;
const flameFrag = /* glsl */`
  uniform vec3 uInner; uniform vec3 uOuter; uniform float uHalo;
  varying float vLit; varying float vFlick;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (uHalo > 0.5) {
      float d = length(c);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(uOuter * a * a * 0.22 * vLit, 1.0);
      return;
    }
    c.y += 0.08;                       // teardrop: narrow at the top
    float w = mix(1.0, 2.6, clamp(-c.y * 2.0 + 0.5, 0.0, 1.0));
    float d = length(vec2(c.x * w, c.y * 1.15));
    float core = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uOuter, uInner, pow(core, 1.5));
    gl_FragColor = vec4(col * core * 1.15 * vFlick * vLit, 1.0);
  }`;

export function buildCake({ age = 60, palette = DEFAULT_PALETTE } = {}) {
  const group = new THREE.Group();
  const tex = cakeTexture(palette);
  const frostMat = new THREE.MeshStandardMaterial({ color: palette.frosting, roughness: 0.45, metalness: 0.0 });
  const dripMat = new THREE.MeshStandardMaterial({ color: palette.drip || palette.frosting, roughness: 0.3, metalness: 0.0 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c56a', roughness: 0.25, metalness: 0.9, emissive: '#3a2600' });

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(2.9, 3.0, 0.12, 96),
    new THREE.MeshStandardMaterial({ color: palette.plate || '#c9cde8', roughness: 0.35, metalness: 0.25 }));
  plate.position.y = 0.06;
  group.add(plate);

  const tiers = [{ r: 2.2, h: 1.1 }, { r: 1.62, h: 1.0 }, { r: 1.08, h: 0.9 }];
  let y = 0.12;
  const dripGeo = new THREE.CapsuleGeometry(0.055, 1, 4, 10);
  const pearlGeo = new THREE.SphereGeometry(0.055, 12, 10);
  const m4 = new THREE.Matrix4();
  for (const [i, t] of tiers.entries()) {
    const tm = tex.clone(); tm.needsUpdate = true; tm.repeat.set(2 + i, 1); tm.offset.x = i * 0.31;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(t.r, t.r, t.h, 128, 1, true),
      new THREE.MeshStandardMaterial({ map: tm, roughness: 0.55, emissive: '#ffffff', emissiveMap: tm, emissiveIntensity: palette.glow ?? 0.22 }));
    body.position.y = y + t.h / 2;
    group.add(body);
    const top = new THREE.Mesh(new THREE.CircleGeometry(t.r + 0.02, 96), frostMat);
    top.rotation.x = -Math.PI / 2; top.position.y = y + t.h + 0.001;
    group.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(t.r, 0.085, 16, 128), frostMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = y + t.h;
    group.add(ring);
    // frosting drips
    const nd = Math.round(t.r * 16);
    const drips = new THREE.InstancedMesh(dripGeo, dripMat, nd);
    for (let k = 0; k < nd; k++) {
      const a = (k / nd) * Math.PI * 2 + rand(-0.08, 0.08);
      const len = rand(0.08, 0.38) * t.h;
      m4.compose(
        new THREE.Vector3(Math.sin(a) * (t.r + 0.01), y + t.h - len / 2 - 0.02, Math.cos(a) * (t.r + 0.01)),
        new THREE.Quaternion(), new THREE.Vector3(1, len, 1));
      drips.setMatrixAt(k, m4);
    }
    group.add(drips);
    // gold pearls around the base
    const np = Math.round(t.r * 42);
    const pearls = new THREE.InstancedMesh(pearlGeo, goldMat, np);
    for (let k = 0; k < np; k++) {
      const a = (k / np) * Math.PI * 2;
      m4.makeTranslation(Math.sin(a) * (t.r + 0.03), y + 0.05, Math.cos(a) * (t.r + 0.03));
      pearls.setMatrixAt(k, m4);
    }
    group.add(pearls);
    y += t.h;
  }
  const topY = y;

  // Candles: phyllotaxis on the top tier, one per year.
  const candleH = 0.42;
  const candleGeo = new THREE.CylinderGeometry(0.032, 0.032, candleH, 10);
  const candles = new THREE.InstancedMesh(candleGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#331a00', emissiveIntensity: 0.4 }), age);
  const flamePos = new Float32Array(age * 3);
  const phase = new Float32Array(age);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const maxR = tiers[2].r * 0.86;
  const col = new THREE.Color();
  for (let i = 0; i < age; i++) {
    const r = maxR * Math.sqrt((i + 0.5) / age);
    const a = i * golden;
    const h = candleH * (0.85 + 0.3 * (1 - r / maxR)); // taller in the middle
    m4.compose(new THREE.Vector3(Math.sin(a) * r, topY + h / 2, Math.cos(a) * r),
      new THREE.Quaternion(), new THREE.Vector3(1, h / candleH, 1));
    candles.setMatrixAt(i, m4);
    candles.setColorAt(i, col.set(palette.candles[i % palette.candles.length]));
    flamePos.set([Math.sin(a) * r, topY + h + 0.07, Math.cos(a) * r], i * 3);
    phase[i] = Math.random() * 100;
  }
  group.add(candles);

  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
  const lit = new Float32Array(age);
  fGeo.setAttribute('aLit', new THREE.BufferAttribute(lit, 1));
  fGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const uniforms = {
    uTime: { value: 0 }, uSize: { value: 0.16 }, uScale: { value: 500 }, uHalo: { value: 0 }, uMin: { value: 4 },
    uInner: { value: new THREE.Color('#fff7d6') }, uOuter: { value: new THREE.Color('#ff9a2e') },
  };
  const mk = (size, halo) => new THREE.ShaderMaterial({
    vertexShader: flameVert, fragmentShader: flameFrag, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { ...uniforms, uSize: { value: size }, uHalo: { value: halo }, uMin: { value: halo ? 14 : 5 } },
  });
  const flameMat = mk(0.14, 0), haloMat = mk(0.42, 1);
  haloMat.uniforms.uTime = flameMat.uniforms.uTime = uniforms.uTime;
  haloMat.uniforms.uScale = flameMat.uniforms.uScale = uniforms.uScale;
  const flames = new THREE.Points(fGeo, flameMat);
  const halos = new THREE.Points(fGeo, haloMat);
  flames.renderOrder = 3; halos.renderOrder = 2;
  group.add(halos, flames);

  const light = new THREE.PointLight('#ffb56b', 0, 14, 1.6);
  light.position.set(0, topY + 0.9, 0);
  group.add(light);

  const target = new Float32Array(age);
  return {
    group, topY, age, flamePos,
    setLit(n) { for (let i = 0; i < age; i++) target[i] = i < n ? 1 : 0; },
    litCount() { let n = 0; for (let i = 0; i < age; i++) n += target[i]; return n; },
    blowOut() { target.fill(0); },
    setScale(s) { uniforms.uScale.value = s; },
    update(time, dt) {
      uniforms.uTime.value = time;
      let sum = 0;
      for (let i = 0; i < age; i++) {
        const k = target[i] > lit[i] ? 3.5 : 7; // light slowly, blow out fast
        lit[i] += (target[i] - lit[i]) * Math.min(1, dt * k);
        sum += lit[i];
      }
      fGeo.attributes.aLit.needsUpdate = true;
      light.intensity = 0.3 + (sum / age) * 2.2 * (0.9 + 0.1 * Math.sin(time * 9));
    },
  };
}

export function buildStarfield(n = 3500, hue = [0.55, 0.72]) {
  const pos = new Float32Array(n * 3), colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = rand(45, 120), u = rand(-1, 1), a = rand(0, Math.PI * 2);
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    c.setHSL(rand(hue[0], hue[1]), rand(0.25, 0.7), rand(0.6, 0.9));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.55, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.85,
  }));
  return pts;
}

// Tilted rings of colourful dust orbiting the cake (like the Douyin galaxy cake).
export function buildOrbitRings(palette = DEFAULT_PALETTE) {
  const group = new THREE.Group();
  const tex = glowTexture();
  const rings = [
    { r: 3.3, tilt: 0.35, y: 1.2, n: 900, speed: 0.12 },
    { r: 4.0, tilt: -0.28, y: 2.3, n: 1000, speed: -0.08 },
    { r: 3.0, tilt: 0.15, y: 3.6, n: 700, speed: 0.15 },
  ];
  const c = new THREE.Color();
  for (const R of rings) {
    const pos = new Float32Array(R.n * 3), col = new Float32Array(R.n * 3);
    for (let i = 0; i < R.n; i++) {
      const a = rand(0, Math.PI * 2), rr = R.r + rand(-0.25, 0.25) * (Math.random() < 0.8 ? 0.4 : 1.6);
      pos.set([Math.cos(a) * rr, rand(-0.04, 0.04), Math.sin(a) * rr], i * 3);
      c.set(Math.random() < 0.55 ? '#ffe2a8' : pick(palette.dots));
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.06, map: tex, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    const holder = new THREE.Group();
    holder.position.y = R.y; holder.rotation.x = R.tilt; holder.rotation.z = R.tilt * 0.6;
    holder.add(p); holder.userData.speed = R.speed; holder.userData.inner = p;
    group.add(holder);
  }
  // floating bokeh dots
  const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(2.6, 10);
    pos.set([Math.cos(a) * r, rand(-1.5, 8), Math.sin(a) * r], i * 3);
    c.set(pick(palette.dots)); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const bokeh = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.22, map: tex, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.55,
  }));
  group.add(bokeh);
  group.userData.update = (dt) => {
    for (const h of group.children) if (h.userData.inner) h.userData.inner.rotation.y += dt * h.userData.speed;
    bokeh.rotation.y += dt * 0.02;
  };
  return group;
}

// Particle text (e.g. "67") that can shimmer, scatter and re-form.
export function buildParticleText(text, { width = 3.4, color = '#ffd88a', font = '900 230px Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 10);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let y = 0; y < c.height; y += 3) for (let x = 0; x < c.width; x += 3)
    if (data[(y * c.width + x) * 4 + 3] > 128) pts.push(x, y);
  const n = pts.length / 2, scale = width / c.width;
  const home = new Float32Array(n * 3), away = new Float32Array(n * 3), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const base = new THREE.Color(color), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    home.set([(pts[i * 2] - c.width / 2) * scale, -(pts[i * 2 + 1] - c.height / 2) * scale, rand(-0.08, 0.08)], i * 3);
    const u = rand(-1, 1), a = rand(0, Math.PI * 2), s = Math.sqrt(1 - u * u), r = rand(3, 9);
    away.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    pos.set(away.subarray(i * 3, i * 3 + 3), i * 3);
    tmp.copy(base).offsetHSL(rand(-0.04, 0.04), 0, rand(-0.1, 0.15));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  });
  const points = new THREE.Points(geo, mat);
  const holder = new THREE.Group();
  holder.add(points);
  let form = 0, formTarget = 0, opTarget = 0;
  return {
    object: holder,
    formIn() { formTarget = 1; opTarget = 1; },
    scatter() { formTarget = 0; },
    hide() { opTarget = 0; formTarget = 0; },
    update(time, dt, camera) {
      holder.quaternion.copy(camera.quaternion);
      form += (formTarget - form) * Math.min(1, dt * 1.2);
      mat.opacity += (opTarget - mat.opacity) * Math.min(1, dt * 1.5);
      const e = form * form * (3 - 2 * form);
      for (let i = 0; i < n; i++) {
        const j = i * 3, w = Math.sin(time * 2 + i) * 0.015;
        pos[j] = away[j] + (home[j] - away[j]) * e + w;
        pos[j + 1] = away[j + 1] + (home[j + 1] - away[j + 1]) * e + w;
        pos[j + 2] = away[j + 2] + (home[j + 2] - away[j + 2]) * e;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// CPU particle pool for fireworks, heart bursts and candle smoke.
export class Particles {
  constructor(max = 6000, { additive = true, size = 0.1 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-9999);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? 1 : 0.5,
    }));
    this.points.frustumCulled = false;
  }
  emit(p, v, color, ttl, grav = -1.2) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.base.set([color.r, color.g, color.b], i * 3);
    this.life[i] = ttl; this.ttl[i] = ttl; this.grav[i] = grav;
  }
  firework(center, palette) {
    const c = new THREE.Color(pick(palette)), c2 = new THREE.Color(pick(palette));
    const n = 520, sp = rand(2.4, 3.8), v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      v.randomDirection().multiplyScalar(sp * rand(0.75, 1));
      this.emit(center, v, k % 3 ? c : c2, rand(1.4, 2.3), -1.1);
    }
  }
  heart(center, right, up, color = '#ff6b9a') {
    const c = new THREE.Color(color), v = new THREE.Vector3();
    for (let k = 0; k < 420; k++) {
      const t = rand(0, Math.PI * 2);
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const s = 0.085 * rand(0.92, 1.05);
      v.copy(right).multiplyScalar(x * s).addScaledVector(up, y * s);
      this.emit(center, v, c, rand(1.6, 2.2), 0);
    }
  }
  smoke(p) {
    const c = new THREE.Color('#9aa0b8'), v = new THREE.Vector3(rand(-0.06, 0.06), rand(0.35, 0.7), rand(-0.06, 0.06));
    this.emit(p, v, c, rand(1.8, 3), 0.15);
  }
  update(dt) {
    const { pos, vel, col, base, life, ttl, grav } = this;
    const drag = Math.pow(0.35, dt);
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const j = i * 3;
      if (life[i] <= 0) { pos[j + 1] = -9999; col[j] = col[j + 1] = col[j + 2] = 0; continue; }
      vel[j] *= drag; vel[j + 1] = vel[j + 1] * drag + grav[i] * dt; vel[j + 2] *= drag;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      const f = life[i] / ttl[i], a = Math.pow(f, 1.4) * (2.0 + 0.6 * Math.sin(i + life[i] * 30));
      col[j] = base[j] * a; col[j + 1] = base[j + 1] * a; col[j + 2] = base[j + 2] * a;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
