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

// Goggles, strap, helmet edge and camera unit as a point cloud. Returns position, part id and lens uv per point.
function buildGoggles(count: number) {
  const pos = new Float32Array(count * 3);
  const part = new Float32Array(count);
  const uv = new Float32Array(count * 2);
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const A = 2.3;
  const B = 1.02;
  const N = 2.6;
  const lensZ = (x: number, y: number) => -0.17 * x * x + 0.14 * (1 - (y / B) * (y / B));
  const notch = (x: number) => 0.42 * Math.exp(-((x / 0.46) ** 2));
  const inside = (x: number, y: number) => Math.abs(x / A) ** N + Math.abs(y / B) ** N <= 1 && y > -B + notch(x) * 2.2 - 0.02;
  const put = (i: number, x: number, y: number, z: number, id: number, u = 0, v = 0) => {
    pos.set([x, y, z], i * 3);
    part[i] = id;
    uv.set([u, v], i * 2);
  };
  for (let i = 0; i < count; i += 1) {
    const pick = i / count;
    if (pick < 0.4) {
      // Lens
      let x = 0;
      let y = 0;
      do {
        x = (rnd() * 2 - 1) * A;
        y = (rnd() * 2 - 1) * B;
      } while (!inside(x, y));
      put(i, x, y, lensZ(x, y), 0, x / A, y / B);
    } else if (pick < 0.62) {
      // Frame: a band round the lens with some depth behind it
      const th = rnd() * 6.283;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const rad = (Math.abs(c) ** N + Math.abs(sn) ** N) ** (-1 / N);
      let x = c * rad * A;
      let y = sn * rad * B;
      if (y < 0) y = Math.max(y, -B + notch(x) * 2.2);
      const grow = 1.02 + rnd() * 0.13;
      x *= grow;
      y *= grow;
      put(i, x, y, lensZ(x / grow, y / grow) - rnd() * 0.42, 1);
    } else if (pick < 0.78) {
      // Strap, running back round the head on both sides
      const side = rnd() < 0.5 ? -1 : 1;
      const t = rnd();
      const ang = t * 1.45;
      put(i, side * (2.55 * Math.cos(ang) + 0.05), (rnd() - 0.5) * 0.62, lensZ(2.4, 0) - 0.3 - 2.9 * Math.sin(ang), 2, t, 0);
    } else if (pick < 0.9) {
      // Camera unit: a small housing clipped to the top of the frame, with a lens ring and a mount
      const r = rnd();
      if (r < 0.34) {
        const ang = rnd() * 6.283;
        const rad = rnd() < 0.6 ? 0.17 : rnd() * 0.17;
        put(i, UNIT.x + Math.cos(ang) * rad, UNIT.y + Math.sin(ang) * rad, UNIT.z + 0.02, 3, 1, 0);
      } else if (r < 0.9) {
        const w = 0.52;
        const h = 0.27;
        const d = 0.3;
        const face = Math.floor(rnd() * 6);
        const a = rnd() * 2 - 1;
        const b = rnd() * 2 - 1;
        const q = face < 2 ? [face ? w : -w, a * h, b * d] : face < 4 ? [a * w, face === 2 ? h : -h, b * d] : [a * w, b * h, face === 4 ? d : -d];
        put(i, UNIT.x + q[0], UNIT.y + q[1], UNIT.z - d + q[2], 3, 0, 0);
      } else {
        put(i, UNIT.x + (rnd() - 0.5) * 0.3, UNIT.y - 0.27 - rnd() * 0.14, UNIT.z - 0.3 + (rnd() - 0.5) * 0.3, 3, 0, 0);
      }
    } else {
      // Helmet edge above, and the line of a cheek below
      if (rnd() < 0.7) {
        const th = (rnd() - 0.5) * 2.5;
        const ph = 0.42 + rnd() * 0.75;
        put(i, 3.0 * Math.sin(th) * Math.cos(ph), 0.35 + 3.0 * Math.sin(ph), -2.55 + 3.0 * Math.cos(th) * Math.cos(ph), 4);
      } else {
        const th = (rnd() - 0.5) * 1.9;
        const dn = rnd();
        put(i, 2.2 * Math.sin(th) * (1 - dn * 0.25), -1.15 - dn * 1.25, -2.0 + 2.25 * Math.cos(th) * (1 - dn * 0.12), 4);
      }
    }
  }
  return { pos, part, uv };
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
    const goggles = buildGoggles(count);
    geometry.setAttribute("aGoggle", new THREE.BufferAttribute(goggles.pos, 3));
    geometry.setAttribute("aPart", new THREE.BufferAttribute(goggles.part, 1));
    geometry.setAttribute("aUv", new THREE.BufferAttribute(goggles.uv, 2));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uMorph, uStrand, uTime, uScatter, uSize, uAspect, uIntro; uniform vec2 uPointer;
        attribute vec3 aHuman; attribute vec3 aGoggle; attribute float aSeed; attribute float aPart; attribute vec2 aUv;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        varying float vIntro; varying vec3 vTone;
        // What the lens shows: the slope rushing past, gates coming at the rider, a low sun.
        vec3 reflection(vec2 uv, float t){
          vec2 vp = vec2(0.05, 0.16);
          vec2 d = uv - vp;
          float r = length(d);
          float ang = atan(d.y, d.x);
          float sky = smoothstep(vp.y - 0.05, 0.95, uv.y);
          vec3 col = mix(vec3(0.34, 0.8, 0.86), vec3(0.42, 0.26, 0.95), sky) * 0.55;
          float ground = 1.0 - smoothstep(vp.y - 0.04, vp.y + 0.04, uv.y);
          float rush = pow(0.5 + 0.5 * sin(log(r + 0.03) * 10.0 - t * 11.0 + sin(ang * 6.0) * 1.4), 4.0);
          col += ground * rush * vec3(0.8, 1.0, 1.0) * 0.9;
          for (int k = 0; k < 3; k++) {
            float ph = fract(t * 0.55 + float(k) * 0.333);
            float side = mod(float(k), 2.0) < 0.5 ? -1.0 : 1.0;
            float gx = vp.x + side * (0.05 + 1.1 * ph * ph);
            float tall = 0.1 + 0.9 * ph;
            float bar = smoothstep(0.02 + 0.05 * ph, 0.0, abs(uv.x - gx)) * step(vp.y - tall * 0.7, uv.y) * step(uv.y, vp.y + tall * 0.6);
            col += bar * (side < 0.0 ? vec3(0.75, 0.5, 1.0) : vec3(0.3, 1.0, 0.7)) * (0.4 + ph);
          }
          col += exp(-dot(uv - vec2(-0.5, 0.62), uv - vec2(-0.5, 0.62)) * 26.0) * vec3(1.0, 0.95, 0.85) * 1.6;
          col += pow(max(0.0, 1.0 - abs(uv.y - 0.74 + uv.x * 0.2) * 9.0), 3.0) * 0.5;
          return col;
        }
        ${FIBER}
        void main(){
          float stagger = aSeed * 0.5;
          float a = clamp(uStrand * 1.5 - stagger, 0.0, 1.0); a = a * a * (3.0 - 2.0 * a);
          float m = clamp(uMorph * 1.5 - stagger, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
          float x = clamp(uScatter * 1.5 - stagger, 0.0, 1.0); x = x * x * (3.0 - 2.0 * x);
          vec3 s = fiber(fract(aSeed * 7.31), fiberSeed(aSeed));
          s += (vec3(fract(aSeed * 91.7), fract(aSeed * 57.3), fract(aSeed * 33.1)) - 0.5) * 0.05;
          // Opening: every particle starts as part of the goggles, then bursts out and lands on the cerebellum.
          float g = clamp(uIntro * 1.35 - aSeed * 0.35, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
          vec3 flung = normalize(aGoggle - vec3(0.0, 1.3, 0.3) + (vec3(fract(aSeed * 17.0), fract(aSeed * 29.0), fract(aSeed * 41.0)) - 0.5)) * (2.0 + 5.0 * aSeed);
          vec3 start = mix(position, aGoggle, g) + flung * sin(g * 3.14159) * (1.0 - step(0.999, uIntro));
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
          gl_PointSize = max(1.5, uSize * sparkle * mix(mix(17.0, 11.0, onStrand), aPart < 0.5 ? 19.0 : (aPart < 3.5 ? 15.0 : 11.0), g) / -mv.z);
          vIntro = g;
          vTone = aPart < 0.5 ? reflection(aUv, uTime) * 2.1
            : aPart < 1.5 ? vec3(0.95, 0.97, 1.0)
            : aPart < 2.5 ? mix(vec3(0.5, 0.36, 0.95), vec3(0.2, 0.85, 0.6), step(0.5, fract(aUv.x * 6.0)))
            : aPart < 3.5 ? mix(vec3(0.85, 0.9, 1.0), vec3(0.3, 1.0, 0.72), aUv.x) * (1.0 + aUv.x * (0.6 + 0.6 * sin(uTime * 6.0)))
            : vec3(0.5, 0.5, 0.75);
          vSeed = aSeed; vMix = m; vNear = near; vStrand = onStrand;
          vKind = step(0.5, fract(fiberSeed(aSeed) * 3.17));
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        varying float vIntro; varying vec3 vTone;
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
          gl_FragColor = vec4(mix(col, vTone, vIntro), a * mix(alpha, 0.95, vIntro));
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

  // Wind: streaks of light and flecks of snow tearing past the goggles while the opening plays.
  {
    const W = 220;
    const a: number[] = [];
    const end: number[] = [];
    const sd: number[] = [];
    for (let i = 0; i < W; i += 1) {
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 7;
      const z = (Math.random() - 0.3) * 5;
      const k = Math.random();
      a.push(x, y, z, x, y, z);
      end.push(0, 1);
      sd.push(k, k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(a), 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array(end), 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(sd), 1));
    const wind = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uIntro; attribute float aEnd; attribute float aSeed; varying float vA; varying float vK;
        void main(){
          vec3 p = position;
          float speed = 9.0 + aSeed * 16.0;
          p.x = mod(p.x - uTime * speed + 8.0, 16.0) - 8.0 + aEnd * (0.5 + aSeed * 1.8);
          p.y += sin(p.x * 0.6 + aSeed * 30.0) * 0.12 - p.x * 0.05;
          vA = (1.0 - aEnd) * uIntro * (0.25 + 0.6 * aSeed) * smoothstep(8.0, 5.0, abs(p.x));
          vK = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; varying float vK;
        void main(){ gl_FragColor = vec4(mix(vec3(0.85, 0.95, 1.0), vec3(0.6, 0.45, 1.0), step(0.7, vK)), vA); }`,
    }));
    wind.frustumCulled = false;
    scene.add(wind);
  }

  // Rotation carries weight: a spring with some mass, so the scene follows the pointer late and settles.
  const spin = { y: -0.5, x: -0.08, vy: 0, vx: 0 };
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
      glow.vx += ((px - glow.x) * 26 - glow.vx * 4.6) * dt;
      glow.vy += ((py - glow.y) * 26 - glow.vy * 4.6) * dt;
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
      group.scale.setScalar((wide ? 1.12 : 0.66) * (1 - morph * 0.2) * (1 + 0.28 * uniforms.uIntro.value));

      // Opening clock: hold on the goggles, push into the camera unit, burst into the cerebellum.
      if ((hero > 0.2 || ctx.reduced) && FREEZE === null) originIntro.skipped = true;
      const e = FREEZE !== null ? FREEZE : originIntro.skipped ? 99 : ctx.time - originIntro.start;
      const intro = e < 0 ? 1 : 1 - smooth(2.7, originIntro.length, e);
      const push = e < 0 ? 0 : smooth(1.5, 2.9, e) * (1 - smooth(2.9, 3.5, e));
      uniforms.uIntro.value = intro;

      const wantY = lerp(-0.5 + clamp01(hero) * 0.5 + morph * 1.1, -0.42, intro) + ctx.pointer.x * lerp(0.55, 0.25, intro) + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.2) * 0.06);
      const wantX = lerp(-0.08, 0.06, intro) - ctx.pointer.y * 0.3;
      // Low stiffness and light damping: it starts late, overshoots a little and settles back.
      spin.vy += ((wantY - spin.y) * 8 - spin.vy * 2.5) * dt;
      spin.vx += ((wantX - spin.x) * 8 - spin.vx * 2.5) * dt;
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
