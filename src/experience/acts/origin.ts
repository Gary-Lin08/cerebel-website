import * as THREE from "three";
import { type Act, type Ctx, clamp01, damp, smooth } from "../stage";
import { loadBinary } from "../paths";

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
    uLift: { value: 0 },
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uPointer: { value: new THREE.Vector2(9, 9) },
    uGlow: { value: new THREE.Vector2(9, 9) },
    uVel: { value: new THREE.Vector2() },
    uSize: { value: 1 },
    uAspect: { value: 1 },
  };

  const load = (url: string) => loadBinary(url).then((b) => new Float32Array(b));
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
        uniform float uMorph, uStrand, uTime, uScatter, uSize, uAspect; uniform vec2 uPointer;
        attribute vec3 aHuman; attribute float aSeed;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
        ${FIBER}
        void main(){
          float stagger = aSeed * 0.5;
          float a = clamp(uStrand * 1.5 - stagger, 0.0, 1.0); a = a * a * (3.0 - 2.0 * a);
          float m = clamp(uMorph * 1.5 - stagger, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m);
          float x = clamp(uScatter * 1.5 - stagger, 0.0, 1.0); x = x * x * (3.0 - 2.0 * x);
          vec3 s = fiber(fract(aSeed * 7.31), fiberSeed(aSeed));
          s += (vec3(fract(aSeed * 91.7), fract(aSeed * 57.3), fract(aSeed * 33.1)) - 0.5) * 0.05;
          vec3 p = mix(mix(position, s, a), aHuman, m);
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
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vSeed; varying float vMix; varying float vNear; varying float vStrand; varying float vKind;
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
          gl_FragColor = vec4(col, a * alpha);
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

  // Rotation carries weight: a spring with some mass, so the scene follows the pointer late and settles.
  const spin = { y: -0.5, x: -0.08, vy: 0, vx: 0 };
  const glow = { x: 0, y: 0, vx: 0, vy: 0 };
  const last = { x: 0, y: 0 };
  const vel = { x: 0, y: 0 };

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
      group.scale.setScalar((wide ? 1.12 : 0.66) * (1 - morph * 0.2));

      const wantY = -0.5 + clamp01(hero) * 0.5 + morph * 1.1 + ctx.pointer.x * 0.55 + (ctx.reduced ? 0 : Math.sin(ctx.time * 0.2) * 0.06);
      const wantX = -0.08 - ctx.pointer.y * 0.3;
      // Heavy and over-damped: it starts late, moves slowly and settles without swinging back.
      spin.vy += ((wantY - spin.y) * 4 - spin.vy * 4.6) * dt;
      spin.vx += ((wantX - spin.x) * 4 - spin.vx * 4.6) * dt;
      spin.y += spin.vy * dt;
      spin.x += spin.vx * dt;
      world.rotation.set(spin.x, spin.y, 0);
      camera.position.set(0, 0, 11 - smooth(0, 1, hero) * 1.2);
      camera.lookAt(0, 0, 0);
    },
  };
  return act;
}
