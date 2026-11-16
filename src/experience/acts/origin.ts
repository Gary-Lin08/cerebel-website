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

// The opening's rider as strips of light: a visor outline, the camera unit clipped above it, a helmet
// edge and strap, and inside the visor the run reflected as moving bars. Clean geometry, nothing drawn
// by hand. Each strip is a ribbon with a bright core and a soft halo across its width.
// Kinds: 0 visor outline, 1 camera unit, 2 speed bar, 3 gate, 4 helmet / strap, 5 sheen across the visor.
function buildLightStrips() {
  const position: number[] = [];
  const normal: number[] = [];
  const side: number[] = [];
  const along: number[] = [];
  const kind: number[] = [];
  const order: number[] = [];
  const width: number[] = [];
  const index: number[] = [];
  const A = 2.3;
  const B = 1.02;
  const N = 2.6;
  const lensZ = (x: number, y: number) => -0.1 * x * x + 0.08 * (1 - (y / B) * (y / B));
  const notch = (x: number) => 0.42 * Math.exp(-((x / 0.46) ** 2));
  const floor = (x: number) => -B + notch(x) * 2.2;
  const inside = (x: number, y: number) => Math.abs(x / A) ** N + Math.abs(y / B) ** N <= 1 && y > floor(x);

  const ribbon = (pts: [number, number, number][], w: number, k: number, o: number) => {
    const base = position.length / 3;
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      const q0 = pts[Math.max(0, i - 1)];
      const q1 = pts[Math.min(pts.length - 1, i + 1)];
      const tx = q1[0] - q0[0];
      const ty = q1[1] - q0[1];
      const len = Math.hypot(tx, ty) || 1;
      for (const sd of [-1, 1]) {
        position.push(p[0], p[1], p[2]);
        normal.push(-ty / len, tx / len);
        side.push(sd);
        along.push(i / (pts.length - 1));
        kind.push(k);
        order.push(o);
        width.push(w);
      }
      if (i > 0) {
        const a = base + (i - 1) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  };
  const visor = (grow: number, back: number): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 260; i += 1) {
      const th = (i / 260) * Math.PI * 2 + Math.PI / 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const rad = (Math.abs(c) ** N + Math.abs(sn) ** N) ** (-1 / N);
      const x = c * rad * A;
      let y = sn * rad * B;
      if (y < 0) y = Math.max(y, floor(x));
      pts.push([x * grow, y * grow, lensZ(x, y) - back]);
    }
    return pts;
  };
  ribbon(visor(1.06, 0), 0.26, 0, 0);
  ribbon(visor(0.93, -0.02), 0.07, 4, 0.2);

  // Camera unit: a rounded housing and two lens rings.
  const round = (cx: number, cy: number, w: number, h: number, r: number, z: number): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    const corners: [number, number, number][] = [[w - r, h - r, 0], [-(w - r), h - r, 1], [-(w - r), -(h - r), 2], [w - r, -(h - r), 3]];
    for (const [x, y, q] of corners) {
      for (let i = 0; i <= 10; i += 1) {
        const ang = (q + i / 10) * (Math.PI / 2);
        pts.push([cx + x + Math.cos(ang) * r, cy + y + Math.sin(ang) * r, z]);
      }
    }
    pts.push(pts[0]);
    return pts;
  };
  const ring = (cx: number, cy: number, r: number, z: number): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i += 1) pts.push([cx + Math.cos((i / 64) * 6.2832) * r, cy + Math.sin((i / 64) * 6.2832) * r, z]);
    return pts;
  };
  ribbon(round(UNIT.x, UNIT.y, 0.62, 0.3, 0.12, UNIT.z), 0.13, 1, 0.35);
  ribbon(ring(UNIT.x, UNIT.y, 0.17, UNIT.z + 0.02), 0.1, 1, 0.5);
  ribbon(ring(UNIT.x, UNIT.y, 0.07, UNIT.z + 0.02), 0.07, 1, 0.56);
  ribbon([[UNIT.x, UNIT.y - 0.3, UNIT.z - 0.05], [UNIT.x, B * 1.06, 0]], 0.09, 1, 0.45);

  // Inside the visor: bars of light running out from the vanishing point, and gates coming at the rider.
  const vx = 0.0;
  const vy = 0.1;
  for (let i = 0; i < 18; i += 1) {
    const ang = Math.PI * (1.04 + (i / 17) * 0.92);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang) * 0.8;
    const pts: [number, number, number][] = [];
    for (let st = 0; st <= 26; st += 1) {
      const r = 0.2 + (st / 26) * 2.7;
      const x = vx + dx * r;
      const y = vy + dy * r;
      if (!inside(x * 1.1, y * 1.12)) break;
      pts.push([x, y, lensZ(x, y) + 0.01]);
    }
    if (pts.length > 3) ribbon(pts, 0.05, 2, i / 18);
  }
  for (let g = 0; g < 10; g += 1) {
    const ph = (Math.floor(g / 2) + 1) / 5;
    const sd = g % 2 === 0 ? -1 : 1;
    const x = vx + sd * (0.1 + 1.7 * ph * ph);
    const top = vy + 0.1 + 0.55 * ph;
    const bottom = vy - 0.05 - 0.5 * ph;
    if (!inside(x * 1.1, top * 1.1) || !inside(x * 1.1, bottom * 1.1)) continue;
    ribbon([[x, bottom, lensZ(x, bottom) + 0.02], [x, top, lensZ(x, top) + 0.02]], 0.05 + 0.05 * ph, 3, ph);
  }
  // A sheen that sweeps the upper visor.
  for (const y of [0.42, 0.6, 0.76]) {
    const pts: [number, number, number][] = [];
    for (let st = 0; st <= 60; st += 1) {
      const x = -A + (st / 60) * 2 * A;
      if (inside(x * 1.08, y * 1.08)) pts.push([x, y - x * x * 0.03, lensZ(x, y) + 0.01]);
    }
    if (pts.length > 3) ribbon(pts, 0.045, 5, y);
  }

  // Helmet edge above and a strap on each side.
  const helmet: [number, number, number][] = [];
  for (let st = 0; st <= 80; st += 1) {
    const th = -1.9 + (st / 80) * 3.8;
    helmet.push([2.95 * Math.sin(th), 0.55 + 2.95 * Math.cos(th) * (th * th < 2.4 ? 1 : 1), -0.45]);
  }
  ribbon(helmet, 0.16, 4, 0.4);
  for (const sd of [-1, 1]) {
    const pts: [number, number, number][] = [];
    for (let st = 0; st <= 20; st += 1) pts.push([sd * (2.5 + (st / 20) * 0.5), 0.02 - (st / 20) * 0.1, -0.2 - (st / 20) * 0.3]);
    ribbon(pts, 0.34, 4, 0.5);
  }
  return {
    position: new Float32Array(position), normal: new Float32Array(normal), side: new Float32Array(side), along: new Float32Array(along),
    kind: new Float32Array(kind), order: new Float32Array(order), width: new Float32Array(width), index,
  };
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

  // ---- The opening's rider, in strips of light.
  {
    const built = buildLightStrips();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(built.position, 3));
    geo.setAttribute("aNormal", new THREE.BufferAttribute(built.normal, 2));
    geo.setAttribute("aSide", new THREE.BufferAttribute(built.side, 1));
    geo.setAttribute("aAlong", new THREE.BufferAttribute(built.along, 1));
    geo.setAttribute("aKind", new THREE.BufferAttribute(built.kind, 1));
    geo.setAttribute("aOrder", new THREE.BufferAttribute(built.order, 1));
    geo.setAttribute("aWidth", new THREE.BufferAttribute(built.width, 1));
    geo.setIndex(built.index);
    const strips = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uIntro, uDraw;
        attribute vec2 aNormal; attribute float aSide, aAlong, aKind, aOrder, aWidth;
        varying float vSide; varying float vAlong; varying float vKind; varying float vOrder; varying float vShow;
        void main(){
          vec3 p = position;
          p.xy += aNormal * aSide * aWidth;
          // On the burst the strips open outward from the camera unit and go out.
          float gone = 1.0 - uIntro;
          p += (p - vec3(${UNIT.x.toFixed(2)}, ${UNIT.y.toFixed(2)}, ${UNIT.z.toFixed(2)})) * gone * 1.6;
          vSide = aSide; vAlong = aAlong; vKind = aKind; vOrder = aOrder;
          // Each strip switches on in turn and its light runs along it.
          vShow = smoothstep(aOrder * 0.6 + aAlong * 0.35, aOrder * 0.6 + aAlong * 0.35 + 0.12, uDraw) * uIntro * uIntro * uIntro;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        varying float vSide; varying float vAlong; varying float vKind; varying float vOrder; varying float vShow;
        void main(){
          float v = vSide * vSide;
          // A tight bright core inside a wide soft halo.
          float core = exp(-v * 60.0);
          float halo = exp(-v * 4.0) * 0.5;
          vec3 col; float a = 1.0;
          if (vKind < 0.5) {
            col = mix(vec3(0.62, 0.44, 1.0), vec3(0.35, 0.95, 1.0), 0.5 + 0.5 * sin(vAlong * 6.2832 + 1.0));
            a = 0.7 + 1.3 * pow(0.5 + 0.5 * sin((vAlong - uTime * 0.22) * 6.2832), 10.0); // a highlight circling the visor
          } else if (vKind < 1.5) {
            col = vec3(0.4, 1.0, 0.78);
            a = 0.9 + 0.5 * sin(uTime * 4.0);
          } else if (vKind < 2.5) {
            col = vec3(0.6, 0.9, 1.0);
            a = 0.08 + 1.2 * pow(0.5 + 0.5 * sin(vAlong * 9.0 - uTime * 9.0 + vOrder * 40.0), 6.0) * (0.3 + vAlong); // dashes racing outward
          } else if (vKind < 3.5) {
            col = vec3(0.8, 0.58, 1.0);
            a = smoothstep(0.2, 0.0, abs(fract(uTime * 0.6) - vOrder)) * (0.6 + vOrder) * 1.6; // gates light far to near
          } else if (vKind < 4.5) {
            col = vec3(0.5, 0.46, 0.95);
            a = 0.42 * smoothstep(0.0, 0.12, vAlong) * smoothstep(1.0, 0.88, vAlong);
          } else {
            col = vec3(1.0);
            a = 0.9 * exp(-pow((vAlong - fract(uTime * 0.35 + vOrder)) * 5.0, 2.0)) * smoothstep(0.0, 0.1, vAlong) * smoothstep(1.0, 0.9, vAlong);
          }
          gl_FragColor = vec4(col * (core + halo) + vec3(1.0) * core * 0.6, (core + halo) * a * vShow);
        }`,
    }));
    strips.frustumCulled = false;
    strips.renderOrder = 5;
    group.add(strips);
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
      group.scale.setScalar((wide ? 1.12 : 0.66) * (1 - morph * 0.2) * (1 - 0.04 * uniforms.uIntro.value));

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
