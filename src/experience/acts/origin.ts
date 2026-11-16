import * as THREE from "three";
import { type Act, type Ctx, clamp01, damp, lerp, smooth } from "../stage";

const FIBERS = 56;
const SEGMENTS = 240;

// One fibre of the strand: two bundles wound round each other, each fibre weaving inside its bundle.
// Shared by the fibre lines, the beads on them and the particles that gather onto them.
const FIBER = /* glsl */ `
  vec3 fiber(float t, float s){
    float y = (t - 0.5) * 11.0;
    float which = step(0.5, fract(s * 3.17));
    float ph = y * 0.62 + uTime * 0.22 + which * 3.14159;
    float R = 1.2 + 0.32 * sin(y * 0.45 + 1.0);
    vec3 c = vec3(cos(ph) * R, y, sin(ph) * R);
    float a = s * 40.0 + y * (0.9 + fract(s * 7.7) * 1.8) + uTime * (0.18 + fract(s * 5.1) * 0.3);
    float rb = (0.05 + 0.36 * fract(s * 13.3)) * (0.75 + 0.25 * sin(y * 1.3 + s * 20.0));
    return c + vec3(cos(a), 0.4 * sin(a * 1.3), sin(a)) * rb;
  }
  float fiberSeed(float s){ return (floor(s * ${FIBERS}.0) + 0.5) / ${FIBERS}.0; }
`;

/** The opening: goggles with the camera unit, then a push into the unit and a burst into the cerebellum. */
export const originIntro = { start: Infinity, length: 3.9, skipped: false };
// For checking the opening by eye: experience.html?introAt=1.2 holds it at that second.
const FREEZE = typeof location !== "undefined" && new URLSearchParams(location.search).has("introAt") ? Number(new URLSearchParams(location.search).get("introAt")) : null;
const UNIT = new THREE.Vector3(0.0, 1.36, 0.3); // the camera unit's lens, in goggle space

// Goggles, strap, helmet edge and camera unit as line art, seen nearly square-on.
// Returns line segments with, per vertex, a draw-on order (0..1) and a kind:
// 0 outline, 1 camera unit, 2 speed line in the lens, 3 gate in the lens, 4 strap / helmet.
function buildGoggleLines() {
  const pos: number[] = [];
  const order: number[] = [];
  const kind: number[] = [];
  const A = 2.3;
  const B = 1.02;
  const N = 2.6;
  const lensZ = (x: number, y: number) => -0.1 * x * x + 0.08 * (1 - (y / B) * (y / B));
  const notch = (x: number) => 0.42 * Math.exp(-((x / 0.46) ** 2));
  const floor = (x: number) => -B + notch(x) * 2.2;
  const inside = (x: number, y: number) => Math.abs(x / A) ** N + Math.abs(y / B) ** N <= 1 && y > floor(x);
  // Drawn by hand, not by ruler: outlines and the figure carry a small wander.
  const wander = (x: number, y: number, k: number) => (k === 0 || k >= 4 ? Math.sin(x * 7.3 + y * 5.1 + k) * 0.014 + Math.sin(x * 19.0 - y * 13.0) * 0.006 : 0);
  const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o0: number, o1: number, k: number) => {
    pos.push(x0 + wander(x0, y0, k), y0 + wander(y0, x0, k), z0, x1 + wander(x1, y1, k), y1 + wander(y1, x1, k), z1);
    order.push(o0, o1);
    kind.push(k, k);
  };
  const outline = (grow: number, back: number, k: number, from: number) => {
    const STEPS = 220;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= STEPS; i += 1) {
      const th = (i / STEPS) * Math.PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const rad = (Math.abs(c) ** N + Math.abs(sn) ** N) ** (-1 / N);
      let x = c * rad * A;
      let y = sn * rad * B;
      if (y < 0) y = Math.max(y, floor(x));
      x *= grow;
      y *= grow;
      if (i > 0) seg(px, py, lensZ(px / grow, py / grow) - back, x, y, lensZ(x / grow, y / grow) - back, from + ((i - 1) / STEPS) * 0.4, from + (i / STEPS) * 0.4, k);
      px = x;
      py = y;
    }
  };
  outline(1, 0, 0, 0);
  outline(1.1, 0.06, 0, 0.1);
  outline(1.16, 0.3, 4, 0.2);

  // Camera unit: housing, lens rings, mount.
  const w = 0.56;
  const h = 0.28;
  const d = 0.3;
  const cz = UNIT.z;
  const corners = [[-w, -h], [w, -h], [w, h], [-w, h]];
  for (let i = 0; i < 4; i += 1) {
    const [x0, y0] = corners[i];
    const [x1, y1] = corners[(i + 1) % 4];
    seg(UNIT.x + x0, UNIT.y + y0, cz, UNIT.x + x1, UNIT.y + y1, cz, 0.45, 0.6, 1);
    seg(UNIT.x + x0, UNIT.y + y0, cz - d * 2, UNIT.x + x1, UNIT.y + y1, cz - d * 2, 0.5, 0.65, 1);
    seg(UNIT.x + x0, UNIT.y + y0, cz, UNIT.x + x0, UNIT.y + y0, cz - d * 2, 0.5, 0.62, 1);
  }
  for (const [r, o] of [[0.19, 0.6], [0.14, 0.66], [0.07, 0.72]]) {
    for (let i = 0; i < 40; i += 1) {
      const a0 = (i / 40) * 6.2832;
      const a1 = ((i + 1) / 40) * 6.2832;
      seg(UNIT.x + Math.cos(a0) * r, UNIT.y + Math.sin(a0) * r, cz + 0.02, UNIT.x + Math.cos(a1) * r, UNIT.y + Math.sin(a1) * r, cz + 0.02, o, o + 0.1, 1);
    }
  }
  seg(UNIT.x - 0.2, UNIT.y - h, cz - 0.1, UNIT.x - 0.24, B * 1.1 + 0.02, -0.02, 0.6, 0.7, 1);
  seg(UNIT.x + 0.2, UNIT.y - h, cz - 0.1, UNIT.x + 0.24, B * 1.1 + 0.02, -0.02, 0.6, 0.7, 1);

  // In the lens: speed lines fanning out from the vanishing point, a horizon, and gates coming at the rider.
  const vx = 0.1;
  const vy = 0.14;
  for (let i = 0; i < 46; i += 1) {
    const ang = Math.PI + (i / 45) * Math.PI + (i % 3) * 0.02; // the lower half: the slope
    const dx = Math.cos(ang);
    const dy = Math.sin(ang) * 0.75;
    let px = vx + dx * 0.12;
    let py = vy + dy * 0.12;
    for (let st = 1; st <= 30; st += 1) {
      const r = 0.12 + (st / 30) * 2.6;
      const x = vx + dx * r;
      const y = vy + dy * r;
      if (inside(x * 1.04, y * 1.06) && inside(px * 1.04, py * 1.06)) seg(px, py, lensZ(px, py) + 0.01, x, y, lensZ(x, y) + 0.01, (st - 1) / 30, st / 30, 2);
      px = x;
      py = y;
    }
  }
  for (let st = 0; st < 60; st += 1) {
    const x0 = -A + (st / 60) * 2 * A;
    const x1 = -A + ((st + 1) / 60) * 2 * A;
    if (inside(x0 * 1.05, vy) && inside(x1 * 1.05, vy)) seg(x0, vy, lensZ(x0, vy) + 0.01, x1, vy, lensZ(x1, vy) + 0.01, 0.7, 0.8, 0);
  }
  for (let g = 0; g < 14; g += 1) {
    const ph = (Math.floor(g / 2) + 1) / 7; // near gates are larger and further out
    const side = g % 2 === 0 ? -1 : 1;
    const x = vx + side * (0.08 + 1.75 * ph * ph);
    const top = vy + 0.08 + 0.5 * ph;
    const bottom = vy - 0.05 - 0.55 * ph;
    if (!inside(x * 1.05, top * 1.05) || !inside(x * 1.05, bottom * 1.05)) continue;
    seg(x, bottom, lensZ(x, bottom) + 0.02, x, top, lensZ(x, top) + 0.02, ph, ph, 3);
    seg(x, top, lensZ(x, top) + 0.02, x + side * -0.22 * ph, top - 0.02, lensZ(x, top) + 0.02, ph, ph, 3);
    seg(x + side * -0.22 * ph, top - 0.02, lensZ(x, top) + 0.02, x, top - 0.16 * ph, lensZ(x, top) + 0.02, ph, ph, 3);
  }

  // Strap either side and the helmet's edge above.
  for (const side of [-1, 1]) {
    for (const off of [-0.3, 0, 0.3]) {
      let px = side * 2.62;
      let pz = lensZ(2.4, 0) - 0.3;
      for (let st = 1; st <= 24; st += 1) {
        const ang = (st / 24) * 1.2;
        const x = side * (2.62 * Math.cos(ang) + 0.04);
        const z = lensZ(2.4, 0) - 0.3 - 2.9 * Math.sin(ang);
        seg(px, off, pz, x, off * (1 - st / 60), z, 0.6 + (st / 24) * 0.3, 0.6 + ((st + 1) / 24) * 0.3, 4);
        px = x;
        pz = z;
      }
    }
  }
  // The rider, in a few strokes: a curve through free points for each feature (kind 5).
  const stroke = (pts: [number, number][], from: number, z = -0.25) => {
    const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    let px = pts[0][0];
    let py = pts[0][1];
    const STEPS = (pts.length - 1) * 10;
    for (let st = 1; st <= STEPS; st += 1) {
      const f = st / 10;
      const i = Math.min(Math.floor(f), pts.length - 2);
      const t = f - i;
      const c = (a: number, b: number, cc: number, dd: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - dd) * t * t + (-a + 3 * b - 3 * cc + dd) * t * t * t);
      const x = c(at(i - 1)[0], at(i)[0], at(i + 1)[0], at(i + 2)[0]);
      const y = c(at(i - 1)[1], at(i)[1], at(i + 1)[1], at(i + 2)[1]);
      seg(px, py, z, x, y, z, from + ((st - 1) / STEPS) * 0.25, from + (st / STEPS) * 0.25, 5);
      px = x;
      py = y;
    }
  };
  stroke([[-0.16, -0.72], [-0.22, -1.2], [-0.36, -1.52], [-0.2, -1.66], [0, -1.6], [0.2, -1.66], [0.36, -1.52], [0.22, -1.2], [0.16, -0.72]], 0.55); // nose
  stroke([[-0.62, -2.12], [-0.3, -2.2], [0, -2.14], [0.3, -2.2], [0.62, -2.12]], 0.7); // mouth
  stroke([[-0.3, -2.42], [0, -2.47], [0.3, -2.42]], 0.75);
  stroke([[-2.45, -0.75], [-2.3, -1.7], [-1.75, -2.75], [-0.85, -3.4], [0, -3.55], [0.85, -3.4], [1.75, -2.75], [2.3, -1.7], [2.45, -0.75]], 0.6); // jaw
  stroke([[-1.15, -3.3], [-1.3, -4.1], [-2.3, -4.7], [-3.9, -5.1]], 0.8, -0.6); // neck and shoulder
  stroke([[1.15, -3.3], [1.3, -4.1], [2.3, -4.7], [3.9, -5.1]], 0.8, -0.6);
  stroke([[-2.75, -0.2], [-2.95, 0.9], [-2.6, 2.25], [-1.5, 3.2], [0, 3.52], [1.5, 3.2], [2.6, 2.25], [2.95, 0.9], [2.75, -0.2]], 0.5, -0.4); // helmet
  stroke([[-2.75, -0.2], [-2.85, -1.1], [-2.5, -2.0]], 0.7, -0.4);
  stroke([[2.75, -0.2], [2.85, -1.1], [2.5, -2.0]], 0.7, -0.4);
  return { pos: new Float32Array(pos), order: new Float32Array(order), kind: new Float32Array(kind) };
}

// Act 0 — the cerebellar field gathers into a woven strand, then resolves into a moving body.
// Both shapes are the precomputed surface-point buffers already shipped with the site.
export function createOrigin(): Act {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  // Everything turns together: the subject, the strand and the cloud around them.
  const world = new THREE.Group();
  const group = new THREE.Group();
  world.add(group);
  scene.add(world);

  const uniforms = {
    uMorph: { value: 0 },
    uStrand: { value: 0 },
    uShow: { value: 0 },
    uIntro: { value: 1 },
    uDraw: { value: 0 },
    uLift: { value: 0 },
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uPointer: { value: new THREE.Vector2(9, 9) },
    uGlow: { value: new THREE.Vector2(9, 9) },
    uVel: { value: new THREE.Vector2() },
    uSize: { value: 1 },
    uAspect: { value: 1 },
  };

  const load = (url: string) => fetch(url).then((r) => r.arrayBuffer()).then((b) => new Float32Array(b));
  const ready = Promise.all([
    load("/assets/cerebel-cerebellum-points.bin"),
    load("/assets/cerebel-kinetic-human-points.bin"),
  ]).then(([cerebellum, human]) => {
    const count = Math.min(cerebellum.length, human.length) / 3;
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) seeds[i] = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cerebellum, 3));
    geometry.setAttribute("aHuman", new THREE.BufferAttribute(human, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uMorph, uStrand, uTime, uScatter, uSize, uAspect, uIntro; uniform vec2 uPointer;
        attribute vec3 aHuman; attribute float aSeed;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        varying float vIntro;
        ${FIBER}
        void main(){
          float stagger = aSeed * 0.5;
          float a = clamp(uStrand * 1.5 - stagger, 0.0, 1.0); a = a * a * (3.0 - 2.0 * a);
          float m = clamp(uMorph * 1.5 - stagger, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
          float x = clamp(uScatter * 1.5 - stagger, 0.0, 1.0); x = x * x * (3.0 - 2.0 * x);
          vec3 s = fiber(fract(aSeed * 7.31), fiberSeed(aSeed));
          s += (vec3(fract(aSeed * 91.7), fract(aSeed * 57.3), fract(aSeed * 33.1)) - 0.5) * 0.05;
          // Opening: every particle waits inside the camera unit, then bursts out of its lens and lands on the cerebellum.
          float g = clamp(uIntro * 1.35 - aSeed * 0.35, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
          vec3 dir = normalize(vec3(fract(aSeed * 17.0), fract(aSeed * 29.0), fract(aSeed * 41.0)) - 0.5);
          vec3 unit = vec3(${UNIT.x.toFixed(2)}, ${UNIT.y.toFixed(2)}, ${UNIT.z.toFixed(2)});
          vec3 start = mix(position, unit + dir * 0.05, g) + dir * (2.0 + 5.0 * aSeed) * sin(g * 3.14159);
          vec3 p = mix(mix(start, s, a), aHuman, m);
          p = mix(p, s + vec3(0.0, 1.5 * x, 0.0), x);
          p += normalize(p + 0.001) * sin(uTime * 0.7 + aSeed * 18.0) * 0.02;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;
          vec2 ndc = clip.xy / clip.w;
          vec2 d = ndc - uPointer; d.x *= uAspect;
          float near = exp(-dot(d, d) * 9.0);
          float onStrand = max(a * (1.0 - m), x);
          mv.xy += normalize(d + 0.0001) * near * 0.42 * (1.0 - onStrand);
          gl_Position = projectionMatrix * mv;
          float sparkle = 1.0 + 0.7 * sin(aSeed * 74.0 + uTime * 0.5);
          gl_PointSize = max(1.5, uSize * sparkle * mix(17.0, 11.0, onStrand) / -mv.z);
          vIntro = g;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        varying float vIntro;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(q));
          vec3 cool = vec3(0.86, 0.89, 0.96);
          vec3 violet = vec3(0.61, 0.42, 1.0);
          float pick = step(0.72, fract(vSeed * 7.31));
          vec3 col = mix(cool, violet, max(pick, vNear * (1.0 - vStrand)));
          col = mix(col, violet, (1.0 - vMix) * 0.35);
          vec3 rail = mix(vec3(0.7, 0.5, 1.0), vec3(0.25, 0.95, 0.62), vKind);
          col = mix(col, mix(rail, vec3(1.0, 0.97, 0.9), vNear * 0.8), vStrand * 0.9);
          float alpha = (0.5 + 0.3 * pick + vNear * 0.6) * mix(1.0, 0.75, vStrand);
          gl_FragColor = vec4(mix(col, vec3(1.0, 0.98, 0.92), vIntro * 0.6), a * alpha * (1.0 - smoothstep(0.8, 1.0, vIntro)));
        }`,
    });
    group.add(new THREE.Points(geometry, material));
  });

  // ---- The strand itself: fine fibres drawn as lines, lit where the pointer passes.
  {
    const t: number[] = [];
    const seed: number[] = [];
    for (let i = 0; i < FIBERS; i += 1) {
      const s = (i + 0.5) / FIBERS;
      for (let j = 0; j < SEGMENTS; j += 1) {
        t.push(j / SEGMENTS, (j + 1) / SEGMENTS);
        seed.push(s, s);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(t.length * 3), 3));
    geo.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(t), 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));
    const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uShow, uLift, uAspect; uniform vec2 uGlow;
        attribute float aT; attribute float aSeed;
        varying float vNear; varying float vKind; varying float vFade; varying float vPulse;
        ${FIBER}
        void main(){
          vec3 p = fiber(aT, aSeed);
          p.y += uLift * 1.5;
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          vec2 d = clip.xy / clip.w - uGlow; d.x *= uAspect;
          vNear = exp(-dot(d, d) * 5.0);
          vKind = step(0.5, fract(aSeed * 3.17));
          // Each fibre draws itself in from one end, at its own moment.
          float reach = clamp(uShow * 1.6 - fract(aSeed * 9.7) * 0.6, 0.0, 1.0);
          vFade = smoothstep(0.0, 0.08, aT) * smoothstep(1.0, 0.92, aT) * step(aT, reach) * uShow;
          // A slow pulse of light travels along every fibre.
          vPulse = pow(0.5 + 0.5 * sin(aT * 26.0 - uTime * (1.2 + fract(aSeed * 4.3)) + aSeed * 60.0), 6.0);
          gl_Position = clip;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vNear; varying float vKind; varying float vFade; varying float vPulse;
        void main(){
          vec3 rail = mix(vec3(0.62, 0.42, 1.0), vec3(0.2, 0.9, 0.58), vKind);
          vec3 col = mix(rail, vec3(1.0, 0.96, 0.86), clamp(vNear * 0.9 + vPulse * 0.5, 0.0, 1.0));
          gl_FragColor = vec4(col, vFade * (0.2 + 0.28 * vPulse + 1.1 * vNear));
        }`,
    }));
    lines.frustumCulled = false;
    group.add(lines);

    // Beads strung on the fibres.
    const BEADS = FIBERS * 70;
    const bt = new Float32Array(BEADS);
    const bs = new Float32Array(BEADS);
    for (let i = 0; i < BEADS; i += 1) {
      bt[i] = Math.random();
      bs[i] = (Math.floor(Math.random() * FIBERS) + 0.5) / FIBERS;
    }
    const beadGeo = new THREE.BufferGeometry();
    beadGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BEADS * 3), 3));
    beadGeo.setAttribute("aT", new THREE.BufferAttribute(bt, 1));
    beadGeo.setAttribute("aSeed", new THREE.BufferAttribute(bs, 1));
    const beads = new THREE.Points(beadGeo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uShow, uLift, uAspect, uSize; uniform vec2 uGlow;
        attribute float aT; attribute float aSeed;
        varying float vNear; varying float vKind; varying float vA;
        ${FIBER}
        void main(){
          float t = fract(aT + uTime * 0.012 * (0.5 + fract(aSeed * 31.0)));
          vec3 p = fiber(t, aSeed);
          p.y += uLift * 1.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;
          vec2 d = clip.xy / clip.w - uGlow; d.x *= uAspect;
          vNear = exp(-dot(d, d) * 5.0);
          vKind = step(0.5, fract(aSeed * 3.17));
          vA = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t) * uShow * (0.4 + 0.6 * fract(aT * 91.0));
          gl_Position = clip;
          gl_PointSize = uSize * (5.0 + 16.0 * vNear + 5.0 * fract(aT * 53.0)) / -mv.z * 2.0;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vNear; varying float vKind; varying float vA;
        void main(){
          float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
          vec3 rail = mix(vec3(0.7, 0.52, 1.0), vec3(0.3, 0.95, 0.65), vKind);
          gl_FragColor = vec4(mix(rail, vec3(1.0, 0.97, 0.9), vNear), a * vA * (0.35 + vNear));
        }`,
    }));
    beads.frustumCulled = false;
    group.add(beads);
  }

  // ---- The opening's goggles, as line art that draws itself on.
  {
    const built = buildGoggleLines();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(built.pos, 3));
    geo.setAttribute("aOrder", new THREE.BufferAttribute(built.order, 1));
    geo.setAttribute("aKind", new THREE.BufferAttribute(built.kind, 1));
    const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uIntro, uDraw; attribute float aOrder; attribute float aKind;
        varying float vA; varying float vKind;
        void main(){
          vec3 p = position;
          // On the burst the drawing flies apart from the camera unit.
          float gone = 1.0 - uIntro;
          vec3 away = p - vec3(${UNIT.x.toFixed(2)}, ${UNIT.y.toFixed(2)}, ${UNIT.z.toFixed(2)});
          p += away * gone * (1.2 + 1.5 * fract(aOrder * 37.0));
          float drawn = smoothstep(aOrder * 0.75, aOrder * 0.75 + 0.2, uDraw);
          float a = drawn * uIntro * uIntro * uIntro;
          if (aKind > 1.5 && aKind < 2.5) {
            // Speed lines: dashes of light running outward from the vanishing point.
            a *= 0.12 + 0.88 * pow(0.5 + 0.5 * sin(aOrder * 16.0 - uTime * 9.0 + position.x * 3.0), 6.0);
          } else if (aKind > 2.5 && aKind < 3.5) {
            // Gates: each lights as the run reaches it, far to near, again and again.
            float ph = fract(uTime * 0.7);
            a *= smoothstep(0.16, 0.0, abs(ph - aOrder)) * (0.5 + aOrder);
          } else if (aKind > 4.5) {
            a *= 0.7;
          } else if (aKind > 3.5) {
            a *= 0.38;
          }
          vA = a;
          vKind = aKind;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; varying float vKind;
        void main(){
          vec3 c = vKind < 0.5 ? vec3(0.93, 0.95, 1.0)
            : vKind < 1.5 ? vec3(0.45, 1.0, 0.76)
            : vKind < 2.5 ? vec3(0.62, 0.9, 1.0)
            : vKind < 3.5 ? vec3(0.78, 0.56, 1.0)
            : vKind < 4.5 ? vec3(0.6, 0.55, 0.9)
            : vec3(0.9, 0.92, 1.0);
          gl_FragColor = vec4(c, vA);
        }`,
    }));
    lines.frustumCulled = false;
    lines.renderOrder = 5;
    group.add(lines);
  }

  // ---- Snow in the air while the opening plays. Nothing regular about it: every flake has its own
  // speed, fall, wobble, size and colour, and a few come past as fast streaks.
  {
    const FLAKES = 1100;
    const p0 = new Float32Array(FLAKES * 3);
    const q = new Float32Array(FLAKES * 4);
    for (let i = 0; i < FLAKES; i += 1) {
      p0.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12 + 1], i * 3);
      q.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p0, 3));
    geo.setAttribute("aQ", new THREE.BufferAttribute(q, 4));
    const snow = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uIntro, uSize; attribute vec4 aQ; varying float vA; varying float vC; varying float vSoft;
        void main(){
          vec3 p = position;
          float speed = 0.8 + 26.0 * aQ.x * aQ.x * aQ.x + 3.0 * aQ.y;         // a few fast, most slow
          float gust = 1.0 + 0.5 * sin(uTime * 0.7 + aQ.z * 6.283) * aQ.w;    // gusts hit flakes unevenly
          p.x = mod(p.x - uTime * speed * gust + 11.0, 22.0) - 11.0;
          p.y = mod(p.y - uTime * (0.3 + 2.4 * aQ.w * aQ.y) + 6.0, 12.0) - 6.0;
          p.y += sin(uTime * (0.6 + 2.2 * aQ.z) + aQ.x * 40.0) * (0.05 + 0.35 * aQ.w);
          p.z += cos(uTime * (0.4 + 1.5 * aQ.y) + aQ.z * 30.0) * 0.3 * aQ.x;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float big = pow(aQ.z, 5.0);
          gl_PointSize = uSize * (11.0 + 70.0 * big + 14.0 * aQ.w) / -mv.z;
          vSoft = big;
          vC = aQ.y;
          vA = uIntro * (0.45 + 0.75 * aQ.w) * (0.55 + 0.45 * sin(uTime * (1.0 + 4.0 * aQ.x) + aQ.y * 50.0)) * smoothstep(11.0, 8.0, abs(p.x));
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; varying float vC; varying float vSoft;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, mix(0.0, 0.35, vSoft), d);
          vec3 c = vC > 0.9 ? vec3(0.8, 0.6, 1.0) : (vC > 0.72 ? vec3(0.45, 1.0, 0.82) : (vC > 0.4 ? vec3(0.78, 0.9, 1.0) : vec3(1.0)));
          gl_FragColor = vec4(c, a * vA * mix(0.9, 0.22, vSoft));
        }`,
    }));
    snow.frustumCulled = false;
    scene.add(snow);

    const W = 46;
    const a: number[] = [];
    const end: number[] = [];
    const sd: number[] = [];
    for (let i = 0; i < W; i += 1) {
      const x = (Math.random() - 0.5) * 22;
      const y = (Math.random() - 0.5) * 9;
      const z = (Math.random() - 0.3) * 6;
      const k = Math.random();
      a.push(x, y, z, x, y, z);
      end.push(0, 1);
      sd.push(k, k);
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(a), 3));
    sgeo.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array(end), 1));
    sgeo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(sd), 1));
    const streaks = new THREE.LineSegments(sgeo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uIntro; attribute float aEnd; attribute float aSeed; varying float vA; varying float vK;
        void main(){
          vec3 p = position;
          float speed = 14.0 + 40.0 * aSeed * aSeed;
          p.x = mod(p.x - uTime * speed + 11.0, 22.0) - 11.0 + aEnd * (0.3 + 2.6 * aSeed * aSeed);
          p.y += sin(aSeed * 80.0) * 0.4 - p.x * (0.02 + 0.1 * fract(aSeed * 7.0));
          vA = (1.0 - aEnd) * uIntro * (0.15 + 0.5 * fract(aSeed * 13.0)) * smoothstep(11.0, 7.0, abs(p.x));
          vK = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; varying float vK;
        void main(){ gl_FragColor = vec4(mix(vec3(0.9, 0.96, 1.0), vec3(0.6, 0.45, 1.0), step(0.75, vK)), vA); }`,
    }));
    streaks.frustumCulled = false;
    scene.add(streaks);
  }

  // Rotation carries weight: a spring with some mass, so the scene follows the pointer late and settles.
  const spin = { y: -0.08, x: 0, vy: 0, vx: 0 };
  const glow = { x: 0, y: 0, vx: 0, vy: 0 };
  const last = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };
  const unitWorld = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  const act: Act = {
    scene,
    camera,
    ready,
    offset: { x: 0, y: 0 },
    bg: [0x0d0722, 0x050507, 0x1d0f52],
    tint: [0x9b6cff, 0x39e6b0],
    update(ctx: Ctx) {
      const wide = ctx.aspect > 1.05;
      const hero = ctx.local("hero");
      const legible = ctx.local("legible");
      const strand = smooth(0.0, 0.32, legible);
      const morph = smooth(0.46, 0.76, legible);
      const scatter = smooth(0.9, 1.14, legible);
      uniforms.uMorph.value = morph;
      uniforms.uStrand.value = strand;
      uniforms.uScatter.value = scatter;
      uniforms.uShow.value = Math.max(smooth(0.5, 1.0, strand) * (1 - smooth(0.0, 0.7, morph)), smooth(0.35, 1.0, scatter));
      uniforms.uLift.value = scatter;
      uniforms.uTime.value = ctx.reduced ? 0 : ctx.time;
      uniforms.uAspect.value = ctx.aspect;
      uniforms.uSize.value = (wide ? 1.5 : 1.15) * Math.min(window.devicePixelRatio || 1, 1.5);

      const dt = Math.min(ctx.dt, 0.033);
      const px = ctx.pointer.x - act.offset!.x * 2;
      const py = ctx.pointer.y - act.offset!.y * 2;
      uniforms.uPointer.value.set(px, py);
      // The light trails the pointer on its own spring.
      glow.vx += ((px - glow.x) * 9 - glow.vx * 6.6) * dt;
      glow.vy += ((py - glow.y) * 9 - glow.vy * 6.6) * dt;
      glow.x += glow.vx * dt;
      glow.y += glow.vy * dt;
      uniforms.uGlow.value.set(glow.x, glow.y);
      // Pointer speed, smoothed, leans the cloud.
      vel.x = damp(vel.x, (ctx.pointer.x - last.x) / dt, 6, dt);
      vel.y = damp(vel.y, (ctx.pointer.y - last.y) / dt, 6, dt);
      last.x = ctx.pointer.x;
      last.y = ctx.pointer.y;
      uniforms.uVel.value.set(THREE.MathUtils.clamp(vel.x, -2, 2) * 0.35, THREE.MathUtils.clamp(vel.y, -2, 2) * 0.35);

      // Centre behind the headline on the hero, then step right so the copy has room.
      const targetX = wide ? 0.06 + 0.16 * smooth(0.5, 1.0, hero) : 0;
      act.offset!.x = damp(act.offset!.x, targetX, 4, ctx.dt);
      act.offset!.y = wide ? 0 : 0.14;
      group.scale.setScalar((wide ? 1.12 : 0.66) * (1 - morph * 0.2) * (1 - 0.3 * uniforms.uIntro.value));

      // Opening clock: hold on the goggles, push into the camera unit, burst into the cerebellum.
      if ((hero > 0.2 || ctx.reduced) && FREEZE === null) originIntro.skipped = true;
      const e = FREEZE !== null ? FREEZE : originIntro.skipped ? 99 : ctx.time - originIntro.start;
      const intro = e < 0 ? 1 : 1 - smooth(2.7, originIntro.length, e);
      const push = e < 0 ? 0 : smooth(1.5, 2.9, e) * (1 - smooth(2.9, 3.5, e));
      uniforms.uIntro.value = intro;
      uniforms.uDraw.value = e < 0 ? 0 : Math.min(1.4, e / 0.9);

      const wantY = lerp(-0.5 + clamp01(hero) * 0.5 + morph * 1.1, -0.08, intro) + ctx.pointer.x * lerp(0.55, 0.12, intro) + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.2) * 0.06);
      const wantX = lerp(-0.08, 0.0, intro) - ctx.pointer.y * lerp(0.3, 0.08, intro);
      // Heavy and over-damped: it starts late, moves slowly and settles without swinging back.
      spin.vy += ((wantY - spin.y) * 4 - spin.vy * 4.6) * dt;
      spin.vx += ((wantX - spin.x) * 4 - spin.vx * 4.6) * dt;
      spin.y += spin.vy * dt;
      spin.x += spin.vx * dt;
      world.rotation.set(spin.x, spin.y, 0);
      world.updateMatrixWorld(true);
      unitWorld.copy(UNIT).applyMatrix4(group.matrixWorld);
      camera.position.set(0, 0, 11 - smooth(0, 1, hero) * 1.2);
      camera.position.lerp(lookAt.copy(unitWorld).add(new THREE.Vector3(0, 0, 0.9)), push);
      camera.lookAt(lookAt.set(0, 0, 0).lerp(unitWorld, push));
    },
  };
  return act;
}
